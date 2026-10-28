import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp, ArrowRight, Bell, Bike, BookOpen, Check, ChevronDown, ChevronRight,
  Clock3, Filter, Heart, HelpCircle, Laptop, Menu, MessageCircle, Plus, Search, LogOut,
  Send, ShieldCheck, Sparkles, Tag, X,
} from 'lucide-react';
import SellerDashboard from './SellerDashboard';
import AuthPage from './AuthPage';
import { fetchCurrentUser, type AuthUser } from './auth';
import { cancelAuction as cancelAuctionApi, createAuction as createAuctionApi, listAuctions, placeBid as placeBidApi, toAuction, updateAuction as updateAuctionApi } from './auctionApi';
import { answerAuctionQuestion, askAuctionQuestion, listNotifications, markAllNotificationsRead, markNotificationRead, type CampusNotification } from './activityApi';
import NotificationPanel from './NotificationPanel';

type Bid = { bidderId: number; bidder: string; amount: number; time: number };
type Question = { id: number; askerId: number; author: string; text: string; answer?: string; createdAt: number; answeredAt?: number };
type Auction = {
  id: number; title: string; category: string; condition: string; description: string;
  image: string; price: number; startingPrice: number; increment: number; endsAt: number;
  sellerId: number; seller: string; bids: Bid[]; watched: boolean; questions: Question[];
  status: 'live' | 'closed' | 'unsold' | 'approved' | 'rejected' | 'cancelled' | 'sold' | 'failed pickup';
};

