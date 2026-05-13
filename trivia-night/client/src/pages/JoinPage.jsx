import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

export default function JoinPage() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { joinGame } = useSocket();
  const navigate = useNavigate();

  // Pre-fill code from URL ?code=XXXX
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code');
    if (c) setCode(c.toUpperCase());
  });

  async function handleJoin(e) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) { setError('Game code and name are required.'); return; }
    setLoading(true); setError('');
    try {
      await joinGame({ gameCode: code.trim().toUpperCase(), playerName: name.trim(), teamName: team.trim() });
      navigate('/game');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page centered" style={{ background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>
            TRIVIA<span style={{ color: 'var(--accent)' }}>NIGHT</span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text2)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
            Live Event Edition
          </p>
        </div>
        <div className="card">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: '1.25rem' }}>
            JOIN THE GAME
          </h2>
          <form onSubmit={handleJoin}>
            <div className="field">
              <label>Game Code</label>
              <input
                type="text" maxLength={6} placeholder="XYZABC"
                value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, letterSpacing: 8, textAlign: 'center', textTransform: 'uppercase' }}
                autoFocus autoComplete="off"
              />
            </div>
            <div className="field">
              <label>Your Name</label>
              <input type="text" placeholder="Enter your name" value={name} onChange={e => setName(e.target.value)} maxLength={50} />
            </div>
            <div className="field">
              <label>Team Name <span style={{ color: 'var(--text2)', textTransform: 'none', fontWeight: 400, fontSize: 10 }}>optional</span></label>
              <input type="text" placeholder="Team Rocket, The Nerds..." value={team} onChange={e => setTeam(e.target.value)} maxLength={50} />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'JOINING...' : "LET'S GO →"}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text2)', marginTop: '1rem' }}>
          Anti-cheat protected · Up to 120 players
        </p>
      </div>
    </div>
  );
}
