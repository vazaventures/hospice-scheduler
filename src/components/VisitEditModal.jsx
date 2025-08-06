import React, { useState, useEffect } from 'react';
import dataManager from '../dataManager.js';
import { visitUtils } from '../autoScheduleVisits.js';
import './Forms.css';

function VisitEditModal({ visit, isOpen, onClose, onSave, isNewVisit = false, patient = null, date = null }) {
  const [formData, setFormData] = useState({
    date: '',
    staff: '',
    visitType: 'routine',
    discipline: 'RN',
    tags: [],
    notes: ''
  });
  const [availableStaff, setAvailableStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(dataManager.getData());

  // Initialize form data when visit changes
  useEffect(() => {
    if (isNewVisit && patient && date) {
      // New visit mode
      setFormData({
        date: date,
        staff: '',
        visitType: 'routine',
        discipline: 'RN',
        tags: [],
        notes: ''
      });
    } else if (visit) {
      // Edit existing visit mode
      setFormData({
        date: visit.date,
        staff: visit.staff || '',
        visitType: visit.visitType || 'routine',
        discipline: visit.discipline || 'RN',
        tags: visit.tags || [],
        notes: visit.notes || ''
      });
    }
  }, [visit, isNewVisit, patient, date]);

  // Load available staff based on discipline
  useEffect(() => {
    if (isOpen) {
      const currentData = dataManager.getData();
      setData(currentData);
      const staffByDiscipline = currentData.staff.filter(s => 
        s.active && s.role === formData.discipline
      );
      setAvailableStaff(staffByDiscipline);
    }
  }, [isOpen, formData.discipline]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDisciplineChange = (discipline) => {
    setFormData(prev => ({
      ...prev,
      discipline: discipline,
      staff: '' // Reset staff when discipline changes
    }));
  };

  const handleTagToggle = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      if (isNewVisit) {
        // Create new visit
        const newVisitData = {
          patientId: patient.id,
          patientName: patient.name,
          date: formData.date,
          discipline: formData.discipline,
          staff: formData.staff || null,
          visitType: formData.visitType,
          tags: formData.tags,
          notes: formData.notes,
          status: 'confirmed' // New visits are confirmed by default
        };
        
        await dataManager.createVisit(newVisitData);
      } else {
        // Update existing visit
        const updates = {
          date: formData.date,
          staff: formData.staff || null,
          discipline: formData.discipline,
          visitType: formData.visitType,
          tags: formData.tags,
          notes: formData.notes
        };

        await dataManager.updateVisit(visit.id, updates);
      }
      
      onSave && onSave();
      onClose();
    } catch (err) {
      setError('Failed to save visit: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const commonTags = ['recert', 'prn', 'HUV1', 'HUV2', 'over-limit'];
  const visitTypes = [
    { value: 'routine', label: 'Routine' },
    { value: 'recert', label: 'Recertification' },
    { value: 'prn', label: 'PRN' }
  ];
  const disciplines = [
    { value: 'RN', label: 'Registered Nurse (RN)' },
    { value: 'LVN', label: 'Licensed Vocational Nurse (LVN)' },
    { value: 'NP', label: 'Nurse Practitioner (NP)' }
  ];

  const modalTitle = isNewVisit ? 'Add New Visit' : 'Edit Visit';
  const patientName = isNewVisit ? patient?.name : visit?.patientName;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>{modalTitle}</h3>
        
        <div className="visit-info">
          <p><strong>Patient:</strong> {patientName}</p>
          {!isNewVisit && (
            <p><strong>Current Date:</strong> {new Date(visit.date).toLocaleDateString()}</p>
          )}
        </div>

        <div className="form-group">
          <label>Visit Date:</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => handleInputChange('date', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="form-group">
          <label>Discipline:</label>
          <select
            value={formData.discipline}
            onChange={(e) => handleDisciplineChange(e.target.value)}
          >
            {disciplines.map(discipline => (
              <option key={discipline.value} value={discipline.value}>
                {discipline.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Assigned Staff:</label>
          <select
            value={formData.staff}
            onChange={(e) => handleInputChange('staff', e.target.value)}
          >
            <option value="">Unassigned</option>
            {availableStaff.map(staff => (
              <option key={staff.id} value={staff.name}>
                {staff.name}
              </option>
            ))}
          </select>
          {formData.staff && (
            <div style={{ 
              marginTop: '4px', 
              padding: '4px 8px', 
              borderRadius: '4px',
              backgroundColor: visitUtils.getStaffColor(formData.staff, data.staff),
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              Selected: {formData.staff}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Visit Type:</label>
          <select
            value={formData.visitType}
            onChange={(e) => handleInputChange('visitType', e.target.value)}
          >
            {visitTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Tags:</label>
          <div className="tag-options">
            {commonTags.map(tag => (
              <label key={tag} className="tag-checkbox">
                <input
                  type="checkbox"
                  checked={formData.tags.includes(tag)}
                  onChange={() => handleTagToggle(tag)}
                />
                {tag}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Notes:</label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={4}
            placeholder="Enter visit notes..."
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : (isNewVisit ? 'Add Visit' : 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VisitEditModal; 