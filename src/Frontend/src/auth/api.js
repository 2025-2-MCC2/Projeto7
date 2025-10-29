import axios from 'axios';

// FRONT aponta para back na 3000:
export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
export const AUTH_STORAGE = import.meta.env.VITE_AUTH_STORAGE || 'cookie';

axios.defaults.withCredentials = AUTH_STORAGE === 'cookie';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: AUTH_STORAGE === 'cookie',
  headers: { 'Content-Type': 'application/json' },
});