// dataLoader.js - Data management utilities

// Function to check if we're in demo mode
export function isDemoMode() {
  return localStorage.getItem('demo-mode') === 'true' || 
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1';
}

// Function to clear all data
export async function clearAllData() {
  try {
    localStorage.removeItem('hospice-patients');
    localStorage.removeItem('hospice-staff');
    localStorage.removeItem('hospice-visits');
    localStorage.removeItem('hospice-alerts');
    localStorage.removeItem('hospice-notes');
    localStorage.removeItem('demo-mode');
    
    // Clear any other hospice-related data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('hospice')) {
        localStorage.removeItem(key);
      }
    }
    
    console.log('All data cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
}

// Function to ensure clean startup - clears any existing data
export function ensureCleanStartup() {
  if (isDemoMode()) {
    // Clear any existing data to ensure clean state
    clearAllData();
    console.log('Clean startup ensured - no sample data loaded');
  }
} 