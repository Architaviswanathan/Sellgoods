import { responseError } from './apiError';

export type AuthUser = { id: number; name: string; email: string };
export type AuthResult = { access_token: string; token_type: string; user: AuthUser };

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

export async function authenticate(path: 'login' | 'signup', payload: { email: string; password: string; name?: string }): Promise<AuthResult> {
  const response = await fetch(`${API_URL}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw responseError(response.status, data.detail, 'Could not sign in. Please try again.');
  return data as AuthResult;
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw responseError(response.status, data.detail, 'Your session has expired.');
  return data as AuthUser;
}
