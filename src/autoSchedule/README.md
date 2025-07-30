# Auto Schedule Module Architecture

This directory contains the modular auto-scheduling system for the hospice visit scheduler. The system has been refactored from a monolithic approach to a modular, scalable structure.

## Architecture Overview

The auto-scheduling system is split into specialized modules, each handling a specific type of visit:

- **RN Visits** (`rn.js`) - Primary visits every 14 days with recertification logic
- **NP Visits** (`np.js`) - Face-to-face visits for BP3+ or admission requirements  
- **HOPE Visits** (`hope.js`) - HUV1 (days 6-15) and HUV2 (days 16-30) visits
- **LVN Visits** (`lvn.js`) - Weekly frequency-based visits with varying schedules
- **Utilities** (`utils.js`) - Common functions used across all modules

## Module Details

### RN Module (`rn.js`)
- **Purpose**: Handles RN visit generation with 14-day intervals
- **Logic**: 
  - Generate only 1 suggested visit per patient if none exists within 14 days from last confirmed RN visit or SOC
  - Add "recert" tag if visit is within 14 days of benefit period rollover
- **Key Functions**:
  - `isRNVisitDue()` - Check if RN visit is due
  - `isRecertDue()` - Check if recertification is due
  - `generateRnVisits()` - Main function to generate RN visits

### NP Module (`np.js`)
- **Purpose**: Handles NP face-to-face visits
- **Logic**:
  - Required at start of BP3 or higher
  - Required on admission if BP3+
- **Key Functions**:
  - `isNPVisitRequired()` - Check if NP visit is required
  - `generateNpVisits()` - Main function to generate NP visits

### HOPE Module (`hope.js`)
- **Purpose**: Handles HUV1 (days 6–15) and HUV2 (days 16–30) visits
- **Logic**:
  - Try to attach to existing RN visit first
  - Otherwise, suggest standalone visit
- **Key Functions**:
  - `getHOPETags()` - Get HOPE tags based on days on service
  - `generateHopeVisits()` - Main function to generate HOPE visits

### LVN Module (`lvn.js`)
- **Purpose**: Handles LVN scheduling with varying weekly frequencies
- **Logic**:
  - Weekly frequencies vary by patient (e.g., 3/week alternating with 2/week)
  - Fill remaining frequency slots after RN visits
- **Key Functions**:
  - `parseFrequency()` - Parse frequency string to number
  - `generateLvnVisits()` - Main function to generate LVN visits

### Utils Module (`utils.js`)
- **Purpose**: Common utility functions used across all modules
- **Key Functions**:
  - `findAvailableDay()` - Find available day for patient
  - `getWeekDates()` - Get week dates (Monday to Friday)
  - `createUnassignedVisit()` - Create unassigned visit
  - `mergeWithExistingVisits()` - Merge new visits with existing

## Visit Object Structure

All generated visits follow this structure:

```javascript
{
  id: "auto-{discipline}-{patientId}-{timestamp}",
  patientId: "patient-id",
  patientName: "Patient Name",
  date: "2024-01-01",
  staff: "assigned-staff",
  discipline: "RN|LVN|NP",
  type: "routine",
  completed: false,
  status: "suggested", // or "confirmed"
  notes: "Auto-assigned visit description",
  tags: ["recert", "hope", "huv1", "huv2"], // Optional tags
  priority: "high|medium|low|urgent"
}
```

## Usage

The main orchestrator (`autoScheduleVisits.js`) imports from all modules and coordinates the visit generation:

```javascript
import {
  generateRnVisits,
  generateNpVisits,
  generateHopeVisits,
  generateLvnVisits
} from './autoSchedule/index.js';

// Generate visits for a patient
const rnVisits = generateRnVisits(patient, weekDates, visitsScheduled, findAvailableDay);
const npVisits = generateNpVisits(patient, weekDates, visitsScheduled, findAvailableDay);
const hopeVisits = generateHopeVisits(patient, weekDates, visitsScheduled, findAvailableDay, existingVisits);
const lvnVisits = generateLvnVisits(patient, weekDates, visitsScheduled, findAvailableDay);
```

## Backward Compatibility

The refactored system maintains full backward compatibility:
- All existing imports continue to work
- The `visitUtils` object is preserved
- The `autoScheduleVisits()` function signature remains unchanged
- The `RobustAutoScheduler` class maintains its public interface

## Benefits of Modular Structure

1. **Maintainability**: Each visit type has its own module with focused logic
2. **Scalability**: Easy to add new visit types or modify existing ones
3. **Testability**: Each module can be tested independently
4. **Readability**: Clear separation of concerns makes code easier to understand
5. **Reusability**: Modules can be reused in different contexts

## Future Development

When adding new visit types or modifying existing logic:
1. Create a new module in this directory
2. Export the main function from the module
3. Add the export to `index.js`
4. Import and use in the main orchestrator
5. Update this README with new module documentation 