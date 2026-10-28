import { responseError } from './apiError';

export type AuctionQuestion = {
  id: number;
  asker_id: number;
  asker: string;
  text: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
};

export type CampusNotification = {
  id: number;
  auction_id: number;
  actor_id: number;
  kind: 'bid' | 'question' | 'answer';
  message: string;
  created_at: string;
  read_at: string | null;
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw responseError(response.status, data?.detail, 'Could not complete this action.');
  return data as T;
}

export function askAuctionQuestion(token: string, auctionId: number, text: string): Promise<AuctionQuestion> {
  return request(`/api/auctions/${auctionId}/questions`, token, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function answerAuctionQuestion(token: string, auctionId: number, questionId: number, answer: string): Promise<AuctionQuestion> {
  return request(`/api/auctions/${auctionId}/questions/${questionId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ answer }),
  });
}

export function listNotifications(token: string): Promise<CampusNotification[]> {
  return request('/api/notifications', token);
}

export function markNotificationRead(token: string, notificationId: number): Promise<CampusNotification> {
  return request(`/api/notifications/${notificationId}/read`, token, { method: 'POST' });
}

export function markAllNotificationsRead(token: string): Promise<void> {
  return request('/api/notifications/read-all', token, { method: 'POST' });
}
