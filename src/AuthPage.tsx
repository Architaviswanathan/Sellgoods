import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Tag, UserRound } from 'lucide-react';
import { authenticate, type AuthUser } from './auth';

type AuthPageProps = { onAuthenticated: (user: AuthUser, token: string) => void };

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await authenticate(mode, { name, email, password });
      onAuthenticated(result.user, result.access_token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-visual" aria-label="Sellgoods campus marketplace">
        <a className="brand auth-brand" href="#home"><span className="brand-mark"><Tag size={18} strokeWidth={2.5} /></span><span>sellgoods<span className="brand-period">.</span></span></a>
        <div className="auth-photo"><img src="https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1400&q=90" alt="A bicycle ready to be passed on to another student" /><div className="auth-photo-stamp">GOOD<br />FINDS<br /><span>GO AROUND.</span></div></div>
        <div className="auth-caption"><span>01 / CAMPUS, IN CIRCULATION</span><p>One student's last semester.<br />Another's first good find.</p></div>
        <div className="auth-visual-foot"><span>THE CAMPUS EXCHANGE</span><span>SELLGOODS © 2026</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-top"><span>MADE FOR CAMPUS, BY CAMPUS</span><span>INDIA <i>·</i> ₹ INR</span></div>
        <div className="auth-card">
          <div className="auth-eyebrow"><span /> YOUR NEXT CHAPTER STARTS HERE</div>
          <h1>{mode === 'signup' ? <>Good to <em>meet you.</em></> : <>Welcome <em>back.</em></>}</h1>
          <p className="auth-lead">{mode === 'signup' ? 'Join your campus exchange. Find what you need, pass on what you don’t.' : 'Your campus finds are right where you left them.'}</p>
          <div className="auth-switch" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'selected' : ''} onClick={() => { setMode('signup'); setError(''); }}>Create account</button>
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); }}>Log in</button>
          </div>
          <form className="auth-form" onSubmit={submit}>
            {mode === 'signup' && <label className="auth-field"><span>YOUR NAME</span><div><UserRound size={17} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Aanya Sharma" autoComplete="name" minLength={2} maxLength={100} required /></div></label>}
            <label className="auth-field"><span>STUDENT EMAIL</span><div><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@university.edu" autoComplete="email" required /></div></label>
            <label className="auth-field"><span>PASSWORD</span><div><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signup' ? 'At least 10 characters' : 'Enter your password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 10 : 1} maxLength={128} required /><button className="password-toggle" type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'One moment…' : mode === 'signup' ? 'Create your account' : 'Log in to Sellgoods'}<ArrowRight size={17} /></button>
          </form>
          <div className="auth-terms">By continuing, you agree to keep bids fair, public, and on campus.</div>
        </div>
        <div className="auth-bottom"><span>GOOD THINGS FIND THEIR NEXT PERSON.</span><span><i /> FAIR BIDS ONLY</span></div>
      </section>
    </main>
  );
}
