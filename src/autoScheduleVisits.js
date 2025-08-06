// Robust Auto-Scheduler for Hospice VisitCheck System v3.0
// Fixed scheduling logic with proper frequency compliance and visit history

import {
  generateRnVisits,
  generateNpVisits,
  generateHopeVisits,
  generateLvnVisits,
  findAvailableDay,
  getWeekDates,
  createUnassignedVisit,
  mergeWithExistingVisits,
  parseFrequency
} from './autoSchedule/index.js';

export class RobustAutoScheduler {
  constructor(patients, staff, existingVisits = []) {
    this.patients = patients;
    this.staff = staff;
    this.existingVisits = existingVisits;
  }

  // Main scheduling function for a week
  autoScheduleVisits(patients, existingVisits, weekDates) {
    this.existingVisits = existingVisits;
    return this.generateVisitsForWeek(weekDates[0]);
  }

  // Generate visits for a specific week
  generateVisitsForWeek(weekStartDate) {
    const weekDates = getWeekDates(weekStartDate);
    const newVisits = [];

    console.log('🔄 Starting auto-schedule for week:', weekStartDate);
    console.log('📅 Week dates:', weekDates);

    // Delete all suggested visits for current week
    this.existingVisits = this.existingVisits.filter(v => 
      !(weekDates.includes(v.date) && v.status === 'suggested')
    );

    this.patients.forEach(patient => {
      if (patient.visitStatus === 'complete') return;

      const patientVisits = this.generatePatientVisits(patient, weekDates);
      newVisits.push(...patientVisits);
    });

    const mergedVisits = mergeWithExistingVisits(newVisits, this.existingVisits, weekDates);
    
    console.log('✅ Auto-schedule complete. New visits:', newVisits.length);
    return mergedVisits;
  }

  // Generate visits for a specific patient
  generatePatientVisits(patient, weekDates) {
    const visits = [];
    const patientId = patient.id;
    const assignedRN = patient.assignedRN;

    console.log(`🔧 Generating visits for ${patient.name}:`, {
      patientId,
      assignedRN,
      frequency: patient.frequency,
      weekDates
    });

    // Check if patient is unassigned
    if (!assignedRN) {
      console.log(`⚠️ Patient ${patient.name} has no RN assigned`);
      visits.push(createUnassignedVisit(patient, weekDates[0]));
      return visits;
    }

    // Calculate visits already scheduled for this week
    const existingVisitsThisWeek = this.existingVisits.filter(v => 
      v.patientId === patientId && 
      weekDates.includes(v.date) && 
      (v.status === 'confirmed' || v.status === 'suggested') &&
      v.discipline === 'RN'
    );

    console.log(`📋 Existing RN visits for ${patient.name} this week:`, existingVisitsThisWeek.length);

    // Calculate how many more visits are needed
    const required = parseFrequency(patient.frequency);
    const needed = Math.max(0, required - existingVisitsThisWeek.length);

    console.log(`📊 Visit calculation for ${patient.name}:`, {
      frequency: patient.frequency,
      required,
      existing: existingVisitsThisWeek.length,
      needed
    });

    if (needed > 0) {
      // Choose weekday slots based on frequency pattern
      let preferredDays = [];
      if (required === 1) {
        // 1x/week: Monday
        preferredDays = [0]; // Monday
      } else if (required === 2) {
        // 2x/week: Monday and Thursday
        preferredDays = [0, 3]; // Monday, Thursday
      } else if (required === 3) {
        // 3x/week: Monday, Wednesday, Friday
        preferredDays = [0, 2, 4]; // Monday, Wednesday, Friday
      }

      // Get available days that match preferred pattern
      const availableDays = weekDates.filter((date, index) => {
        const dayOfWeek = new Date(date).getDay();
        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) return false;
        
        // Check if patient already has a visit on this day
        const hasVisitOnDay = existingVisitsThisWeek.some(v => v.date === date);
        if (hasVisitOnDay) return false;
        
        // Prefer days that match the frequency pattern
        const isPreferredDay = preferredDays.includes(index);
        return true; // Include all weekdays, we'll prioritize preferred ones
      });

      // Sort available days by preference (preferred days first)
      availableDays.sort((a, b) => {
        const aIndex = weekDates.indexOf(a);
        const bIndex = weekDates.indexOf(b);
        const aPreferred = preferredDays.includes(aIndex);
        const bPreferred = preferredDays.includes(bIndex);
        
        if (aPreferred && !bPreferred) return -1;
        if (!aPreferred && bPreferred) return 1;
        return aIndex - bIndex; // Then by day order
      });

      // Distribute visits across available days
      const newVisitDates = [];
      for (let i = 0; i < needed && i < availableDays.length; i++) {
        newVisitDates.push(availableDays[i]);
      }

      // Create new visit objects
      newVisitDates.forEach((selectedDate, index) => {
        const newVisit = {
          id: `auto-${patientId}-${Date.now()}-${index}`,
          patientId: patient.id,
          patientName: patient.name,
          date: selectedDate,
          staff: assignedRN || 'Unassigned',
          discipline: 'RN',
          visitType: 'routine',
          completed: false,
          status: 'suggested',
          notes: 'Auto-scheduled for current week',
          tags: ['routine']
        };

        // Avoid duplicating visits
        const visitExists = this.existingVisits.some(v => 
          v.patientId === patient.id && 
          v.date === selectedDate && 
          v.discipline === 'RN'
        );

        if (!visitExists) {
          visits.push(newVisit);
        }
      });

      console.log(`📅 Weekly Visit Summary for ${patient.name}:`, {
        patient: patient.name,
        freq: patient.frequency,
        visitsScheduled: existingVisitsThisWeek.length,
        visitsNeeded: needed,
        datesAdded: newVisitDates
      });
    }

