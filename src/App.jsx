import React, { useState, useEffect } from "react";
import axios from "axios";
import RnDashboard from "./RnDashboard.jsx";
import NurseWeeklySchedule from "./WeeklySchedule.jsx";
import MainDashboard from "./MainDashboard.jsx";
import StaffManager from "./StaffManager.jsx";
import DataEditor from "./DataEditor.jsx";
import VisitCheck from "./VisitCheck.jsx";
import { clearAllData, ensureCleanStartup } from "./dataLoader";

const API_URL = "http://localhost:4000/api";

function App() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [activeTab, setActiveTab] = useState("patients");
  const [dataVersion, setDataVersion] = useState(0);

  // Initialize app with clean data
  useEffect(() => {
    ensureCleanStartup();
  }, []);

  const handleLogin = async () => {
    try {
      setMessage("");
      const res = await axios.post(`${API_URL}/login`, { email, password });
      setToken(res.data.token);
      setMessage("Login successful!");
    } catch (err) {
      setMessage("Login failed: " + (err.response?.data?.error || err.message));
    }
  };

  const handleRegister = async () => {
    try {
      setMessage("");
      await axios.post(`${API_URL}/register`, { email, password });
      setMessage("Registration successful! You can now login.");
      setIsRegistering(false);
    } catch (err) {
      setMessage("Registration failed: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDemoMode = () => {
    setToken("DEMO_TOKEN");
    setDemoMode(true);
    setMessage("");
    // Demo mode activated - no sample data loaded
  };

  const handleLogout = () => {
    setToken("");
    setDemoMode(false);
    setMessage("");
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "visitcheck":
        return <VisitCheck token={token} dataVersion={dataVersion} onDataChange={() => setDataVersion(v => v + 1)} />;
      case "patients":
        return <MainDashboard token={token} dataVersion={dataVersion} onDataChange={() => setDataVersion(v => v + 1)} />;
      case "rn-dashboard":
        return <RnDashboard token={token} dataVersion={dataVersion} onDataChange={() => setDataVersion(v => v + 1)} />;
      case "schedule":
        return <NurseWeeklySchedule token={token} dataVersion={dataVersion} onDataChange={() => setDataVersion(v => v + 1)} />;
      case "staff":
        return <StaffManager token={token} dataVersion={dataVersion} onDataChange={() => setDataVersion(v => v + 1)} />;
      case "data":
        return <DataEditor token={token} onDataChange={() => setDataVersion(v => v + 1)} />;
      default:
        return <MainDashboard token={token} dataVersion={dataVersion} onDataChange={() => setDataVersion(v => v + 1)} />;
    }
  };

  return (
    <div className="app-container">
      {demoMode && (
        <div className="demo-banner">
          Demo Mode Active: Login is bypassed and data is read-only.
        </div>
      )}
      
      {!token ? (
        <div className="login-container">
          <div className="login-card">
            <h1>🏥 Hospice Scheduler</h1>
            <p className="login-subtitle">Comprehensive hospice care management system</p>
            
            <div className="login-form">
              <input
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="login-input"
              />
              <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="login-input"
              />
              <div className="login-buttons">
                {isRegistering ? (
                  <button onClick={handleRegister} className="login-button primary">Register</button>
                ) : (
                  <button onClick={handleLogin} className="login-button primary">Login</button>
                )}
                <button onClick={() => setIsRegistering(!isRegistering)} className="login-button secondary">
                  {isRegistering ? "Switch to Login" : "Switch to Register"}
                </button>
              </div>
              <button onClick={handleDemoMode} className="demo-button">
                🚀 Try Demo Mode
              </button>
            </div>
            
            {message && (
              <div className={`message ${message.includes("successful") ? "success" : "error"}`}>
                {message}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="main-app">
          <header className="app-header">
            <div className="header-content">
              <h1>🏥 Hospice Scheduler</h1>
              <button onClick={handleLogout} className="logout-button">
                Logout
              </button>
            </div>
          </header>

          <nav className="app-nav">
            <button 
              className={`nav-tab ${activeTab === "patients" ? "active" : ""}`}
              onClick={() => setActiveTab("patients")}
            >
              👥 Patients
            </button>
            <button 
              className={`nav-tab ${activeTab === "visitcheck" ? "active" : ""}`}
              onClick={() => setActiveTab("visitcheck")}
            >
              ✅ VisitCheck
            </button>
            <button 
              className={`nav-tab ${activeTab === "rn-dashboard" ? "active" : ""}`}
              onClick={() => setActiveTab("rn-dashboard")}
            >
              🩺 RN Dashboard
            </button>
            <button 
              className={`nav-tab ${activeTab === "schedule" ? "active" : ""}`}
              onClick={() => setActiveTab("schedule")}
            >
              📅 Schedule
            </button>
            <button 
              className={`nav-tab ${activeTab === "staff" ? "active" : ""}`}
              onClick={() => setActiveTab("staff")}
            >
              👥 Staff
            </button>
            <button 
              className={`nav-tab ${activeTab === "data" ? "active" : ""}`}
              onClick={() => setActiveTab("data")}
            >
              📊 Data Editor
            </button>
          </nav>

          <main className="app-main">
            {renderTabContent()}
          </main>
        </div>
      )}

      <style jsx>{`
        .app-container {
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .demo-banner {
          background: #ffe082;
          color: #333;
          padding: 12px;
          text-align: center;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .login-card {
          background: white;
          padding: 40px;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          max-width: 400px;
          width: 100%;
          text-align: center;
        }

        .login-card h1 {
          margin: 0 0 10px 0;
          color: #2c3e50;
          font-size: 2rem;
        }

        .login-subtitle {
          color: #7f8c8d;
          margin: 0 0 30px 0;
          font-size: 1rem;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .login-input {
          padding: 12px 16px;
          border: 2px solid #e1e8ed;
          border-radius: 8px;
          font-size: 1rem;
          transition: border-color 0.2s;
        }

        .login-input:focus {
          outline: none;
          border-color: #3498db;
        }

        .login-buttons {
          display: flex;
          gap: 10px;
        }

        .login-button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .login-button.primary {
          background: #3498db;
          color: white;
        }

        .login-button.primary:hover {
          background: #2980b9;
        }

        .login-button.secondary {
          background: #95a5a6;
          color: white;
        }

        .login-button.secondary:hover {
          background: #7f8c8d;
        }

        .demo-button {
          width: 100%;
          padding: 12px;
          background: #27ae60;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .demo-button:hover {
          background: #229954;
        }

        .message {
          margin-top: 15px;
          padding: 10px;
          border-radius: 6px;
          font-weight: 600;
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

        .main-app {
          min-height: 100vh;
          background: #f8f9fa;
        }

        .app-header {
          background: #2c3e50;
          color: white;
          padding: 15px 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1400px;
          margin: 0 auto;
        }

        .header-content h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .logout-button {
          padding: 8px 16px;
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .logout-button:hover {
          background: #c0392b;
        }

        .app-nav {
          background: white;
          padding: 0 20px;
          border-bottom: 1px solid #e1e8ed;
          overflow-x: auto;
        }

        .nav-tab {
          padding: 15px 20px;
          background: none;
          border: none;
          color: #7f8c8d;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 600;
          border-bottom: 3px solid transparent;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .nav-tab:hover {
          color: #2c3e50;
          background: #f8f9fa;
        }

        .nav-tab.active {
          color: #3498db;
          border-bottom-color: #3498db;
        }

        .app-main {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        @media (max-width: 768px) {
          .login-card {
            padding: 30px 20px;
          }
          
          .login-buttons {
            flex-direction: column;
          }
          
          .header-content h1 {
            font-size: 1.2rem;
          }
          
          .nav-tab {
            padding: 12px 15px;
            font-size: 0.8rem;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
