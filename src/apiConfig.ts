/**
 * Resolve the API address. A VITE_API_URL always wins. Otherwise we talk to
 * port 8000 on whatever host opened the app, so both http://localhost:5173
 * and http://127.0.0.1:5173 work without CORS surprises.
 */
const configured = import.meta.env.VITE_API_URL;

export const API_URL = configured
  ? configured.replace(/\/$/, '')
  : `${window.location.protocol}//${window.location.hostname}:8000`;

export const API_DOWN_MESSAGE = `Can't reach the Sellgoods API at ${API_URL}. Start the backend (see README) and try again.`;

export function networkError(): Error {
  return new Error(API_DOWN_MESSAGE);
}
