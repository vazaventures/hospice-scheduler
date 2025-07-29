// Robust Auto-Scheduler for Hospice VisitCheck System v2.0
// Combines enhanced scheduling logic with HOPE tool integration

export class RobustAutoScheduler {
  constructor(patients, staff, existingVisits = []) {
    this.patients = patients;
    this.staff = staff;
    this.existingVisits = existingVisits;
  }

  // Main scheduling function for a week
  autoScheduleVisits(patients, existingVisits, weekDates) {
    return this.generateVisitsForWeek(weekDates[0]);
  }

  // Generate visits for a specific week
  generateVisitsForWeek(weekStartDate) {
    const weekDates = this.getWeekDates(weekStartDate);
    const newVisits = [];

    this.patients.forEach(patient => {
      if (patient.visitStatus === 'complete') return;

      const patientVisits = this.generatePatientVisits(patient, weekDates);
      newVisits.push(...patientVisits);
    });

    return this.mergeWithExistingVisits(newVisits, weekDates);
  }

  // Generate visits for a specific patient
  generatePatientVisits(patient, weekDates) {
    const visits = [];
    const patientId = patient.id;
    const assignedRN = patient.assignedRN;
    const assignedLVN = patient.assignedLVN;
    const assignedNP = patient.assignedNP;
    const frequency = patient.frequency;
    const lastRNVisitDate = patient.lastRNVisitDate;
    const benefitPeriodNumber = patient.benefitPeriodNumber;
    const socDate = patient.socDate;

    // Check if patient is unassigned
    if (!assignedRN && !assignedLVN && !assignedNP) {
      visits.push(this.createUnassignedVisit(patient, weekDates[0]));
      return visits;
    }

    // Parse frequency (e.g., "3x/week" -> 3)
    const frequencyNum = parseInt(frequency.match(/\d+/)?.[0] || "1");
    let visitsScheduled = 0;

    // RN Visit Logic (every 14 days or recert due) - This is the primary visit
    if (assignedRN && this.isRNVisitDue(patient, lastRNVisitDate, benefitPeriodNumber) && visitsScheduled < frequencyNum) {
      const rnVisit = this.generateRNVisit(patient, weekDates, visitsScheduled);
      if (rnVisit) {
        // Add HOPE tags to RN visit if needed
        const hopeTags = this.getHOPETags(patient);
        if (hopeTags.length > 0) {
          rnVisit.tags = [...(rnVisit.tags || []), ...hopeTags];
          rnVisit.notes = `${rnVisit.notes} ${hopeTags.map(tag => `(${tag})`).join(' ')}`;
        }
        visits.push(rnVisit);
        visitsScheduled++;
      }
    }

    // LVN Visit Logic (fill remaining frequency slots)
    if (assignedLVN && visitsScheduled < frequencyNum) {
      const lvnVisits = this.generateLVNVisits(patient, weekDates, visitsScheduled, frequencyNum);
      visits.push(...lvnVisits);
      visitsScheduled += lvnVisits.length;
    }

    // NP Visit Logic (BP2+ only, if not already at frequency limit)
    if (assignedNP && this.isNPVisitRequired(benefitPeriodNumber) && visitsScheduled < frequencyNum) {
      const npVisit = this.generateNPVisit(patient, weekDates, visitsScheduled);
      if (npVisit) {
        visits.push(npVisit);
      }
    }

    return visits;
  }

  // Get HOPE tags for a patient (to be added to RN visits)
  getHOPETags(patient) {
    const tags = [];
    const patientId = patient.id;
    const socDate = new Date(patient.socDate);
    const today = new Date();
    const daysOnService = Math.floor((today - socDate) / (1000 * 60 * 60 * 24));

    // Check if HUV1 is due (days 6-15 from SOC)
    if (daysOnService >= 6 && daysOnService <= 15) {
      const hasHUV1 = this.existingVisits.some(v => 
        v.patientId === patientId && 
        v.tags && 
        v.tags.includes("HOPE") && 
        v.tags.includes("HUV1") &&
        v.completed
      );
      
      if (!hasHUV1) {
        tags.push("HOPE", "HUV1");
      }
    }

    // Check if HUV2 is due (days 16-30 from SOC)
    if (daysOnService >= 16 && daysOnService <= 30) {
      const hasHUV2 = this.existingVisits.some(v => 
        v.patientId === patientId && 
        v.tags && 
        v.tags.includes("HOPE") && 
        v.tags.includes("HUV2") &&
        v.completed
      );
      
      if (!hasHUV2) {
        tags.push("HOPE", "HUV2");
      }
    }

    return tags;
  }

  // Check if RN visit is due (14-day rule or recert)
  isRNVisitDue(patient, lastRNVisitDate, benefitPeriodNumber) {
    if (!lastRNVisitDate) return true; // First visit
    
    const daysSinceLastRN = Math.floor((new Date() - new Date(lastRNVisitDate)) / (1000 * 60 * 60 * 24));
    
    // RN visit due if 14+ days have passed
    if (daysSinceLastRN >= 14) return true;
    
    // RN visit due if recertification is due
    if (this.isRecertDue(patient, benefitPeriodNumber)) return true;
    
    return false;
  }

