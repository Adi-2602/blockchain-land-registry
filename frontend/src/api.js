import axios from "axios";

// Backend ka URL .env se (VITE_API_URL) — deploy karte waqt sirf .env badlo
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Axios / contract errors ko ek readable message mein badlo
export function errorMessage(err, fallback = "Something went wrong") {
  return err.response?.data?.error || err.message || fallback;
}

export default api;
