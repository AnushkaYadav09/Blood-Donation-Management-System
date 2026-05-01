// Central API base URL — uses Render backend in production, local proxy in dev
export const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : import.meta.env.DEV
  ? ''
  : 'https://blood-donation-management-system-52s3.onrender.com';

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
