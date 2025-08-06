/**
 * RN Visit Scheduling Module
 * Handles RN visit generation with 14-day intervals and recertification logic
 */

import { findBestDayForEvenDistribution, hasReachedDailyLimit, getVisitNoteTemplate } from './utils.js';

/**
 * Check if RN visit is due based on 14-day rule or recertification requirements
 * @param {Object} patient - Patient object
 * @param {Array} existingVisits - Array of existing visits to check against
 * @returns {Object} - Object with isDue, reason, and daysSinceLast properties
 */
export function isRNVisitDue(patient, existingVisits = []) {
  // Get the most recent confirmed RN visit
  const confirmedRNVisits = existingVisits.filter(v => 
    v.patientId === patient.id && 
    v.discipline === 'RN' && 
    v.status === 'confirmed' &&
    v.completed
  ).sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const lastConfirmedRNVisit = confirmedRNVisits[0];
  
  if (!lastConfirmedRNVisit) {
    // No confirmed RN visit exists - due immediately
    return {
      isDue: true,
      reason: 'No confirmed RN visit in past 14 days',
      daysSinceLast: null
    };
  }
  
  const daysSinceLastRN = Math.floor((new Date() - new Date(lastConfirmedRNVisit.date)) / (1000 * 60 * 60 * 24));
  
  // Check if patient has scheduled RN visits
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasScheduledVisit = existingVisits.some(v => {
    const visitDate = new Date(v.date.split('T')[0]);
    visitDate.setHours(0, 0, 0, 0);
    return v.patientId === patient.id && 
           v.discipline === 'RN' &&
           visitDate >= today &&
           (v.status === 'confirmed' || v.status === 'suggested');
  });
  
  // RN visit due if 14+ days have passed AND no scheduled visit
  if (daysSinceLastRN >= 14 && !hasScheduledVisit) {
    return {
      isDue: true,
      reason: `RN visit overdue by ${daysSinceLastRN - 14} days`,
      daysSinceLast: daysSinceLastRN
    };
  }
  
  // Check if recertification is due
  const recertWindow = calculateRecertWindow(patient);
  if (recertWindow && recertWindow.isInWindow) {
    return {
      isDue: true,
      reason: `Recertification due in ${recertWindow.daysUntilEnd} days`,
      daysSinceLast: daysSinceLastRN
    };
  }
  
  return {
    isDue: false,
    reason: `RN visit due in ${14 - daysSinceLastRN} days`,
    daysSinceLast: daysSinceLastRN
  };
}

/**
 * Calculate recertification window for a patient
 * @param {Object} patient - Patient object
 * @returns {Object|null} - Recert window object or null if not applicable
 */
export function calculateRecertWindow(patient) {
  if (!patient.benefitPeriodEnd) return null;
  
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

/**
 * Check if patient has any confirmed RN visits in the past 14 days
 * @param {Object} patient - Patient object
 * @param {Array} existingVisits - Array of existing visits
 * @returns {boolean} - True if confirmed RN visit exists in past 14 days
 */
export function hasConfirmedRNVisitInPast14Days(patient, existingVisits) {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  
  return existingVisits.some(v => 
    v.patientId === patient.id && 
    v.discipline === 'RN' && 
    v.status === 'confirmed' &&
    new Date(v.date) >= fourteenDaysAgo
  );
}

/**
 * Generate RN visit for a patient
 * @param {Object} patient - Patient object
 * @param {Array} weekDates - Array of week dates
 * @param {number} visitsScheduled - Number of visits already scheduled
 * @param {Function} findAvailableDay - Function to find available day
 * @param {Array} existingVisits - Array of existing visits
 * @returns {Object|null} - RN visit object or null if no available day
 */
export function generateRNVisit(patient, weekDates, visitsScheduled, findAvailableDay, existingVisits = []) {
  const availableDay = findAvailableDay(patient.id, weekDates, visitsScheduled);
  if (!availableDay) return null;

  const tags = [];
  const rnDue = isRNVisitDue(patient, existingVisits);
  
  // Add recert tag if recertification is due
  const recertWindow = calculateRecertWindow(patient);
  if (recertWindow && recertWindow.isInWindow) {
    tags.push("recert");
  }

  return {
    id: `auto-rn-${patient.id}-${Date.now()}`,
    patientId: patient.id,
    patientName: patient.name,
    date: availableDay,
    staff: patient.assignedRN,
    discipline: "RN",
    type: "routine",
    completed: false,
    status: "suggested",
    notes: `Auto-suggested RN visit: ${rnDue.reason}`,
    tags: tags,
    priority: "high"
  };
}

/**
 * Generate RN visits for a patient with improved distribution
 * @param {Object} patient - Patient object
 * @param {Array} weekDates - Array of week dates
 * @param {number} visitsScheduled - Number of visits already scheduled
 * @param {Function} findAvailableDay - Function to find available day
 * @param {Array} existingVisits - Array of existing visits
 * @returns {Array} - Array of generated RN visits
 */
export function generateRnVisits(patient, weekDates, visitsScheduled, findAvailableDay, existingVisits = []) {
  const visits = [];
  const patientId = patient.id;
  const assignedRN = patient.assignedRN;

  if (!assignedRN) {
    return visits; // No RN assigned
  }

  // Check if RN visit is due
  const rnDue = isRNVisitDue(patient, existingVisits);
  if (!rnDue.isDue) {
    return visits;
  }

  // Determine visit type and tags
  const recertWindow = calculateRecertWindow(patient);
  const isRecert = recertWindow && recertWindow.isInWindow;
  
  let visitType = 'routine';
  let tags = [];
  
  if (isRecert) {
    visitType = 'recert';
    tags = ['recert'];
  }

  // Find best day for even distribution
  const bestDate = findBestDayForEvenDistribution(assignedRN, weekDates, existingVisits, 'RN');
  
  if (!bestDate) {
    // No available days - create unassigned visit
    const unassignedVisit = {
      id: `v${Date.now()}_${Math.random()}`,
      patientId: patientId,
      patientName: patient.name,
      date: weekDates[0], // Default to first day
      discipline: 'RN',
      staff: null, // Unassigned
      status: 'suggested',
      completed: false,
      visitType: visitType,
      tags: tags,
      notes: getVisitNoteTemplate(visitType, 'RN'),
      reason: rnDue.reason
    };
    visits.push(unassignedVisit);
    return visits;
  }

  // Check if staff has reached daily limit
  if (hasReachedDailyLimit(assignedRN, bestDate, existingVisits)) {
    // Create visit but mark as over limit
    const overLimitVisit = {
      id: `v${Date.now()}_${Math.random()}`,
      patientId: patientId,
      patientName: patient.name,
      date: bestDate,
      discipline: 'RN',
      staff: assignedRN,
      status: 'suggested',
      completed: false,
      visitType: visitType,
      tags: [...tags, 'over-limit'],
      notes: getVisitNoteTemplate(visitType, 'RN'),
      reason: rnDue.reason,
      overLimit: true
    };
    visits.push(overLimitVisit);
    return visits;
  }

  // Create normal RN visit
  const rnVisit = {
    id: `v${Date.now()}_${Math.random()}`,
    patientId: patientId,
    patientName: patient.name,
    date: bestDate,
    discipline: 'RN',
    staff: assignedRN,
    status: 'suggested',
    completed: false,
    visitType: visitType,
    tags: tags,
    notes: getVisitNoteTemplate(visitType, 'RN'),
    reason: rnDue.reason
  };

  visits.push(rnVisit);
  return visits;
} 