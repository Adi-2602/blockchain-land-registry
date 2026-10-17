import axios from "axios";
// Deploy par VITE_API_URL set karo (e.g. http://<EC2-IP>:5001/api)
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api" });


api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;