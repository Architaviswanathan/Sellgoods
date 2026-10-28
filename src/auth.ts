import { responseError } from './apiError';
import { API_URL, networkError } from './apiConfig';

export type AuthUser = { id: number; name: string; email: string };
export type AuthResult = { access_token: string; token_type: string; user: AuthUser };

export async function authenticate(path: 'login' | 'signup', payload: { email: string; password: string; name?: string }): Promise<AuthResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw networkError();
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw responseError(response.status, data?.detail, 'Could not sign in. Please try again.');
  return data as AuthResult;
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw networkError();
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw responseError(response.status, data?.detail, 'Your session has expired.');
  return data as AuthUser;
}
