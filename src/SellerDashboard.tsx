import { useState } from 'react';
import { ArrowRight, Check, Clock3, Pencil, ShieldCheck, X } from 'lucide-react';

type SellerItem = {
  id: number;
  sellerId: number;
  title: string;
  category: string;
  condition: string;
  description: string;
  image: string;
  price: number;
  startingPrice: number;
  increment: number;
  endsAt: number;
  bids: { bidderId: number; bidder: string; amount: number; time: number }[];
  questions: { id: number; askerId: number; author: string; text: string; answer?: string }[];
  status: 'live' | 'closed' | 'unsold' | 'approved' | 'rejected' | 'cancelled' | 'sold' | 'failed pickup';
};

type SellerDashboardProps = {
  items: SellerItem[];
  sellerName: string;
  sellerEmail: string;
  now: number;
  onUpdate: (id: number, patch: Pick<Partial<SellerItem>, 'title' | 'category' | 'condition' | 'description' | 'startingPrice' | 'price' | 'increment'>) => void;
  onOutcome: (id: number, status: SellerItem['status']) => void;
  onAnswer: (auctionId: number, questionId: number, answer: string) => Promise<void>;
};

const money = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
const remaining = (endsAt: number, now: number) => {
  const seconds = Math.max(0, Math.floor((endsAt - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m ${seconds % 60}s`;
};

export default function SellerDashboard({ items, sellerName, sellerEmail, now, onUpdate, onOutcome, onAnswer }: SellerDashboardProps) {
  const [editing, setEditing] = useState<SellerItem | null>(null);

  const saveEdit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    onUpdate(editing.id, {
      title: String(form.get('title')),
      category: String(form.get('category')),
      condition: String(form.get('condition')),
      description: String(form.get('description')),
      startingPrice: Number(form.get('price')),
      price: Number(form.get('price')),
      increment: Number(form.get('increment')),
    });
    setEditing(null);
  };

  return (
    <main className="activity-page seller-page">
      <div className="eyebrow dark-eyebrow"><span /> SELLER WORKSPACE</div>
      <div className="section-heading seller-heading">
        <div><h1>Your <span>listings.</span></h1><p className="activity-intro">Signed in as {sellerEmail}. Only listings created by this account appear here.</p></div>
        <span className="seller-count">{items.length} {items.length === 1 ? 'listing' : 'listings'}</span>
      </div>
      {items.length ? <div className="seller-list">
        {items.map((item) => <article className="seller-item" key={item.id}>
          <img src={item.image} alt={item.title} />
          <div className="seller-item-main">
            <div className="seller-item-meta"><span>{item.category}</span><span>·</span><span className={`status-label status-${item.status.replace(' ', '-')}`}>{item.status}</span></div>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <div className="seller-item-stats"><strong>{money(item.price)}</strong><span>{item.bids.length} public bids</span>{item.status === 'live' && <span><Clock3 size={13} /> {remaining(item.endsAt, now)} left</span>}</div>
            {item.bids.length > 0 && <div className="seller-bid-summary"><span>{item.status === 'live' ? 'Currently leading' : 'Provisional winner'}</span><strong>{[...item.bids].sort((a, b) => b.amount - a.amount || b.time - a.time)[0].bidder}</strong><b>{money(Math.max(...item.bids.map((bid) => bid.amount)))}</b></div>}
            {item.bids.length > 0 && <details className="seller-bid-history"><summary>View public bid history <span>{item.bids.length}</span></summary>{[...item.bids].sort((a, b) => b.amount - a.amount).map((bid) => <div key={`${bid.bidderId}-${bid.time}`}><strong>{bid.bidder}</strong><time>{new Date(bid.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time><b>{money(bid.amount)}</b></div>)}</details>}
            {item.questions.length > 0 && <section className="seller-questions"><h3><span>Buyer questions</span><small>{item.questions.filter((question) => !question.answer).length} unanswered</small></h3>{item.questions.map((question) => <article key={question.id}><strong>{question.author}</strong><p>{question.text}</p>{question.answer ? <div className="seller-answer"><span>YOUR ANSWER</span>{question.answer}</div> : <form onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const answer = String(new FormData(form).get('answer')).trim(); if (!answer) return; await onAnswer(item.id, question.id, answer); form.reset(); }}><input name="answer" placeholder="Write a helpful answer for the buyer..." maxLength={1000} required /><button type="submit">Reply</button></form>}</article>)}</section>}
            {item.status === 'live' && <div className="seller-controls">
              {item.bids.length === 0 && <button className="button-outline" onClick={() => setEditing(item)}><Pencil size={14} /> Edit listing</button>}
              {item.bids.length > 0 && <span className="seller-hint">Editing is locked after the first bid.</span>}
              <button className="seller-cancel" onClick={() => onOutcome(item.id, 'cancelled')}><X size={14} /> Cancel auction</button>
            </div>}
            {item.status === 'closed' && <div className="seller-outcome">
              <span className="outcome-winner">Provisional winner <strong>{[...item.bids].sort((a, b) => b.amount - a.amount || b.time - a.time)[0]?.bidder}</strong> · {money(item.price)}</span>
              <button className="button-dark" onClick={() => onOutcome(item.id, 'approved')}><Check size={14} /> Approve price</button>
              <button className="button-outline" onClick={() => onOutcome(item.id, 'rejected')}>Reject price</button>
            </div>}
            {item.status === 'approved' && <div className="seller-outcome"><span className="outcome-winner"><ShieldCheck size={15} /> Reserved for the winner</span><button className="button-dark" onClick={() => onOutcome(item.id, 'sold')}>Confirm handover <ArrowRight size={14} /></button><button className="button-outline" onClick={() => onOutcome(item.id, 'failed pickup')}>Pickup failed</button></div>}
            {item.status === 'unsold' && <div className="seller-outcome"><span className="outcome-winner">No bids · marked unsold</span></div>}
          </div>
        </article>)}
      </div> : <div className="empty-state seller-empty"><ShieldCheck size={24} /><h3>No listings under {sellerName}.</h3><p>Listings are tied to the account that created them. Switch to that account to manage its items, or list a new one here.</p></div>}
  {editing && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><section className="form-modal" role="dialog" aria-modal="true" aria-label="Edit listing"><div className="form-modal-heading"><div><div className="eyebrow dark-eyebrow"><span /> UPDATE YOUR ITEM</div><h2>Edit listing.</h2></div><button className="modal-close" onClick={() => setEditing(null)} aria-label="Close"><X size={19} /></button></div><form onSubmit={saveEdit}><label>ITEM NAME<input name="title" defaultValue={editing.title} required maxLength={80} /></label><div className="form-row"><label>CATEGORY<select name="category" defaultValue={editing.category}><option>Cycles</option><option>Electronics</option><option>Books</option><option>Other</option></select></label><label>CONDITION<select name="condition" defaultValue={editing.condition}><option>Good</option><option>Like new</option><option>Very good</option><option>New</option></select></label></div><label>THE DETAILS<textarea name="description" defaultValue={editing.description} required rows={3} maxLength={500} /></label><div className="form-row"><label>STARTING PRICE (₹)<input name="price" type="number" min="1" defaultValue={editing.startingPrice} required /></label><label>MINIMUM INCREMENT (₹)<input name="increment" type="number" min="1" defaultValue={editing.increment} required /></label></div><div className="form-modal-footer"><span><ShieldCheck size={16} /> Editing closes after a bid.</span><button className="button-dark" type="submit">Save changes <ArrowRight size={15} /></button></div></form></section></div>}
  </main>
  );
}
