import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';
import { exportScoresToCSV } from '../utils/helpers';
import { generateJoinQR } from '../utils/helpers';

export default function HostDashboardPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('host_token');
  const host = JSON.parse(localStorage.getItem('host') || '{}');
  const { hostJoin, startQuestion, lockAnswers, revealAnswers, endRound } = useSocket();
  const { game, setGame, rounds, setRounds, liveAnswers, playerCount, leaderboard } = useGameStore();

  const [games, setGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [selectedRound, setSelectedRound] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!token) { navigate('/host/login'); return; }
    fetchGames();
  }, []);

  async function fetchGames() {
    const res = await fetch('/api/games', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setGames(data);
  }

  async function createGame() {
    const title = prompt('Game title:', 'Friday Night Trivia');
    if (!title) return;
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    setGames(prev => [data, ...prev]);
    selectGame(data);
  }

  async function selectGame(g) {
    setGame(g);
    setSelectedGameId(g.id);
    const res = await fetch(`/api/games/${g.id}/rounds`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setRounds(data);
    if (data.length) selectRound(data[0]);

    // Join host socket room
    hostJoin({ gameCode: g.code, token });

    // Generate QR
    const qr = await generateJoinQR(g.code);
    if (qr) setQrDataUrl(qr.dataUrl);
  }

  async function selectRound(round) {
    setSelectedRound(round);
    const res = await fetch(`/api/questions/round/${round.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setQuestions(data);
    setActiveQuestionIdx(0);
  }

  async function addRound() {
    const title = prompt('Round title:', 'Round 1 — General');
    if (!title) return;
    const res = await fetch(`/api/games/${selectedGameId}/rounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, sortOrder: rounds.length }),
    });
    const data = await res.json();
    setRounds(prev => [...prev, data]);
  }

  function handleStartQuestion() {
    const q = questions[activeQuestionIdx];
    if (!q) return;
    startQuestion({ questionId: q.id, gameCode: game.code });
    setStatus(`▶ Started: "${q.question_text.slice(0, 40)}..."`);
  }

  function handleLockAnswers() {
    const q = questions[activeQuestionIdx];
    if (!q) return;
    lockAnswers({ questionId: q.id, gameCode: game.code });
    setStatus('🔒 Answers locked');
  }

  function handleReveal() {
    const q = questions[activeQuestionIdx];
    if (!q) return;
    revealAnswers({ questionId: q.id, gameCode: game.code });
    setStatus('👁 Answers revealed');
  }

  async function handleEndRound() {
    if (!selectedRound) return;
    await endRound({ roundId: selectedRound.id, gameCode: game.code });
    setStatus('⏹ Round ended — leaderboard updated');
  }

  function handleExport() {
    exportScoresToCSV(leaderboard, game?.title);
  }

  if (!token) return null;

  return (
    <div className="host-layout">
      {/* Sidebar */}
      <div className="host-sidebar">
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>HOST</p>
          <p style={{ fontSize: 14, fontWeight: 600 }}>{host.displayName || host.email}</p>
        </div>

        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 8 }}>Games</p>
        {games.map(g => (
          <div
            key={g.id}
            onClick={() => selectGame(g)}
            style={{
              padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 3,
              background: selectedGameId === g.id ? 'rgba(124,106,245,0.2)' : 'transparent',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500 }}>{g.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Code: {g.code}</div>
          </div>
        ))}
        <button className="btn btn-outline" onClick={createGame} style={{ marginTop: 8, fontSize: 12, padding: '6px 10px' }}>
          + New Game
        </button>

        {rounds.length > 0 && (
          <>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text2)', margin: '1rem 0 8px' }}>Rounds</p>
            {rounds.map(r => (
              <div
                key={r.id}
                onClick={() => selectRound(r)}
                style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 3,
                  background: selectedRound?.id === r.id ? 'rgba(240,192,64,0.15)' : 'transparent',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{r.question_count || 0} questions</div>
              </div>
            ))}
            <button className="btn btn-outline" onClick={addRound} style={{ marginTop: 6, fontSize: 12, padding: '6px 10px' }}>
              + Add Round
            </button>
          </>
        )}

        {qrDataUrl && (
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>Join QR</p>
            <img src={qrDataUrl} alt="Join QR Code" style={{ width: '100%', borderRadius: 8 }} />
            <p style={{ fontSize: 11, color: 'var(--accent)', textAlign: 'center', marginTop: 4 }}>{game?.code}</p>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="host-main">
        <div className="host-toolbar">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginRight: 'auto' }}>
            {selectedRound ? selectedRound.title : 'Select a round'}
          </h2>
          <span style={{ fontSize: 12, color: 'var(--accent3)' }}>👥 {playerCount} online</span>
          <button className="btn btn-success" onClick={handleStartQuestion} disabled={!questions.length}>▶ Start</button>
          <button className="btn btn-outline" onClick={handleLockAnswers} disabled={!questions.length}>🔒 Lock</button>
          <button className="btn btn-secondary" onClick={handleReveal} disabled={!questions.length}>👁 Reveal</button>
          <button className="btn btn-danger" onClick={handleEndRound} disabled={!selectedRound}>⏹ End Round</button>
          <button className="btn btn-outline" onClick={handleExport} disabled={!leaderboard.length} style={{ fontSize: 12 }}>📥 CSV</button>
        </div>

        {status && (
          <div style={{ padding: '8px 16px', background: 'rgba(64,196,160,0.1)', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--accent3)' }}>
            {status}
          </div>
        )}

        <div className="host-content" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start' }}>

          {/* Question navigator */}
          <div className="card">
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 10 }}>Questions</p>
            {questions.length === 0 && <p style={{ fontSize: 13, color: 'var(--text2)' }}>No questions yet in this round.</p>}
            {questions.map((q, i) => (
              <div
                key={q.id}
                onClick={() => setActiveQuestionIdx(i)}
                style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                  background: activeQuestionIdx === i ? 'rgba(124,106,245,0.2)' : 'var(--surface2)',
                  border: '1px solid var(--border)',
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 2 }}>Q{i + 1} · {q.question_type}</p>
                <p style={{ fontSize: 13 }}>{q.question_text.slice(0, 60)}{q.question_text.length > 60 ? '...' : ''}</p>
              </div>
            ))}
          </div>

          {/* Live answers */}
          <div className="card">
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 10 }}>
              Live Responses ({liveAnswers.length})
            </p>
            {liveAnswers.slice(0, 10).map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'var(--surface2)', marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.isCorrect ? 'var(--accent3)' : 'var(--danger)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 70 }}>{a.playerName}</span>
                <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>{a.answerText}</span>
                <span style={{ fontSize: 12, color: a.isCorrect ? 'var(--accent)' : 'var(--danger)' }}>
                  {a.isCorrect ? `+${a.pointsAwarded}` : '+0'}
                </span>
              </div>
            ))}
          </div>

          {/* Leaderboard preview */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 10 }}>
              Leaderboard Preview
            </p>
            {leaderboard.slice(0, 8).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, background: 'var(--surface2)', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text2)', minWidth: 28 }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                {p.team_name && <span style={{ fontSize: 11, color: 'var(--text2)' }}>{p.team_name}</span>}
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{p.score?.toLocaleString()}</span>
              </div>
            ))}
            {leaderboard.length > 8 && (
              <p style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', marginTop: 6 }}>
                +{leaderboard.length - 8} more players · <a href={`/leaderboard/${game?.code}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent2)' }}>Open full leaderboard →</a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
