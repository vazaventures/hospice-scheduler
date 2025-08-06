import React, { useEffect, useState } from "react";
import dataManager from "./dataManager.js";

const DEFAULT_COLORS = ["#4caf50", "#2196f3", "#ffeb3b", "#ff9800", "#9c27b0", "#e91e63", "#795548", "#00bcd4"];

function StaffManager({ token, dataVersion, onDataChange }) {
  const [data, setData] = useState(dataManager.getData());
  const [form, setForm] = useState({ 
    id: "", 
    name: "", 
    role: "RN", 
    color: DEFAULT_COLORS[0], 
    active: true 
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);

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

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleColorChange = e => {
    setForm({ ...form, color: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!form.name || !form.role) {
      setError("Name and role are required.");
      setLoading(false);
      return;
    }

    try {
      if (editingId) {
        // Update existing staff member
        await dataManager.updateStaff(editingId, {
          name: form.name,
          role: form.role,
          color: form.color,
          active: form.active
        });
        setSuccess("Staff updated successfully!");
      } else {
        // Create new staff member
        await dataManager.createStaff({
          name: form.name,
          role: form.role,
          color: form.color,
          active: form.active
        });
        setSuccess("Staff added successfully!");
      }

      resetForm();
    } catch (err) {
      setError("Failed to save staff: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = staff => {
    setForm({ 
      id: staff.id, 
      name: staff.name, 
      role: staff.role, 
      color: staff.color || DEFAULT_COLORS[0], 
      active: staff.active !== undefined ? staff.active : true 
    });
    setEditingId(staff.id);
    setShowForm(true);
  };

  // Handle staff activation/deactivation with warning
  const handleToggleActive = async (staff) => {
    const assignedPatients = getAssignedPatients(staff.name, staff.role);
    
    // If trying to deactivate staff with assigned patients, show warning
    if (staff.active && assignedPatients.length > 0) {
      const patientNames = assignedPatients.map(p => p.name).join(', ');
      const confirmMessage = `Warning: ${staff.name} is currently assigned to ${assignedPatients.length} patient(s): ${patientNames}.\n\nDeactivating this staff member may affect patient care scheduling. Are you sure you want to continue?`;
      
      if (!window.confirm(confirmMessage)) {
        return; // User cancelled
      }
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await dataManager.updateStaff(staff.id, {
        ...staff,
        active: !staff.active
      });
      setSuccess(`${staff.name} has been ${staff.active ? 'deactivated' : 'activated'} successfully!`);
    } catch (err) {
      setError("Failed to update staff status: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm("Are you sure you want to delete this staff member?")) return;
    
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await dataManager.deleteStaff(id);
      setSuccess("Staff deleted successfully!");
    } catch (err) {
      setError("Failed to delete staff: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ id: "", name: "", role: "RN", color: DEFAULT_COLORS[0], active: true });
    setEditingId(null);
    setShowForm(false);
    setError("");
    setSuccess("");
  };

  // Get assigned patient count for a staff member
  const getAssignedPatientCount = (staffName, role) => {
    return data.patients.filter(patient => {
      if (role === 'RN') return patient.assignedRN === staffName;
      if (role === 'LVN') return patient.assignedLVN === staffName;
      if (role === 'NP') return patient.assignedNP === staffName;
      return false;
    }).length;
  };

  // Get patients assigned to a staff member
  const getAssignedPatients = (staffName, role) => {
    return data.patients.filter(patient => {
      if (role === 'RN') return patient.assignedRN === staffName;
      if (role === 'LVN') return patient.assignedLVN === staffName;
      if (role === 'NP') return patient.assignedNP === staffName;
      return false;
    });
  };

  // Filter staff based on search and role filter
  const getFilteredStaff = () => {
    let filtered = data.staff;
    
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.role.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (roleFilter !== "all") {
      filtered = filtered.filter(s => s.role === roleFilter);
    }
    
    return filtered;
  };

  const filteredStaff = getFilteredStaff();
  const activeStaff = data.staff.filter(s => s.active).length;
  const rnCount = data.staff.filter(s => s.role === "RN").length;
  const lvnCount = data.staff.filter(s => s.role === "LVN").length;
  const npCount = data.staff.filter(s => s.role === "NP").length;

  if (!token) return <div className="staff-manager-container">Please log in to manage staff.</div>;

  return (
    <div className="staff-manager-container">
      <div className="dashboard-header">
        <h1>👥 Staff Management</h1>
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-number">{data.staff.length}</div>
            <div className="stat-label">Total Staff</div>
          </div>
          <div className="stat-card active">
            <div className="stat-number">{activeStaff}</div>
            <div className="stat-label">Active Staff</div>
          </div>
          <div className="stat-card rn">
            <div className="stat-number">{rnCount}</div>
            <div className="stat-label">RNs</div>
          </div>
          <div className="stat-card lvn">
            <div className="stat-number">{lvnCount}</div>
            <div className="stat-label">LVNs</div>
          </div>
          <div className="stat-card np">
            <div className="stat-number">{npCount}</div>
            <div className="stat-label">NPs</div>
          </div>
        </div>
      </div>

      <div className="staff-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search staff by name or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-section">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Roles</option>
            <option value="RN">RN</option>
            <option value="LVN">LVN</option>
            <option value="NP">NP</option>
          </select>
        </div>
        <div className="action-section">
          <button
            onClick={() => setShowForm(true)}
            className="add-staff-button"
          >
            + Add Staff
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          {success}
        </div>
      )}

      <div className="staff-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Color</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map(staff => {
              const assignmentCount = getAssignedPatientCount(staff.name, staff.role);
              return (
                <tr key={staff.id}>
                  <td>
                    <div className="staff-name-container">
                      <span className="staff-name">{staff.name}</span>
                      {assignmentCount > 0 && (
                        <span className="assignment-count-badge">
                          {assignmentCount}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge ${staff.role.toLowerCase()}`}>
                      {staff.role}
                    </span>
                  </td>
                  <td>
                    <div className="color-preview" style={{ backgroundColor: staff.color }}></div>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleActive(staff)}
                      className={`status-toggle ${staff.active ? 'active' : 'inactive'}`}
                      disabled={loading}
                      title={`Click to ${staff.active ? 'deactivate' : 'activate'} ${staff.name}`}
                    >
                      {staff.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => handleEdit(staff)}
                        className="edit-button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(staff.id)}
                        className="delete-button"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Staff Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingId ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name:</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Role:</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  required
                  className="form-select"
                >
                  <option value="RN">RN</option>
                  <option value="LVN">LVN</option>
                  <option value="NP">NP</option>
                </select>
              </div>
              <div className="form-group">
                <label>Color:</label>
                <div className="color-options">
                  {DEFAULT_COLORS.map(color => (
                    <label key={color} className="color-option">
                      <input
                        type="radio"
                        name="color"
                        value={color}
                        checked={form.color === color}
                        onChange={handleColorChange}
                      />
                      <span 
                        className="color-preview" 
                        style={{ backgroundColor: color }}
                      ></span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="active"
                    checked={form.active}
                    onChange={(e) => setForm({...form, active: e.target.checked})}
                  />
                  Active
                </label>
              </div>
              <div className="modal-actions">
                <button 
                  type="submit" 
                  className="save-button"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : (editingId ? 'Update' : 'Add')}
                </button>
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="cancel-button"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .staff-manager-container {
          padding: 20px;
          max-width: 1200px;
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
          min-width: 100px;
        }

        .stat-card.active {
          border-left: 4px solid #27ae60;
        }

        .stat-card.rn {
          border-left: 4px solid #3498db;
        }

        .stat-card.lvn {
          border-left: 4px solid #9c27b0;
        }

        .stat-card.np {
          border-left: 4px solid #ff9800;
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

        .staff-controls {
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

        .add-staff-button {
          padding: 10px 20px;
          background: #27ae60;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
        }

        .add-staff-button:hover {
          background: #229954;
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .success-message {
          background: #d4edda;
          color: #155724;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .staff-table {
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
          padding: 15px;
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

        .role-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .role-badge.rn {
          background: #e3f2fd;
          color: #1976d2;
        }

        .role-badge.lvn {
          background: #f3e5f5;
          color: #7b1fa2;
        }

        .role-badge.np {
          background: #fff3e0;
          color: #f57c00;
        }

        .color-preview {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #ddd;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .status-badge.active {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.inactive {
          background: #f8d7da;
          color: #721c24;
        }

        .staff-name-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .staff-name {
          font-weight: 500;
        }

        .assignment-count-badge {
          background: #2196f3;
          color: white;
          font-size: 0.7rem;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 16px;
          text-align: center;
        }

        .status-toggle {
          padding: 6px 12px;
          border: none;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .status-toggle.active {
          background: #d4edda;
          color: #155724;
        }

        .status-toggle.active:hover {
          background: #c3e6cb;
        }

        .status-toggle.inactive {
          background: #f8d7da;
          color: #721c24;
        }

        .status-toggle.inactive:hover {
          background: #f1b0b7;
        }

        .status-toggle:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .action-buttons {
          display: flex;
          gap: 5px;
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

        .delete-button {
          padding: 6px 12px;
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .delete-button:hover {
          background: #c0392b;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          padding: 30px;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-content h3 {
          margin: 0 0 20px 0;
          color: #2c3e50;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #2c3e50;
        }

        .form-input, .form-select {
          width: 100%;
          padding: 10px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 1rem;
        }

        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: #3498db;
        }

        .color-options {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .color-option {
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
        }

        .color-option input[type="radio"] {
          display: none;
        }

        .color-option .color-preview {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 3px solid #ddd;
          transition: border-color 0.2s;
        }

        .color-option input[type="radio"]:checked + .color-preview {
          border-color: #333;
        }

        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 30px;
        }

        .save-button {
          padding: 10px 20px;
          background: #27ae60;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
        }

        .save-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }

        .cancel-button {
          padding: 10px 20px;
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
        }

        .cancel-button:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .staff-controls {
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

export default StaffManager; 