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
    
    // Find the most recent Monday (or today if it's Monday)
    const dayOfWeek = monday.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so we go back 6 days
    monday.setDate(monday.getDate() - daysToMonday + weekOffset * 7);
    
    // Generate 7 days starting from Monday
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
    
    // Sprint 6 state
    const [showVisitEditModal, setShowVisitEditModal] = useState(false);
    const [selectedVisitForEdit, setSelectedVisitForEdit] = useState(null);
    const [showVisitHistoryModal, setShowVisitHistoryModal] = useState(false);
    const [selectedPatientForHistory, setSelectedPatientForHistory] = useState(null);
    const [staffFilter, setStaffFilter] = useState("all");
    const [isAddingNewVisit, setIsAddingNewVisit] = useState(false);
    const [newVisitData, setNewVisitData] = useState(null);

    // Use current date for week calculation (this week)
    const week = getWeekDates(new Date(), weekOffset);
    
    // DEBUG: Log current week calculation
    console.log('📅 Current week calculation:', {
        currentDate: new Date().toISOString().split('T')[0],
        weekOffset,
        calculatedWeek: week,
        weekStart: week[0],
        weekEnd: week[6],
        weekDates: week
    });

    // Initialize data manager and subscribe to changes
    useEffect(() => {
        if (!token) return;
        
        const initializeData = async () => {
            try {
                await dataManager.initialize(token);
                const loadedData = dataManager.getData();
                
                // DEBUG: Log data initialization
                console.log('🚀 WeeklySchedule initialized:', {
                    patientsCount: loadedData.patients.length,
                    visitsCount: loadedData.visits.length,
                    staffCount: loadedData.staff.length,
                    samplePatients: loadedData.patients.map(p => ({ id: p.id, name: p.name, frequency: p.frequency })),
                    sampleVisits: loadedData.visits.map(v => ({ id: v.id, patientId: v.patientId, date: v.date, staff: v.staff, status: v.status })),
                    currentWeek: week
                });
                
                setData(loadedData);
            } catch (err) {
                setError("Failed to initialize data: " + err.message);
            }
        };

        initializeData();

        // Subscribe to data changes
        const unsubscribe = dataManager.subscribe((newData) => {
            // DEBUG: Log data changes
            console.log('🔄 Data changed:', {
                patientsCount: newData.patients.length,
                visitsCount: newData.visits.length,
                visits: newData.visits.map(v => ({ id: v.id, patientId: v.patientId, date: v.date, staff: v.staff, status: v.status }))
            });
            
            setData(newData);
            if (onDataChange) onDataChange();
        });

        return unsubscribe;
    }, [token, onDataChange]);

    // Handle scroll to patient from RN Dashboard
    useEffect(() => {
        const scrollToPatient = () => {
            const patientId = sessionStorage.getItem('scrollToPatientId');
            if (patientId) {
                sessionStorage.removeItem('scrollToPatientId');
                
                // Wait for component to render
                setTimeout(() => {
                    const patientRow = document.querySelector(`[data-patient-id="${patientId}"]`);
                    if (patientRow) {
                        patientRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Add highlight effect
                        patientRow.style.backgroundColor = '#fff3cd';
                        patientRow.style.transition = 'background-color 2s ease';
                        setTimeout(() => {
                            patientRow.style.backgroundColor = '';
                        }, 2000);
                    }
                }, 500);
            }
        };

        // Listen for navigation events
        const handleNavigateToSchedule = (event) => {
            if (event.detail && event.detail.patientId) {
                sessionStorage.setItem('scrollToPatientId', event.detail.patientId);
                scrollToPatient();
            }
        };

        // Check on component mount
        scrollToPatient();
        
        // Listen for custom navigation events
        window.addEventListener('navigateToSchedule', handleNavigateToSchedule);
        
        return () => {
            window.removeEventListener('navigateToSchedule', handleNavigateToSchedule);
        };
    }, [data.patients]);

    // Re-run auto-scheduling when week changes
    useEffect(() => {
        if (data.patients.length > 0 && data.visits.length > 0 && !loading) {
            console.log('🔄 Triggering auto-schedule due to data change');
            regenerateVisitsForWeek();
        }
    }, [weekOffset, data.patients, data.visits, loading]);

    // Regenerate visits for the current week
    const regenerateVisitsForWeek = async () => {
        // Add timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
            console.warn('⚠️ Auto-schedule timeout - forcing completion');
            setLoading(false);
            setError('Auto-schedule timed out - please refresh');
        }, 10000); // 10 second timeout
        
        try {
            setLoading(true);
            setError(''); // Clear any previous errors
            
            console.log('🔄 regenerateVisitsForWeek started:', {
                weekDates: week,
                totalPatients: data.patients.length,
                totalVisits: data.visits.length
            });
            
            // Get all existing visits for auto-scheduler
            const allExistingVisits = data.visits;
            
            // Run auto-scheduler for this week
            const newVisits = autoScheduleVisits(data.patients, allExistingVisits, week);
            
            console.log('🤖 Auto-scheduler results:', {
                weekDates: week,
                patientsCount: data.patients.length,
                existingVisitsCount: allExistingVisits.length,
                newVisitsGenerated: newVisits.length
            });
            
            // Update data manager with new visits
            dataManager.data.visits = newVisits;
            await dataManager.saveData();
            
            // Update local state
            setData(dataManager.getData());
            
            console.log('✅ Visits regenerated successfully');
            
        } catch (error) {
            console.error('Error regenerating visits:', error);
            setError('Failed to regenerate visits: ' + error.message);
            // Don't let the error break the component - continue with current data
        } finally {
            clearTimeout(timeoutId);
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

    // Get visit for patient on specific date (both confirmed and suggested)
    const getVisitForPatient = (patientId, date) => {
        const visit = data.visits.find(v => 
            v.patientId === patientId && 
            v.date.split('T')[0] === date.split('T')[0] && 
            (v.status === 'confirmed' || v.status === 'suggested')
        );
        
        // DEBUG: Log visit lookup
        console.log('🔍 getVisitForPatient:', {
            patientId,
            date,
            foundVisit: visit,
            totalVisits: data.visits.length,
            matchingVisits: data.visits.filter(v => v.patientId === patientId && v.date.split('T')[0] === date.split('T')[0]),
            confirmedVisits: data.visits.filter(v => v.patientId === patientId && v.date.split('T')[0] === date.split('T')[0] && v.status === 'confirmed'),
            suggestedVisits: data.visits.filter(v => v.patientId === patientId && v.date.split('T')[0] === date.split('T')[0] && v.status === 'suggested')
        });
        
        return visit;
    };

    // Check if cell has conflict (too many visits for one staff)
    const hasConflict = (date, staffName) => {
        const visitsOnDate = data.visits.filter(v => 
            v.date.split('T')[0] === date.split('T')[0] && 
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
            setData(dataManager.getData()); // Force UI refresh
        } catch (error) {
            console.error('Error moving visit:', error);
        }
    };

    // Handle cell click to assign staff or edit visit
    const handleCellClick = (patientId, date) => {
        const visit = getVisitForPatient(patientId, date);
        const patient = data.patients.find(p => p.id === patientId);
        
        if (visit) {
            // Edit existing visit
            setSelectedVisitForEdit(visit);
            setIsAddingNewVisit(false);
            setShowVisitEditModal(true);
        } else {
            // Add new visit
            setNewVisitData({ patient, date });
            setIsAddingNewVisit(true);
            setShowVisitEditModal(true);
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
            setData(dataManager.getData()); // Force UI refresh
        } catch (error) {
            console.error('Error assigning staff:', error);
        }
    };

    // Handle visit completion
    const handleCompleteVisit = async (visitId) => {
        try {
            await dataManager.completeVisit(visitId);
            setData(dataManager.getData()); // Force UI refresh
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

    // Handle visit edit modal close
    const handleVisitEditClose = () => {
        setShowVisitEditModal(false);
        setSelectedVisitForEdit(null);
        setIsAddingNewVisit(false);
        setNewVisitData(null);
    };

    // Get two-week interval dates for visual highlighting
    const getTwoWeekIntervals = () => {
        const intervals = [];
        const today = new Date();
        const startDate = new Date(week[0]);
        const endDate = new Date(week[6]);
        
        // Find the most recent RN visit for each patient
        data.patients.forEach(patient => {
            const rnVisits = data.visits.filter(v => 
                v.patientId === patient.id && 
                v.discipline === 'RN' && 
                v.status === 'confirmed'
            ).sort((a, b) => new Date(b.date) - new Date(a.date));
            
            if (rnVisits.length > 0) {
                const lastRNVisit = new Date(rnVisits[0].date);
                const nextRNDue = new Date(lastRNVisit);
                nextRNDue.setDate(lastRNVisit.getDate() + 14);
                
                // Check if next RN due date falls within this week
                if (nextRNDue >= startDate && nextRNDue <= endDate) {
                    intervals.push({
                        patientId: patient.id,
                        date: nextRNDue.toISOString().split('T')[0],
                        type: 'rn-due'
                    });
                }
            }
        });
        
        return intervals;
    };

    // Check if a cell should be highlighted for two-week intervals
    const getTwoWeekHighlight = (patientId, date) => {
        const intervals = getTwoWeekIntervals();
        const interval = intervals.find(i => i.patientId === patientId && i.date === date);
        
        if (interval) {
            return {
                type: interval.type,
                style: {
                    borderLeft: '4px solid #2196f3',
                    backgroundColor: '#e3f2fd',
                    position: 'relative'
                }
            };
        }
        
        return null;
    };

    // Get cell styling with frequency compliance and two-week highlights
    const getCellStyling = (patientId, date) => {
        const visit = getVisitForPatient(patientId, date);
        const isDragOver = dragOverCell && dragOverCell.patientId === patientId && dragOverCell.date === date;
        const patient = data.patients.find(p => p.id === patientId);
        const frequencyCompliance = checkFrequencyCompliance(patient);
        const twoWeekHighlight = getTwoWeekHighlight(patientId, date);
        
        let style = {
            borderLeftWidth: '1px',
            borderLeftStyle: 'solid',
            borderLeftColor: '#ddd',
            borderRightWidth: '1px',
            borderRightStyle: 'solid',
            borderRightColor: '#ddd',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderTopColor: '#ddd',
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
            borderBottomColor: '#ddd',
            padding: '3px', // Reduced padding for compact layout
            minHeight: '45px', // Reduced height
            cursor: 'pointer',
            transition: 'all 0.2s ease'
        };

        if (isDragOver) {
            style.backgroundColor = '#e3f2fd';
            style.borderLeftWidth = '2px';
            style.borderLeftStyle = 'dashed';
            style.borderLeftColor = '#2196f3';
            style.borderRightWidth = '2px';
            style.borderRightStyle = 'dashed';
            style.borderRightColor = '#2196f3';
            style.borderTopWidth = '2px';
            style.borderTopStyle = 'dashed';
            style.borderTopColor = '#2196f3';
            style.borderBottomWidth = '2px';
            style.borderBottomStyle = 'dashed';
            style.borderBottomColor = '#2196f3';
        }

        if (visit) {
            if (visit.completed) {
                style.backgroundColor = '#e8f5e8';
                style.borderLeftColor = '#4caf50';
                style.borderRightColor = '#4caf50';
                style.borderTopColor = '#4caf50';
                style.borderBottomColor = '#4caf50';
            } else if (visitUtils.isOverdue(visit, data.visits)) {
                style.backgroundColor = '#ffebee';
                style.borderLeftColor = '#f44336';
                style.borderRightColor = '#f44336';
                style.borderTopColor = '#f44336';
                style.borderBottomColor = '#f44336';
            } else {
                style.backgroundColor = '#f5f5f5';
            }
        } else {
            // Empty cell - show add visit indicator
            style.backgroundColor = '#fafafa';
            style.borderLeftStyle = 'dashed';
            style.borderRightStyle = 'dashed';
            style.borderTopStyle = 'dashed';
            style.borderBottomStyle = 'dashed';
            style.borderLeftColor = '#ccc';
            style.borderRightColor = '#ccc';
            style.borderTopColor = '#ccc';
            style.borderBottomColor = '#ccc';
        }

        // Add two-week interval highlighting first
        if (twoWeekHighlight) {
            Object.assign(style, twoWeekHighlight.style);
        }

        // Add frequency compliance warning (this will override two-week highlight if both apply)
        if (!frequencyCompliance.compliant) {
            style.borderLeftWidth = '3px';
            style.borderLeftStyle = 'solid';
            style.borderLeftColor = '#f44336';
        }

        return style;
    };

    // Get visit display content with new styling and two-week indicators
    const getVisitContent = (visit, patientId, date) => {
        if (!visit) return null;

        const isOverdue = visitUtils.isOverdue(visit, data.visits);
        const isSuggested = visit.status === 'suggested';
        const isOverLimit = visit.tags && visit.tags.includes('over-limit');
        const isRecertVisit = visit.tags && visit.tags.includes('recert');
        const twoWeekHighlight = getTwoWeekHighlight(patientId, date);
        const isRNVisit = visit.discipline === 'RN';
        const staffColor = visitUtils.getStaffColor(visit.staff, data.staff);

        return (
            <div 
                className={`visit-cell ${visit.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''} ${isSuggested ? 'suggested' : ''} ${isRecertVisit ? 'recert-visit' : ''}`}
                draggable={!visit.completed}
                onDragStart={(e) => handleDragStart(e, visit)}
                title={`${visit.patientName} - ${new Date(visit.date).toLocaleDateString()}\n${visit.visitType || 'routine'} ${visit.discipline}\n${visit.staff || 'Unassigned'}\n${visit.notes || 'No notes'}${isRecertVisit ? '\n📋 Recertification Visit' : ''}`}
                style={{ 
                    backgroundColor: visitUtils.getDisciplineColor(visit.discipline),
                    color: 'white',
                    padding: '3px',
                    borderRadius: '3px',
                    fontSize: '11px',
                    cursor: visit.completed ? 'default' : 'grab',
                    borderWidth: isSuggested ? '2px' : isRecertVisit ? '2px' : '0px',
                    borderStyle: isSuggested ? 'dotted' : isRecertVisit ? 'solid' : 'none',
                    borderColor: isSuggested ? 'rgba(255,255,255,0.7)' : isRecertVisit ? '#ffd700' : 'transparent',
                    opacity: isSuggested ? 0.8 : 1,
                    position: 'relative',
                    boxShadow: isRecertVisit ? '0 0 8px rgba(255, 215, 0, 0.6)' : 'none'
                }}
            >
                <div style={{ 
                    fontWeight: 'bold',
                    color: staffColor,
                    textShadow: '1px 1px 1px rgba(0,0,0,0.8)'
                }}>
                    {visit.staff || 'Unassigned'}
                </div>
                <div style={{ fontSize: '10px' }}>{visit.discipline}</div>
                
                {/* Recert visit indicator */}
                {isRecertVisit && (
                    <div style={{ 
                        fontSize: '8px', 
                        fontWeight: 'bold',
                        color: '#ffd700',
                        textShadow: '1px 1px 1px rgba(0,0,0,0.8)',
                        marginTop: '1px'
                    }}>
                        📋 Recert Visit
                    </div>
                )}
                
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

                {/* Two-week interval indicator */}
                {twoWeekHighlight && isRNVisit && (
                    <div style={{
                        position: 'absolute',
                        top: '-2px',
                        left: '-2px',
                        backgroundColor: '#2196f3',
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
                        14
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

    // Count scheduled visits for a patient in the current week - only count visits from current week forward
    const countScheduledVisitsForWeek = (patientId, currentWeek) => {
        const currentWeekStart = new Date(currentWeek[0]); // First date of the week
        return data.visits.filter(v => {
            const visitDate = new Date(v.date.split('T')[0]);
            return v.patientId === patientId && 
                   currentWeek.includes(v.date.split('T')[0]) &&
                   visitDate >= currentWeekStart &&
                   (v.status === 'confirmed' || v.status === 'suggested');
        }).length;
    };

    // Check frequency compliance for a patient
    const checkFrequencyCompliance = (patient) => {
        const frequencyNum = parseFrequency(patient.frequency);
        const today = new Date();
        
        // Get all confirmed and suggested visits for this patient in the current week
        const weekVisits = data.visits.filter(v => 
            v.patientId === patient.id && 
            week.includes(v.date.split('T')[0]) &&
            (v.status === 'confirmed' || v.status === 'suggested')
        );
        
        // Get the most recent completed visit (any discipline) - updated to use completed visits
        const allCompletedVisits = data.visits.filter(v => 
            v.patientId === patient.id && 
            v.completed
        ).sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const lastCompletedVisit = allCompletedVisits[0];
        let daysSinceLastCompletedVisit = 0;
        
        if (lastCompletedVisit) {
            const lastVisitDate = new Date(lastCompletedVisit.date);
            daysSinceLastCompletedVisit = Math.floor((today - lastVisitDate) / (1000 * 60 * 60 * 24));
        } else {
            // No previous completed visits - check days since start of care
            const socDate = new Date(patient.socDate);
            daysSinceLastCompletedVisit = Math.floor((today - socDate) / (1000 * 60 * 60 * 24));
        }
        
        // Calculate missing visits based on frequency and overdue status - use the new function
        const scheduledVisits = countScheduledVisitsForWeek(patient.id, week);
        const requiredVisits = frequencyNum;
        
        // Check if we're overdue (more than 7 days since last completed visit for 1x/week, etc.)
        const maxDaysBetweenVisits = frequencyNum > 0 ? Math.ceil(7 / frequencyNum) : Infinity;
        const isOverdue = daysSinceLastCompletedVisit > maxDaysBetweenVisits;
        
        // Calculate missing visits based on frequency requirements
        let missingVisits = Math.max(0, requiredVisits - scheduledVisits);
        
        // If overdue, ensure we require the full frequency count, not just one visit
        if (isOverdue && scheduledVisits < requiredVisits) {
            missingVisits = requiredVisits - scheduledVisits; // Need full required visits if overdue
        }
        
        // DEBUG: Log frequency compliance calculation
        console.log('📊 checkFrequencyCompliance:', {
            patientName: patient.name,
            patientId: patient.id,
            frequency: patient.frequency,
            frequencyNum,
            weekDates: week,
            weekVisits: weekVisits.map(v => ({ date: v.date, staff: v.staff, status: v.status })),
            allCompletedVisits: allCompletedVisits.map(v => ({ date: v.date, staff: v.staff, status: v.status, completed: v.completed })),
            lastCompletedVisit: lastCompletedVisit ? { date: lastCompletedVisit.date, staff: lastCompletedVisit.staff, completed: lastCompletedVisit.completed } : null,
            daysSinceLastCompletedVisit,
            requiredVisits,
            scheduledVisits,
            maxDaysBetweenVisits,
            isOverdue,
            missingVisits,
            compliant: missingVisits === 0 && !isOverdue
        });
        
        return {
            required: frequencyNum,
            scheduled: scheduledVisits,
            compliant: missingVisits === 0 && !isOverdue,
            missing: missingVisits,
            daysSinceLastCompletedVisit: daysSinceLastCompletedVisit,
            isOverdue: isOverdue,
            maxDaysBetweenVisits: maxDaysBetweenVisits
        };
    };

    // Parse frequency string to number
    const parseFrequency = (frequency) => {
        if (!frequency) return 0;
        const match = frequency.match(/(\d+)x/);
        return match ? parseInt(match[1]) : 0;
    };

    // Get patient info with frequency compliance
    const getPatientInfo = (patient) => {
        const complianceStatus = getPatientComplianceStatus(patient);
        const benefitCountdown = calculateBenefitPeriodCountdown(patient);
        const frequencyCompliance = checkFrequencyCompliance(patient);
        const isOverdue = frequencyCompliance.isOverdue || (!frequencyCompliance.compliant && frequencyCompliance.missing > 0);
        
        return (
            <div className={`patient-info ${isOverdue ? 'overdue-row' : ''}`}>
                <div className="patient-name">
                    {isOverdue && <span className="overdue-icon">⚠️</span>}
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
                {!frequencyCompliance.compliant && frequencyCompliance.missing > 0 && (
                    <div className="compliance-alert critical">
                        ⚠️ Missing {frequencyCompliance.missing} visit(s) this week
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
    if (data.patients.length === 0 && data.visits.length === 0 && data.staff.length === 0) {
        return <div>Loading weekly schedule...</div>;
    }
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="weekly-schedule-container">
            {loading && (
                <div className="loading-overlay">
                    <div className="loading-message">
                        Auto-scheduling visits... Please wait.
                    </div>
                </div>
            )}
            <div className="schedule-header">
                <h1>Weekly Schedule</h1>
                <div className="schedule-controls">
                    <div className="week-navigation">
                        <button onClick={() => setWeekOffset(weekOffset - 1)}>← Previous Week</button>
                        <div className="week-selector">
                            <div className="week-option" onClick={() => setWeekOffset(-1)}>
                                <div className="week-label">Previous</div>
                                <div className="week-dates">
                                    {getWeekDates(new Date(), -1)[0].split('-')[1]}/{getWeekDates(new Date(), -1)[0].split('-')[2]} - {getWeekDates(new Date(), -1)[6].split('-')[1]}/{getWeekDates(new Date(), -1)[6].split('-')[2]}
                                </div>
                            </div>
                            <div className={`week-option current ${weekOffset === 0 ? 'selected' : ''}`} onClick={() => setWeekOffset(0)}>
                                <div className="week-label">Current</div>
                                <div className="week-dates">
                                    {getWeekDates(new Date(), 0)[0].split('-')[1]}/{getWeekDates(new Date(), 0)[0].split('-')[2]} - {getWeekDates(new Date(), 0)[6].split('-')[1]}/{getWeekDates(new Date(), 0)[6].split('-')[2]}
                                </div>
                            </div>
                            <div className="week-option" onClick={() => setWeekOffset(1)}>
                                <div className="week-label">Next</div>
                                <div className="week-dates">
                                    {getWeekDates(new Date(), 1)[0].split('-')[1]}/{getWeekDates(new Date(), 1)[0].split('-')[2]} - {getWeekDates(new Date(), 1)[6].split('-')[1]}/{getWeekDates(new Date(), 1)[6].split('-')[2]}
                                </div>
                            </div>
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

                        <button
                            onClick={async () => {
                                if (confirm('Reset sample data? This will create fresh data with all patients having visits.')) {
                                    setLoading(true);
                                    await dataManager.resetAndCreateFreshSampleData();
                                    setData(dataManager.getData());
                                    setLoading(false);
                                }
                            }}
                            style={{
                                background: '#ff9800',
                                color: 'white',
                                border: 'none',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                            title="Reset to fresh sample data with all patients having visits"
                        >
                            🔄 Reset Data
                        </button>
                        
                        <button
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    // Regenerate visits for all patients
                                    const patients = getActivePatients();
                                    for (const patient of patients) {
                                        await dataManager.regenerateVisitsForPatient(patient.id);
                                    }
                                    setData(dataManager.getData());
                                } catch (error) {
                                    console.error('Error regenerating all visits:', error);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                            style={{
                                background: '#2196f3',
                                color: 'white',
                                border: 'none',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                marginLeft: '8px'
                            }}
                            title="Regenerate visits for all patients"
                        >
                            {loading ? '🔄 Regenerating...' : '🔄 Regenerate All'}
                        </button>
                        
                        <button
                            onClick={async () => {
                                console.log('🔍 DEBUG: Current data state:', {
                                    patients: data.patients.map(p => ({ id: p.id, name: p.name, frequency: p.frequency })),
                                    visits: data.visits.map(v => ({ id: v.id, patientId: v.patientId, date: v.date, staff: v.staff, status: v.status })),
                                    currentWeek: week,
                                    staff: data.staff.map(s => ({ id: s.id, name: s.name, role: s.role }))
                                });
                                
                                // Create test visits for current week
                                const testVisits = [];
                                data.patients.slice(0, 3).forEach((patient, index) => {
                                    const visitDate = week[index % week.length];
                                    testVisits.push({
                                        patientId: patient.id,
                                        patientName: patient.name,
                                        date: visitDate,
                                        staff: patient.assignedRN || 'Unassigned',
                                        discipline: 'RN',
                                        visitType: 'routine',
                                        completed: false,
                                        status: 'confirmed',
                                        notes: 'Manual test visit for current week',
                                        tags: ['routine']
                                    });
                                });
                                
                                // Add test visits to data manager
                                for (const visit of testVisits) {
                                    await dataManager.createVisit(visit);
                                }
                                
                                console.log('✅ Manual test visits created for current week:', testVisits.map(v => ({ date: v.date, patient: v.patientName, staff: v.staff })));
                            }}
                            style={{
                                background: '#f44336',
                                color: 'white',
                                border: 'none',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                marginLeft: '8px'
                            }}
                            title="Create test visits for current week"
                        >
                            🐛 Create Test Visits
                        </button>
                        
                        <button
                            onClick={() => {
                                console.log('🔍 DEBUG: Sample data visits:', {
                                    sampleVisits: data.visits.map(v => ({ id: v.id, patientId: v.patientId, date: v.date, staff: v.staff, status: v.status })),
                                    currentWeek: week,
                                    weekMatches: data.visits.filter(v => week.includes(v.date))
                                });
                                
                                // Show which visits should be visible
                                const visibleVisits = data.visits.filter(v => week.includes(v.date));
                                console.log('👁️ Visits that should be visible this week:', visibleVisits);
                                
                                // Show which visits are missing
                                const missingVisits = data.visits.filter(v => !week.includes(v.date));
                                console.log('❌ Visits that are NOT visible (wrong dates):', missingVisits);
                            }}
                            style={{
                                background: '#9c27b0',
                                color: 'white',
                                border: 'none',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                marginLeft: '8px'
                            }}
                            title="Debug visit visibility"
                        >
                            🔍 Debug Visits
                        </button>
                    </div>
                </div>
            </div>

            <div className="schedule-grid">
                <table className="schedule-table">
                    <thead>
                        <tr>
                            <th className="patient-header">Patient</th>
                            <th className="frequency-header">Frequency</th>
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
                        {patients.map(patient => {
                            const frequencyCompliance = checkFrequencyCompliance(patient);
                            return (
                                <tr key={patient.id} data-patient-id={patient.id} className={`patient-row ${getPatientComplianceStatus(patient).status} ${!frequencyCompliance.compliant ? 'frequency-warning' : ''}`}>
                                    <td className="patient-cell">
                                        {getPatientInfo(patient)}
                                    </td>
                                    <td className="frequency-cell">
                                        <div className="frequency-display">
                                            <span className="frequency-text">{patient.frequency}</span>
                                            <div className="frequency-status">
                                                {frequencyCompliance.scheduled}/{frequencyCompliance.required}
                                            </div>
                                        </div>
                                    </td>
                                    {week.map(date => (
                                        <td
                                            key={date}
                                            className={`schedule-cell ${dragOverCell && dragOverCell.patientId === patient.id && dragOverCell.date === date ? 'drag-over' : ''}`}
                                            style={getCellStyling(patient.id, date)}
                                            onDragOver={(e) => handleDragOver(e, patient.id, date)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, patient.id, date)}
                                            onClick={() => handleCellClick(patient.id, date)}
                                            title={getVisitForPatient(patient.id, date) ? "Click to edit visit" : "Click to add visit"}
                                        >
                                            {getVisitContent(getVisitForPatient(patient.id, date), patient.id, date)}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
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
                onClose={handleVisitEditClose}
                onSave={() => {
                    // Refresh data
                    setData(dataManager.getData());
                }}
                isNewVisit={isAddingNewVisit}
                patient={newVisitData?.patient}
                date={newVisitData?.date}
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
