/**
 * NP Visit Scheduling Module
 * Handles NP face-to-face visits for BP3+ or admission requirements
 */

/**
 * Check if NP visit is required (BP3+ or admission requirement)
 * @param {number} benefitPeriodNumber - Current benefit period number
 * @param {boolean} isNewAdmission - Whether this is a new admission
 * @returns {boolean} - True if NP visit is required
 */
export function isNPVisitRequired(benefitPeriodNumber, isNewAdmission = false) {
  // NP visit required at start of BP3 or higher
  if (benefitPeriodNumber >= 3) return true;
  
  // NP visit required on admission if BP3+
  if (isNewAdmission && benefitPeriodNumber >= 3) return true;
  
  return false;
}

/**
 * Generate NP visit for a patient
 * @param {Object} patient - Patient object
 * @param {Array} weekDates - Array of week dates
 * @param {number} visitsScheduled - Number of visits already scheduled
 * @param {Function} findAvailableDay - Function to find available day
 * @returns {Object|null} - NP visit object or null if no available day
 */
export function generateNPVisit(patient, weekDates, visitsScheduled, findAvailableDay) {
  const availableDay = findAvailableDay(patient.id, weekDates, visitsScheduled);
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
    status: "suggested",
    notes: "Auto-assigned NP visit",
    tags: [],
    priority: "medium"
  };
}

/**
 * Main function to generate NP visits for a patient
 * @param {Object} patient - Patient object
 * @param {Array} weekDates - Array of week dates
 * @param {number} visitsScheduled - Number of visits already scheduled
 * @param {Function} findAvailableDay - Function to find available day
 * @returns {Array} - Array of NP visits
 */
export function generateNpVisits(patient, weekDates, visitsScheduled, findAvailableDay) {
  const visits = [];
  
  // Check if NP visit is required and not at frequency limit
  if (patient.assignedNP && 
      isNPVisitRequired(patient.benefitPeriodNumber) && 
      visitsScheduled < 1) {
    
    const npVisit = generateNPVisit(patient, weekDates, visitsScheduled, findAvailableDay);
    if (npVisit) {
      visits.push(npVisit);
    }
  }
  
  return visits;
} 