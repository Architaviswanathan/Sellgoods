export type AuctionRecord = {
  id: number;
  seller_id: number;
  seller: string;
  title: string;
  category: string;
  condition: string;
  description: string;
  image: string;
  price: number;
  starting_price: number;
  increment: number;
  ends_at: string;
  status: string;
  bids: { bidder_id: number; bidder: string; amount: number; time: string }[];
  watched: boolean;
  questions: { id: number; asker_id: number; asker: string; text: string; answer: string | null; created_at: string; answered_at: string | null }[];
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
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not load auctions. Please try again.');
  return data as T;
}

export function listAuctions(token: string): Promise<AuctionRecord[]> {
  return request('/api/auctions', token);
}

export function listMyAuctions(token: string): Promise<AuctionRecord[]> {
  return request('/api/auctions/mine', token);
}

export function createAuction(token: string, item: {
  title: string; category: string; condition: string; description: string; image: string;
  startingPrice: number; increment: number; endsAt: number;
}): Promise<AuctionRecord> {
  return request('/api/auctions', token, {
    method: 'POST',
    body: JSON.stringify({
      title: item.title,
      category: item.category,
      condition: item.condition,
      description: item.description,
      image_url: item.image,
      starting_price: item.startingPrice,
      increment: item.increment,
      ends_at: new Date(item.endsAt).toISOString(),
    }),
  });
}

export function updateAuction(token: string, id: number, patch: {
  title?: string; category?: string; condition?: string; description?: string;
  starting_price?: number; increment?: number;
}): Promise<AuctionRecord> {
  return request(`/api/auctions/${id}`, token, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function cancelAuction(token: string, id: number): Promise<AuctionRecord> {
  return request(`/api/auctions/${id}/cancel`, token, { method: 'POST' });
}

export function placeBid(token: string, id: number, amount: number): Promise<AuctionRecord> {
  return request(`/api/auctions/${id}/bids`, token, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export function toAuction(record: AuctionRecord) {
  return {
    id: record.id,
    sellerId: record.seller_id,
    title: record.title,
    category: record.category,
    condition: record.condition,
    description: record.description,
    image: record.image,
    price: record.price,
    startingPrice: record.starting_price,
    increment: record.increment,
    endsAt: new Date(record.ends_at).getTime(),
    seller: record.seller,
    bids: record.bids.map((bid) => ({ bidderId: bid.bidder_id, bidder: bid.bidder, amount: bid.amount, time: new Date(bid.time).getTime() })),
    watched: record.watched,
    questions: record.questions.map((question) => ({
      id: question.id,
      askerId: question.asker_id,
      author: question.asker,
      text: question.text,
      answer: question.answer ?? undefined,
      createdAt: new Date(question.created_at).getTime(),
      answeredAt: question.answered_at ? new Date(question.answered_at).getTime() : undefined,
    })),
    status: record.status,
  };
}
