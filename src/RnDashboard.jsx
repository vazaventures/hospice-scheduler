// RnDashboard.js

import React, { useEffect, useState } from "react";
import dataManager from "./dataManager.js";

// Helper function to get current week dates
function getCurrentWeekDates() {
  const dates = [];
  const monday = new Date();
  
  // Find the most recent Monday (or today if it's Monday)
  const dayOfWeek = monday.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so we go back 6 days
  monday.setDate(monday.getDate() - daysToMonday);
  
  // Generate 7 days starting from Monday
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

// Helper functions for RN visit calculations
function calculateNextRnVisit(patientId, visits) {
  // Get the most recent completed RN visit for this patient
  const completedRNVisits = visits.filter(v => 
    v.patientId === patientId && 
    v.discipline === 'RN' && 
    v.completed
  ).sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const lastCompletedRNVisit = completedRNVisits[0];
  
  if (!lastCompletedRNVisit) {
    return new Date().toISOString().split('T')[0]; // Today if no completed visit
  }
  
  const lastVisit = new Date(lastCompletedRNVisit.date);
  const nextVisit = new Date(lastVisit);
  nextVisit.setDate(lastVisit.getDate() + 14); // 14 days from last completed visit
  
  return nextVisit.toISOString().split('T')[0];
}

function isRecertificationDue(socDate, benefitPeriodStart) {
  if (!socDate || !benefitPeriodStart) return false;
  
  const benefitStart = new Date(benefitPeriodStart);
  const today = new Date();
  const daysInBenefitPeriod = Math.floor((today - benefitStart) / (1000 * 60 * 60 * 24));
  
  // Recertification is due in the last 14 days of a benefit period
  // Assuming 60-day benefit periods
  const daysUntilEnd = 60 - (daysInBenefitPeriod % 60);
  return daysUntilEnd <= 14;
}

// Check if patient has scheduled RN visits in current week or future
function hasScheduledRnVisit(patientId, visits) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day
  
  return visits.some(v => {
    const visitDate = new Date(v.date.split('T')[0]);
    visitDate.setHours(0, 0, 0, 0);
    
    return v.patientId === patientId && 
           v.discipline === 'RN' &&
           visitDate >= today &&
           (v.status === 'confirmed' || v.status === 'suggested');
  });
}

// Get the last completed RN visit date for a patient
function getLastCompletedVisitDate(patientId, discipline, visits) {
  const completedVisits = visits.filter(v => 
    v.patientId === patientId && 
    v.discipline === discipline && 
    v.completed
  ).sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return completedVisits.length > 0 ? completedVisits[0].date : null;
}

// Determine patient status based on visit data
function getPatientStatus(patientId, visits) {
  const hasCompletedVisits = visits.some(v => 
    v.patientId === patientId && 
    v.completed
  );
  
  if (hasCompletedVisits) {
    return 'In Progress';
  } else {
    return 'Pending';
  }
}