    console.log(`✅ Total visits generated for ${patient.name}:`, visits.length);
    return visits;
  }

  // Utility functions for visit management
  updateLastRNVisitDate(patientId, visitDate) {
    console.log(`Updated last RN visit date for patient ${patientId} to ${visitDate}`);
  }

  // Calculate next RN visit date
  calculateNextRNVisit(patient) {
    if (!patient.lastRNVisitDate) return null;
    
    const lastVisit = new Date(patient.lastRNVisitDate);
    const nextVisit = new Date(lastVisit);
    nextVisit.setDate(lastVisit.getDate() + 14);
    
    return nextVisit.toISOString().split('T')[0];
  }

  // Get patient status
  getPatientStatus(patient, weekDates) {
    const visitsThisWeek = this.existingVisits.filter(v => 
      v.patientId === patient.id && 
      weekDates.includes(v.date) && 
      v.completed
    );
    
    if (visitsThisWeek.length > 0) return "Completed";
    return "Pending";
  }

  // Check if visit is overdue
  isOverdue(visit) {
    const visitDate = new Date(visit.date);
    const today = new Date();
    return visitDate < today && !visit.completed;
  }

  // Get days until visit
  getDaysUntilVisit(visit) {
    const visitDate = new Date(visit.date);
    const today = new Date();
    const diff = Math.floor((visitDate - today) / (1000 * 60 * 60 * 24));
    return diff;
  }

  // Get staff color by name
  getStaffColor(staffName, staffList = []) {
    if (!staffName) return '#666666';
    
    const staff = staffList.find(s => s.name === staffName);
    return staff?.color || '#666666';
  }

  getTagColor(tag) {
    switch (tag) {
      case 'routine': return '#254FBB';
      case 'recert': return '#f44336';
      case 'prn': return '#9c27b0';
      case 'HOPE': return '#e74c3c';
      case 'HUV1': return '#ff9800';
      case 'HUV2': return '#ff5722';
      case 'over-limit': return '#ff0000';
      case 'unassigned': return '#9FDFE1';
      default: return '#666666';
    }
  }

  getOverdueGlow(visit) {
    if (this.isOverdue(visit)) {
      return '0 0 10px #9FDFE1';
    }
    return 'none';
  }

  // Check if RN visit is overdue (14-day rule)
  isRNVisitOverdue(patient) {
    const nextRN = this.calculateNextRNVisit(patient);
    return nextRN.isOverdue;
  }

  // Get days until next RN visit
  getDaysUntilNextRNVisit(patient) {
    const nextRN = this.calculateNextRNVisit(patient);
    return nextRN.daysUntilDue;
  }

  // Calculate recertification window
  calculateRecertWindow(patient) {
    if (!patient.benefitPeriodEnd) {
      return null;
    }
    
    const benefitPeriodEnd = new Date(patient.benefitPeriodEnd);
    const recertWindowStart = new Date(benefitPeriodEnd);
    recertWindowStart.setDate(benefitPeriodEnd.getDate() - 14); // 14 days before end
    
    const today = new Date();
    const isInRecertWindow = today >= recertWindowStart && today <= benefitPeriodEnd;
    const isRecertOverdue = today > benefitPeriodEnd;
    
    return {
      windowStart: recertWindowStart.toISOString().split('T')[0],
      windowEnd: benefitPeriodEnd.toISOString().split('T')[0],
      isInWindow: isInRecertWindow,
      isOverdue: isRecertOverdue,
      daysUntilWindow: Math.ceil((recertWindowStart - today) / (1000 * 60 * 60 * 24)),
      daysUntilEnd: Math.ceil((benefitPeriodEnd - today) / (1000 * 60 * 60 * 24))
    };
  }

  // Check if recertification is due
  isRecertDue(patient) {
    const recertWindow = this.calculateRecertWindow(patient);
    return recertWindow && (recertWindow.isInWindow || recertWindow.isOverdue);
  }

  // Calculate next RN visit due date
  calculateNextRNVisit(patient) {
    const lastRNVisitDate = patient.lastRNVisitDate;
    
    if (!lastRNVisitDate) {
      // If no last RN visit, due immediately
      return {
        dueDate: new Date().toISOString().split('T')[0],
        isOverdue: true,
        daysUntilDue: 0
      };
    }
    
    const lastVisit = new Date(lastRNVisitDate);
    const nextDue = new Date(lastVisit);
    nextDue.setDate(lastVisit.getDate() + 14); // 14 days from last visit
    
    const today = new Date();
    const daysUntilDue = Math.ceil((nextDue - today) / (1000 * 60 * 60 * 24));
    
    return {
      dueDate: nextDue.toISOString().split('T')[0],
      isOverdue: daysUntilDue < 0,
      daysUntilDue: daysUntilDue
    };
  }
}

