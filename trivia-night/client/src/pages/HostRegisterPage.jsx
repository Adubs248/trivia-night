import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HostRegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    if (!email || !password || !displayName) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('host_token', data.token);
      localStorage.setItem('host', JSON.stringify(data.host));
      navigate('/host/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page centered">
      <div style={{ width: '100%', maxWidth: 360 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 900, marginBottom: '1.5rem', textAlign: 'center' }}>
          HOST <span style={{ color: 'var(--accent)' }}>REGISTER</span>
        </h1>
        <div className="card">
          <form onSubmit={handleRegister}>
            <div className="field">
              <label>Your Name</label>
              <input
                type="text"
                placeholder="Jane Smith"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                placeholder="host@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT →'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: 13, color: 'var(--text2)' }}>
          Already have an account?{' '}
          <a href="/host/login" style={{ color: 'var(--accent2)' }}>Sign in here</a>
        </p>
      </div>
    </div>
  );
}
