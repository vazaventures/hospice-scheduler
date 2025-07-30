import React, { useState, useEffect } from "react";
import dataManager from "./dataManager.js";
import { visitUtils, autoScheduleVisits } from "./autoScheduleVisits.js";
import PRNVisitForm from "./components/PRNVisitForm.jsx";
import VisitEditModal from "./components/VisitEditModal.jsx";
import VisitHistoryModal from "./components/VisitHistoryModal.jsx";
import { calculateBenefitPeriodCountdown, getDailyVisitCount, getStaffExceedingDailyLimit } from "./autoSchedule/utils.js";
import "./WeeklySchedule.css";

function getWeekDates(start = new Date(), weekOffset = 0) {
    const dates = [];
    const monday = new Date(start);
    monday.setDate(start.getDate() - start.getDay() + 1 + weekOffset * 7);
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
}

function WeeklySchedule({ token, dataVersion, onDataChange }) {
    const [data, setData] = useState(dataManager.getData());
    const [weekOffset, setWeekOffset] = useState(0);
    const [draggedVisit, setDraggedVisit] = useState(null);
    const [dragOverCell, setDragOverCell] = useState(null);
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [selectedCell, setSelectedCell] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [cityFilter, setCityFilter] = useState("all");
    const [showComplianceOnly, setShowComplianceOnly] = useState(false);
    const [showPRNForm, setShowPRNForm] = useState(false);
    const [selectedPatientForPRN, setSelectedPatientForPRN] = useState(null);
    
    // New Sprint 4+5 state
    const [showVisitEditModal, setShowVisitEditModal] = useState(false);
    const [selectedVisitForEdit, setSelectedVisitForEdit] = useState(null);
    const [showVisitHistoryModal, setShowVisitHistoryModal] = useState(false);
    const [selectedPatientForHistory, setSelectedPatientForHistory] = useState(null);
    const [staffFilter, setStaffFilter] = useState("all");

    const week = getWeekDates(new Date(), weekOffset);

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

    // Re-run auto-scheduling when week changes
    useEffect(() => {
        if (data.patients.length > 0 && data.visits.length > 0) {
            regenerateVisitsForWeek();
        }
    }, [weekOffset, data.patients, data.visits]);

    // Regenerate visits for the current week
    const regenerateVisitsForWeek = async () => {
        try {
            setLoading(true);
            
            // Get existing visits for this week
            const existingVisits = data.visits.filter(v => 
                week.includes(v.date) && v.status === 'confirmed'
            );
            
            // Get all confirmed visits (for 14-day RN rule)
            const allConfirmedVisits = data.visits.filter(v => v.status === 'confirmed');
            
            // Run auto-scheduler for this week
            const newVisits = autoScheduleVisits(data.patients, allConfirmedVisits, week);
            
            // Filter out visits that are already confirmed
            const suggestedVisits = newVisits.filter(v => v.status === 'suggested');
            
            // Remove old suggested visits for this week
            const visitsToKeep = data.visits.filter(v => 
                !(week.includes(v.date) && v.status === 'suggested')
            );
            
            // Add new suggested visits
            const updatedVisits = [...visitsToKeep, ...suggestedVisits];
            
            // Update data manager
            dataManager.data.visits = updatedVisits;
            await dataManager.saveData();
            
        } catch (err) {
            console.error('Error regenerating visits:', err);
        } finally {
            setLoading(false);
        }
    };

    // Get all active patients
    const getActivePatients = () => {
        return data.patients.filter(p => p.visitStatus !== 'complete');
    };

    // Get daily visit counts for header
    const getDailyVisitCounts = () => {
        const counts = {};
        week.forEach(date => {
            counts[date] = {};
            data.staff.forEach(staff => {
                counts[date][staff.name] = getDailyVisitCount(staff.name, date, data.visits);
            });
        });
        return counts;
    };

    // Get staff exceeding daily limits
    const getExceededStaff = (date) => {
        return getStaffExceedingDailyLimit(date, data.visits, data.staff);
    };

    // Get filtered patients based on staff filter
    const getFilteredPatients = () => {
        let filtered = getActivePatients();

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(patient =>
                patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                patient.city.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply city filter
        if (cityFilter !== "all") {
            filtered = filtered.filter(patient => patient.city === cityFilter);
        }

        // Apply staff filter
        if (staffFilter !== "all") {
            filtered = filtered.filter(patient => {
                const patientVisits = data.visits.filter(v => 
                    v.patientId === patient.id && 
                    week.includes(v.date) &&
                    v.staff === staffFilter
                );
                return patientVisits.length > 0;
            });
        }

        // Apply compliance filter
        if (showComplianceOnly) {
            filtered = filtered.filter(patient => {
                const status = getPatientComplianceStatus(patient);
                return status.status === 'critical' || status.status === 'warning';
            });
        }

        return filtered;
    };

    // Get visit for patient on specific date
    const getVisitForPatient = (patientId, date) => {
        return data.visits.find(v => v.patientId === patientId && v.date === date);
    };

    // Check if cell has conflict (too many visits for one staff)
    const hasConflict = (date, staffName) => {
        const visitsOnDate = data.visits.filter(v => 
            v.date === date && 
            v.staff === staffName && 
            !v.completed
        );
        
        const rnVisits = visitsOnDate.filter(v => v.discipline === 'RN');
        const lvnVisits = visitsOnDate.filter(v => v.discipline === 'LVN');
        
        return rnVisits.length > 1 || lvnVisits.length > 2;
    };

    // Drag and drop handlers
    const handleDragStart = (e, visit) => {
        setDraggedVisit(visit);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, patientId, date) => {
        e.preventDefault();
        setDragOverCell({ patientId, date });
    };

    const handleDragLeave = () => {
        setDragOverCell(null);
    };

    const handleDrop = async (e, targetPatientId, targetDate) => {
        e.preventDefault();
        if (!draggedVisit) return;

        try {
            // Update the visit with new patient and date
            await dataManager.updateVisit(draggedVisit.id, {
                patientId: targetPatientId,
                date: targetDate
            });

            // Update patient name in visit
            const targetPatient = data.patients.find(p => p.id === targetPatientId);
            if (targetPatient) {
                await dataManager.updateVisit(draggedVisit.id, {
                    patientName: targetPatient.name
                });
            }

            setDraggedVisit(null);
            setDragOverCell(null);
        } catch (error) {
            console.error('Error moving visit:', error);
        }
    };

    // Handle cell click to assign staff or edit visit
    const handleCellClick = (patientId, date) => {
        const visit = getVisitForPatient(patientId, date);
        if (visit) {
            setSelectedCell({ patientId, date, visit });
            setShowAssignmentModal(true);
        }
    };

    // Handle edit visit
    const handleEditVisit = (visit) => {
        setSelectedVisitForEdit(visit);
        setShowVisitEditModal(true);
    };

    // Handle visit history
    const handleShowVisitHistory = (patient) => {
        setSelectedPatientForHistory(patient);
        setShowVisitHistoryModal(true);
    };

    // Handle staff assignment
    const handleAssignStaff = async (staffName) => {
        if (!selectedCell) return;

        try {
            await dataManager.updateVisit(selectedCell.visit.id, {
                staff: staffName,
                status: 'confirmed' // Mark as confirmed when staff is assigned
            });
            setShowAssignmentModal(false);
            setSelectedCell(null);
        } catch (error) {
            console.error('Error assigning staff:', error);
        }
    };

    // Handle visit completion
    const handleCompleteVisit = async (visitId) => {
        try {
            await dataManager.completeVisit(visitId);
        } catch (error) {
            console.error('Error completing visit:', error);
        }
    };

    // Handle PRN visit creation
    const handleCreatePRNVisit = (patient) => {
        setSelectedPatientForPRN(patient);
        setShowPRNForm(true);
    };

    const handlePRNVisitCreated = () => {
        setShowPRNForm(false);
        setSelectedPatientForPRN(null);
    };

    // Get cell styling
    const getCellStyling = (patientId, date) => {
        const visit = getVisitForPatient(patientId, date);
        const isDragOver = dragOverCell && dragOverCell.patientId === patientId && dragOverCell.date === date;
        
        let style = {
            border: '1px solid #ddd',
            padding: '8px',
            minHeight: '60px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
        };

        if (isDragOver) {
            style.backgroundColor = '#e3f2fd';
            style.border = '2px dashed #2196f3';
        }

        if (visit) {
            if (visit.completed) {
                style.backgroundColor = '#e8f5e8';
                style.borderColor = '#4caf50';
            } else if (visitUtils.isOverdue(visit)) {
                style.backgroundColor = '#ffebee';
                style.borderColor = '#f44336';
            } else {
                style.backgroundColor = '#f5f5f5';
            }
        }

        return style;
    };

    // Get visit display content with new styling
    const getVisitContent = (visit) => {
        if (!visit) return null;

        const isOverdue = visitUtils.isOverdue(visit);
        const isSuggested = visit.status === 'suggested';
        const isOverLimit = visit.tags && visit.tags.includes('over-limit');

        return (
            <div 
                className={`visit-cell ${visit.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''} ${isSuggested ? 'suggested' : ''}`}
                draggable={!visit.completed}
                onDragStart={(e) => handleDragStart(e, visit)}
                title={`${visit.patientName} - ${new Date(visit.date).toLocaleDateString()}\n${visit.visitType || 'routine'} ${visit.discipline}\n${visit.staff || 'Unassigned'}\n${visit.notes || 'No notes'}`}
                style={{ 
                    backgroundColor: visitUtils.getDisciplineColor(visit.discipline),
                    color: 'white',
                    padding: '4px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: visit.completed ? 'default' : 'grab',
                    border: isSuggested ? '2px dotted rgba(255,255,255,0.7)' : 'none',
                    opacity: isSuggested ? 0.8 : 1,
                    position: 'relative'
                }}
            >
                <div style={{ fontWeight: 'bold' }}>{visit.staff || 'Unassigned'}</div>
                <div style={{ fontSize: '10px' }}>{visit.discipline}</div>
                
                {/* Tag badges */}
                {visit.tags && visit.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '2px', marginTop: '2px', flexWrap: 'wrap' }}>
                        {visit.tags.map(tag => (
                            <span 
                                key={tag}
                                style={{
                                    backgroundColor: visitUtils.getTagColor(tag),
                                    color: 'white',
                                    padding: '1px 3px',
                                    borderRadius: '2px',
                                    fontSize: '8px',
                                    fontWeight: 'bold'
                                }}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
                
                {/* Over limit warning */}
                {isOverLimit && (
                    <div style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        backgroundColor: '#ff0000',
                        color: 'white',
                        borderRadius: '50%',
                        width: '12px',
                        height: '12px',
                        fontSize: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                    }}>
                        ⚠️
                    </div>
                )}
                
                <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                    {!visit.completed && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteVisit(visit.id);
                            }}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                color: 'white',
                                padding: '2px 4px',
                                borderRadius: '2px',
                                fontSize: '10px',
                                cursor: 'pointer'
                            }}
                        >
                            ✓
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleEditVisit(visit);
                        }}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '2px 4px',
                            borderRadius: '2px',
                            fontSize: '10px',
                            cursor: 'pointer'
                        }}
                    >
                        ✏️
                    </button>
                </div>
            </div>
        );
    };

    // Get patient compliance status
    const getPatientComplianceStatus = (patient) => {
        const nextRN = visitUtils.calculateNextRNVisit(patient);
        const recertWindow = visitUtils.calculateRecertWindow(patient);
        const socDate = new Date(patient.socDate);
        const today = new Date();
        const daysOnService = Math.floor((today - socDate) / (1000 * 60 * 60 * 24));
        
        let status = 'normal';
        let message = '';

        if (nextRN.isOverdue) {
            status = 'critical';
            message = `RN overdue by ${Math.abs(nextRN.daysUntilDue)} days`;
        } else if (nextRN.daysUntilDue <= 3) {
            status = 'warning';
            message = `RN due in ${nextRN.daysUntilDue} days`;
        } else if (recertWindow && recertWindow.isInWindow) {
            status = 'warning';
            message = `Recert due in ${recertWindow.daysUntilEnd} days`;
        } else if (daysOnService >= 6 && daysOnService <= 15) {
            status = 'info';
            message = 'HOPE HUV1 window';
        } else if (daysOnService >= 16 && daysOnService <= 30) {
            status = 'info';
            message = 'HOPE HUV2 window';
        }

        return { status, message };
    };

    // Get patient info with benefit period countdown
    const getPatientInfo = (patient) => {
        const complianceStatus = getPatientComplianceStatus(patient);
        const benefitCountdown = calculateBenefitPeriodCountdown(patient);
        
        return (
            <div className="patient-info">
                <div className="patient-name">
                    {patient.name}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleShowVisitHistory(patient);
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            marginLeft: '8px',
                            fontSize: '14px'
                        }}
                        title="View visit history"
                    >
                        🕘
                    </button>
                </div>
                <div className="patient-details">
                    <span className="city">{patient.city}</span>
                    <span className="frequency">{patient.frequency}</span>
                    {benefitCountdown.daysLeft !== null && (
                        <span 
                            className={`benefit-countdown ${benefitCountdown.status}`}
                            style={{
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: 'white',
                                backgroundColor: 
                                    benefitCountdown.status === 'critical' ? '#f44336' :
                                    benefitCountdown.status === 'warning' ? '#ff9800' :
                                    benefitCountdown.status === 'expired' ? '#000' : '#4caf50'
                            }}
                        >
                            {benefitCountdown.period} — {benefitCountdown.daysLeft} days left
                        </span>
                    )}
                </div>
                {complianceStatus.message && (
                    <div className={`compliance-alert ${complianceStatus.status}`}>
                        {complianceStatus.message}
                    </div>
                )}
            </div>
        );
    };

    const patients = getFilteredPatients();
    const cities = [...new Set(data.patients.map(p => p.city))];
    const staffOptions = data.staff.filter(s => s.active);
    const dailyCounts = getDailyVisitCounts();

    if (!token) return <div>Please log in to view the weekly schedule.</div>;
    if (loading) return <div>Loading weekly schedule...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="weekly-schedule-container">
            <div className="schedule-header">
                <h1>Weekly Schedule</h1>
                <div className="schedule-controls">
                    <div className="week-navigation">
                        <button onClick={() => setWeekOffset(weekOffset - 1)}>← Previous Week</button>
                        <div className="week-display">
                            {new Date(week[0]).toLocaleDateString()} - {new Date(week[6]).toLocaleDateString()}
                        </div>
                        <button onClick={() => setWeekOffset(weekOffset + 1)}>Next Week →</button>
                    </div>
                    
                    <div className="filters">
                        <input
                            type="text"
                            placeholder="Search patients..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                        
                        <select
                            value={cityFilter}
                            onChange={(e) => setCityFilter(e.target.value)}
                            className="city-filter"
                        >
                            <option value="all">All Cities</option>
                            {cities.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                        
                        <select
                            value={staffFilter}
                            onChange={(e) => setStaffFilter(e.target.value)}
                            className="staff-filter"
                        >
                            <option value="all">All Staff</option>
                            {staffOptions.map(staff => (
                                <option key={staff.id} value={staff.name}>{staff.name}</option>
                            ))}
                        </select>
                        
                        <label className="compliance-filter">
                            <input
                                type="checkbox"
                                checked={showComplianceOnly}
                                onChange={(e) => setShowComplianceOnly(e.target.checked)}
                            />
                            Show compliance issues only
                        </label>
                    </div>
                </div>
            </div>

            <div className="schedule-grid">
                <table className="schedule-table">
                    <thead>
                        <tr>
                            <th className="patient-header">Patient</th>
                            {week.map((date, index) => {
                                const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
                                const exceededStaff = getExceededStaff(date);
                                const totalVisits = Object.values(dailyCounts[date] || {}).reduce((sum, count) => sum + count, 0);
                                
                                return (
                                    <th key={date} className="day-header">
                                        <div>{dayName}</div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>
                                            {totalVisits} visits
                                        </div>
                                        {exceededStaff.length > 0 && (
                                            <div style={{ color: '#f44336', fontSize: '10px' }}>
                                                ⚠️ {exceededStaff.join(', ')}
                                            </div>
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {patients.map(patient => (
                            <tr key={patient.id} className={`patient-row ${getPatientComplianceStatus(patient).status}`}>
                                <td className="patient-cell">
                                    {getPatientInfo(patient)}
                                </td>
                                {week.map(date => (
                                    <td
                                        key={date}
                                        className="schedule-cell"
                                        style={getCellStyling(patient.id, date)}
                                        onDragOver={(e) => handleDragOver(e, patient.id, date)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, patient.id, date)}
                                        onClick={() => handleCellClick(patient.id, date)}
                                    >
                                        {getVisitContent(getVisitForPatient(patient.id, date))}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modals */}
            {showAssignmentModal && selectedCell && (
                <div className="modal-overlay" onClick={() => setShowAssignmentModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Assign Staff</h3>
                        <p>Select staff for {selectedCell.patientName} on {new Date(selectedCell.date).toLocaleDateString()}</p>
                        <div className="staff-options">
                            {data.staff.filter(s => s.active && s.role === 'RN').map(staff => (
                                <button
                                    key={staff.id}
                                    className="staff-option"
                                    onClick={() => handleAssignStaff(staff.name)}
                                >
                                    {staff.name}
                                </button>
                            ))}
                        </div>
                        <div className="modal-actions">
                            <button onClick={() => setShowAssignmentModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {showPRNForm && selectedPatientForPRN && (
                <PRNVisitForm
                    patient={selectedPatientForPRN}
                    onClose={() => {
                        setShowPRNForm(false);
                        setSelectedPatientForPRN(null);
                    }}
                    onVisitCreated={handlePRNVisitCreated}
                />
            )}

            <VisitEditModal
                visit={selectedVisitForEdit}
                isOpen={showVisitEditModal}
                onClose={() => {
                    setShowVisitEditModal(false);
                    setSelectedVisitForEdit(null);
                }}
                onSave={() => {
                    // Refresh data
                    setData(dataManager.getData());
                }}
            />

            <VisitHistoryModal
                patient={selectedPatientForHistory}
                isOpen={showVisitHistoryModal}
                onClose={() => {
                    setShowVisitHistoryModal(false);
                    setSelectedPatientForHistory(null);
                }}
            />
        </div>
    );
}

export default WeeklySchedule;
