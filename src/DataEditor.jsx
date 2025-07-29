import React, { useState, useEffect } from 'react';
import { clearAllData } from './dataLoader';

function DataEditor({ token, onDataChange }) {
  const [activeTab, setActiveTab] = useState('patients');
  const [patients, setPatients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [visits, setVisits] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [editingData, setEditingData] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load data from localStorage (for demo mode) or API
  const loadData = async () => {
    setIsLoading(true);
    try {
      if (token === 'DEMO_TOKEN') {
        // Demo mode - load from localStorage
        const storedPatients = localStorage.getItem('hospice-patients');
        const storedStaff = localStorage.getItem('hospice-staff');
        const storedVisits = localStorage.getItem('hospice-visits');
        const storedAlerts = localStorage.getItem('hospice-alerts');

        setPatients(storedPatients ? JSON.parse(storedPatients) : []);
        setStaff(storedStaff ? JSON.parse(storedStaff) : []);
        setVisits(storedVisits ? JSON.parse(storedVisits) : []);
        setAlerts(storedAlerts ? JSON.parse(storedAlerts) : []);

        // Set initial editing data
        setEditingData(JSON.stringify(JSON.parse(storedPatients || '[]'), null, 2));
      } else {
        // Real mode - load from API
        // For now, we'll use localStorage as fallback
        const storedPatients = localStorage.getItem('hospice-patients');
        const storedStaff = localStorage.getItem('hospice-staff');
        const storedVisits = localStorage.getItem('hospice-visits');
        const storedAlerts = localStorage.getItem('hospice-alerts');

        setPatients(storedPatients ? JSON.parse(storedPatients) : []);
        setStaff(storedStaff ? JSON.parse(storedStaff) : []);
        setVisits(storedVisits ? JSON.parse(storedVisits) : []);
        setAlerts(storedAlerts ? JSON.parse(storedAlerts) : []);

        setEditingData(JSON.stringify(JSON.parse(storedPatients || '[]'), null, 2));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage('Error loading data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Update editing data when tab changes
  useEffect(() => {
    switch (activeTab) {
      case 'patients':
        setEditingData(JSON.stringify(patients, null, 2));
        break;
      case 'staff':
        setEditingData(JSON.stringify(staff, null, 2));
        break;
      case 'visits':
        setEditingData(JSON.stringify(visits, null, 2));
        break;
      case 'alerts':
        setEditingData(JSON.stringify(alerts, null, 2));
        break;
      default:
        break;
    }
  }, [activeTab, patients, staff, visits, alerts]);

  const handleSave = async () => {
    try {
      let parsedData;
      try {
        parsedData = JSON.parse(editingData);
      } catch (error) {
        setMessage('Invalid JSON format');
        return;
      }

      if (!Array.isArray(parsedData)) {
        setMessage('Data must be an array');
        return;
      }

      // Validate data based on type
      const validationError = validateData(parsedData, activeTab);
      if (validationError) {
        setMessage(validationError);
        return;
      }

      // Save to localStorage (for demo mode) or API
      if (token === 'DEMO_TOKEN') {
        localStorage.setItem(`hospice-${activeTab}`, JSON.stringify(parsedData));
        
        // Update state
        switch (activeTab) {
          case 'patients':
            setPatients(parsedData);
            break;
          case 'staff':
            setStaff(parsedData);
            break;
          case 'visits':
            setVisits(parsedData);
            break;
          case 'alerts':
            setAlerts(parsedData);
            break;
          default:
            break;
        }
        
        setMessage(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} saved successfully!`);
      } else {
        // TODO: Implement API save
        setMessage('API save not implemented yet');
      }

      if (typeof onDataChange === 'function') onDataChange();
    } catch (error) {
      console.error('Error saving data:', error);
      setMessage('Error saving data');
    }
  };

  const validateData = (data, type) => {
    switch (type) {
      case 'patients':
        for (const patient of data) {
          if (!patient.id || !patient.name || !patient.socDate || !patient.benefitPeriodStart || !patient.benefitPeriodNumber) {
            return 'Patients must have id, name, socDate, benefitPeriodStart, and benefitPeriodNumber';
          }
          if (!patient.benefitPeriodNumber.match(/^BP[1-9]\d*$/)) {
            return 'Benefit Period Number must be in format BP1, BP2, BP3, etc.';
          }
          if (isNaN(Date.parse(patient.socDate)) || isNaN(Date.parse(patient.benefitPeriodStart))) {
            return 'Dates must be in valid ISO format (YYYY-MM-DD)';
          }
        }
        break;
      case 'staff':
        for (const member of data) {
          if (!member.name || !member.role || !member.color || !member.status) {
            return 'Staff must have name, role, color, and status';
          }
          if (!['RN', 'LVN'].includes(member.role)) {
            return 'Staff role must be RN or LVN';
          }
        }
        break;
      case 'visits':
        for (const visit of data) {
          if (!visit.id || !visit.patientId || !visit.date || !visit.staff) {
            return 'Visits must have id, patientId, date, and staff';
          }
          if (isNaN(Date.parse(visit.date))) {
            return 'Visit date must be in valid ISO format (YYYY-MM-DD)';
          }
        }
        break;
      case 'alerts':
        for (const alert of data) {
          if (!alert.id || !alert.patientId || !alert.date || !alert.type || !alert.message) {
            return 'Alerts must have id, patientId, date, type, and message';
          }
          if (isNaN(Date.parse(alert.date))) {
            return 'Alert date must be in valid ISO format (YYYY-MM-DD)';
          }
        }
        break;
      default:
        break;
    }
    return null;
  };

  const handleClearAllData = async () => {
    try {
      await clearAllData();
      await loadData();
      setMessage('All data cleared successfully!');
      if (typeof onDataChange === 'function') onDataChange();
    } catch (error) {
      console.error('Error clearing data:', error);
      setMessage('Error clearing data');
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(editingData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTab}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          setEditingData(JSON.stringify(importedData, null, 2));
          setMessage('File imported successfully! Click Save to apply changes.');
        } catch (error) {
          setMessage('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  };

  const getDataStats = () => {
    switch (activeTab) {
      case 'patients':
        const activePatients = patients.filter(p => p.status === 'active').length;
        const pendingPatients = patients.filter(p => p.status === 'pending').length;
        return {
          total: patients.length,
          active: activePatients,
          pending: pendingPatients,
          cities: [...new Set(patients.map(p => p.city))].length
        };
      case 'staff':
        const rnCount = staff.filter(s => s.role === 'RN').length;
        const lvnCount = staff.filter(s => s.role === 'LVN').length;
        const activeStaff = staff.filter(s => s.status === 'active').length;
        return {
          total: staff.length,
          rn: rnCount,
          lvn: lvnCount,
          active: activeStaff
        };
      case 'visits':
        const completedVisits = visits.filter(v => v.completed).length;
        const pendingVisits = visits.filter(v => !v.completed).length;
        const rnVisits = visits.filter(v => v.discipline === 'RN').length;
        const lvnVisits = visits.filter(v => v.discipline === 'LVN').length;
        return {
          total: visits.length,
          completed: completedVisits,
          pending: pendingVisits,
          rn: rnVisits,
          lvn: lvnVisits
        };
      case 'alerts':
        const recertAlerts = alerts.filter(a => a.type === 'recert').length;
        const visitAlerts = alerts.filter(a => a.type === 'visit').length;
        return {
          total: alerts.length,
          recert: recertAlerts,
          visit: visitAlerts
        };
      default:
        return {};
    }
  };

  const stats = getDataStats();

  return (
    <div className="data-editor">
      <div className="editor-header">
        <h1>📊 Data Editor</h1>
        <p>Edit and manage your hospice data in JSON format</p>
      </div>

      <div className="editor-controls">
        <div className="tab-buttons">
          <button 
            className={`tab-button ${activeTab === 'patients' ? 'active' : ''}`}
            onClick={() => setActiveTab('patients')}
          >
            👥 Patients ({stats.total || 0})
          </button>
          <button 
            className={`tab-button ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            👨‍⚕️ Staff ({stats.total || 0})
          </button>
          <button 
            className={`tab-button ${activeTab === 'visits' ? 'active' : ''}`}
            onClick={() => setActiveTab('visits')}
          >
            📅 Visits ({stats.total || 0})
          </button>
          <button 
            className={`tab-button ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            ⚠️ Alerts ({stats.total || 0})
          </button>
        </div>

        <div className="action-buttons">
          <button onClick={handleSave} className="save-button">
            💾 Save Changes
          </button>
          <button onClick={handleExport} className="export-button">
            📤 Export
          </button>
          <label className="import-button">
            �� Import
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImport} 
              style={{ display: 'none' }}
            />
          </label>
                  <button onClick={handleClearAllData} className="reset-button">
          🗑️ Clear All Data
        </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes('successful') || message.includes('imported') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="stats-cards">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="stat-card">
            <div className="stat-value">{value}</div>
            <div className="stat-label">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
          </div>
        ))}
      </div>

      <div className="editor-container">
        <div className="editor-toolbar">
          <h3>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Data</h3>
          <div className="editor-tips">
            <p>💡 Tips:</p>
            <ul>
              <li>Edit the JSON data below and click "Save Changes"</li>
              <li>Use "Export" to download the current data</li>
              <li>Use "Import" to load data from a JSON file</li>
              <li>Use "Clear All Data" to remove all data</li>
            </ul>
          </div>
        </div>
        
        <textarea
          value={editingData}
          onChange={(e) => setEditingData(e.target.value)}
          className="json-editor"
          placeholder="Enter JSON data here..."
          disabled={isLoading}
        />
      </div>

      <style jsx>{`
        .data-editor {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .editor-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .editor-header h1 {
          color: #2c3e50;
          margin-bottom: 10px;
          font-size: 2rem;
        }

        .editor-header p {
          color: #7f8c8d;
          font-size: 1.1rem;
        }

        .editor-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 15px;
        }

        .tab-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .tab-button {
          padding: 12px 20px;
          border: 2px solid #e1e8ed;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
          font-weight: 500;
        }

        .tab-button:hover {
          border-color: #3498db;
          background: #f8f9fa;
        }

        .tab-button.active {
          background: #3498db;
          color: white;
          border-color: #3498db;
        }

        .action-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .save-button, .export-button, .import-button, .reset-button {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s;
        }

        .save-button {
          background: #27ae60;
          color: white;
        }

        .save-button:hover {
          background: #229954;
        }

        .export-button {
          background: #3498db;
          color: white;
        }

        .export-button:hover {
          background: #2980b9;
        }

        .import-button {
          background: #f39c12;
          color: white;
          cursor: pointer;
          display: inline-block;
        }

        .import-button:hover {
          background: #e67e22;
        }

        .reset-button {
          background: #e74c3c;
          color: white;
        }

        .reset-button:hover {
          background: #c0392b;
        }

        .message {
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 20px;
          font-weight: 500;
        }

        .message.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .message.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .stats-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: white;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          text-align: center;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: bold;
          color: #2c3e50;
          margin-bottom: 5px;
        }

        .stat-label {
          color: #7f8c8d;
          font-size: 0.8rem;
        }

        .editor-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        .editor-toolbar {
          padding: 20px;
          border-bottom: 1px solid #e1e8ed;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .editor-toolbar h3 {
          color: #2c3e50;
          margin: 0;
        }

        .editor-tips {
          max-width: 300px;
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .editor-tips p {
          margin: 0 0 10px 0;
          font-weight: 500;
        }

        .editor-tips ul {
          margin: 0;
          padding-left: 20px;
        }

        .editor-tips li {
          margin-bottom: 5px;
        }

        .json-editor {
          width: 100%;
          min-height: 500px;
          padding: 20px;
          border: none;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          line-height: 1.5;
          background: #f8f9fa;
          color: #2c3e50;
          resize: vertical;
        }

        .json-editor:focus {
          outline: none;
          background: #ffffff;
        }

        .json-editor:disabled {
          background: #f1f2f6;
          color: #7f8c8d;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .editor-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .tab-buttons, .action-buttons {
            justify-content: center;
          }

          .editor-toolbar {
            flex-direction: column;
            gap: 15px;
          }

          .editor-tips {
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
}

export default DataEditor; 