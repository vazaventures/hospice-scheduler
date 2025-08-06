// Centralized Data Manager for Hospice Scheduler
// Handles all data operations with proper persistence and synchronization

import { getSampleData } from './sampleData.js';

class DataManager {
  constructor() {
    this.subscribers = new Set();
    this.data = {
      patients: [],
      visits: [],
      staff: [],
      alerts: []
    };
    this.isDemo = false;
    this.simulatedDate = new Date(); // For date simulation
  }

  // Initialize data manager
  async initialize(token) {
    // Check environment variable first, then fallback to token check
    const envDemo = import.meta?.env?.VITE_IS_DEMO === 'true';
    this.isDemo = envDemo || token === 'DEMO_TOKEN';
    this.token = token;
    
    if (this.isDemo) {
      this.loadDemoData();
    } else {
      await this.loadFromAPI(token);
    }
    
    this.notifySubscribers();
  }

  // Load demo data from localStorage
  loadDemoData() {
    this.data.patients = JSON.parse(localStorage.getItem('hospice-patients') || '[]');
    this.data.visits = JSON.parse(localStorage.getItem('hospice-visits') || '[]');
    this.data.staff = JSON.parse(localStorage.getItem('hospice-staff') || '[]');
    this.data.alerts = JSON.parse(localStorage.getItem('hospice-alerts') || '[]');
    
    // If no data exists, create fresh sample data
    if (this.data.patients.length === 0 || this.data.visits.length === 0 || this.data.staff.length === 0) {
      console.log('📝 No demo data found - creating fresh sample data');
      this.createFreshSampleData();
    }
  }

