/**
 * HOPE Visit Scheduling Module
 * Handles HUV1 (days 6-15) and HUV2 (days 16-30) visits
 */

/**
 * Get HOPE tags for a patient based on days on service
 * @param {Object} patient - Patient object
 * @param {Array} existingVisits - Array of existing visits
 * @returns {Array} - Array of HOPE tags
 */
export function getHOPETags(patient, existingVisits) {
  const tags = [];
  const patientId = patient.id;
  const socDate = new Date(patient.socDate);
  const today = new Date();
  const daysOnService = Math.floor((today - socDate) / (1000 * 60 * 60 * 24));

  // Check if HUV1 is due (days 6-15 from SOC)
  if (daysOnService >= 6 && daysOnService <= 15) {
    const hasHUV1 = existingVisits.some(v => 
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
    const hasHUV2 = existingVisits.some(v => 
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

/**
 * Generate HOPE visit for a patient
 * @param {Object} patient - Patient object
 * @param {Array} weekDates - Array of week dates
 * @param {number} visitsScheduled - Number of visits already scheduled
 * @param {Function} findAvailableDay - Function to find available day
 * @param {Array} hopeTags - HOPE tags to add to visit
 * @returns {Object|null} - HOPE visit object or null if no available day
 */
export function generateHOPEVisit(patient, weekDates, visitsScheduled, findAvailableDay, hopeTags) {
  const availableDay = findAvailableDay(patient.id, weekDates, visitsScheduled);
  if (!availableDay) return null;

  return {
    id: `auto-hope-${patient.id}-${Date.now()}`,
    patientId: patient.id,
    patientName: patient.name,
    date: availableDay,
    staff: patient.assignedRN || "Unassigned",
    discipline: "RN",
    type: "routine",
    completed: false,
    status: "suggested",
    notes: `Auto-assigned HOPE visit ${hopeTags.join(' ')}`,
    tags: hopeTags,
    priority: "high"
  };
}

/**
 * Main function to generate HOPE visits for a patient
 * @param {Object} patient - Patient object
 * @param {Array} weekDates - Array of week dates
 * @param {number} visitsScheduled - Number of visits already scheduled
 * @param {Function} findAvailableDay - Function to find available day
 * @param {Array} existingVisits - Array of existing visits
 * @returns {Array} - Array of HOPE visits
 */
export function generateHopeVisits(patient, weekDates, visitsScheduled, findAvailableDay, existingVisits) {
  const visits = [];
  
  // Get HOPE tags for this patient
  const hopeTags = getHOPETags(patient, existingVisits);
  
  // If HOPE tags exist, try to attach to existing RN visit first
  if (hopeTags.length > 0) {
    // Check if there's already an RN visit this week that we can attach HOPE to
    const existingRNVisit = existingVisits.find(v => 
      v.patientId === patient.id && 
      weekDates.includes(v.date) && 
      v.discipline === "RN" &&
      !v.completed
    );
    
    if (existingRNVisit) {
      // Attach HOPE tags to existing RN visit
      existingRNVisit.tags = [...(existingRNVisit.tags || []), ...hopeTags];
      existingRNVisit.notes = `${existingRNVisit.notes} ${hopeTags.map(tag => `(${tag})`).join(' ')}`;
    } else {
      // Generate standalone HOPE visit
      const hopeVisit = generateHOPEVisit(patient, weekDates, visitsScheduled, findAvailableDay, hopeTags);
      if (hopeVisit) {
        visits.push(hopeVisit);
      }
    }
  }
  
  return visits;
} 