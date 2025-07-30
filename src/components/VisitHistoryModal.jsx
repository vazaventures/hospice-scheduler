import React, { useState, useEffect } from 'react';
import dataManager from '../dataManager.js';
import './Forms.css';

function VisitHistoryModal({ patient, isOpen, onClose }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && patient) {
      loadVisitHistory();
    }
  }, [isOpen, patient]);

  const loadVisitHistory = () => {
    setLoading(true);
    const data = dataManager.getData();
    
    // Get all visits for this patient, sorted by date (newest first)
    const patientVisits = data.visits
      .filter(v => v.patientId === patient.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    setVisits(patientVisits);
    setLoading(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4caf50';
      case 'confirmed': return '#2196f3';
      case 'suggested': return '#ff9800';
      default: return '#999';
    }
  };

  const getTagColor = (tag) => {
    switch (tag) {
      case 'recert': return '#f44336';
      case 'prn': return '#9c27b0';
      case 'HUV1': return '#ff9800';
      case 'HUV2': return '#ff5722';
      case 'over-limit': return '#ff0000';
      default: return '#666';
    }
  };

  if (!isOpen || !patient) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content visit-history-modal" onClick={e => e.stopPropagation()}>
        <h3>Visit History - {patient.name}</h3>
        
        {loading ? (
          <div className="loading">Loading visit history...</div>
        ) : (
          <div className="visit-history">
            {visits.length === 0 ? (
              <p className="no-visits">No visits found for this patient.</p>
            ) : (
              <div className="visits-list">
                {visits.map(visit => (
                  <div key={visit.id} className="visit-item">
                    <div className="visit-header">
                      <div className="visit-date">
                        {new Date(visit.date).toLocaleDateString()}
                      </div>
                      <div 
                        className="visit-status"
                        style={{ backgroundColor: getStatusColor(visit.status) }}
                      >
                        {visit.status}
                      </div>
                    </div>
                    
                    <div className="visit-details">
                      <div className="visit-discipline">
                        <strong>{visit.discipline}</strong>
                        {visit.staff && ` - ${visit.staff}`}
                      </div>
                      
                      <div className="visit-type">
                        {visit.visitType || 'routine'}
                      </div>
                      
                      {visit.tags && visit.tags.length > 0 && (
                        <div className="visit-tags">
                          {visit.tags.map(tag => (
                            <span 
                              key={tag} 
                              className="tag-badge"
                              style={{ backgroundColor: getTagColor(tag) }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {visit.notes && (
                        <div className="visit-notes">
                          <strong>Notes:</strong> {visit.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default VisitHistoryModal; 