import React, { useState } from 'react';
import dataManager from '../dataManager.js';
import './Forms.css';

function PRNVisitForm({ patient, onVisitCreated, onCancel }) {
    const [formData, setFormData] = useState({
        type: 'routine',
        discipline: 'RN',
        staff: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const visitData = {
                patientId: patient.id,
                patientName: patient.name,
                date: formData.date,
                staff: formData.staff,
                discipline: formData.discipline,
                type: formData.type,
                notes: formData.notes,
                status: 'confirmed', // PRN visits are always confirmed
                completed: false,
                tags: ['prn'],
                priority: formData.type === 'recert' ? 'high' : 'medium'
            };

            await dataManager.createVisit(visitData);
            
            if (onVisitCreated) {
                onVisitCreated();
            }
        } catch (err) {
            setError('Failed to create visit: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const getAvailableStaff = () => {
        const data = dataManager.getData();
        return data.staff.filter(s => 
            s.active && 
            s.role.toLowerCase() === formData.discipline.toLowerCase()
        );
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content prn-form">
                <h3>Create PRN Visit</h3>
                <p>Creating visit for {patient.name}</p>

                <form onSubmit={handleSubmit} className="form">
                    <div className="form-group">
                        <label htmlFor="type">Visit Type:</label>
                        <select
                            id="type"
                            name="type"
                            value={formData.type}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="routine">Routine</option>
                            <option value="recert">Recertification</option>
                            <option value="prn">PRN</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="discipline">Discipline:</label>
                        <select
                            id="discipline"
                            name="discipline"
                            value={formData.discipline}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="RN">RN</option>
                            <option value="LVN">LVN</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="staff">Staff:</label>
                        <select
                            id="staff"
                            name="staff"
                            value={formData.staff}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="">Select staff...</option>
                            {getAvailableStaff().map(staff => (
                                <option key={staff.id} value={staff.name}>
                                    {staff.name} ({staff.role})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="date">Date:</label>
                        <input
                            type="date"
                            id="date"
                            name="date"
                            value={formData.date}
                            onChange={handleInputChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="notes">Notes (optional):</label>
                        <textarea
                            id="notes"
                            name="notes"
                            value={formData.notes}
                            onChange={handleInputChange}
                            rows="3"
                            placeholder="Enter any additional notes..."
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div className="form-actions">
                        <button 
                            type="button" 
                            onClick={onCancel}
                            className="btn-secondary"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn-primary"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Visit'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default PRNVisitForm; 