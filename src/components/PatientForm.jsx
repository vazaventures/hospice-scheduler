import React, { useState, useEffect } from 'react';
import dataManager from '../dataManager.js';

function PatientForm({ patient = null, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    socDate: '',
    benefitPeriodStart: '',
    benefitPeriodNumber: 'BP1',
    frequency: '2x/week',
    assignedRN: '',
    assignedLVN: '',
    assignedNP: '',
    visitStatus: 'pending'
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Initialize form with patient data if editing
  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name || '',
        city: patient.city || '',
        socDate: patient.socDate || '',
        benefitPeriodStart: patient.benefitPeriodStart || '',
        benefitPeriodNumber: patient.benefitPeriodNumber || 'BP1',
        frequency: patient.frequency || '2x/week',
        assignedRN: patient.assignedRN || '',
        assignedLVN: patient.assignedLVN || '',
        assignedNP: patient.assignedNP || '',
        visitStatus: patient.visitStatus || 'pending'
      });
    }
  }, [patient]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Patient name is required';
    }
    
    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }
    
    if (!formData.socDate) {
      newErrors.socDate = 'Start of care date is required';
    }
    
    if (!formData.benefitPeriodStart) {
      newErrors.benefitPeriodStart = 'Benefit period start is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      if (patient) {
        // Update existing patient
        await dataManager.updatePatient(patient.id, formData);
      } else {
        // Create new patient
        await dataManager.createPatient(formData);
      }
      
      onSave();
    } catch (error) {
      console.error('Error saving patient:', error);
      setErrors({ submit: 'Failed to save patient. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const getStaffOptions = (role) => {
    const staff = dataManager.getData().staff.filter(s => s.role === role && s.status === 'active');
    return staff.map(s => (
      <option key={s.id} value={s.name}>{s.name}</option>
    ));
  };

  return (
    <div className="patient-form-overlay">
      <div className="patient-form-modal">
        <div className="patient-form-header">
          <h2>{patient ? 'Edit Patient' : 'Add New Patient'}</h2>
          <button 
            type="button" 
            className="close-button"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="patient-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Patient Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={errors.name ? 'error' : ''}
                placeholder="Enter patient name"
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="city">City *</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className={errors.city ? 'error' : ''}
                placeholder="Enter city"
              />
              {errors.city && <span className="error-message">{errors.city}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="socDate">Start of Care Date *</label>
              <input
                type="date"
                id="socDate"
                name="socDate"
                value={formData.socDate}
                onChange={handleChange}
                className={errors.socDate ? 'error' : ''}
              />
              {errors.socDate && <span className="error-message">{errors.socDate}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="benefitPeriodStart">Benefit Period Start *</label>
              <input
                type="date"
                id="benefitPeriodStart"
                name="benefitPeriodStart"
                value={formData.benefitPeriodStart}
                onChange={handleChange}
                className={errors.benefitPeriodStart ? 'error' : ''}
              />
              {errors.benefitPeriodStart && <span className="error-message">{errors.benefitPeriodStart}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="benefitPeriodNumber">Benefit Period</label>
              <select
                id="benefitPeriodNumber"
                name="benefitPeriodNumber"
                value={formData.benefitPeriodNumber}
                onChange={handleChange}
              >
                <option value="BP1">BP1</option>
                <option value="BP2">BP2</option>
                <option value="BP3">BP3</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="frequency">Visit Frequency</label>
              <select
                id="frequency"
                name="frequency"
                value={formData.frequency}
                onChange={handleChange}
              >
                <option value="1x/week">1x/week</option>
                <option value="2x/week">2x/week</option>
                <option value="3x/week">3x/week</option>
                <option value="4x/week">4x/week</option>
                <option value="5x/week">5x/week</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="assignedRN">Assigned RN</label>
              <select
                id="assignedRN"
                name="assignedRN"
                value={formData.assignedRN}
                onChange={handleChange}
              >
                <option value="">Select RN</option>
                {getStaffOptions('RN')}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="assignedLVN">Assigned LVN</label>
              <select
                id="assignedLVN"
                name="assignedLVN"
                value={formData.assignedLVN}
                onChange={handleChange}
              >
                <option value="">Select LVN</option>
                {getStaffOptions('LVN')}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="assignedNP">Assigned NP</label>
            <select
              id="assignedNP"
              name="assignedNP"
              value={formData.assignedNP}
              onChange={handleChange}
            >
              <option value="">Select NP</option>
              {getStaffOptions('NP')}
            </select>
          </div>

          {errors.submit && (
            <div className="error-message submit-error">{errors.submit}</div>
          )}

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
              {loading ? 'Saving...' : (patient ? 'Update Patient' : 'Add Patient')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PatientForm; 