  // Check if recertification is due
  isRecertDue(patient, benefitPeriodNumber) {
    if (!patient.socDate) return false;
    
    const socDate = new Date(patient.socDate);
    const today = new Date();
    const daysOnService = Math.floor((today - socDate) / (1000 * 60 * 60 * 24));
    
    // Recert due at 60 days for BP1, 90 days for BP2, etc.
    const recertDays = benefitPeriodNumber === 1 ? 60 : 90;
    
    return daysOnService >= recertDays && daysOnService <= recertDays + 7;
  }

  // Check if NP visit is required (BP2+ only)
  isNPVisitRequired(benefitPeriodNumber) {
    return benefitPeriodNumber >= 2;
  }

  // Generate RN visit
  generateRNVisit(patient, weekDates, visitsScheduled) {
    const availableDay = this.findAvailableDay(patient.id, weekDates, visitsScheduled);
    if (!availableDay) return null;

    return {
      id: `auto-rn-${patient.id}-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      date: availableDay,
      staff: patient.assignedRN,
      discipline: "RN",
      type: "routine",
      completed: false,
      notes: "Auto-assigned RN visit",
      tags: [],
      priority: "high"
    };
  }

  // Generate LVN visits
  generateLVNVisits(patient, weekDates, visitsScheduled, frequencyNum) {
    const visits = [];
    const remainingSlots = frequencyNum - visitsScheduled;
    
    if (remainingSlots <= 0) return visits;

    // Spread out LVN visits evenly across the week
    const interval = weekDates.length / (remainingSlots + 1);
    for (let i = 0; i < remainingSlots; i++) {
      const dayIndex = Math.round((i + 1) * interval);
      if (dayIndex >= weekDates.length) break;
      
      const availableDay = this.findAvailableDay(patient.id, weekDates, visitsScheduled + visits.length);
      if (availableDay) {
        visits.push({
          id: `auto-lvn-${patient.id}-${Date.now()}-${i}`,
          patientId: patient.id,
          patientName: patient.name,
          date: availableDay,
          staff: patient.assignedLVN,
          discipline: "LVN",
          type: "routine",
          completed: false,
          notes: "Auto-assigned LVN visit",
          tags: [],
          priority: "medium"
        });
      }
    }

    return visits;
  }

  // Generate NP visit
  generateNPVisit(patient, weekDates, visitsScheduled) {
    const availableDay = this.findAvailableDay(patient.id, weekDates, visitsScheduled);
    if (!availableDay) return null;

    return {
      id: `auto-np-${patient.id}-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      date: availableDay,
      staff: patient.assignedNP,
      discipline: "NP",
      type: "routine",
      completed: false,
      notes: "Auto-assigned NP visit",
      tags: [],
      priority: "medium"
    };
  }

  // Create unassigned visit
  createUnassignedVisit(patient, date) {
    return {
      id: `unassigned-${patient.id}-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      date: date,
      staff: "Unassigned",
      discipline: "Unassigned",
      type: "unassigned",
      completed: false,
      notes: "Patient needs team assignment",
      tags: ["unassigned"],
      priority: "urgent"
    };
  }

  // Find available day for a patient
  findAvailableDay(patientId, weekDates, visitsScheduled) {
    const existingVisitsForPatient = this.existingVisits.filter(v => 
      v.patientId === patientId && weekDates.includes(v.date)
    );

    for (const date of weekDates) {
      const hasVisitOnDate = existingVisitsForPatient.some(v => v.date === date);
      if (!hasVisitOnDate) {
        return date;
      }
    }

    return null;
  }

  // Get week dates (Monday to Friday)
  getWeekDates(startDate) {
    const start = new Date(startDate);
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }

  // Merge new visits with existing visits
  mergeWithExistingVisits(newVisits, weekDates) {
    const existingVisitsInWeek = this.existingVisits.filter(v => 
      weekDates.includes(v.date)
    );
    
    return [...existingVisitsInWeek, ...newVisits];
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
      case 'recert': return '#38AAE1';
      case 'prn': return '#83CDC1';
      case 'HOPE': return '#e74c3c';
      case 'HUV1': return '#e67e22';
      case 'HUV2': return '#f39c12';
      case 'unassigned': return '#9FDFE1';
      default: return '#3C3235';
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
    if (!patient.benefitPeriodNumber || !patient.benefitPeriodNumber.includes("BP")) {
      return null;
    }
    
    const bpNumber = parseInt(patient.benefitPeriodNumber.replace("BP", ""));
    const benefitPeriodStart = new Date(patient.benefitPeriodStart);
    const benefitPeriodEnd = new Date(benefitPeriodStart);
    
    // BP2+ uses 60-day periods
    benefitPeriodEnd.setDate(benefitPeriodStart.getDate() + 60);
    
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
  