// Sample Data Configuration
// Single source of truth for all sample data in the hospice scheduler

export const sampleStaff = [
  {
    id: 'staff-1',
    name: 'Rachelle RN',
    role: 'RN',
    color: '#254FBB',
    active: true
  },
  {
    id: 'staff-2',
    name: 'Tej LVN',
    role: 'LVN',
    color: '#38AAE1',
    active: true
  },
  {
    id: 'staff-3',
    name: 'George RN',
    role: 'RN',
    color: '#83CDC1',
    active: true
  },
  {
    id: 'staff-4',
    name: 'Tiffani LVN',
    role: 'LVN',
    color: '#9FDFE1',
    active: true
  },
  {
    id: 'staff-5',
    name: 'Jermaine RN',
    role: 'RN',
    color: '#e74c3c',
    active: true
  },
  {
    id: 'staff-6',
    name: 'Dr. Wilson NP',
    role: 'NP',
    color: '#607D8B',
    active: true
  }
];

// Generate realistic SOC dates (60-100 days ago)
function generateSOCDate() {
  const socDate = new Date();
  socDate.setDate(socDate.getDate() - (60 + Math.floor(Math.random() * 40)));
  return socDate.toISOString().split('T')[0];
}

// Generate visit history from SOC to today based on frequency
function generateVisitHistory(patient) {
  const visits = [];
  const socDate = new Date(patient.socDate);
  const today = new Date();
  const frequency = patient.frequency;
  
  // Parse frequency to get visits per week
  let visitsPerWeek;
  if (frequency.includes('1x')) visitsPerWeek = 1;
  else if (frequency.includes('2x')) visitsPerWeek = 2;
  else if (frequency.includes('3x')) visitsPerWeek = 3;
  else visitsPerWeek = 2; // default
  
  // Generate visits from SOC to today
  let currentDate = new Date(socDate);
  let visitCount = 0;
  
  while (currentDate <= today) {
    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Determine if this day should have a visit based on frequency
      let shouldVisit = false;
      
      if (visitsPerWeek === 1) {
        // 1x/week: Always Monday
        shouldVisit = dayOfWeek === 1;
      } else if (visitsPerWeek === 2) {
        // 2x/week: Monday and Thursday
        shouldVisit = dayOfWeek === 1 || dayOfWeek === 4;
      } else if (visitsPerWeek === 3) {
        // 3x/week: Monday, Wednesday, Friday
        shouldVisit = dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5;
      }
      
      if (shouldVisit) {
        visitCount++;
        visits.push({
          id: `history-${patient.id}-${visitCount}`,
          patientId: patient.id,
          patientName: patient.name,
          date: currentDate.toISOString().split('T')[0],
          staff: patient.assignedRN,
          discipline: 'RN',
          visitType: 'routine',
          completed: true,
          status: 'confirmed',
          notes: 'Backfilled for sample compliance',
          tags: ['routine']
        });
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return visits;
}

export const samplePatients = [
  {
    id: 'patient-1',
    name: 'McDermott, George',
    city: 'Anaheim',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null, // Will be set to SOC date
    frequency: '2x/week',
    assignedRN: 'Rachelle RN',
    assignedLVN: 'Tej LVN',
    assignedNP: null,
    lastRNVisitDate: null, // Will be set after visit history generation
    visitStatus: 'active'
  },
  {
    id: 'patient-2',
    name: 'Olguin, Mary',
    city: 'Artesia',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'George RN',
    assignedLVN: 'Tiffani LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  },
  {
    id: 'patient-3',
    name: 'Dong, Ziming',
    city: 'Buena Park',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'Jermaine RN',
    assignedLVN: 'Tej LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  },
  {
    id: 'patient-4',
    name: 'Tomlinson, Gay',
    city: 'Cypress',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'Rachelle RN',
    assignedLVN: 'Tiffani LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  },
  {
    id: 'patient-5',
    name: 'Toufigh, Riaz',
    city: 'Fullerton',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'George RN',
    assignedLVN: 'Tej LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  },
  {
    id: 'patient-6',
    name: 'Ford, Cathie',
    city: 'Garden Grove',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'Jermaine RN',
    assignedLVN: 'Tiffani LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  },
  {
    id: 'patient-7',
    name: 'Forcucci, James',
    city: 'Huntington Beach',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'Rachelle RN',
    assignedLVN: 'Tej LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  },
  {
    id: 'patient-8',
    name: 'Torres, Ana',
    city: 'Irvine',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'George RN',
    assignedLVN: 'Tiffani LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  },
  {
    id: 'patient-9',
    name: 'Castro, Martha',
    city: 'La Habra',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'Jermaine RN',
    assignedLVN: 'Tej LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  },
  {
    id: 'patient-10',
    name: 'Patil, Jadhav',
    city: 'La Mirada',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'Rachelle RN',
    assignedLVN: 'Tiffani LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  },
  {
    id: 'patient-11',
    name: 'Asselin, Gertrude',
    city: 'Los Alamitos',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'George RN',
    assignedLVN: 'Tej LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  },
  {
    id: 'patient-12',
    name: 'Love, Vivian',
    city: 'Newport Beach',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'Jermaine RN',
    assignedLVN: 'Tiffani LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  },
  {
    id: 'patient-13',
    name: 'Garcia, Arthur',
    city: 'Orange',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'Rachelle RN',
    assignedLVN: 'Tej LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  },
  {
    id: 'patient-14',
    name: 'Reddy Gummi, Sushila',
    city: 'Placentia',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'George RN',
    assignedLVN: 'Tiffani LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  },
  {
    id: 'patient-15',
    name: 'Kitasaki, Utaro',
    city: 'San Clemente',
    socDate: generateSOCDate(),
    benefitPeriodNumber: 'BP1',
    benefitPeriodStart: null,
    frequency: '2x/week',
    assignedRN: 'Jermaine RN',
    assignedLVN: 'Tej LVN',
    assignedNP: null,
    lastRNVisitDate: null,
    visitStatus: 'active'
  }
];

// Process patients to set benefit periods and generate visit history
function processPatientsAndGenerateVisits() {
  const processedPatients = [...samplePatients];
  const allVisits = [];
  
  processedPatients.forEach(patient => {
    // Set benefit period start equal to SOC
    patient.benefitPeriodStart = patient.socDate;
    
    // Generate visit history from SOC to today
    const visitHistory = generateVisitHistory(patient);
    allVisits.push(...visitHistory);
    
    // Set last RN visit date to the latest visit date
    if (visitHistory.length > 0) {
      const latestVisit = visitHistory[visitHistory.length - 1];
      patient.lastRNVisitDate = latestVisit.date;
    }
  });
  
  return { processedPatients, allVisits };
}

// Helper function to get sample data
export const getSampleData = () => {
  const { processedPatients, allVisits } = processPatientsAndGenerateVisits();
  
  console.log('📅 Sample Data Generated:', {
    patientsCount: processedPatients.length,
    visitsCount: allVisits.length,
    patients: processedPatients.map(p => ({
      name: p.name,
      socDate: p.socDate,
      frequency: p.frequency,
      assignedRN: p.assignedRN,
      lastRNVisitDate: p.lastRNVisitDate
    })),
    visitHistory: allVisits.map(v => ({
      patientName: v.patientName,
      date: v.date,
      staff: v.staff,
      completed: v.completed
    }))
  });
  
  return {
    staff: sampleStaff,
    patients: processedPatients,
    visits: allVisits,
    alerts: []
  };
};

// Helper function to add a new sample patient
export const addSamplePatient = (patientData) => {
  const newPatient = {
    id: `patient-${Date.now()}`,
    ...patientData,
    visitStatus: 'active'
  };
  samplePatients.push(newPatient);
  return newPatient;
};

// Helper function to add a new sample staff member
export const addSampleStaff = (staffData) => {
  const newStaff = {
    id: `staff-${Date.now()}`,
    ...staffData,
    active: true
  };
  sampleStaff.push(newStaff);
  return newStaff;
}; 