import React, { useState, useEffect } from "react";
import dataManager from "./dataManager.js";
import { visitUtils } from "./autoScheduleVisits.js";
import "./VisitCheck.css";

function VisitCheck({ token, dataVersion, onDataChange }) {
  const [data, setData] = useState(dataManager.getData());
  const [selectedWeek, setSelectedWeek] = useState(dataManager.getCurrentWeek());
  const [confirmingVisit, setConfirmingVisit] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({
    assignedRN: "",
    assignedLVN: "",
    assignedNP: "",
    frequency: ""
  });
  const [showHOPEOnly, setShowHOPEOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [simulatedDate, setSimulatedDate] = useState(dataManager.getSimulatedDate());

  // Initialize data manager and subscribe to changes
  useEffect(() => {
    if (!token) return;
    
    const initializeData = async () => {
      setLoading(true);
      try {
        await dataManager.initialize(token);
        setData(dataManager.getData());
      } catch (err) {
        setError("Failed to initialize data: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    initializeData();

    // Subscribe to data changes
    const unsubscribe = dataManager.subscribe((newData) => {
      setData(newData);
      setSimulatedDate(dataManager.getSimulatedDate());
      if (onDataChange) onDataChange();
    });

    return unsubscribe;
  }, [token, onDataChange]);

  // Get current week (Monday to Friday)
  function getCurrentWeek() {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    return monday.toISOString().split('T')[0];
  }

  // Get week dates for selected week
  function getWeekDates(startDate) {
    const start = new Date(startDate);
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }

  // Confirm a visit
  async function confirmVisit(visit) {
    setConfirmingVisit(visit);
    setError("");
    
    try {
      console.log('Confirming visit:', visit.id, visit.patientName);
      await dataManager.completeVisit(visit.id);
      console.log('Visit confirmed successfully');
      setConfirmingVisit(null);
    } catch (err) {
      console.error('Error confirming visit:', err);
      setError("Failed to confirm visit: " + err.message);
      setConfirmingVisit(null);
    }
  }

  // Open assignment modal
  function openAssignmentModal(patient) {
    setSelectedPatient(patient);
    setAssignmentForm({
      assignedRN: patient.assignedRN || "",
      assignedLVN: patient.assignedLVN || "",
      assignedNP: patient.assignedNP || "",
      frequency: patient.frequency || ""
    });
    setShowAssignmentModal(true);
  }

  // Save assignment
  async function saveAssignment() {
    if (!selectedPatient) return;

    setError("");
    setLoading(true);

    try {
      await dataManager.assignStaffToPatient(selectedPatient.id, assignmentForm);
      setShowAssignmentModal(false);
      setSelectedPatient(null);
    } catch (err) {
      setError("Failed to update assignment: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Schedule a visit (assign staff to unassigned visit)
  async function scheduleVisit(visit) {
    const patient = data.patients.find(p => p.id === visit.patientId);
    if (!patient) return;

    // Open assignment modal for this patient
    openAssignmentModal(patient);
  }

  // NEW: Assign visit to a specific cell in the schedule
  async function assignVisitToCell(visitId, patientId, targetDate, targetStaff) {
    setError("");
    setLoading(true);

    try {
      const visit = data.visits.find(v => v.id === visitId);
      if (!visit) {
        throw new Error("Visit not found");
      }

      // Update the visit with new date and staff
      await dataManager.updateVisit(visitId, {
        date: targetDate,
        staff: targetStaff,
        discipline: visit.discipline || 'UNASSIGNED'
      });

      // Remove from unassigned visits
      const updatedVisits = data.visits.filter(v => v.id !== visitId);
      data.visits = updatedVisits;

      // Notify subscribers of the change
      dataManager.notifySubscribers();

    } catch (err) {
      setError("Failed to assign visit: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // NEW: Auto-assign visit to first available weekday
  async function autoAssignVisit(visit) {
    const patient = data.patients.find(p => p.id === visit.patientId);
    if (!patient) return;

    // Get current week dates
    const weekDates = getWeekDates(selectedWeek);
    
    // Find first available weekday (Mon-Fri)
    let availableDate = null;
    let assignedStaff = null;

    for (const date of weekDates) {
      // Check if this date is available for this patient
      const existingVisit = data.visits.find(v => 
        v.patientId === patient.id && 
        v.date === date && 
        v.staff && 
        v.discipline !== 'UNASSIGNED'
      );

      if (!existingVisit) {
        // Find available staff for this discipline
        const availableStaff = data.staff.filter(s => 
          s.active && 
          s.role === visit.discipline
        );

        if (availableStaff.length > 0) {
          // Prefer assigned staff if available
          let preferredStaff = null;
          if (visit.discipline === 'RN' && patient.assignedRN) {
            preferredStaff = availableStaff.find(s => s.name === patient.assignedRN);
          } else if (visit.discipline === 'LVN' && patient.assignedLVN) {
            preferredStaff = availableStaff.find(s => s.name === patient.assignedLVN);
          } else if (visit.discipline === 'NP' && patient.assignedNP) {
            preferredStaff = availableStaff.find(s => s.name === patient.assignedNP);
          }

          assignedStaff = preferredStaff || availableStaff[0];
          availableDate = date;
          break;
        }
      }
    }

    if (availableDate && assignedStaff) {
      await assignVisitToCell(visit.id, patient.id, availableDate, assignedStaff.name);
    } else {
      setError("No available slots found for this visit. Please assign staff manually.");
    }
  }

  // Get visits for current week
  const weekDates = getWeekDates(selectedWeek);
  const weekVisits = data.visits.filter(v => weekDates.includes(v.date));
  
  // Filter visits based on HOPE filter
  let filteredWeekVisits = weekVisits;
  if (showHOPEOnly) {
    filteredWeekVisits = weekVisits.filter(v => v.tags && v.tags.includes("HOPE"));
  }
  
  const unassignedVisits = filteredWeekVisits.filter(v => !v.staff || v.discipline === 'UNASSIGNED');
  const scheduledVisits = filteredWeekVisits.filter(v => v.staff && v.discipline !== 'UNASSIGNED');

  // Get statistics
  const hopeVisits = weekVisits.filter(v => v.tags && v.tags.includes("HOPE"));
  const huv1Visits = hopeVisits.filter(v => v.tags.includes("HUV1"));
  const huv2Visits = hopeVisits.filter(v => v.tags.includes("HUV2"));

  if (!token) return <div className="visitcheck-container">Please log in to view VisitCheck.</div>;
  if (loading) return <div className="visitcheck-container">Loading...</div>;
  if (error) return <div className="visitcheck-container error">{error}</div>;

  return (
    <div className="visitcheck-container">
      <div className="visitcheck-header">
        <h1>✅ VisitCheck Dashboard</h1>
        <div className="header-controls">
          <div className="week-selector">
            <label>Week of:</label>
            <input
              type="date"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="week-input"
            />
          </div>
          <div className="date-simulator">
            <label>Simulated Date: {simulatedDate.toLocaleDateString()}</label>
            <div className="date-controls">
              <button 
                onClick={() => dataManager.advanceDateByDays(1)}
                className="date-button"
                title="Advance 1 day"
              >
                +1 Day
              </button>
              <button 
                onClick={() => dataManager.advanceDateByDays(7)}
                className="date-button"
                title="Advance 1 week"
              >
                +1 Week
              </button>
              <button 
                onClick={() => dataManager.resetDateToToday()}
                className="date-button reset"
                title="Reset to today"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Alerts Section */}
      {data.alerts.length > 0 && (
        <div className="compliance-alerts">
          <h2>🚨 Compliance Alerts ({data.alerts.length})</h2>
          <div className="alerts-grid">
            {data.alerts.map(alert => (
              <div key={alert.id} className={`alert-card ${alert.severity}`}>
                <div className="alert-header">
                  <span className={`alert-type ${alert.type}`}>
                    {alert.type === 'overdue' ? '⏰' : 
                     alert.type === 'due-soon' ? '⚠️' : 
                     alert.type === 'hope-assessment' ? '📋' : '🚨'}
                  </span>
                  <span className="alert-severity">{alert.severity}</span>
                </div>
                <div className="alert-patient">{alert.patientName}</div>
                <div className="alert-message">{alert.message}</div>
                <div className="alert-date">{alert.date}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unassignedVisits.length > 0 && (
        <div className="unassigned-alert">
          <div className="alert-content">
            <span className="alert-icon">🚨</span>
            <span className="alert-text">
              You have <strong>{unassignedVisits.length}</strong> unassigned visit{unassignedVisits.length !== 1 ? 's' : ''} that need attention
            </span>
            <button
              className="alert-action-button"
              onClick={() => {
                unassignedVisits.forEach(visit => autoAssignVisit(visit));
              }}
              disabled={loading}
            >
              {loading ? 'Assigning...' : 'Assign All'}
            </button>
          </div>
        </div>
      )}

      <div className="visitcheck-stats">
        <div className="stat-card">
          <div className="stat-number">{weekVisits.length}</div>
          <div className="stat-label">Total Visits</div>
        </div>
        <div className="stat-card unassigned">
          <div className="stat-number">{unassignedVisits.length}</div>
          <div className="stat-label">Unassigned</div>
        </div>
        <div className="stat-card scheduled">
          <div className="stat-number">{scheduledVisits.length}</div>
          <div className="stat-label">Scheduled</div>
        </div>
        <div className="stat-card hope">
          <div className="stat-number">{hopeVisits.length}</div>
          <div className="stat-label">HOPE Visits</div>
        </div>
        <div className="stat-card huv1">
          <div className="stat-number">{huv1Visits.length}</div>
          <div className="stat-label">HUV1</div>
        </div>
        <div className="stat-card huv2">
          <div className="stat-number">{huv2Visits.length}</div>
          <div className="stat-label">HUV2</div>
        </div>
      </div>

      <div className="visitcheck-controls">
        <label className="hope-filter">
          <input
            type="checkbox"
            checked={showHOPEOnly}
            onChange={(e) => setShowHOPEOnly(e.target.checked)}
          />
          Show HOPE Visits Only
        </label>
        <button
          onClick={async () => {
            setLoading(true);
            try {
              await dataManager.createTestComplianceData();
              setError("");
            } catch (err) {
              setError("Failed to load sample data: " + err.message);
            } finally {
              setLoading(false);
            }
          }}
          className="load-sample-button"
          disabled={loading}
        >
          {loading ? 'Loading...' : '📊 Load Sample Data'}
        </button>
        <button
          onClick={async () => {
            setLoading(true);
            try {
              await dataManager.resetAndCreateFreshSampleData();
              setError("");
            } catch (err) {
              setError("Failed to reset sample data: " + err.message);
            } finally {
              setLoading(false);
            }
          }}
          className="reset-sample-button"
          disabled={loading}
        >
          {loading ? 'Resetting...' : '🔄 Reset Sample Data'}
        </button>
      </div>

      <div className="visitcheck-content">
        <div className="visits-section">
          <div className="section-header">
            <h2>🚨 Unassigned Visits ({unassignedVisits.length})</h2>
            {unassignedVisits.length > 0 && (
              <button
                className="bulk-assign-button"
                onClick={() => {
                  unassignedVisits.forEach(visit => autoAssignVisit(visit));
                }}
                disabled={loading}
              >
                {loading ? 'Assigning All...' : 'Assign All'}
              </button>
            )}
          </div>
          <div className="visits-grid">
            {unassignedVisits.map(visit => {
              const patient = data.patients.find(p => p.id === visit.patientId);
              const isOverdue = visitUtils.isOverdue(visit);
              
              return (
                <div
                  key={visit.id}
                  className={`visit-card unassigned ${isOverdue ? 'overdue' : ''}`}
                  style={{ boxShadow: visitUtils.getOverdueGlow(visit) }}
                >
                  <div className="visit-header">
                    <span className="patient-name">{patient?.name}</span>
                    <span
                      className="discipline-badge unassigned"
                      style={{ backgroundColor: visitUtils.getDisciplineColor(visit.discipline) }}
                    >
                      {visit.discipline}
                    </span>
                  </div>
                  <div className="visit-date">{visitUtils.formatVisitDate(visit.date)}</div>
                  <div className="visit-notes">{visit.notes}</div>
                  <div className="visit-tags">
                    {visit.tags && visit.tags.map(tag => (
                      <span
                        key={tag}
                        className="tag"
                        style={{ backgroundColor: visitUtils.getTagColor(tag) }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="visit-actions">
                    <button
                      className="assign-button"
                      onClick={() => openAssignmentModal(patient)}
                    >
                      Assign Staff
                    </button>
                    <button
                      className="schedule-button"
                      onClick={() => autoAssignVisit(visit)}
                      disabled={loading}
                    >
                      {loading ? 'Assigning...' : 'Assign Now'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="visits-section">
          <h2>📅 Scheduled Visits ({scheduledVisits.length})</h2>
          <div className="visits-grid">
            {scheduledVisits.map(visit => {
              const patient = data.patients.find(p => p.id === visit.patientId);
              const isOverdue = visitUtils.isOverdue(visit);
              const isHOPE = visit.tags && visit.tags.includes("HOPE");
              
              return (
                <div
                  key={visit.id}
                  className={`visit-card scheduled ${visit.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''} ${isHOPE ? 'hope' : ''}`}
                  style={{ boxShadow: visitUtils.getOverdueGlow(visit) }}
                >
                  <div className="visit-header">
                    <span className="patient-name">{patient?.name}</span>
                    <span
                      className="discipline-badge"
                      style={{ backgroundColor: visitUtils.getDisciplineColor(visit.discipline) }}
                    >
                      {visit.discipline}
                    </span>
                  </div>
                  <div className="visit-date">{visitUtils.formatVisitDate(visit.date)}</div>
                  <div className="visit-staff">Staff: {visit.staff}</div>
                  <div className="visit-notes">{visit.notes}</div>
                  <div className="visit-tags">
                    {visit.tags && visit.tags.map(tag => (
                      <span
                        key={tag}
                        className="tag"
                        style={{ backgroundColor: visitUtils.getTagColor(tag) }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {visit.completed ? (
                    <div className="completed-badge">✓ Completed</div>
                  ) : (
                    <div className="visit-actions">
                      <button
                        className="confirm-button"
                        onClick={() => confirmVisit(visit)}
                        disabled={confirmingVisit?.id === visit.id}
                      >
                        {confirmingVisit?.id === visit.id ? 'Confirming...' : 'Confirm Visit'}
                      </button>
                      <button
                        className="edit-button"
                        onClick={() => openAssignmentModal(patient)}
                      >
                        Edit Assignment
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignmentModal && selectedPatient && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Assign Staff to {selectedPatient.name}</h3>
            <div className="modal-form">
              <div className="form-group">
                <label>RN:</label>
                <select
                  value={assignmentForm.assignedRN}
                  onChange={(e) => setAssignmentForm({...assignmentForm, assignedRN: e.target.value})}
                >
                  <option value="">Select RN</option>
                  {data.staff.filter(s => s.role === "RN" && s.active).map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>LVN:</label>
                <select
                  value={assignmentForm.assignedLVN}
                  onChange={(e) => setAssignmentForm({...assignmentForm, assignedLVN: e.target.value})}
                >
                  <option value="">Select LVN</option>
                  {data.staff.filter(s => s.role === "LVN" && s.active).map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>NP:</label>
                <select
                  value={assignmentForm.assignedNP}
                  onChange={(e) => setAssignmentForm({...assignmentForm, assignedNP: e.target.value})}
                >
                  <option value="">Select NP</option>
                  {data.staff.filter(s => s.role === "NP" && s.active).map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Frequency:</label>
                <select
                  value={assignmentForm.frequency}
                  onChange={(e) => setAssignmentForm({...assignmentForm, frequency: e.target.value})}
                >
                  <option value="">Select Frequency</option>
                  <option value="1x/week">1x/week</option>
                  <option value="2x/week">2x/week</option>
                  <option value="3x/week">3x/week</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                onClick={saveAssignment} 
                className="save-button"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Assignment'}
              </button>
              <button 
                onClick={() => setShowAssignmentModal(false)} 
                className="cancel-button"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VisitCheck; 