const hour = 60 * 60 * 1000;
const money = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
const timeLeft = (endsAt: number, now: number) => {
  const seconds = Math.max(0, Math.floor((endsAt - now) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m ${remainder.toString().padStart(2, '0')}s`;
};

const imageAsDataUrl = async (file: File): Promise<string> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not process this photo.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.78);
};

function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [auctionsLoading, setAuctionsLoading] = useState(true);
  const [auctionsError, setAuctionsError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All items');
  const [condition, setCondition] = useState('Any condition');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('Ending soon');
  const [activeTab, setActiveTab] = useState('Marketplace');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<'listing' | 'watch' | null>(null);
  const [bidValue, setBidValue] = useState('');
  const [autoMax, setAutoMax] = useState('');
  const [notice, setNotice] = useState('');
  const [assistantQuery, setAssistantQuery] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notifications, setNotifications] = useState<CampusNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const seenNotificationIds = useRef(new Set<number>());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authUser) return;
    const token = localStorage.getItem('sellgoods.token');
    if (!token) return;
    setAuctionsLoading(true);
    setAuctionsError('');
    let active = true;
    let hasLoaded = false;
    const refresh = async () => {
      try {
        const [records, alertRecords] = await Promise.all([listAuctions(token), listNotifications(token)]);
        if (!active) return;
        setAuctions(records.map((record) => toAuction(record) as Auction));
        setNotifications(alertRecords);
        if (hasLoaded && document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
          const newAlerts = alertRecords.filter((alert) => !alert.read_at && !seenNotificationIds.current.has(alert.id));
          if (newAlerts.length) new Notification('Sellgoods activity', { body: newAlerts[0].message });
        }
        seenNotificationIds.current = new Set(alertRecords.map((alert) => alert.id));
        hasLoaded = true;
        setAuctionsError('');
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Could not load campus listings.';
        if (!hasLoaded) {
          setAuctions([]);
          setAuctionsError(message);
          showNotice(message);
        }
      } finally {
        if (active) setAuctionsLoading(false);
      }
    };
    void refresh();
    const poller = window.setInterval(() => { void refresh(); }, 12_000);
    return () => {
      active = false;
      window.clearInterval(poller);
    };
  }, [authUser]);

  useEffect(() => {
    const token = localStorage.getItem('sellgoods.token');
    if (!token) {
      setAuthLoading(false);
      return;
    }
    fetchCurrentUser(token)
      .then(setAuthUser)
      .catch(() => {
        localStorage.removeItem('sellgoods.user');
        localStorage.removeItem('sellgoods.token');
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    const expiring = auctions.filter((item) => item.status === 'live' && item.endsAt <= now);
    if (expiring.length) {
      setAuctions((current) => current.map((item) => item.status === 'live' && item.endsAt <= now ? { ...item, status: item.bids.length ? 'closed' : 'unsold' } : item));
    }
  }, [now, auctions]);

  const selected = auctions.find((item) => item.id === selectedId) ?? null;
  const visibleAuctions = useMemo(() => {
    const filtered = auctions.filter((item) => {
      const matchesQuery = `${item.title} ${item.category} ${item.description}`.toLowerCase().includes(query.toLowerCase());
      return item.status === 'live' && matchesQuery && (category === 'All items' || item.category === category)
        && (condition === 'Any condition' || item.condition === condition)
        && (!maxPrice || item.price <= Number(maxPrice));
    });
    return filtered.sort((a, b) => sort === 'Price: low to high' ? a.price - b.price : a.endsAt - b.endsAt);
  }, [auctions, category, condition, maxPrice, query, sort]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2800);
  };

  const toggleWatch = (id: number) => setAuctions((items) => items.map((item) => item.id === id ? { ...item, watched: !item.watched } : item));

  const setAuctionOutcome = async (id: number, status: Auction['status']) => {
    if (status === 'cancelled') {
      const token = localStorage.getItem('sellgoods.token');
      if (!token) return;
      try {
        const updated = await cancelAuctionApi(token, id);
        setAuctions((items) => items.map((item) => item.id === id ? toAuction(updated) as Auction : item));
      } catch (error) {
        return showNotice(error instanceof Error ? error.message : 'Could not cancel this auction.');
      }
    }
    setAuctions((items) => items.map((item) => item.id === id ? { ...item, status } : item));
    showNotice(status === 'approved' ? 'Winning bid approved. The item is reserved.' : status === 'sold' ? 'Campus handover confirmed.' : status === 'failed pickup' ? 'Failed pickup recorded.' : status === 'rejected' ? 'Winning price rejected.' : status === 'cancelled' ? 'Listing cancelled.' : 'Auction updated.');
  };

  const updateAuction = async (id: number, patch: Partial<Auction>) => {
    const token = localStorage.getItem('sellgoods.token');
    if (!token) return;
    try {
      const updated = await updateAuctionApi(token, id, {
        title: patch.title,
        category: patch.category,
        condition: patch.condition,
        description: patch.description,
        starting_price: patch.startingPrice,
        increment: patch.increment,
      });
      setAuctions((items) => items.map((item) => item.id === id ? toAuction(updated) as Auction : item));
      showNotice('Listing updated.');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Could not update this listing.');
    }
  };

  const placeBid = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const amount = Number(bidValue);
    const token = localStorage.getItem('sellgoods.token');
    if (!token) return showNotice('Please log in to bid.');
    try {
      const updated = await placeBidApi(token, selected.id, amount);
      setAuctions((items) => items.map((item) => item.id === selected.id ? toAuction(updated) as Auction : item));
      setBidValue('');
      showNotice('Bid placed. The seller can see you are leading.');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Could not place your bid.');
    }
  };

  const createListing = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startingPrice = Number(form.get('price'));
    const increment = Number(form.get('increment'));
    const duration = Number(form.get('duration'));
    const title = String(form.get('title'));
    const imageFile = form.get('image');
    const image = imageFile instanceof File && imageFile.size ? await imageAsDataUrl(imageFile) : '';
    const token = localStorage.getItem('sellgoods.token');
    if (!token || !authUser) return;
    try {
      const created = await createAuctionApi(token, {
        title,
        category: String(form.get('category')),
        condition: String(form.get('condition')),
        description: String(form.get('description')),
        image,
        startingPrice,
        increment,
        endsAt: Date.now() + duration * hour,
      });
      setAuctions((items) => [toAuction(created) as Auction, ...items]);
      setModal(null);
      showNotice('Your listing is live for every student.');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Could not publish your listing.');
    }
  };

  const saveWatch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phrase = String(form.get('phrase'));
    const limit = String(form.get('limit'));
    setModal(null);
    showNotice(`We'll alert you about “${phrase}” under ${money(Number(limit))}.`);
  };

  const sendQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !authUser) return;
    if (selected.sellerId === authUser.id) return showNotice('Sellers answer questions; they cannot ask on their own listing.');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const text = String(form.get('question')).trim();
    if (!text) return;
    const token = localStorage.getItem('sellgoods.token');
    if (!token) return;
    try {
      await askAuctionQuestion(token, selected.id, text);
      const updated = await listAuctions(token);
      setAuctions(updated.map((record) => toAuction(record) as Auction));
      formElement.reset();
      showNotice('Question sent to the seller.');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Could not send your question.');
    }
  };

  const answerQuestion = async (auctionId: number, questionId: number, answer: string) => {
    const token = localStorage.getItem('sellgoods.token');
    if (!token) return;
    try {
      await answerAuctionQuestion(token, auctionId, questionId, answer);
      const records = await listAuctions(token);
      setAuctions(records.map((record) => toAuction(record) as Auction));
      showNotice('Your answer is visible to the buyer.');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Could not send your answer.');
    }
  };

  const openNotification = async (notification: CampusNotification) => {
    const token = localStorage.getItem('sellgoods.token');
    if (token && !notification.read_at) {
      try {
        const updated = await markNotificationRead(token, notification.id);
        setNotifications((items) => items.map((item) => item.id === updated.id ? updated : item));
      } catch (error) {
        showNotice(error instanceof Error ? error.message : 'Could not update notification.');
      }
    }
    const auctionRecords = token ? await listAuctions(token).catch(() => []) : [];
    if (auctionRecords.length) setAuctions(auctionRecords.map((record) => toAuction(record) as Auction));
    setSelectedId(notification.auction_id);
    setActiveTab('Marketplace');
    setNotificationsOpen(false);
  };

  const readAllNotifications = async () => {
    const token = localStorage.getItem('sellgoods.token');
    if (!token) return;
    try {
      await markAllNotificationsRead(token);
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Could not mark notifications as read.');
    }
  };

  const sendAssistant = (event: React.FormEvent) => {
    event.preventDefault();
    const match = assistantQuery.match(/(?:under|below|max(?:imum)?|upto|up to)\s*₹?\s*(\d[\d,]*)/i);
    if (match) setMaxPrice(match[1].replace(/,/g, ''));
    const words = assistantQuery.toLowerCase().split(/\s+/).filter((word) => word.length > 3 && !['under', 'below', 'find', 'show', 'with', 'upto', 'maximum'].includes(word));
    if (words.length) setQuery(words[0]);
    setActiveTab('Marketplace');
    showNotice('I found matching live auctions below.');
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) return showNotice('Browser notifications are not supported here.');
    const permission = await Notification.requestPermission();
    showNotice(permission === 'granted' ? 'Browser notifications are on.' : 'Notifications were not enabled.');
  };

  const completeAuthentication = (user: AuthUser, token: string) => {
    localStorage.setItem('sellgoods.user', JSON.stringify(user));
    localStorage.setItem('sellgoods.token', token);
    setAuthUser(user);
  };

  const logout = () => {
    localStorage.removeItem('sellgoods.user');
    localStorage.removeItem('sellgoods.token');
    setAuthUser(null);
    setAuctions([]);
    setNotifications([]);
    setNotificationsOpen(false);
    seenNotificationIds.current.clear();
    setActiveTab('Marketplace');
    showNotice('You have logged out.');
  };

  if (authLoading) return <div className="auth-loading"><span className="brand-mark"><Tag size={18} /></span><span>Opening your campus exchange…</span></div>;
  if (!authUser) return <AuthPage onAuthenticated={completeAuthentication} />;

  const renderCard = (item: Auction) => (
    <article className="auction-card" key={item.id}>
      <button className="card-image" onClick={() => setSelectedId(item.id)} aria-label={`View ${item.title}`}>
        <img src={item.image} alt={item.title} />
        <span className="condition-chip">{item.condition}</span>
        <span className="image-count"><span className="image-dot" /> 1 / 1</span>
      </button>
      <button className={`save-button ${item.watched ? 'is-saved' : ''}`} onClick={() => toggleWatch(item.id)} aria-label={item.watched ? 'Remove from saved items' : 'Save item'}>
        <Heart size={17} fill={item.watched ? 'currentColor' : 'none'} />
      </button>
      <div className="card-content">
        <div className="card-meta"><span>{item.category}</span><span className="meta-separator">·</span><span>{item.bids.length} bids</span></div>
        <button className="card-title" onClick={() => setSelectedId(item.id)}>{item.title}</button>
        <div className="card-price-row"><div><span className="price-label">CURRENT BID</span><strong>{money(item.price)}</strong></div><div className="countdown"><Clock3 size={14} /><span>{timeLeft(item.endsAt, now)}</span></div></div>
        <button className="card-bid-link" onClick={() => setSelectedId(item.id)}>View auction <ArrowRight size={14} /></button>
      </div>
    </article>
  );

  return (
    <div className="app-shell">
      <div className="announcement"><span className="announce-dot" /> THE SEMESTER'S ALMOST OVER. YOUR NEXT GREAT FIND ISN'T. <button onClick={() => setModal('listing')}>List something <ArrowRight size={13} /></button></div>
      <header className="topbar">
        <a className="brand" href="#home" onClick={() => setActiveTab('Marketplace')}><span className="brand-mark"><Tag size={18} strokeWidth={2.5} /></span><span>sellgoods<span className="brand-period">.</span></span></a>
        <nav className={`main-nav ${mobileMenu ? 'nav-open' : ''}`}>
          {['Marketplace', 'My activity', 'My listings', 'AI assistant'].map((tab) => <button key={tab} onClick={() => { setActiveTab(tab); setMobileMenu(false); }} className={activeTab === tab ? 'active' : ''}>{tab === 'AI assistant' && <Sparkles size={15} />}{tab}</button>)}
        </nav>
        <div className="header-actions"><div className="notification-wrap"><button className="icon-button notification-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label={`Notifications${notifications.filter((item) => !item.read_at).length ? `, ${notifications.filter((item) => !item.read_at).length} unread` : ''}`} title="Open activity notifications"><Bell size={18} />{notifications.some((item) => !item.read_at) && <span className="notification-count">{notifications.filter((item) => !item.read_at).length}</span>}</button>{notificationsOpen && <NotificationPanel notifications={notifications} onOpen={openNotification} onReadAll={readAllNotifications} onEnableBrowserAlerts={enableNotifications} />}</div><span className="account-name">{authUser.name}</span><button className="logout-button" onClick={logout}><LogOut size={15} /> Log out</button><button className="icon-button menu-button" onClick={() => setMobileMenu((open) => !open)} aria-label="Toggle navigation">{mobileMenu ? <X size={20} /> : <Menu size={20} />}</button></div>
      </header>

      {activeTab === 'Marketplace' && <main id="home">
        <section className="hero-band">
          <div className="hero-copy"><div className="eyebrow"><span /> A BETTER WAY TO PASS IT ON</div><h1>Good things<br />don't <span>graduate.</span></h1><p>The bike you leave behind is someone else's first ride. Find it here, bid fairly, pass it on.</p><div className="hero-actions"><button className="button-dark" onClick={() => document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' })}>Explore what's up <ArrowRight size={16} /></button><div className="avatar-stack"><span>M</span><span>R</span><span>A</span><small>YOUR CAMPUS,<br />CIRCLING BACK</small></div></div></div>
          <div className="hero-art"><img src="https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1400&q=90" alt="A bicycle ready for its next campus commute" /><div className="hero-sticker"><span>GOOD<br />FINDS</span><ArrowDownUp size={19} /></div><div className="hero-note"><span className="note-line" /> CLOSING THE LOOP, ONE LISTING AT A TIME</div></div>
          <div className="hero-index"><span>01</span><i /> CAMPUS MARKETPLACE</div>
        </section>

        <section className="trust-strip"><div><ShieldCheck size={18} /><span>Every bid out in the open</span></div><i /><div><Clock3 size={18} /><span>Fair, item-by-item countdowns</span></div><i /><div><Bike size={18} /><span>Meet on campus. Pass it on.</span></div><button onClick={() => showNotice('Campus handover is coordinated between buyer and seller.')}>How it works <ArrowRight size={14} /></button></section>

        <section className="market-section" id="listings">
          <div className="section-heading"><div><div className="eyebrow dark-eyebrow"><span /> THE CAMPUS EXCHANGE</div><h2>Find your next <span>something.</span></h2></div><div className="section-side"><span className="live-indicator" /><span>{visibleAuctions.length} live listings</span><button className="button-outline" onClick={() => setModal('listing')}><Plus size={16} /> List an item</button></div></div>
          <div className="market-tools"><div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cycles, calculators, that one textbook..." aria-label="Search listings" /><kbd>⌘ K</kbd></div><div className="filter-controls"><label className="select-wrap"><Filter size={15} /><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter category"><option>All items</option><option>Cycles</option><option>Electronics</option><option>Books</option><option>Other</option></select><ChevronDown size={14} /></label><label className="select-wrap"><select value={condition} onChange={(event) => setCondition(event.target.value)} aria-label="Filter condition"><option>Any condition</option><option>New</option><option>Like new</option><option>Very good</option><option>Good</option></select><ChevronDown size={14} /></label><label className="price-filter"><span>₹</span><input type="number" min="0" placeholder="Max price" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} aria-label="Maximum price" /></label><label className="select-wrap sort-select"><ArrowDownUp size={15} /><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort listings"><option>Ending soon</option><option>Price: low to high</option></select><ChevronDown size={14} /></label></div></div>
          <div className="category-rail">{[{ name: 'Everything', icon: <Tag size={15} />, value: 'All items' }, { name: 'Cycles', icon: <Bike size={15} />, value: 'Cycles' }, { name: 'Tech & electronics', icon: <Laptop size={15} />, value: 'Electronics' }, { name: 'Books & notes', icon: <BookOpen size={15} />, value: 'Books' }, { name: 'The rest', icon: <Sparkles size={15} />, value: 'Other' }].map((item) => <button key={item.value} className={category === item.value ? 'category-active' : ''} onClick={() => setCategory(item.value)}>{item.icon}{item.name}</button>)}<button className="want-button" onClick={() => setModal('watch')}><Bell size={15} /> Want something specific?</button></div>
          {auctionsLoading ? <div className="empty-state"><Clock3 size={24} /><h3>Loading campus listings…</h3></div> : auctionsError ? <div className="empty-state"><Search size={24} /><h3>Couldn’t load the campus exchange.</h3><p>{auctionsError}</p><button className="button-outline" onClick={() => { const token = localStorage.getItem('sellgoods.token'); if (!token) return; setAuctionsLoading(true); setAuctionsError(''); listAuctions(token).then((records) => setAuctions(records.map((record) => toAuction(record) as Auction))).catch((error: unknown) => setAuctionsError(error instanceof Error ? error.message : 'Could not load campus listings.')).finally(() => setAuctionsLoading(false)); }}>Try again</button></div> : visibleAuctions.length ? <div className="auction-grid">{visibleAuctions.map(renderCard)}</div> : <div className="empty-state"><Search size={24} /><h3>Nothing on the board yet.</h3><p>Try a different search or be the first to list something.</p><button className="button-outline" onClick={() => setModal('listing')}><Plus size={15} /> List an item</button></div>}
          <div className="more-row"><span>GOOD FINDS DON'T HAPPEN ALL AT ONCE.</span><button onClick={() => setModal('watch')}>Get notified when something's listed <ArrowRight size={15} /></button></div>
        </section>

        <section className="closing-note"><div className="closing-number">02 / THE HANDOVER</div><div className="closing-content"><span className="closing-icon"><Bike size={24} /></span><div><h3>Bid here. Meet just outside class.</h3><p>When an auction closes, the seller confirms the price. You sort the handover on campus, face to face.</p></div></div><button onClick={() => showNotice('A confirmed handover marks the sale complete.')}>The whole process <ArrowRight size={15} /></button></section>
      </main>}

      {activeTab === 'AI assistant' && <main className="assistant-page"><div className="eyebrow dark-eyebrow"><span /> YOUR CAMPUS FINDER</div><div className="assistant-title"><Sparkles size={24} /><h1>Tell me what you're<br /><span>looking for.</span></h1></div><p className="assistant-intro">I can scan live campus auctions and bring the right ones to you. You stay in charge of every bid.</p><form className="assistant-form" onSubmit={sendAssistant}><Search size={19} /><input value={assistantQuery} onChange={(event) => setAssistantQuery(event.target.value)} placeholder="A scientific calculator under ₹400..." autoFocus /><button aria-label="Search with assistant"><ArrowRight size={18} /></button></form><div className="suggestion-row"><span>TRY</span>{['A cycle under ₹2,000', 'Books for engineering', 'Ending soon'].map((suggestion) => <button key={suggestion} onClick={() => { setAssistantQuery(suggestion); if (suggestion === 'Ending soon') { setActiveTab('Marketplace'); setSort('Ending soon'); } }}>{suggestion}</button>)}</div><div className="assistant-boundary"><ShieldCheck size={19} /><div><strong>Your go-ahead. Your limit. Always.</strong><p>I can help you find an auction or suggest a bid, but I never place one without your approval or exceed a maximum you set.</p></div></div><div className="assistant-live"><div className="section-heading"><div><div className="eyebrow dark-eyebrow"><span /> OUT IN THE OPEN</div><h2>Live right now</h2></div><button className="text-link" onClick={() => setActiveTab('Marketplace')}>See the marketplace <ArrowRight size={15} /></button></div><div className="assistant-results">{auctions.filter((item) => item.status === 'live').slice(0, 3).map((item) => <button key={item.id} onClick={() => { setSelectedId(item.id); }}><img src={item.image} alt="" /><span><strong>{item.title}</strong><small>{item.category} · {item.bids.length} public bids</small></span><b>{money(item.price)}</b><ArrowRight size={15} /></button>)}</div></div></main>}

      {activeTab === 'My activity' && <main className="activity-page"><div className="eyebrow dark-eyebrow"><span /> YOUR CAMPUS EXCHANGE</div><div className="section-heading"><div><h1>Your <span>activity.</span></h1><p className="activity-intro">Keep an eye on the things you care about.</p></div><button className="button-outline" onClick={enableNotifications}><Bell size={16} /> Turn on alerts</button></div><div className="activity-columns"><section><div className="activity-heading"><h2><Heart size={18} /> Saved auctions</h2><span>{auctions.filter((item) => item.watched).length}</span></div>{auctions.filter((item) => item.watched).length ? <div className="activity-list">{auctions.filter((item) => item.watched).map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)}><img src={item.image} alt="" /><span><strong>{item.title}</strong><small>{item.status === 'live' ? `Closes in ${timeLeft(item.endsAt, now)}` : 'Auction closed'}</small></span><b>{money(item.price)}</b><ChevronRight size={17} /></button>)}</div> : <p className="activity-empty">Save an auction with the heart and it will show up here.</p>}</section><section><div className="activity-heading"><h2><Bell size={18} /> Search alerts</h2><button className="small-add" onClick={() => setModal('watch')}><Plus size={15} /> New alert</button></div><div className="alert-placeholder"><span><Search size={20} /></span><strong>Don't miss the right listing.</strong><p>Set a search alert and we'll let you know when something matching turns up.</p><button className="text-link" onClick={() => setModal('watch')}>Create a search alert <ArrowRight size={14} /></button></div></section></div></main>}

      {activeTab === 'My listings' && <SellerDashboard items={auctions.filter((item) => item.sellerId === authUser.id)} now={now} onUpdate={updateAuction} onOutcome={setAuctionOutcome} onAnswer={answerQuestion} />}

      <footer className="site-footer"><a className="brand footer-brand" href="#home"><span className="brand-mark"><Tag size={16} strokeWidth={2.5} /></span><span>sellgoods<span className="brand-period">.</span></span></a><span>Good things find their next person.</span><div><button onClick={() => showNotice('All bids and bidder names are public on each auction.')}>The ground rules</button><i /> <button onClick={() => showNotice('Made for campus, by campus.')}>About</button></div><span className="footer-year">CAMPUS, IN CIRCULATION © 2026</span></footer>

      {selected && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}><section className="detail-modal" role="dialog" aria-modal="true" aria-label={selected.title}><button className="modal-close" onClick={() => setSelectedId(null)} aria-label="Close"><X size={19} /></button><div className="detail-image"><img src={selected.image} alt={selected.title} /><span className="condition-chip">{selected.condition}</span></div><div className="detail-body"><div className="detail-meta"><span>{selected.category}</span><span>·</span><span>Listed by {selected.seller}</span></div><h2>{selected.title}</h2><p className="detail-description">{selected.description}</p><div className="detail-price"><div><span className="price-label">{selected.bids.length ? 'CURRENT LEADING BID' : 'STARTING PRICE'}</span><strong>{money(selected.price)}</strong></div><div className="detail-countdown"><Clock3 size={16} /><span>{selected.status === 'live' ? timeLeft(selected.endsAt, now) : 'Auction closed'}</span></div></div><div className="bid-rules">Minimum next bid <strong>{money(selected.bids.length ? selected.price + selected.increment : selected.startingPrice)}</strong><span> · </span>increments of {money(selected.increment)}</div>{selected.status === 'live' && <form className="bid-form" onSubmit={placeBid}><label htmlFor="bid-amount">YOUR BID</label><div><span>₹</span><input id="bid-amount" type="number" min={selected.bids.length ? selected.price + selected.increment : selected.startingPrice} step="any" required placeholder={String(selected.bids.length ? selected.price + selected.increment : selected.startingPrice)} value={bidValue} onChange={(event) => setBidValue(event.target.value)} /><button className="button-dark" type="submit">Place bid <ArrowRight size={15} /></button></div></form>}<details className="auto-bid"><summary><Sparkles size={15} /> Set an automatic bid limit <ChevronDown size={15} /></summary><form onSubmit={(event) => { event.preventDefault(); const amount = Number(autoMax); if (amount <= selected.price) return showNotice('Your maximum must be higher than the current bid.'); showNotice(`Auto-bid enabled up to ${money(amount)}. Demo mode only.`); setAutoMax(''); }}><input type="number" min={selected.price + selected.increment} step="any" placeholder={`Maximum e.g. ${selected.price + 500}`} value={autoMax} onChange={(event) => setAutoMax(event.target.value)} required /><button type="submit">Set limit</button></form><p>We'll bid only what's needed to keep you in the lead, never beyond your limit.</p></details><div className="bid-history"><div className="subheading-row"><h3>Public bid history <span>{selected.bids.length}</span></h3><span>All bids visible</span></div>{selected.bids.length ? [...selected.bids].reverse().map((bid, index) => <div className={`bid-entry ${index === 0 ? 'leading-bid' : ''}`} key={`${bid.time}-${bid.bidder}`}><span className="bid-avatar">{bid.bidder.slice(0, 1)}</span><span className="bidder-name">{bid.bidder}{index === 0 && <small>LEADING</small>}</span><span className="bid-time">{new Date(bid.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span><strong>{money(bid.amount)}</strong></div>) : <p className="no-bids">No bids yet. Set the opening price.</p>}</div><div className="questions-block"><div className="subheading-row"><h3><MessageCircle size={16} /> Questions <span>{selected.questions.length}</span></h3><span>Keep it useful</span></div>{selected.questions.map((question, index) => <div className="question-entry" key={`${question.text}-${index}`}><strong>{question.author}</strong><p>{question.text}</p>{question.answer && <div className="seller-answer"><span>SELLER</span>{question.answer}</div>}</div>)}<form className="question-form" onSubmit={sendQuestion}><input name="question" placeholder="Ask the seller something specific..." maxLength={240} required /><button aria-label="Send question"><Send size={16} /></button></form></div></div></section></div>}

      {modal === 'listing' && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="form-modal" role="dialog" aria-modal="true" aria-label="List an item"><div className="form-modal-heading"><div><div className="eyebrow dark-eyebrow"><span /> PASS IT ON</div><h2>List something <span>good.</span></h2></div><button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button></div><form onSubmit={createListing}><label>ITEM NAME<input name="title" placeholder="e.g. Riverside city bicycle" required maxLength={80} /></label><div className="form-row"><label>CATEGORY<select name="category"><option>Cycles</option><option>Electronics</option><option>Books</option><option>Other</option></select></label><label>CONDITION<select name="condition"><option>Good</option><option>Like new</option><option>Very good</option><option>New</option></select></label></div><label>THE DETAILS<textarea name="description" placeholder="What should the next owner know?" required rows={3} maxLength={500} /></label><div className="form-row"><label>STARTING PRICE (₹)<input name="price" type="number" min="1" placeholder="500" required /></label><label>MINIMUM INCREMENT (₹)<input name="increment" type="number" min="1" placeholder="25" required /></label></div><div className="form-row"><label>AUCTION CLOSES IN<select name="duration" defaultValue="24"><option value="1">1 hour</option><option value="6">6 hours</option><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">2 days</option><option value="72">3 days</option></select></label><label>PHOTO<input name="image" type="file" accept="image/*" /><span className="field-note">Choose one photo from this device.</span></label></div><div className="form-modal-footer"><span><ShieldCheck size={16} /> Every bid will be public.</span><button className="button-dark" type="submit">Publish listing <ArrowRight size={15} /></button></div></form></section></div>}

      {modal === 'watch' && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="watch-modal" role="dialog" aria-modal="true" aria-label="Create a search alert"><button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button><span className="watch-icon"><Bell size={21} /></span><div className="eyebrow dark-eyebrow"><span /> SAVE YOUR SEARCH</div><h2>We'll keep an <span>eye out.</span></h2><p>Tell us what you need. We'll let you know when a matching auction appears.</p><form onSubmit={saveWatch}><label>WHAT ARE YOU LOOKING FOR?<input name="phrase" placeholder="e.g. scientific calculator" required /></label><label>MAXIMUM PRICE (₹)<input name="limit" type="number" min="1" placeholder="400" required /></label><button className="button-dark" type="submit">Create alert <ArrowRight size={15} /></button></form><div className="watch-footnote"><Bell size={14} /> Browser pop-ups can be enabled from the bell in the header.</div></section></div>}

      {notice && <div className="toast"><Check size={17} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
      <button className="floating-help" onClick={() => showNotice('Questions are public, item-specific, and meant to help buyers decide.') } aria-label="Help"><HelpCircle size={20} /></button>
    </div>
  );
}

export default App;