import React, { useState, useEffect } from "react";
import dataManager from "./dataManager.js";
import { visitUtils } from "./autoScheduleVisits.js";
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

    // Get all active patients
    const getActivePatients = () => {
        return data.patients.filter(p => p.visitStatus !== 'complete');
    };

    // Get filtered patients
    const getFilteredPatients = () => {
        let patients = getActivePatients();
        
        if (searchTerm) {
            patients = patients.filter(p => 
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.city.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        if (cityFilter !== "all") {
            patients = patients.filter(p => p.city === cityFilter);
        }

        if (showComplianceOnly) {
            patients = patients.filter(p => {
                // Show patients with compliance issues
                const nextRN = visitUtils.calculateNextRNVisit(p);
                const recertWindow = visitUtils.calculateRecertWindow(p);
                const socDate = new Date(p.socDate);
                const today = new Date();
                const daysOnService = Math.floor((today - socDate) / (1000 * 60 * 60 * 24));
                
                return nextRN.isOverdue || 
                       (recertWindow && recertWindow.isInWindow) ||
                       (daysOnService >= 6 && daysOnService <= 30);
            });
        }
        
        return patients;
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
        setSelectedCell({ patientId: visit.patientId, date: visit.date, visit });
        setShowAssignmentModal(true);
    };

    // Handle staff assignment
    const handleAssignStaff = async (staffName) => {
        if (!selectedCell) return;

        try {
            await dataManager.updateVisit(selectedCell.visit.id, {
                staff: staffName
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

    // Get visit display content
    const getVisitContent = (visit) => {
        if (!visit) return null;

        const isOverdue = visitUtils.isOverdue(visit);
        const isHOPE = visit.tags && visit.tags.includes("HOPE");
        const isRecert = visit.tags && visit.tags.includes("recert");

        return (
            <div 
                className={`visit-cell ${visit.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}
                draggable={!visit.completed}
                onDragStart={(e) => handleDragStart(e, visit)}
                style={{ 
                    backgroundColor: visitUtils.getDisciplineColor(visit.discipline),
                    color: 'white',
                    padding: '4px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: visit.completed ? 'default' : 'grab'
                }}
            >
                <div style={{ fontWeight: 'bold' }}>{visit.staff}</div>
                <div style={{ fontSize: '10px' }}>{visit.discipline}</div>
                {isHOPE && <div style={{ fontSize: '10px' }}>HOPE</div>}
                {isRecert && <div style={{ fontSize: '10px' }}>RECERT</div>}
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

    const patients = getFilteredPatients();
    const cities = [...new Set(data.patients.map(p => p.city))];

    if (!token) return <div>Please log in to view the weekly schedule.</div>;
    if (loading) return <div>Loading weekly schedule...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="weekly-schedule-container">
            <div className="schedule-header">
                <h1>📅 Weekly Schedule</h1>
                <div className="schedule-controls">
                    <div className="week-navigation">
                        <button onClick={() => setWeekOffset(weekOffset - 1)}>← Previous</button>
                        <span className="week-display">
                            Week of {new Date(week[0]).toLocaleDateString()}
                        </span>
                        <button onClick={() => setWeekOffset(weekOffset + 1)}>Next →</button>
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
                        
                        <label className="compliance-filter">
                            <input
                                type="checkbox"
                                checked={showComplianceOnly}
                                onChange={(e) => setShowComplianceOnly(e.target.checked)}
                            />
                            Show Compliance Issues Only
                        </label>
                    </div>
                </div>
            </div>

            <div className="schedule-grid">
                <table className="schedule-table">
                    <thead>
                        <tr>
                            <th className="patient-header">Patient</th>
                            {week.map(date => (
                                <th key={date} className="day-header">
                                    {new Date(date).toLocaleDateString('en-US', { 
                                        weekday: 'short', 
                                        month: 'short', 
                                        day: 'numeric' 
                                    })}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {patients.map(patient => {
                            const compliance = getPatientComplianceStatus(patient);
                            return (
                                <tr key={patient.id} className={`patient-row ${compliance.status}`}>
                                    <td className="patient-info">
                                        <div className="patient-name">{patient.name}</div>
                                        <div className="patient-details">
                                            <span className="city">{patient.city}</span>
                                            <span className="frequency">{patient.frequency}</span>
                                        </div>
                                        {compliance.message && (
                                            <div className={`compliance-alert ${compliance.status}`}>
                                                {compliance.message}
                                            </div>
                                        )}
                                    </td>
                                    {week.map(date => (
                                        <td
                                            key={date}
                                            className="schedule-cell"
                                            style={getCellStyling(patient.id, date)}
                                            onClick={() => handleCellClick(patient.id, date)}
                                            onDragOver={(e) => handleDragOver(e, patient.id, date)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, patient.id, date)}
                                        >
                                            {getVisitContent(getVisitForPatient(patient.id, date))}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Staff Assignment Modal */}
            {showAssignmentModal && selectedCell && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Assign Staff</h3>
                        <p>Assign staff to visit for {data.patients.find(p => p.id === selectedCell.patientId)?.name} on {new Date(selectedCell.date).toLocaleDateString()}</p>
                        
                        <div className="staff-options">
                            {data.staff.filter(s => s.active).map(staff => (
                                <button
                                    key={staff.id}
                                    onClick={() => handleAssignStaff(staff.name)}
                                    className="staff-option"
                                    style={{ backgroundColor: staff.color }}
                                >
                                    {staff.name} ({staff.role})
                                </button>
                            ))}
                        </div>
                        
                        <div className="modal-actions">
                            <button onClick={() => setShowAssignmentModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WeeklySchedule;