// Legacy function for backward compatibility
export function autoScheduleVisits(patients, existingVisits, weekDates) {
  const scheduler = new RobustAutoScheduler(patients, [], existingVisits);
  return scheduler.autoScheduleVisits(patients, existingVisits, weekDates);
}

// Utility functions for visit formatting and styling
export const visitUtils = {
  formatVisitDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  },

  getPriorityColor(priority) {
    switch (priority) {
      case 'urgent': return '#e74c3c';
      case 'high': return '#f39c12';
      case 'medium': return '#3498db';
      case 'low': return '#95a5a6';
      default: return '#95a5a6';
    }
  },

  getDisciplineColor(discipline) {
    switch (discipline) {
      case 'RN': return '#254FBB';
      case 'LVN': return '#38AAE1';
      case 'NP': return '#83CDC1';
      case 'UNASSIGNED': return '#9FDFE1';
      default: return '#3C3235';
    }
  },

  // Get staff color by name
  getStaffColor(staffName, staffList = []) {
    if (!staffName) return '#666666';
    
    const staff = staffList.find(s => s.name === staffName);
    return staff?.color || '#666666';
  },

  getTagColor(tag) {
    switch (tag) {
      case 'routine': return '#254FBB';
      case 'recert': return '#f44336';
      case 'prn': return '#9c27b0';
      case 'HOPE': return '#e74c3c';
      case 'HUV1': return '#ff9800';
      case 'HUV2': return '#ff5722';
      case 'over-limit': return '#ff0000';
      case 'unassigned': return '#9FDFE1';
      default: return '#666666';
    }
  },

  isOverdue(visit, allVisits = []) {
    // If visit is completed, it's not overdue
    if (visit.completed) return false;
    
    const visitDate = new Date(visit.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
    visitDate.setHours(0, 0, 0, 0);
    
    // If visit date is not in the past, it's not overdue
    if (visitDate >= today) return false;
    
    // Check if there are future scheduled visits for the same patient
    if (allVisits && allVisits.length > 0) {
      const scheduledVisitInFuture = allVisits.some(v => {
        if (v.patientId !== visit.patientId) return false;
        if (v.completed) return false;
        
        const vDate = new Date(v.date.split('T')[0]);
        vDate.setHours(0, 0, 0, 0);
        
        return vDate >= today && (v.status === 'confirmed' || v.status === 'suggested');
      });
      
      // If there's a future scheduled visit, don't show this past visit as overdue
      if (scheduledVisitInFuture) return false;
    }
    
    return true;
  },

  getDaysUntilVisit(visit) {
    const visitDate = new Date(visit.date);
    const today = new Date();
    const diff = Math.floor((visitDate - today) / (1000 * 60 * 60 * 24));
    return diff;
  },

  getOverdueGlow(visit) {
    if (this.isOverdue(visit)) {
      return '0 0 10px #9FDFE1';
    }
    return 'none';
  },

  // Check if RN visit is overdue (14-day rule)
  isRNVisitOverdue(patient) {
    const nextRN = this.calculateNextRNVisit(patient);
    return nextRN.isOverdue;
  },

  // Get days until next RN visit
  getDaysUntilNextRNVisit(patient) {
    const nextRN = this.calculateNextRNVisit(patient);
    return nextRN.daysUntilDue;
  },

  // Calculate recertification window
  calculateRecertWindow(patient) {
    if (!patient.benefitPeriodEnd) {
      return null;
    }
    
    const benefitPeriodEnd = new Date(patient.benefitPeriodEnd);
    const recertWindowStart = new Date(benefitPeriodEnd);
    recertWindowStart.setDate(benefitPeriodEnd.getDate() - 14); // 14 days before end
    
    const today = new Date();
    const isInRecertWindow = today >= recertWindowStart && today <= benefitPeriodEnd;
    const isRecertOverdue = today > benefitPeriodEnd;
    
    return {
      windowStart: recertWindowStart.toISOString().split('T')[0],
      windowEnd: benefitPeriodEnd.toISOString().split('T')[0],
      isInWindow: isInRecertWindow,
      isOverdue: isRecertOverdue,
      daysUntilWindow: Math.ceil((recertWindowStart - today) / (1000 * 60 * 60 * 24)),
      daysUntilEnd: Math.ceil((benefitPeriodEnd - today) / (1000 * 60 * 60 * 24))
    };
  },

  // Check if recertification is due
  isRecertDue(patient) {
    const recertWindow = this.calculateRecertWindow(patient);
    return recertWindow && (recertWindow.isInWindow || recertWindow.isOverdue);
  },

  // Calculate next RN visit due date
  calculateNextRNVisit(patient) {
    const lastRNVisitDate = patient.lastRNVisitDate;
    
    if (!lastRNVisitDate) {
      // If no last RN visit, due immediately
      return {
        dueDate: new Date().toISOString().split('T')[0],
        isOverdue: true,
        daysUntilDue: 0
      };
    }
    
    const lastVisit = new Date(lastRNVisitDate);
    const nextDue = new Date(lastVisit);
    nextDue.setDate(lastVisit.getDate() + 14); // 14 days from last visit
    
    const today = new Date();
    const daysUntilDue = Math.ceil((nextDue - today) / (1000 * 60 * 60 * 24));
    
    return {
      dueDate: nextDue.toISOString().split('T')[0],
      isOverdue: daysUntilDue < 0,
      daysUntilDue: daysUntilDue
    };
  }
};
  