import React, { useState, useEffect } from 'react';
import dataManager from '../dataManager.js';

function StaffForm({ staff = null, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    role: 'RN',
    color: '#254FBB',
    status: 'active'
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Initialize form with staff data if editing
  useEffect(() => {
    if (staff) {
      setFormData({
        name: staff.name || '',
        role: staff.role || 'RN',
        color: staff.color || '#254FBB',
        status: staff.status || 'active'
      });
    }
  }, [staff]);

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
      newErrors.name = 'Staff name is required';
    }
    
    if (!formData.role) {
      newErrors.role = 'Role is required';
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
      if (staff) {
        // Update existing staff
        await dataManager.updateStaff(staff.id, formData);
      } else {
        // Create new staff
        await dataManager.createStaff(formData);
      }
      
      onSave();
    } catch (error) {
      console.error('Error saving staff:', error);
      setErrors({ submit: 'Failed to save staff member. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const roleColors = {
    RN: '#254FBB',
    LVN: '#83CDC1',
    NP: '#e74c3c'
  };

  const handleRoleChange = (e) => {
    const role = e.target.value;
    setFormData(prev => ({
      ...prev,
      role,
      color: roleColors[role] || prev.color
    }));
  };

  return (
    <div className="staff-form-overlay">
      <div className="staff-form-modal">
        <div className="staff-form-header">
          <h2>{staff ? 'Edit Staff Member' : 'Add New Staff Member'}</h2>
          <button 
            type="button" 
            className="close-button"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="staff-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Staff Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={errors.name ? 'error' : ''}
                placeholder="Enter staff name"
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="role">Role *</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleRoleChange}
                className={errors.role ? 'error' : ''}
              >
                <option value="RN">Registered Nurse (RN)</option>
                <option value="LVN">Licensed Vocational Nurse (LVN)</option>
                <option value="NP">Nurse Practitioner (NP)</option>
              </select>
              {errors.role && <span className="error-message">{errors.role}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="color">Color</label>
              <div className="color-picker">
                <input
                  type="color"
                  id="color"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  className="color-input"
                />
                <span className="color-preview" style={{ backgroundColor: formData.color }}></span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
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
              {loading ? 'Saving...' : (staff ? 'Update Staff' : 'Add Staff')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StaffForm; 