  // Load data from API
  async loadFromAPI(token) {
    try {
      const [patientsRes, visitsRes, staffRes, alertsRes] = await Promise.all([
        fetch('/api/patients', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/visits', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/staff', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/alerts', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      this.data.patients = await patientsRes.json();
      this.data.visits = await visitsRes.json();
      this.data.staff = await staffRes.json();
      this.data.alerts = await alertsRes.json();
    } catch (error) {
      console.error('Failed to load data from API:', error);
      // Fallback to demo data
      this.loadDemoData();
    }
  }

  // Save data
  async saveData() {
    if (this.isDemo) {
      localStorage.setItem('hospice-patients', JSON.stringify(this.data.patients));
      localStorage.setItem('hospice-visits', JSON.stringify(this.data.visits));
      localStorage.setItem('hospice-staff', JSON.stringify(this.data.staff));
      localStorage.setItem('hospice-alerts', JSON.stringify(this.data.alerts));
    } else {
      // Save to API
      await this.saveToAPI();
    }
    
    this.notifySubscribers();
  }

  // Save to API (Note: This bulk save method is not used in normal operations)
  async saveToAPI() {
    console.warn('saveToAPI: Bulk save method called - this should not be used in normal operations');
    // This method is kept for compatibility but should not be used
    // Individual CRUD operations should use the specific methods below
  }

  // Get API base URL
  getApiUrl() {
    return import.meta?.env?.VITE_API_URL || 'http://localhost:4000/api';
  }

  // Get auth headers
  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  }

  // Subscribe to data changes
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // Notify all subscribers
  notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.data));
  }

  // Get all data
  getData() {
    return this.data;
  }

  // PATIENT OPERATIONS
  async updatePatient(patientId, updates) {
    const index = this.data.patients.findIndex(p => p.id === patientId);
    if (index !== -1) {
      this.data.patients[index] = { ...this.data.patients[index], ...updates };
      await this.saveData();
      
      // Regenerate visits for this patient
      await this.regenerateVisitsForPatient(patientId);
    }
  }

  async createPatient(patientData) {
    const newPatient = {
      id: `p${Date.now()}`,
      ...patientData,
      visitStatus: 'pending',
      lastRNVisitDate: null
    };
    this.data.patients.push(newPatient);
    await this.saveData();
    return newPatient;
  }

  async deletePatient(patientId) {
    this.data.patients = this.data.patients.filter(p => p.id !== patientId);
    this.data.visits = this.data.visits.filter(v => v.patientId !== patientId);
    await this.saveData();
  }

  // VISIT OPERATIONS
  async updateVisit(visitId, updates) {
    if (this.isDemo) {
      // Demo mode - use localStorage
      const index = this.data.visits.findIndex(v => v.id === visitId);
      if (index !== -1) {
        this.data.visits[index] = { ...this.data.visits[index], ...updates };
        await this.saveData();
        this.notifySubscribers();
      }
    } else {
      // Live mode - use API
      try {
        const visit = this.data.visits.find(v => v.id === visitId);
        if (!visit) throw new Error('Visit not found');

        const updatedVisit = { ...visit, ...updates };
        const response = await fetch(`${this.getApiUrl()}/visits/${visitId}`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            patientId: updatedVisit.patientId,
            date: updatedVisit.date,
            staff: updatedVisit.staff,
            discipline: updatedVisit.discipline,
            type: updatedVisit.visitType || updatedVisit.type,
            tags: updatedVisit.tags || [],
            completed: updatedVisit.completed || false,
            notes: updatedVisit.notes || ''
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to update visit: ${response.statusText}`);
        }

        // Update local data
        const index = this.data.visits.findIndex(v => v.id === visitId);
        if (index !== -1) {
          this.data.visits[index] = { ...this.data.visits[index], ...updates };
        }
        
        this.notifySubscribers();
      } catch (error) {
        console.error('Error updating visit:', error);
        throw error;
      }
    }
  }

  async createVisit(visitData) {
    const newVisit = {
      id: `v${Date.now()}`,
      ...visitData,
      completed: false,
      status: visitData.status || 'suggested', // Default to suggested if not specified
      visitType: visitData.visitType || 'routine',
      tags: visitData.tags || [],
      notes: visitData.notes || '',
      overLimit: visitData.overLimit || false
    };
    
    // Ensure PRN visits are always confirmed
    if (visitData.tags && visitData.tags.includes('prn')) {
      newVisit.status = 'confirmed';
    }

    if (this.isDemo) {
      // Demo mode - use localStorage
      this.data.visits.push(newVisit);
      await this.saveData();
      this.notifySubscribers();
    } else {
      // Live mode - use API
      try {
        const response = await fetch(`${this.getApiUrl()}/visits`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            id: newVisit.id,
            patientId: newVisit.patientId,
            date: newVisit.date,
            staff: newVisit.staff,
            discipline: newVisit.discipline,
            type: newVisit.visitType,
            tags: newVisit.tags,
            completed: newVisit.completed,
            notes: newVisit.notes
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to create visit: ${response.statusText}`);
        }

        // Add to local data
        this.data.visits.push(newVisit);
        this.notifySubscribers();
      } catch (error) {
        console.error('Error creating visit:', error);
        throw error;
      }
    }
    
    return newVisit;
  }

  async deleteVisit(visitId) {
    if (this.isDemo) {
      // Demo mode - use localStorage
      this.data.visits = this.data.visits.filter(v => v.id !== visitId);
      await this.saveData();
    } else {
      // Live mode - use API
      try {
        const response = await fetch(`${this.getApiUrl()}/visits/${visitId}`, {
          method: 'DELETE',
          headers: this.getAuthHeaders()
        });

        if (!response.ok) {
          throw new Error(`Failed to delete visit: ${response.statusText}`);
        }

        // Remove from local data
        this.data.visits = this.data.visits.filter(v => v.id !== visitId);
        this.notifySubscribers();
      } catch (error) {
        console.error('Error deleting visit:', error);
        throw error;
      }
    }
  }

  // STAFF OPERATIONS
  async updateStaff(staffId, updates) {
    const index = this.data.staff.findIndex(s => s.id === staffId);
    if (index !== -1) {
      this.data.staff[index] = { ...this.data.staff[index], ...updates };
      await this.saveData();
    }
  }

  async createStaff(staffData) {
    const newStaff = {
      id: `s${Date.now()}`,
      ...staffData,
      active: true
    };
    this.data.staff.push(newStaff);
    await this.saveData();
    return newStaff;
  }

  async deleteStaff(staffId) {
    this.data.staff = this.data.staff.filter(s => s.id !== staffId);
    await this.saveData();
  }

  // SCHEDULING OPERATIONS
  async assignStaffToPatient(patientId, assignments) {
    const patient = this.data.patients.find(p => p.id === patientId);
    if (!patient) return;

    // Update patient assignments
    await this.updatePatient(patientId, assignments);

    // Remove unassigned visits for this patient
    this.data.visits = this.data.visits.filter(v => 
      !(v.patientId === patientId && v.discipline === 'UNASSIGNED')
    );

    // DISABLED: Auto-regeneration
    console.log('Staff assignment complete - no auto-regeneration');
  }

  // Regenerate visits for a patient
  async regenerateVisitsForPatient(patientId, weeksAhead = 2) {
    const patient = this.data.patients.find(p => p.id === patientId);
    if (!patient) return;

    // Remove existing suggested visits for this patient
    this.data.visits = this.data.visits.filter(v => 
      !(v.patientId === patientId && v.status === 'suggested')
    );

    // Generate new visits for the next few weeks
    const weekDates = this.getWeekDates(new Date());
    const scheduler = new (await import('./autoScheduleVisits.js')).RobustAutoScheduler(
      [patient], 
      this.data.staff, 
      this.data.visits
    );
    
    const newVisits = scheduler.generateVisitsForWeek(weekDates[0]);
    
    // Add new visits to the data
    this.data.visits.push(...newVisits);
    await this.saveData();
  }

  async completeVisit(visitId) {
    try {
      const visit = this.data.visits.find(v => v.id === visitId);
      if (!visit) {
        console.error('Visit not found:', visitId);
        return;
      }

      // Check if visit is already completed to prevent double-clicks
      if (visit.completed) {
        console.log('Visit already completed:', visitId);
        return;
      }

      console.log('Completing visit:', visit.id, visit.patientName, visit.discipline);

      await this.updateVisit(visitId, { completed: true });

      // If this is an RN visit, update patient's last RN visit date
      if (visit.discipline === 'RN') {
        await this.updatePatient(visit.patientId, { lastRNVisitDate: visit.date });
        console.log('Updated last RN visit date for patient:', visit.patientId);
      }

      // NO AUTO-REGENERATION - Keep it simple
      console.log('Visit completed successfully - no auto-regeneration');
    } catch (error) {
      console.error('Error completing visit:', visitId, error);
      throw error;
    }
  }



  // UTILITY FUNCTIONS
  getCurrentWeek() {
    const now = this.simulatedDate;
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    return monday.toISOString().split('T')[0];
  }

  // Date simulation functions
  getSimulatedDate() {
    return this.simulatedDate;
  }

  advanceDateByDays(days) {
    this.simulatedDate.setDate(this.simulatedDate.getDate() + days);
    this.generateAlertsForCurrentDate();
    this.notifySubscribers();
    console.log(`Date advanced by ${days} days. Current simulated date: ${this.simulatedDate.toISOString().split('T')[0]}`);
  }

  resetDateToToday() {
    this.simulatedDate = new Date();
    this.generateAlertsForCurrentDate();
    this.notifySubscribers();
    console.log(`Date reset to today: ${this.simulatedDate.toISOString().split('T')[0]}`);
  }

  // Generate alerts based on current simulated date
  generateAlertsForCurrentDate() {
    const currentDate = this.simulatedDate.toISOString().split('T')[0];
    const alerts = [];

    // Check for overdue RN visits
    this.data.patients.forEach(patient => {
      if (patient.visitStatus === 'complete') return;

      const lastRNVisit = patient.lastRNVisitDate;
      if (lastRNVisit) {
        const daysSinceLastRN = Math.floor((this.simulatedDate - new Date(lastRNVisit)) / (1000 * 60 * 60 * 24));
        
        // Check if patient has scheduled RN visits
        const hasScheduledVisit = this.data.visits.some(v => {
          const visitDate = new Date(v.date.split('T')[0]);
          return v.patientId === patient.id && 
                 v.discipline === 'RN' &&
                 visitDate >= this.simulatedDate &&
                 (v.status === 'confirmed' || v.status === 'suggested');
        });
        
        if (daysSinceLastRN >= 14 && !hasScheduledVisit) {
          alerts.push({
            id: `alert-${patient.id}-overdue`,
            type: 'overdue',
            severity: 'high',
            patientId: patient.id,
            patientName: patient.name,
            message: `RN visit overdue by ${daysSinceLastRN - 14} days`,
            date: currentDate,
            daysOverdue: daysSinceLastRN - 14
          });
        } else if (daysSinceLastRN >= 12 && !hasScheduledVisit) {
          alerts.push({
            id: `alert-${patient.id}-due-soon`,
            type: 'due-soon',
            severity: 'medium',
            patientId: patient.id,
            patientName: patient.name,
            message: `RN visit due in ${14 - daysSinceLastRN} days`,
            date: currentDate,
            daysUntilDue: 14 - daysSinceLastRN
          });
        }
      }

      // Check for HOPE tool assessments
      const socDate = new Date(patient.socDate);
      const daysOnService = Math.floor((this.simulatedDate - socDate) / (1000 * 60 * 60 * 24));
      
      if (daysOnService >= 6 && daysOnService <= 15) {
        const hasHUV1 = this.data.visits.some(v => 
          v.patientId === patient.id && 
          v.tags && 
          v.tags.includes("HOPE") && 
          v.tags.includes("HUV1") &&
          v.completed
        );
        
        if (!hasHUV1) {
          alerts.push({
            id: `alert-${patient.id}-huv1`,
            type: 'hope-assessment',
            severity: 'high',
            patientId: patient.id,
            patientName: patient.name,
            message: `HOPE HUV1 Assessment Required (Days ${daysOnService} on service)`,
            date: currentDate,
            assessmentType: 'HUV1'
          });
        }
      }

      if (daysOnService >= 16 && daysOnService <= 30) {
        const hasHUV2 = this.data.visits.some(v => 
          v.patientId === patient.id && 
          v.tags && 
          v.tags.includes("HOPE") && 
          v.tags.includes("HUV2") &&
          v.completed
        );
        
        if (!hasHUV2) {
          alerts.push({
            id: `alert-${patient.id}-huv2`,
            type: 'hope-assessment',
            severity: 'high',
            patientId: patient.id,
            patientName: patient.name,
            message: `HOPE HUV2 Assessment Required (Days ${daysOnService} on service)`,
            date: currentDate,
            assessmentType: 'HUV2'
          });
        }
      }
    });

    this.data.alerts = alerts;
  }

  getWeekDates(startDate) {
    const start = new Date(startDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }

  // Get visits for a specific week
  getVisitsForWeek(weekStartDate) {
    const weekDates = this.getWeekDates(weekStartDate);
    return this.data.visits.filter(v => weekDates.includes(v.date));
  }

  // Get unassigned visits
  getUnassignedVisits() {
    return this.data.visits.filter(v => !v.staff || v.discipline === 'UNASSIGNED');
  }

  // Get scheduled visits
  getScheduledVisits() {
    return this.data.visits.filter(v => v.staff && v.discipline !== 'UNASSIGNED');
  }

  // Get visits by staff member
  getVisitsByStaff(staffName, weekStartDate = null) {
    let visits = this.data.visits.filter(v => v.staff === staffName);
    
    if (weekStartDate) {
      const weekDates = this.getWeekDates(weekStartDate);
      visits = visits.filter(v => weekDates.includes(v.date));
    }
    
    return visits;
  }

  // Get patient by ID
  getPatient(patientId) {
    return this.data.patients.find(p => p.id === patientId);
  }

  // Get staff by ID
  getStaff(staffId) {
    return this.data.staff.find(s => s.id === staffId);
  }

  // Get staff by name
  getStaffByName(name) {
    return this.data.staff.find(s => s.name === name);
  }

  // Get active staff by role
  getActiveStaffByRole(role) {
    return this.data.staff.filter(s => s.role === role && s.active);
  }

  // Create test compliance data based on real patient data
  async createTestComplianceData() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    // Create test staff
    const testStaff = [
      {
        id: 'staff-1',
        name: 'Rachelle RN',
        role: 'RN',
        color: '#254FBB',
        active: true
      },
      {
        id: 'staff-2',
        name: 'Tej LVN',
        role: 'LVN',
        color: '#38AAE1',
        active: true
      },
      {
        id: 'staff-3',
        name: 'George RN',
        role: 'RN',
        color: '#83CDC1',
        active: true
      },
      {
        id: 'staff-4',
        name: 'Tiffani LVN',
        role: 'LVN',
        color: '#9FDFE1',
        active: true
      },
      {
        id: 'staff-5',
        name: 'Jermaine RN',
        role: 'RN',
        color: '#e74c3c',
        active: true
      }
    ];

    // Create test patients based on real data
    const testPatients = [
      {
        id: 'patient-1',
        name: 'McDermott, George',
        city: 'Anaheim',
        socDate: '2025-07-28',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-07-28',
        frequency: '2x/week',
        assignedRN: 'Rachelle RN',
        assignedLVN: 'Tej LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-25', // 3 days ago - due for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-2',
        name: 'Olguin, Mary',
        city: 'Artesia',
        socDate: '2025-07-28',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-07-28',
        frequency: '2x/week',
        assignedRN: 'George RN',
        assignedLVN: 'Tiffani LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-24', // 4 days ago - due for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-3',
        name: 'Dong, Ziming',
        city: 'Buena Park',
        socDate: '2025-07-26',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-07-26',
        frequency: '2x/week',
        assignedRN: 'Jermaine RN',
        assignedLVN: 'Tej LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-22', // 6 days ago - overdue for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-4',
        name: 'Tomlinson, Gay',
        city: 'Cypress',
        socDate: '2025-07-24',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-07-24',
        frequency: '2x/week',
        assignedRN: 'Rachelle RN',
        assignedLVN: 'Tiffani LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-20', // 8 days ago - overdue for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-5',
        name: 'Toufigh, Riaz',
        city: 'Fullerton',
        socDate: '2025-07-17',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-07-17',
        frequency: '2x/week',
        assignedRN: 'George RN',
        assignedLVN: 'Tej LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-13', // 15 days ago - overdue for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-6',
        name: 'Ford, Cathie',
        city: 'Garden Grove',
        socDate: '2025-07-17',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-07-17',
        frequency: '2x/week',
        assignedRN: 'Jermaine RN',
        assignedLVN: 'Tiffani LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-13', // 15 days ago - overdue for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-7',
        name: 'Forcucci, James',
        city: 'Huntington Beach',
        socDate: '2025-07-16',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-07-16',
        frequency: '2x/week',
        assignedRN: 'Rachelle RN',
        assignedLVN: 'Tej LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-12', // 16 days ago - overdue for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-8',
        name: 'Torres, Ana',
        city: 'Irvine',
        socDate: '2025-06-26',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-06-26',
        frequency: '2x/week',
        assignedRN: 'George RN',
        assignedLVN: 'Tiffani LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-22', // 6 days ago - due for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-9',
        name: 'Castro, Martha',
        city: 'La Habra',
        socDate: '2025-06-24',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-06-24',
        frequency: '2x/week',
        assignedRN: 'Jermaine RN',
        assignedLVN: 'Tej LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-20', // 8 days ago - overdue for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-10',
        name: 'Patil, Jadhav',
        city: 'La Mirada',
        socDate: '2025-06-14',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-06-14',
        frequency: '2x/week',
        assignedRN: 'Rachelle RN',
        assignedLVN: 'Tiffani LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-18', // 10 days ago - due for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-11',
        name: 'Asselin, Gertrude',
        city: 'Los Alamitos',
        socDate: '2025-06-13',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-06-13',
        frequency: '2x/week',
        assignedRN: 'George RN',
        assignedLVN: 'Tej LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-17', // 11 days ago - due for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-12',
        name: 'Love, Vivian',
        city: 'Newport Beach',
        socDate: '2025-06-10',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-06-10',
        frequency: '2x/week',
        assignedRN: 'Jermaine RN',
        assignedLVN: 'Tiffani LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-14', // 14 days ago - due for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-13',
        name: 'Garcia, Arthur',
        city: 'Orange',
        socDate: '2025-05-24',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-05-24',
        frequency: '2x/week',
        assignedRN: 'Rachelle RN',
        assignedLVN: 'Tej LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-18', // 10 days ago - due for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-14',
        name: 'Reddy Gummi, Sushila',
        city: 'Placentia',
        socDate: '2025-05-20',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-05-20',
        frequency: '2x/week',
        assignedRN: 'George RN',
        assignedLVN: 'Tiffani LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-16', // 12 days ago - due for RN visit
        visitStatus: 'active'
      },
      {
        id: 'patient-15',
        name: 'Kitasaki, Utaro',
        city: 'San Clemente',
        socDate: '2025-04-30',
        benefitPeriodNumber: 'BP1',
        benefitPeriodStart: '2025-04-30',
        frequency: '2x/week',
        assignedRN: 'Jermaine RN',
        assignedLVN: 'Tej LVN',
        assignedNP: null,
        lastRNVisitDate: '2025-07-14', // 14 days ago - due for RN visit
        visitStatus: 'active'
      }
    ];

    // Create test visits for today and upcoming days
    const testVisits = [
      // Today's visits (some overdue, some due)
      {
        id: 'visit-1',
        patientId: 'patient-3',
        patientName: 'Dong, Ziming',
        date: today.toISOString().split('T')[0],
        staff: 'Jermaine RN',
        discipline: 'RN',
        type: 'routine',
        completed: false,
        notes: 'RN visit overdue (6 days)',
        tags: ['routine'],
        priority: 'urgent'
      },
      {
        id: 'visit-2',
        patientId: 'patient-4',
        patientName: 'Tomlinson, Gay',
        date: today.toISOString().split('T')[0],
        staff: 'Rachelle RN',
        discipline: 'RN',
        type: 'routine',
        completed: false,
        notes: 'RN visit overdue (8 days)',
        tags: ['routine'],
        priority: 'urgent'
      },
      {
        id: 'visit-3',
        patientId: 'patient-5',
        patientName: 'Toufigh, Riaz',
        date: today.toISOString().split('T')[0],
        staff: 'George RN',
        discipline: 'RN',
        type: 'routine',
        completed: false,
        notes: 'RN visit overdue (15 days)',
        tags: ['routine'],
        priority: 'urgent'
      },
      {
        id: 'visit-4',
        patientId: 'patient-6',
        patientName: 'Ford, Cathie',
        date: today.toISOString().split('T')[0],
        staff: 'Jermaine RN',
        discipline: 'RN',
        type: 'routine',
        completed: false,
        notes: 'RN visit overdue (15 days)',
        tags: ['routine'],
        priority: 'urgent'
      },
      {
        id: 'visit-5',
        patientId: 'patient-7',
        patientName: 'Forcucci, James',
        date: today.toISOString().split('T')[0],
        staff: 'Rachelle RN',
        discipline: 'RN',
        type: 'routine',
        completed: false,
        notes: 'RN visit overdue (16 days)',
        tags: ['routine'],
        priority: 'urgent'
      },
      // Tomorrow's visits (will become due)
      {
        id: 'visit-6',
        patientId: 'patient-1',
        patientName: 'McDermott, George',
        date: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        staff: 'Rachelle RN',
        discipline: 'RN',
        type: 'routine',
        completed: false,
        notes: 'RN visit due tomorrow',
        tags: ['routine'],
        priority: 'high'
      },
      {
        id: 'visit-7',
        patientId: 'patient-2',
        patientName: 'Olguin, Mary',
        date: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        staff: 'George RN',
        discipline: 'RN',
        type: 'routine',
        completed: false,
        notes: 'RN visit due tomorrow',
        tags: ['routine'],
        priority: 'high'
      },
      // Day after tomorrow (will become due)
      {
        id: 'visit-8',
        patientId: 'patient-8',
        patientName: 'Torres, Ana',
        date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        staff: 'George RN',
        discipline: 'RN',
        type: 'routine',
        completed: false,
        notes: 'RN visit due in 2 days',
        tags: ['routine'],
        priority: 'medium'
      },
      {
        id: 'visit-9',
        patientId: 'patient-9',
        patientName: 'Castro, Martha',
        date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        staff: 'Jermaine RN',
        discipline: 'RN',
        type: 'routine',
        completed: false,
        notes: 'RN visit due in 2 days',
        tags: ['routine'],
        priority: 'medium'
      }
    ];

    // Save test data
    this.data.staff = testStaff;
    this.data.patients = testPatients;
    this.data.visits = testVisits;
    this.data.alerts = [];

    await this.saveData();
    console.log('Test compliance data created successfully with real patient data');
  }

  // Create fresh sample data (internal method, doesn't save)
  createFreshSampleData() {
    // Clear existing data
    this.data.patients = [];
    this.data.visits = [];
    this.data.staff = [];
    this.data.alerts = [];

    // Get sample data from the centralized source
    const sampleData = getSampleData();
    
    // Set the data
    this.data.staff = sampleData.staff;
    this.data.patients = sampleData.patients;
    this.data.visits = sampleData.visits;

    console.log('Fresh sample data created with 15 patients and 6 staff members');
    console.log('All patients have proper assignments and benefit periods');
    console.log('Completed visits added to establish visit history');
    console.log('Auto-scheduler will now generate visits for all patients');
  }

  // Reset and create fresh sample data with new data points
  async resetAndCreateFreshSampleData() {
    // Clear existing data
    this.data.patients = [];
    this.data.visits = [];
    this.data.staff = [];
    this.data.alerts = [];

    // Get sample data from the centralized source
    const sampleData = getSampleData();
    
    // Set the data
    this.data.staff = sampleData.staff;
    this.data.patients = sampleData.patients;
    this.data.visits = sampleData.visits;

    // Save the data
    await this.saveData();

    console.log('Fresh sample data created with 15 patients and 6 staff members');
    console.log('All patients have proper assignments and benefit periods');
    console.log('Completed visits added to establish visit history');
    console.log('Auto-scheduler will now generate visits for all patients');
    
    // Notify subscribers immediately
    this.notifySubscribers();
  }
}

// Create singleton instance
const dataManager = new DataManager();

export default dataManager; 