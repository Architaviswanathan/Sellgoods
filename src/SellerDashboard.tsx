import { useState } from 'react';
import { ArrowRight, Check, Clock3, Pencil, ShieldCheck, X } from 'lucide-react';

type SellerItem = {
  id: number;
  title: string;
  category: string;
  condition: string;
  description: string;
  image: string;
  price: number;
  startingPrice: number;
  increment: number;
  endsAt: number;
  bids: { bidder: string; amount: number; time: number }[];
  status: 'live' | 'closed' | 'unsold' | 'approved' | 'rejected' | 'cancelled' | 'sold' | 'failed pickup';
};

type SellerDashboardProps = {
  items: SellerItem[];
  now: number;
  onUpdate: (id: number, patch: Partial<SellerItem>) => void;
  onOutcome: (id: number, status: SellerItem['status']) => void;
};

const money = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
const remaining = (endsAt: number, now: number) => {
  const seconds = Math.max(0, Math.floor((endsAt - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m ${seconds % 60}s`;
};

export default function SellerDashboard({ items, now, onUpdate, onOutcome }: SellerDashboardProps) {
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
        <div><h1>Your <span>listings.</span></h1><p className="activity-intro">Manage live auctions and record what happens after they close.</p></div>
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
            {item.status === 'live' && <div className="seller-controls">
              {item.bids.length === 0 && <button className="button-outline" onClick={() => setEditing(item)}><Pencil size={14} /> Edit listing</button>}
              {item.bids.length > 0 && <span className="seller-hint">Editing is locked after the first bid.</span>}
              <button className="seller-cancel" onClick={() => onOutcome(item.id, 'cancelled')}><X size={14} /> Cancel auction</button>
            </div>}
            {item.status === 'closed' && <div className="seller-outcome">
              <span className="outcome-winner">Provisional winner <strong>{item.bids[item.bids.length - 1]?.bidder}</strong> · {money(item.price)}</span>
              <button className="button-dark" onClick={() => onOutcome(item.id, 'approved')}><Check size={14} /> Approve price</button>
              <button className="button-outline" onClick={() => onOutcome(item.id, 'rejected')}>Reject price</button>
            </div>}
            {item.status === 'approved' && <div className="seller-outcome"><span className="outcome-winner"><ShieldCheck size={15} /> Reserved for the winner</span><button className="button-dark" onClick={() => onOutcome(item.id, 'sold')}>Confirm handover <ArrowRight size={14} /></button><button className="button-outline" onClick={() => onOutcome(item.id, 'failed pickup')}>Pickup failed</button></div>}
            {item.status === 'unsold' && <div className="seller-outcome"><span className="outcome-winner">No bids · marked unsold</span></div>}
          </div>
        </article>)}
      </div> : <div className="empty-state seller-empty"><ShieldCheck size={24} /><h3>Your listings will appear here.</h3><p>List an item from the marketplace to manage its auction and handover.</p></div>}
  {editing && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><section className="form-modal" role="dialog" aria-modal="true" aria-label="Edit listing"><div className="form-modal-heading"><div><div className="eyebrow dark-eyebrow"><span /> UPDATE YOUR ITEM</div><h2>Edit listing.</h2></div><button className="modal-close" onClick={() => setEditing(null)} aria-label="Close"><X size={19} /></button></div><form onSubmit={saveEdit}><label>ITEM NAME<input name="title" defaultValue={editing.title} required maxLength={80} /></label><div className="form-row"><label>CATEGORY<select name="category" defaultValue={editing.category}><option>Cycles</option><option>Electronics</option><option>Books</option><option>Other</option></select></label><label>CONDITION<select name="condition" defaultValue={editing.condition}><option>Good</option><option>Like new</option><option>Very good</option><option>New</option></select></label></div><label>THE DETAILS<textarea name="description" defaultValue={editing.description} required rows={3} maxLength={500} /></label><div className="form-row"><label>STARTING PRICE (₹)<input name="price" type="number" min="1" defaultValue={editing.startingPrice} required /></label><label>MINIMUM INCREMENT (₹)<input name="increment" type="number" min="1" defaultValue={editing.increment} required /></label></div><div className="form-modal-footer"><span><ShieldCheck size={16} /> Editing closes after a bid.</span><button className="button-dark" type="submit">Save changes <ArrowRight size={15} /></button></div></form></section></div>}
  </main>
  );
}
