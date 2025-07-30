// Robust Auto-Scheduler for Hospice VisitCheck System v2.0
// Combines enhanced scheduling logic with HOPE tool integration
// Now uses modular structure for better maintainability

import {
  generateRnVisits,
  generateNpVisits,
  generateHopeVisits,
  generateLvnVisits,
  findAvailableDay,
  getWeekDates,
  createUnassignedVisit,
  mergeWithExistingVisits
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

    this.patients.forEach(patient => {
      if (patient.visitStatus === 'complete') return;

      const patientVisits = this.generatePatientVisits(patient, weekDates);
      newVisits.push(...patientVisits);
    });

    return mergeWithExistingVisits(newVisits, this.existingVisits, weekDates);
  }

  // Generate visits for a specific patient using modular approach
  generatePatientVisits(patient, weekDates) {
    const visits = [];
    const patientId = patient.id;
    const assignedRN = patient.assignedRN;
    const assignedLVN = patient.assignedLVN;
    const assignedNP = patient.assignedNP;

    // Check if patient is unassigned
    if (!assignedRN && !assignedLVN && !assignedNP) {
      visits.push(createUnassignedVisit(patient, weekDates[0]));
      return visits;
    }

    let visitsScheduled = 0;

    // RN Visit Logic (every 14 days or recert due) - This is the primary visit
    const rnVisits = generateRnVisits(patient, weekDates, visitsScheduled, 
      (patientId, weekDates, visitsScheduled) => findAvailableDay(patientId, weekDates, visitsScheduled, this.existingVisits),
      this.existingVisits
    );
    visits.push(...rnVisits);
    visitsScheduled += rnVisits.length;

    // HOPE Visit Logic (attach to RN visits or create standalone)
    const hopeVisits = generateHopeVisits(patient, weekDates, visitsScheduled,
      (patientId, weekDates, visitsScheduled) => findAvailableDay(patientId, weekDates, visitsScheduled, this.existingVisits),
      this.existingVisits
    );
    visits.push(...hopeVisits);
    visitsScheduled += hopeVisits.length;

    // LVN Visit Logic (fill remaining frequency slots)
    const lvnVisits = generateLvnVisits(patient, weekDates, visitsScheduled,
      (patientId, weekDates, visitsScheduled) => findAvailableDay(patientId, weekDates, visitsScheduled, this.existingVisits),
      this.existingVisits
    );
    visits.push(...lvnVisits);
    visitsScheduled += lvnVisits.length;

    // NP Visit Logic (BP3+ only, if not already at frequency limit)
    const npVisits = generateNpVisits(patient, weekDates, visitsScheduled,
      (patientId, weekDates, visitsScheduled) => findAvailableDay(patientId, weekDates, visitsScheduled, this.existingVisits)
    );
    visits.push(...npVisits);

    return visits;
  }

  // Utility functions for visit management
  updateLastRNVisitDate(patientId, visitDate) {
    // This would typically update the patient record
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

  isOverdue(visit) {
    if (visit.completed) return false;
    const visitDate = new Date(visit.date);
    const today = new Date();
    return visitDate < today;
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
  