import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export function login(email, password) {
  return axios.post(`${API_URL}/login`, { email, password });
}

export function getPatients(token) {
  return axios.get(`${API_URL}/patients`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export function getVisits(token) {
  return axios.get(`${API_URL}/visits`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

// You can add more functions for POST/PUT/DELETE as needed
