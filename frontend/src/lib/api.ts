import axios from "axios";
import { getSession } from "next-auth/react";

export const api = axios.create({
  baseURL: "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session && (session as any).backend_access_token) {
    config.headers.Authorization = `Bearer ${(session as any).backend_access_token}`;
  }
  return config;
});