function RnDashboard({ token, dataVersion, onDataChange }) {
  const [data, setData] = useState(dataManager.getData());
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState("recert");
  const [searchTerm, setSearchTerm] = useState("");
  const [completingVisit, setCompletingVisit] = useState(null);
  const [editingPatient, setEditingPatient] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Initialize data manager and subscribe to changes
  useEffect(() => {
    if (!token) return;
    
    const initializeData = async () => {
      try {
        await dataManager.initialize(token);
        setData(dataManager.getData());
      } catch (err) {
        setError("Failed to initialize data: " + err.message);
      }
    };

    initializeData();

    // Subscribe to data changes
    const unsubscribe = dataManager.subscribe((newData) => {
      setData(newData);
      if (onDataChange) onDataChange();
    });

    return unsubscribe;
  }, [token, onDataChange]);

  // Load notes from localStorage if available
  useEffect(() => {
    const savedNotes = localStorage.getItem("hospice-notes");
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes));
    }
  }, []);

  // Handle note change
  const handleNoteChange = (patientId, value) => {
    const updatedNotes = { ...notes, [patientId]: value };
    setNotes(updatedNotes);
    localStorage.setItem("hospice-notes", JSON.stringify(updatedNotes));
  };

  // Complete a visit
  const handleCompleteVisit = async (patientId) => {
    setCompletingVisit(patientId);
    setError("");

    try {
      // Find the most recent RN visit for this patient
      const patientVisits = data.visits.filter(v => 
        v.patientId === patientId && 
        v.discipline === "RN" && 
        !v.completed
      );

      if (patientVisits.length > 0) {
        // Complete the most recent visit
        const visitToComplete = patientVisits[0];
        await dataManager.completeVisit(visitToComplete.id);
      } else {
        // Create a new completed visit for today
        const today = new Date().toISOString().split('T')[0];
        const patient = data.patients.find(p => p.id === patientId);
        if (patient) {
          await dataManager.createVisit({
            patientId: patientId,
            patientName: patient.name,
            date: today,
            staff: patient.assignedRN || 'Unassigned',
            discipline: 'RN',
            type: 'routine',
            completed: true,
            notes: '',
            tags: []
          });
        }
      }
    } catch (err) {
      setError("Failed to complete visit: " + err.message);
    } finally {
      setCompletingVisit(null);
    }
  };

  // Start editing a patient
  const startEditPatient = (patient) => {
    setEditingPatient(patient);
    setEditForm({
      assignedRN: patient.assignedRN || "",
      frequency: patient.frequency || "",
      lastRNVisitDate: patient.lastRNVisitDate || ""
    });
  };

  // Save patient edits
  const savePatientEdit = async () => {
    if (!editingPatient) return;

    setError("");
    setLoading(true);

    try {
      await dataManager.updatePatient(editingPatient.id, editForm);
      setEditingPatient(null);
      setEditForm({});
    } catch (err) {
      setError("Failed to update patient: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingPatient(null);
    setEditForm({});
  };

  // Navigate to Weekly Schedule for specific patient
  const handleGoToSchedule = (patientId) => {
    // Store patient ID in sessionStorage for WeeklySchedule to scroll to
    sessionStorage.setItem('scrollToPatientId', patientId);
    
    // Navigate to Schedule tab
    const scheduleTab = document.querySelector('[role="tabpanel"] button[data-tab="schedule"], [data-tab="schedule"], .tab-schedule');
    if (scheduleTab) {
      scheduleTab.click();
    } else {
      // Fallback - try to find any element that might navigate to schedule
      const scheduleLink = document.querySelector('a[href*="schedule"], button[title*="Schedule"], .schedule-nav');
      if (scheduleLink) {
        scheduleLink.click();
      } else {
        // Last resort - try to dispatch a custom event
        window.dispatchEvent(new CustomEvent('navigateToSchedule', { detail: { patientId } }));
      }
    }
  };

  // Get enriched patient data
  const getEnrichedPatients = () => {
    return data.patients.map((p) => {
      const nextRnVisit = calculateNextRnVisit(p.id, data.visits);
      const recertDue = isRecertificationDue(p.socDate, p.benefitPeriodStart);
      const daysUntilNext = Math.ceil((new Date(nextRnVisit) - new Date()) / (1000 * 60 * 60 * 24));
      const hasScheduledVisit = hasScheduledRnVisit(p.id, data.visits);
      const lastCompletedRNVisitDate = getLastCompletedVisitDate(p.id, 'RN', data.visits);
      const currentStatus = getPatientStatus(p.id, data.visits);
      
      // Patient is truly overdue only if days until next < 0 AND no scheduled visit
      const isTrulyOverdue = daysUntilNext < 0 && !hasScheduledVisit;
      
      return { 
        ...p, 
        nextRnVisit, 
        recertDue,
        daysUntilNext,
        hasScheduledVisit,
        isTrulyOverdue,
        lastCompletedRNVisitDate,
        currentStatus
      };
    });
  };

  // Filter patients based on current filter type
  const getFilteredPatients = () => {
    let filtered = getEnrichedPatients();
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.id || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply type filter
    switch (filterType) {
      case "recert":
        filtered = filtered.filter(p => p.recertDue);
        break;
      case "overdue":
        // Show only patients who are overdue AND not currently scheduled
        filtered = filtered.filter(p => p.isTrulyOverdue);
        break;
      case "due-soon":
        filtered = filtered.filter(p => p.daysUntilNext >= 0 && p.daysUntilNext <= 3 && !p.hasScheduledVisit);
        break;
      case "all":
        // Show all patients
        break;
      default:
        break;
    }
    
    return filtered;
  };

  const filteredPatients = getFilteredPatients();
  const enrichedPatients = getEnrichedPatients();

  const recertCount = enrichedPatients.filter(p => p.recertDue).length;
  const overdueCount = enrichedPatients.filter(p => p.isTrulyOverdue).length;
  const dueSoonCount = enrichedPatients.filter(p => p.daysUntilNext >= 0 && p.daysUntilNext <= 3 && !p.hasScheduledVisit).length;

  if (!token) {
    return <div className="rn-dashboard-container">Please log in to view the RN Dashboard</div>;
  }

  if (error) {
    return <div className="rn-dashboard-container error">Error: {error}</div>;
  }

  return (
    <div className="rn-dashboard-container">
      <div className="dashboard-header">
        <h1>🩺 RN Visit Dashboard</h1>
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-number">{data.patients.length}</div>
            <div className="stat-label">Total Patients</div>
          </div>
          <div className="stat-card recert">
            <div className="stat-number">{recertCount}</div>
            <div className="stat-label">Recert Due</div>
          </div>
          <div className="stat-card overdue">
            <div className="stat-number">{overdueCount}</div>
            <div className="stat-label">Overdue Visits</div>
          </div>
          <div className="stat-card due-soon">
            <div className="stat-number">{dueSoonCount}</div>
            <div className="stat-label">Due Soon (≤3 days)</div>
          </div>
        </div>
      </div>

      <div className="dashboard-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search patients by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filters-section">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="recert">Recertification Due</option>
            <option value="overdue">Overdue Visits</option>
            <option value="due-soon">Due Soon (≤3 days)</option>
            <option value="all">All Patients</option>
          </select>
        </div>
      </div>

      <div className="patients-table">
        <table>
          <thead>
            <tr>
              <th>Patient Name</th>
              <th>City</th>
              <th>Assigned RN</th>
              <th>Frequency</th>
              <th>Last RN Visit</th>
              <th>Next RN Visit</th>
              <th>Days Until Due</th>
              <th>Status</th>
              <th>Recert Status</th>
              <th>Actions</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map(patient => (
              <tr key={patient.id} className={editingPatient?.id === patient.id ? 'editing' : ''}>
                {editingPatient?.id === patient.id ? (
                  // Edit mode
                  <>
                    <td>{patient.name}</td>
                    <td>{patient.city}</td>
                    <td>
                      <select
                        value={editForm.assignedRN}
                        onChange={(e) => setEditForm({...editForm, assignedRN: e.target.value})}
                        className="edit-select"
                      >
                        <option value="">Select RN</option>
                        {data.staff.filter(s => s.role === "RN" && s.active).map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={editForm.frequency}
                        onChange={(e) => setEditForm({...editForm, frequency: e.target.value})}
                        className="edit-select"
                      >
                        <option value="">Select Frequency</option>
                        <option value="1x/week">1x/week</option>
                        <option value="2x/week">2x/week</option>
                        <option value="3x/week">3x/week</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="date"
                        value={editForm.lastRNVisitDate}
                        onChange={(e) => setEditForm({...editForm, lastRNVisitDate: e.target.value})}
                        className="edit-input"
                        placeholder="Auto-calculated from visits"
                        title="This will be auto-calculated from completed visits"
                      />
                    </td>
                    <td>{patient.nextRnVisit}</td>
                    <td>
                      <span className={`days-badge ${patient.daysUntilNext < 0 ? 'overdue' : patient.daysUntilNext <= 3 ? 'due-soon' : 'normal'}`}>
                        {patient.daysUntilNext < 0 ? `${Math.abs(patient.daysUntilNext)} overdue` : patient.daysUntilNext}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${patient.currentStatus === 'In Progress' ? 'in-progress' : 'pending'}`}>
                        {patient.currentStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`recert-badge ${patient.recertDue && !patient.hasScheduledVisit ? 'critical' : patient.recertDue ? 'due' : 'ok'}`}>
                        {patient.recertDue && !patient.hasScheduledVisit ? '❗Missing Visit + Recert Due' : patient.recertDue ? 'Due' : 'OK'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button onClick={savePatientEdit} className="save-button" disabled={loading}>
                          {loading ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={cancelEdit} className="cancel-button" disabled={loading}>
                          Cancel
                        </button>
                      </div>
                    </td>
                    <td>
                      <textarea
                        value={notes[patient.id] || ""}
                        onChange={(e) => handleNoteChange(patient.id, e.target.value)}
                        placeholder="Add notes..."
                        className="notes-textarea"
                      />
                    </td>
                  </>
                ) : (
                  // View mode
                  <>
                    <td>{patient.name}</td>
                    <td>{patient.city}</td>
                    <td>{patient.assignedRN || "Unassigned"}</td>
                    <td>{patient.frequency}</td>
                    <td>{patient.lastCompletedRNVisitDate ? new Date(patient.lastCompletedRNVisitDate).toLocaleDateString() : "Never"}</td>
                    <td>{patient.nextRnVisit}</td>
                    <td>
                      <span className={`days-badge ${patient.daysUntilNext < 0 ? 'overdue' : patient.daysUntilNext <= 3 ? 'due-soon' : 'normal'}`}>
                        {patient.daysUntilNext < 0 ? `${Math.abs(patient.daysUntilNext)} overdue` : patient.daysUntilNext}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${patient.currentStatus === 'In Progress' ? 'in-progress' : 'pending'}`}>
                        {patient.currentStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`recert-badge ${patient.recertDue && !patient.hasScheduledVisit ? 'critical' : patient.recertDue ? 'due' : 'ok'}`}>
                        {patient.recertDue && !patient.hasScheduledVisit ? '❗Missing Visit + Recert Due' : patient.recertDue ? 'Due' : 'OK'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleCompleteVisit(patient.id)}
                          className="complete-button"
                          disabled={completingVisit === patient.id}
                        >
                          {completingVisit === patient.id ? 'Completing...' : 'Complete Visit'}
                        </button>
                        <button
                          onClick={() => startEditPatient(patient)}
                          className="edit-button"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleGoToSchedule(patient.id)}
                          className="schedule-link-button"
                          title="Go to Weekly Schedule for this patient"
                        >
                          🔗
                        </button>
                      </div>
                    </td>
                    <td>
                      <textarea
                        value={notes[patient.id] || ""}
                        onChange={(e) => handleNoteChange(patient.id, e.target.value)}
                        placeholder="Add notes..."
                        className="notes-textarea"
                      />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .rn-dashboard-container {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          flex-wrap: wrap;
          gap: 20px;
        }

        .dashboard-header h1 {
          margin: 0;
          color: #2c3e50;
          font-size: 2rem;
        }

        .dashboard-stats {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }

        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          text-align: center;
          min-width: 120px;
        }

        .stat-card.recert {
          border-left: 4px solid #e74c3c;
        }

        .stat-card.overdue {
          border-left: 4px solid #f39c12;
        }

        .stat-card.due-soon {
          border-left: 4px solid #3498db;
        }

        .stat-number {
          font-size: 2rem;
          font-weight: bold;
          color: #2c3e50;
        }

        .stat-label {
          color: #7f8c8d;
          font-size: 0.9rem;
          margin-top: 5px;
        }

        .dashboard-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 15px;
        }

        .search-input {
          padding: 10px 15px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 1rem;
          min-width: 250px;
        }

        .filter-select {
          padding: 10px 15px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 1rem;
          background: white;
        }

        .patients-table {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e0e0e0;
        }

        th {
          background: #f8f9fa;
          font-weight: 600;
          color: #2c3e50;
        }

        tr:hover {
          background: #f8f9fa;
        }

        tr.editing {
          background: #fff3cd;
        }

        .days-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .days-badge.overdue {
          background: #f8d7da;
          color: #721c24;
        }

        .days-badge.due-soon {
          background: #fff3cd;
          color: #856404;
        }

        .days-badge.normal {
          background: #d4edda;
          color: #155724;
        }

        .recert-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .recert-badge.due {
          background: #f8d7da;
          color: #721c24;
        }

        .recert-badge.ok {
          background: #d4edda;
          color: #155724;
        }

        .recert-badge.critical {
          background: #dc3545;
          color: white;
          font-weight: bold;
          animation: pulse 2s infinite;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .status-badge.in-progress {
          background: #e3f2fd;
          color: #1976d2;
        }

        .status-badge.pending {
          background: #fff3e0;
          color: #f57c00;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }

        .action-buttons {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }

        .complete-button {
          padding: 6px 12px;
          background: #27ae60;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .complete-button:hover {
          background: #229954;
        }

        .complete-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }

        .edit-button {
          padding: 6px 12px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .edit-button:hover {
          background: #2980b9;
        }

        .schedule-link-button {
          padding: 6px 10px;
          background: #9b59b6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: bold;
        }

        .schedule-link-button:hover {
          background: #8e44ad;
          transform: scale(1.05);
        }

        .save-button {
          padding: 6px 12px;
          background: #27ae60;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .save-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }

        .cancel-button {
          padding: 6px 12px;
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .cancel-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }

        .edit-input, .edit-select {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
        }

        .notes-textarea {
          width: 100%;
          min-height: 60px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
          resize: vertical;
        }

        .error {
          background: #f8d7da;
          color: #721c24;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
        }

        @media (max-width: 1200px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .dashboard-controls {
            flex-direction: column;
            align-items: stretch;
          }
          
          .search-input {
            min-width: auto;
          }
        }
      `}</style>
    </div>
  );
}

export default RnDashboard;
