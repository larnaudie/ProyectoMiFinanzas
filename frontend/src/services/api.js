import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:2000/v1';

export const api = axios.create({
  baseURL: API_URL,
});

let redirigiendoAlLogin = false;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const teniaSesion = Boolean(localStorage.getItem('token'));
    const sesionInvalida = teniaSesion && (status === 401 || status === 403);

    if (sesionInvalida) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');

      if (!redirigiendoAlLogin) {
        redirigiendoAlLogin = true;
        window.location.replace('/');
      }
    }

    return Promise.reject(error);
  },
);
