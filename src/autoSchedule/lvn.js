/**
 * LVN Visit Scheduling Module
 * Handles LVN scheduling with varying weekly frequencies per patient
 */

import { findBestDayForEvenDistribution, hasReachedDailyLimit, getVisitNoteTemplate } from './utils.js';

/**
 * Parse frequency string to get number of visits per week
 * @param {string} frequency - Frequency string (e.g., "3x/week", "2x/week")
 * @returns {number} - Number of visits per week
 */
export function parseFrequency(frequency) {
  const frequencyNum = parseInt(frequency.match(/\d+/)?.[0] || "1");
  return frequencyNum;
}

/**
 * Get day name from date string
 * @param {string} date - Date string in YYYY-MM-DD format
 * @returns {string} - Day name (Monday, Tuesday, etc.)
 */
export function getDayName(date) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIndex = new Date(date).getDay();
  return dayNames[dayIndex];
}

/**
 * Check if a day is preferred for the patient
 * @param {Object} patient - Patient object
 * @param {string} date - Date string
 * @returns {boolean} - True if day is preferred
 */
export function isPreferredDay(patient, date) {
  if (!patient.preferredVisitDays || patient.preferredVisitDays.length === 0) {
    return false;
  }
  
  const dayName = getDayName(date);
  return patient.preferredVisitDays.includes(dayName);
}

/**
 * Find the best available day for LVN visit considering RN visits and spacing
 * @param {Object} patient - Patient object
 * @param {Array} weekDates - Array of week dates
 * @param {Array} existingVisits - Array of existing visits
 * @param {number} visitIndex - Index of this visit (0-based)
 * @param {number} totalVisits - Total number of LVN visits needed
 * @returns {string|null} - Best available date or null
 */
export function findBestLVNDay(patient, weekDates, existingVisits, visitIndex, totalVisits) {
  // Get existing RN and LVN visits for this patient this week
  const patientVisitsThisWeek = existingVisits.filter(v => 
    v.patientId === patient.id && 
    weekDates.includes(v.date)
  );
  
  const rnVisitsThisWeek = patientVisitsThisWeek.filter(v => v.discipline === 'RN');
  const lvnVisitsThisWeek = patientVisitsThisWeek.filter(v => v.discipline === 'LVN');
  
  // Create array of available days (excluding RN visit days)
  const rnVisitDays = rnVisitsThisWeek.map(v => v.date);
  const lvnVisitDays = lvnVisitsThisWeek.map(v => v.date);
  
  const availableDays = weekDates.filter(date => 
    !rnVisitDays.includes(date) && 
    !lvnVisitDays.includes(date)
  );
  
  if (availableDays.length === 0) return null;
  
  // For 2/week patients, space out visits (e.g., Tue/Thu instead of Mon/Tue)
  if (totalVisits === 2) {
    // Sort by preference: preferred days first, then spaced out
    const sortedDays = availableDays.sort((a, b) => {
      const aPreferred = isPreferredDay(patient, a);
      const bPreferred = isPreferredDay(patient, b);
      
      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;
      
      // If both preferred or both not preferred, space them out
      const aIndex = weekDates.indexOf(a);
      const bIndex = weekDates.indexOf(b);
      
      // Prefer days that are more spaced out from existing visits
      const aSpacing = Math.min(...lvnVisitDays.map(d => Math.abs(weekDates.indexOf(d) - aIndex)));
      const bSpacing = Math.min(...lvnVisitDays.map(d => Math.abs(weekDates.indexOf(d) - bIndex)));
      
      return bSpacing - aSpacing;
    });
    
    return sortedDays[0];
  }
  
  // For 3+ visits, prioritize preferred days but don't worry as much about spacing
  const preferredDays = availableDays.filter(date => isPreferredDay(patient, date));
  if (preferredDays.length > 0) {
    return preferredDays[0];
  }
  
  return availableDays[0];
}

/**
 * Generate LVN visits for a patient
 * @param {Object} patient - Patient object
 * @param {Array} weekDates - Array of week dates
 * @param {number} visitsScheduled - Number of visits already scheduled
 * @param {number} frequencyNum - Total frequency number
 * @param {Function} findAvailableDay - Function to find available day
 * @param {Array} existingVisits - Array of existing visits
 * @returns {Array} - Array of LVN visits
 */
