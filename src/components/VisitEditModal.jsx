import React, { useState, useEffect } from 'react';
import dataManager from '../dataManager.js';
import './Forms.css';

function VisitEditModal({ visit, isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    staff: '',
    visitType: 'routine',
    tags: [],
    notes: ''
  });
  const [availableStaff, setAvailableStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize form data when visit changes
  useEffect(() => {
    if (visit) {
      setFormData({
        staff: visit.staff || '',
        visitType: visit.visitType || 'routine',
        tags: visit.tags || [],
        notes: visit.notes || ''
      });
    }
  }, [visit]);

  // Load available staff
  useEffect(() => {
    if (isOpen) {
      const data = dataManager.getData();
      const staffByDiscipline = data.staff.filter(s => 
        s.active && s.role === visit?.discipline
      );
      setAvailableStaff(staffByDiscipline);
    }
  }, [isOpen, visit]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
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
    if (!visit) return;

    setLoading(true);
    setError('');

    try {
      const updates = {
        staff: formData.staff || null,
        visitType: formData.visitType,
        tags: formData.tags,
        notes: formData.notes
      };

      await dataManager.updateVisit(visit.id, updates);
      onSave && onSave();
      onClose();
    } catch (err) {
      setError('Failed to update visit: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !visit) return null;

  const commonTags = ['recert', 'prn', 'HUV1', 'HUV2', 'over-limit'];
  const visitTypes = [
    { value: 'routine', label: 'Routine' },
    { value: 'recert', label: 'Recertification' },
    { value: 'prn', label: 'PRN' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Edit Visit</h3>
        
        <div className="visit-info">
          <p><strong>Patient:</strong> {visit.patientName}</p>
          <p><strong>Date:</strong> {new Date(visit.date).toLocaleDateString()}</p>
          <p><strong>Discipline:</strong> {visit.discipline}</p>
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
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VisitEditModal; 