import React, { useEffect, useState } from "react";
import dataManager from "./dataManager.js";
import PatientForm from "./components/PatientForm.jsx";
import "./components/Forms.css";

function getFirstInitialLastName(name) {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

function daysOnService(socDate) {
  if (!socDate) return "-";
  const admit = new Date(socDate);
  if (isNaN(admit.getTime())) return "-";
  const now = new Date();
  const diff = Math.floor((now - admit) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : "-";
}

function MainDashboard({ token, dataVersion, onDataChange }) {
  const [data, setData] = useState(dataManager.getData());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);

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
      if (onDataChange) onDataChange();
    });

    return unsubscribe;
  }, [token, onDataChange]);

  // Helper: get last RN visit for a patient
  function getLastRnVisit(patientId) {
    const rnVisits = data.visits.filter(v => v.patientId === patientId && v.discipline === "RN" && v.completed);
    if (rnVisits.length === 0) return "-";
    const last = rnVisits.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b);
    return new Date(last.date).toLocaleDateString();
  }

  // Helper: get status for a patient
  function getStatus(patient, thisWeekDates, rnVisits) {
    const id = patient.id;
    const visitsThisWeek = rnVisits.filter(v => v.patientId === id && thisWeekDates.includes(v.date) && v.completed);
    if (visitsThisWeek.length > 0) return "Completed";
    
    // Check if patient has any completed visits (indicating care has started)
    const hasCompletedVisits = data.visits.some(v => v.patientId === id && v.completed);
    if (hasCompletedVisits) return "In Progress";
    
    return "Pending";
  }

  // Helper: get this week's dates (Mon-Fri)
  function getThisWeekDates() {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }

  function getStaffColor(name, role) {
    const s = data.staff.find(st => st.name === name && st.role === role);
    return s ? s.color : undefined;
  }

  // Start editing a patient
  function startEditPatient(patient) {
    setEditingPatient(patient);
    setShowPatientForm(true);
  }

  // Handle patient form save
  function handlePatientSave() {
    setShowPatientForm(false);
    setEditingPatient(null);
    if (onDataChange) onDataChange();
  }

  // Handle patient form cancel
  function handlePatientCancel() {
    setShowPatientForm(false);
    setEditingPatient(null);
  }

  // Add new patient
  function addNewPatient() {
    setEditingPatient(null);
    setShowPatientForm(true);
  }

  // Delete patient
  async function deletePatient(patientId) {
    if (window.confirm("Are you sure you want to delete this patient?")) {
      try {
        await dataManager.deletePatient(patientId);
        if (onDataChange) onDataChange();
      } catch (err) {
        setError("Failed to delete patient: " + err.message);
      }
    }
  }

  // Filter and sort patients
  const filteredAndSortedPatients = data.patients
    .filter(patient => {
      const name = (patient.name || "").toLowerCase();
      const city = (patient.city || "").toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      const matchesSearch = name.includes(searchLower) || city.includes(searchLower);
      const matchesStatus = statusFilter === "all" || getStatus(patient, getThisWeekDates(), data.visits.filter(v => v.discipline === "RN")) === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case "name":
          aValue = (a.name || "").toLowerCase();
          bValue = (b.name || "").toLowerCase();
          break;
        case "daysOnService":
          aValue = daysOnService(a.socDate);
          bValue = daysOnService(b.socDate);
          break;
        case "status":
          aValue = getStatus(a, getThisWeekDates(), data.visits.filter(v => v.discipline === "RN"));
          bValue = getStatus(b, getThisWeekDates(), data.visits.filter(v => v.discipline === "RN"));
          break;
        default:
          aValue = (a.name || "").toLowerCase();
          bValue = (b.name || "").toLowerCase();
      }
      
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const thisWeekDates = getThisWeekDates();
  const rnVisits = data.visits.filter(v => v.discipline === "RN");
  
  const completedCount = filteredAndSortedPatients.filter(p => getStatus(p, thisWeekDates, rnVisits) === "Completed").length;
  const pendingCount = filteredAndSortedPatients.filter(p => getStatus(p, thisWeekDates, rnVisits) === "Pending").length;

  if (!token) return <div className="dashboard-container">Please log in to view the dashboard.</div>;
  if (loading) return <div className="dashboard-container">Loading...</div>;
  if (error) return <div className="dashboard-container error">{error}</div>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>👥 Patient Dashboard</h1>
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-number">{data.patients.length}</div>
            <div className="stat-label">Total Patients</div>
          </div>
          <div className="stat-card completed">
            <div className="stat-number">{completedCount}</div>
            <div className="stat-label">Completed This Week</div>
          </div>
          <div className="stat-card pending">
            <div className="stat-number">{pendingCount}</div>
            <div className="stat-label">Pending This Week</div>
          </div>
        </div>
      </div>

      <div className="dashboard-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search patients by name or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-section">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="name">Sort by Name</option>
            <option value="daysOnService">Sort by Days on Service</option>
            <option value="status">Sort by Status</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="sort-order-button"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>
          <button
            onClick={addNewPatient}
            className="add-patient-button"
          >
            ➕ Add Patient
          </button>
        </div>
      </div>

      <div className="patients-table">
        <table>
          <thead>
            <tr>
              <th>Patient Name</th>
              <th>City</th>
              <th>Days on Service</th>
              <th>Benefit Period</th>
              <th>Frequency</th>
              <th>Assigned RN</th>
              <th>Assigned LVN</th>
              <th>Assigned NP</th>
              <th>Last RN Visit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedPatients.map(patient => (
              <tr key={patient.id}>
                <td>{patient.name}</td>
                <td>{patient.city}</td>
                <td>{daysOnService(patient.socDate)}</td>
                <td>{patient.benefitPeriodNumber}</td>
                <td>{patient.frequency}</td>
                <td>
                  <span 
                    className="staff-name"
                    style={{ color: getStaffColor(patient.assignedRN, "RN") }}
                  >
                    {patient.assignedRN || "-"}
                  </span>
                </td>
                <td>
                  <span 
                    className="staff-name"
                    style={{ color: getStaffColor(patient.assignedLVN, "LVN") }}
                  >
                    {patient.assignedLVN || "-"}
                  </span>
                </td>
                <td>
                  <span 
                    className="staff-name"
                    style={{ color: getStaffColor(patient.assignedNP, "NP") }}
                  >
                    {patient.assignedNP || "-"}
                  </span>
                </td>
                <td>{getLastRnVisit(patient.id)}</td>
                <td>{getStatus(patient, thisWeekDates, rnVisits)}</td>
                <td>
                  <div className="action-buttons">
                    <button onClick={() => startEditPatient(patient)} className="edit-button">
                      Edit
                    </button>
                    <button onClick={() => deletePatient(patient.id)} className="delete-button">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Patient Form Modal */}
      {showPatientForm && (
        <PatientForm
          patient={editingPatient}
          onSave={handlePatientSave}
          onCancel={handlePatientCancel}
        />
      )}

      <style jsx>{`
        .dashboard-container {
          padding: 20px;
          max-width: 1400px;
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
          min-width: 120px;
        }

        .stat-card.completed {
          border-left: 4px solid #27ae60;
        }

        .stat-card.pending {
          border-left: 4px solid #e74c3c;
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

        .dashboard-controls {
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
          min-width: 300px;
        }

        .filter-select, .sort-select {
          padding: 10px 15px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 1rem;
          background: white;
        }

        .sort-order-button, .add-patient-button {
          padding: 10px 15px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .add-patient-button {
          background: #27ae60;
          color: white;
          border-color: #27ae60;
          font-weight: 500;
        }

        .add-patient-button:hover {
          background: #229954;
          border-color: #229954;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(39, 174, 96, 0.3);
        }

        .patients-table {
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

        .staff-name {
          font-weight: 500;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .status-badge.completed {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.pending {
          background: #f8d7da;
          color: #721c24;
        }

        .edit-button, .delete-button {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          margin-right: 5px;
        }

        .edit-button {
          background: #3498db;
          color: white;
        }

        .edit-button:hover {
          background: #2980b9;
        }

        .delete-button {
          background: #e74c3c;
          color: white;
        }

        .delete-button:hover {
          background: #c0392b;
        }

        .action-buttons {
          display: flex;
          gap: 5px;
        }

        @media (max-width: 1200px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .dashboard-controls {
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

export default MainDashboard; 