export function generateLVNVisits(patient, weekDates, visitsScheduled, frequencyNum, findAvailableDay, existingVisits = []) {
  const visits = [];
  const remainingSlots = frequencyNum - visitsScheduled;
  
  if (remainingSlots <= 0) return visits;

  // Get existing LVN visits for this patient this week
  const existingLVNThisWeek = existingVisits.filter(v => 
    v.patientId === patient.id && 
    v.discipline === 'LVN' &&
    weekDates.includes(v.date)
  );
  
  const existingLVNCount = existingLVNThisWeek.length;
  const additionalNeeded = Math.max(0, remainingSlots - existingLVNCount);
  
  for (let i = 0; i < additionalNeeded; i++) {
    const visitIndex = existingLVNCount + i;
    const availableDay = findBestLVNDay(patient, weekDates, existingVisits, visitIndex, frequencyNum);
    
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
        status: "suggested",
        notes: `Auto-suggested LVN visit (${frequencyNum}x/week)`,
        tags: [],
        priority: "medium"
      });
    }
  }

  return visits;
}

/**
 * Main function to generate LVN visits for a patient
 * @param {Object} patient - Patient object
 * @param {Array} weekDates - Array of week dates
 * @param {number} visitsScheduled - Number of visits already scheduled
 * @param {Function} findAvailableDay - Function to find available day
 * @param {Array} existingVisits - Array of existing visits
 * @returns {Array} - Array of LVN visits
 */
export function generateLvnVisits(patient, weekDates, visitsScheduled, findAvailableDay, existingVisits = []) {
  const visits = [];
  const patientId = patient.id;
  const assignedLVN = patient.assignedLVN;

  if (!assignedLVN) {
    return visits; // No LVN assigned
  }

  // Check if LVN visit is due based on frequency
  const lvnDue = isLVNVisitDue(patient, existingVisits);
  if (!lvnDue.isDue) {
    return visits;
  }

  // Determine visit type and tags
  let visitType = 'routine';
  let tags = [];
  
  // Check for HOPE visits
  const socDate = new Date(patient.socDate);
  const today = new Date();
  const daysOnService = Math.floor((today - socDate) / (1000 * 60 * 60 * 24));
  
  if (daysOnService >= 6 && daysOnService <= 15) {
    tags.push('HUV1');
  } else if (daysOnService >= 16 && daysOnService <= 30) {
    tags.push('HUV2');
  }

  // Find best day for even distribution
  const bestDate = findBestDayForEvenDistribution(assignedLVN, weekDates, existingVisits, 'LVN');
  
  if (!bestDate) {
    // No available days - create unassigned visit
    const unassignedVisit = {
      id: `v${Date.now()}_${Math.random()}`,
      patientId: patientId,
      patientName: patient.name,
      date: weekDates[0], // Default to first day
      discipline: 'LVN',
      staff: null, // Unassigned
      status: 'suggested',
      completed: false,
      visitType: visitType,
      tags: tags,
      notes: getVisitNoteTemplate(visitType, 'LVN'),
      reason: lvnDue.reason
    };
    visits.push(unassignedVisit);
    return visits;
  }

  // Check if staff has reached daily limit
  if (hasReachedDailyLimit(assignedLVN, bestDate, existingVisits)) {
    // Create visit but mark as over limit
    const overLimitVisit = {
      id: `v${Date.now()}_${Math.random()}`,
      patientId: patientId,
      patientName: patient.name,
      date: bestDate,
      discipline: 'LVN',
      staff: assignedLVN,
      status: 'suggested',
      completed: false,
      visitType: visitType,
      tags: [...tags, 'over-limit'],
      notes: getVisitNoteTemplate(visitType, 'LVN'),
      reason: lvnDue.reason,
      overLimit: true
    };
    visits.push(overLimitVisit);
    return visits;
  }

  // Create normal LVN visit
  const lvnVisit = {
    id: `v${Date.now()}_${Math.random()}`,
    patientId: patientId,
    patientName: patient.name,
    date: bestDate,
    discipline: 'LVN',
    staff: assignedLVN,
    status: 'suggested',
    completed: false,
    visitType: visitType,
    tags: tags,
    notes: getVisitNoteTemplate(visitType, 'LVN'),
    reason: lvnDue.reason
  };

  visits.push(lvnVisit);
  return visits;
} 