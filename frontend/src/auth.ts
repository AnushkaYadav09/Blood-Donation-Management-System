// Minimal auth helpers — no context needed, just localStorage
export function getToken(): string | null { return localStorage.getItem('token'); }
export function getDonorId(): string | null { return localStorage.getItem('donorId'); }
export function isLoggedIn(): boolean { return !!getToken() && !!getDonorId(); }
export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('donorId');
  window.location.href = '/login';
}
export function saveAuth(token: string, donorId: string): void {
  localStorage.setItem('token', token);
  localStorage.setItem('donorId', donorId);
}
export function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
