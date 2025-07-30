/**
 * Utility functions for visit scheduling
 * Common functions used across all visit scheduling modules
 */

/**
 * Find available day for a patient
 * @param {string} patientId - Patient ID
 * @param {Array} weekDates - Array of week dates
 * @param {number} visitsScheduled - Number of visits already scheduled
 * @param {Array} existingVisits - Array of existing visits
 * @returns {string|null} - Available date or null
 */
export function findAvailableDay(patientId, weekDates, visitsScheduled, existingVisits) {
  const existingVisitsForPatient = existingVisits.filter(v => 
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

/**
 * Get week dates (Monday to Sunday)
 * @param {string} startDate - Start date string
 * @returns {Array} - Array of week dates
 */
export function getWeekDates(startDate) {
  const start = new Date(startDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

/**
 * Create unassigned visit for patient
 * @param {Object} patient - Patient object
 * @param {string} date - Visit date
 * @returns {Object} - Unassigned visit object
 */
export function createUnassignedVisit(patient, date) {
  return {
    id: `unassigned-${patient.id}-${Date.now()}`,
    patientId: patient.id,
    patientName: patient.name,
    date: date,
    staff: "Unassigned",
    discipline: "Unassigned",
    type: "unassigned",
    completed: false,
    status: "suggested",
    notes: "Patient needs team assignment",
    tags: ["unassigned"],
    priority: "urgent"
  };
}

/**
 * Merge new visits with existing visits
 * @param {Array} newVisits - Array of new visits
 * @param {Array} existingVisits - Array of existing visits
 * @param {Array} weekDates - Array of week dates
 * @returns {Array} - Merged array of visits
 */
export function mergeWithExistingVisits(newVisits, existingVisits, weekDates) {
  // Get existing visits for this week
  const existingVisitsInWeek = existingVisits.filter(v => 
    weekDates.includes(v.date)
  );
  
  // Filter out visits that should not be overwritten
  const protectedVisits = existingVisitsInWeek.filter(v => 
    v.status === 'confirmed' || // Confirmed visits should not be overwritten
    (v.tags && v.tags.includes('prn')) // PRN visits should never be overwritten
  );
  
  // Filter out suggested visits that are being replaced
  const suggestedVisitsToKeep = existingVisitsInWeek.filter(v => 
    v.status === 'suggested' && 
    !(v.tags && v.tags.includes('prn')) // Keep suggested PRN visits
  );
  
  // Only keep suggested visits that don't conflict with new visits
  const nonConflictingSuggested = suggestedVisitsToKeep.filter(existingVisit => {
    const hasConflict = newVisits.some(newVisit => 
      newVisit.patientId === existingVisit.patientId && 
      newVisit.date === existingVisit.date &&
      newVisit.discipline === existingVisit.discipline
    );
    return !hasConflict;
  });
  
  // Combine protected visits, non-conflicting suggested visits, and new visits
  return [...protectedVisits, ...nonConflictingSuggested, ...newVisits];
} 

/**
 * Check if a staff member has reached daily visit limit (5 visits per day)
 * @param {string} staffName - Staff member name
 * @param {string} date - Date to check
 * @param {Array} existingVisits - Array of existing visits
 * @returns {boolean} - True if staff has reached daily limit
 */
export function hasReachedDailyLimit(staffName, date, existingVisits) {
  const dailyVisits = existingVisits.filter(v => 
    v.staff === staffName && 
    v.date === date && 
    v.status === 'confirmed'
  );
  return dailyVisits.length >= 5;
}

/**
 * Get daily visit count for a staff member on a specific date
 * @param {string} staffName - Staff member name
 * @param {string} date - Date to check
 * @param {Array} existingVisits - Array of existing visits
 * @returns {number} - Number of visits for that staff on that date
 */
export function getDailyVisitCount(staffName, date, existingVisits) {
  return existingVisits.filter(v => 
    v.staff === staffName && 
    v.date === date && 
    v.status === 'confirmed'
  ).length;
}

/**
 * Find the best day to schedule a visit for even distribution
 * @param {string} staffName - Staff member name
 * @param {Array} weekDates - Array of week dates
 * @param {Array} existingVisits - Array of existing visits
 * @param {string} discipline - Visit discipline (RN, LVN, NP)
 * @returns {string|null} - Best date to schedule, or null if no availability
 */
export function findBestDayForEvenDistribution(staffName, weekDates, existingVisits, discipline) {
  // Filter to weekdays only (Monday-Friday)
  const weekdays = weekDates.filter(date => {
    const dayOfWeek = new Date(date).getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday = 1, Friday = 5
  });

  // Get current visit counts for each weekday
  const dayCounts = weekdays.map(date => ({
    date,
    count: getDailyVisitCount(staffName, date, existingVisits)
  }));

  // Sort by visit count (ascending) to prefer days with fewer visits
  dayCounts.sort((a, b) => a.count - b.count);

  // Find first available day that doesn't exceed limit
  for (const day of dayCounts) {
    if (day.count < 5) {
      return day.date;
    }
  }

  return null; // No available days
}

/**
 * Check if a day has exceeded the daily visit limit for any staff
 * @param {string} date - Date to check
 * @param {Array} existingVisits - Array of existing visits
 * @param {Array} staff - Array of staff members
 * @returns {Array} - Array of staff names who have exceeded the limit
 */
export function getStaffExceedingDailyLimit(date, existingVisits, staff) {
  const exceededStaff = [];
  
  staff.forEach(s => {
    const dailyCount = getDailyVisitCount(s.name, date, existingVisits);
    if (dailyCount > 5) {
      exceededStaff.push(s.name);
    }
  });
  
  return exceededStaff;
}

/**
 * Get visit note template based on visit type
 * @param {string} visitType - Type of visit (routine, recert, prn)
 * @param {string} discipline - Visit discipline (RN, LVN, NP)
 * @returns {string} - Default note template
 */
export function getVisitNoteTemplate(visitType, discipline) {
  const templates = {
    routine: {
      RN: "Routine RN Visit – no urgent concerns",
      LVN: "Routine LVN Visit – no urgent concerns", 
      NP: "Routine NP Visit – no urgent concerns"
    },
    recert: {
      RN: "Recertification visit – verify eligibility",
      LVN: "Recertification visit – verify eligibility",
      NP: "Recertification visit – verify eligibility"
    },
    prn: {
      RN: "Follow-up on reported symptoms",
      LVN: "Follow-up on reported symptoms",
      NP: "Follow-up on reported symptoms"
    }
  };
  
  return templates[visitType]?.[discipline] || "Visit completed";
}

/**
 * Calculate benefit period countdown for a patient
 * @param {Object} patient - Patient object
 * @returns {Object} - Countdown information
 */
export function calculateBenefitPeriodCountdown(patient) {
  if (!patient.benefitPeriodEnd) {
    return { daysLeft: null, status: 'no-data' };
  }
  
  const endDate = new Date(patient.benefitPeriodEnd);
  const today = new Date();
  const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
  
  let status = 'normal';
  if (daysLeft < 0) {
    status = 'expired';
  } else if (daysLeft <= 7) {
    status = 'critical';
  } else if (daysLeft <= 14) {
    status = 'warning';
  } else {
    status = 'normal';
  }
  
  return {
    daysLeft,
    status,
    endDate: patient.benefitPeriodEnd,
    period: patient.benefitPeriod || 'Unknown'
  };
} 