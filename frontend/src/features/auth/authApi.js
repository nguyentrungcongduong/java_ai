import axios from 'axios';
import { loginSuccess, logout } from './authSlice';

// Sử dụng biến môi trường (Vite), fallback về localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
});

export const login = (credentials) => {
  return apiClient.post('/auth/login', credentials);
};

export const register = (userData) => {
    return apiClient.post('/auth/register', userData);
};

// --- Interceptors ---

// Request interceptor to add the auth token header to requests
apiClient.interceptors.request.use(
  (config) => {
    // Lấy token trực tiếp từ localStorage để tránh circular dependency với store
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Bỏ qua nếu chính request refresh bị lỗi (tránh vòng lặp)
    if (originalRequest?.url?.includes('/auth/refresh')) {
      localStorage.clear();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Xử lý 401 (Unauthorized) - token hết hạn
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          localStorage.clear();
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Gọi endpoint refresh token
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });

        // Cập nhật token mới vào localStorage
        localStorage.setItem('token', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }

        // Gửi lại request gốc với token mới
        originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh thất bại → logout
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
