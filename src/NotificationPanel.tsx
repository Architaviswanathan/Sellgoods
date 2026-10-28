import { Bell, CheckCheck, Circle, Clock3, MessageCircle, Tag } from 'lucide-react';
import type { CampusNotification } from './activityApi';

type NotificationPanelProps = {
  notifications: CampusNotification[];
  onOpen: (notification: CampusNotification) => void;
  onReadAll: () => void;
  onEnableBrowserAlerts: () => void;
};

const relativeTime = (date: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
};

export default function NotificationPanel({ notifications, onOpen, onReadAll, onEnableBrowserAlerts }: NotificationPanelProps) {
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <section className="notification-panel" aria-label="Activity notifications">
      <header><div><span className="eyebrow dark-eyebrow"><span /> SELLGOODS INBOX</span><h2>Activity</h2></div><div className="notification-actions"><button onClick={onEnableBrowserAlerts}><Bell size={15} /><span>Browser alerts</span></button><button onClick={onReadAll} disabled={!unreadCount} title="Mark all as read"><CheckCheck size={16} /><span>Read all</span></button></div></header>
      {notifications.length ? <div className="notification-list">{notifications.map((notification) => <button key={notification.id} className={`notification-item ${notification.read_at ? '' : 'notification-unread'}`} onClick={() => onOpen(notification)}>
        <span className="notification-type-icon">{notification.kind === 'question' || notification.kind === 'answer' ? <MessageCircle size={16} /> : notification.kind === 'ended' ? <Clock3 size={16} /> : <Tag size={16} />}</span>
        <span className="notification-copy"><strong>{notification.message}</strong><time>{relativeTime(notification.created_at)}</time></span>
        {!notification.read_at && <Circle size={8} fill="currentColor" className="unread-dot" />}
      </button>)}</div> : <div className="notifications-empty"><Bell size={20} /><strong>You’re all caught up.</strong><span>New listings, bids, questions, answers, and closing auctions will show up here.</span></div>}
    </section>
  );
}
