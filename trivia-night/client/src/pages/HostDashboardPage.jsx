import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';
import { exportScoresToCSV, generateJoinQR } from '../utils/helpers';

export default function HostDashboardPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('host_token');
  const host = JSON.parse(localStorage.getItem('host') || '{}');
  const { hostJoin, startQuestion, lockAnswers, revealAnswers, endRound, requestLeaderboard } = useSocket();
  const { game, setGame, rounds, setRounds, liveAnswers, playerCount, leaderboard } = useGameStore();

  const [games, setGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [selectedRound, setSelectedRound] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [status, setStatus] = useState('');
  const [newQuestion, setNewQuestion] = useState({ text: '', type: 'multiple_choice', options: ['', '', '', ''], correct: 'A', points: 100, timer: 30 });
  const [showAddQuestion, setShowAddQuestion] = useState(false);

  useEffect(() => {
    if (!token) { navigate('/host/login'); return; }
    fetchGames();
  }, []);

  // Auto-refresh leaderboard every 10 seconds
  useEffect(() => {
    if (!selectedGameId) return;
    const interval = setInterval(() => requestLeaderboard(), 10000);
    return () => clearInterval(interval);
  }, [selectedGameId]);

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
    hostJoin({ gameCode: g.code, token });
    const qr = await generateJoinQR(g.code);
    if (qr) setQrDataUrl(qr.dataUrl);
    requestLeaderboard();
  }

  async function selectRound(round) {
    setSelectedRound(round);
    const res = await fetch(`/api/questions/round/${round.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setQuestions(data);
    setActiveQuestionIdx(0);
    setShowAddQuestion(false);
  }

  async function addRound() {
    const title = prompt('Round title (e.g. Round 1 — General Knowledge):');
    if (!title) return;
    const res = await fetch(`/api/games/${selectedGameId}/rounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, sortOrder: rounds.length }),
    });
    const data = await res.json();
    const updated = [...rounds, data];
    setRounds(updated);
    selectRound(data);
    setStatus(`✅ Round "${title}" created`);
  }

  async function addQuestion() {
    if (!newQuestion.text.trim()) { alert('Please enter a question.'); return; }
    if (!selectedRound) { alert('Please select or create a round first.'); return; }
    const options = ['A','B','C','D'].map((letter, i) => ({ letter, text: newQuestion.options[i] || '' }));
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        roundId: selectedRound.id,
        gameId: selectedGameId,
        questionType: newQuestion.type,
        questionText: newQuestion.text,
        options,
        correctAnswer: newQuestion.correct,
        points: newQuestion.points,
        timerSeconds: newQuestion.timer,
        sortOrder: questions.length,
      }),
    });
    const data = await res.json();
    setQuestions(prev => [...prev, data]);
    setNewQuestion({ text: '', type: 'multiple_choice', options: ['', '', '', ''], correct: 'A', points: 100, timer: 30 });
    setShowAddQuestion(false);
    setStatus(`✅ Question added`);
  }

  function handleStartQuestion() {
    const q = questions[activeQuestionIdx];
    if (!q) return;
    startQuestion({ questionId: q.id, gameCode: game.code });
    setStatus(`▶ Question started — players can answer now`);
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
    setStatus('👁 Correct answer revealed to players');
  }

  async function handleEndRound() {
    if (!selectedRound) return;
    await endRound({ roundId: selectedRound.id, gameCode: game.code });
    requestLeaderboard();
    setStatus('⏹ Round ended — leaderboard updated');
  }

  if (!token) return null;

  return (
    <div className="host-layout">
      {/* Sidebar */}
      <div className="host-sidebar" style={{ overflowY: 'auto' }}>
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>HOST</p>
          <p style={{ fontSize: 14, fontWeight: 600 }}>{host.displayName || host.email}</p>
        </div>

        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 8 }}>Games</p>
        {games.map(g => (
          <div key={g.id} onClick={() => selectGame(g)} style={{
            padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 3,
            background: selectedGameId === g.id ? 'rgba(124,106,245,0.2)' : 'transparent',
          }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{g.title}</div>
            <div style={{ fontSize: 11, color: 'var(--accent)' }}>Code: {g.code}</div>
          </div>
        ))}
        <button className="btn btn-outline" onClick={createGame} style={{ marginTop: 8, fontSize: 12, padding: '6px 10px', width: '100%' }}>
          + New Game
        </button>

        {/* Rounds — always show if a game is selected */}
        {selectedGameId && (
          <>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text2)', margin: '1.25rem 0 8px' }}>Rounds</p>
            {rounds.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>No rounds yet — add one below</p>
            )}
            {rounds.map(r => (
              <div key={r.id} onClick={() => selectRound(r)} style={{
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 3,
                background: selectedRound?.id === r.id ? 'rgba(240,192,64,0.15)' : 'transparent',
              }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{r.question_count || 0} questions</div>
              </div>
            ))}
            {/* Add Round always visible when game is selected */}
            <button className="btn btn-outline" onClick={addRound} style={{ marginTop: 6, fontSize: 12, padding: '6px 10px', width: '100%', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
              + Add Round
            </button>
          </>
        )}

        {qrDataUrl && (
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>Join QR</p>
            <img src={qrDataUrl} alt="Join QR Code" style={{ width: '100%', borderRadius: 8 }} />
            <p style={{ fontSize: 12, color: 'var(--accent)', textAlign: 'center', marginTop: 4, fontWeight: 700 }}>{game?.code}</p>
          </div>
        )}
      </div>

      {/* Main */}
      <div className="host-main">
        <div className="host-toolbar">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginRight: 'auto' }}>
            {selectedRound ? selectedRound.title : game ? 'Select or create a round →' : 'Select a game →'}
          </h2>
          <span style={{ fontSize: 12, color: 'var(--accent3)', marginRight: 4 }}>👥 {playerCount} online</span>
          <button className="btn btn-success" onClick={handleStartQuestion} disabled={!questions.length}>▶ Start</button>
          <button className="btn btn-outline" onClick={handleLockAnswers} disabled={!questions.length}>🔒 Lock</button>
          <button className="btn btn-secondary" onClick={handleReveal} disabled={!questions.length}>👁 Reveal</button>
          <button className="btn btn-danger" onClick={handleEndRound} disabled={!selectedRound}>⏹ End Round</button>
          <button className="btn btn-outline" onClick={() => exportScoresToCSV(leaderboard, game?.title)} disabled={!leaderboard.length} style={{ fontSize: 12 }}>📥 CSV</button>
        </div>

        {status && (
          <div style={{ padding: '8px 16px', background: 'rgba(64,196,160,0.08)', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--accent3)' }}>
            {status}
          </div>
        )}

        <div className="host-content" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start' }}>

          {/* Questions */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text2)' }}>Questions</p>
              {selectedRound && (
                <button className="btn btn-secondary" onClick={() => setShowAddQuestion(!showAddQuestion)} style={{ fontSize: 11, padding: '4px 10px' }}>
                  {showAddQuestion ? 'Cancel' : '+ Add Question'}
                </button>
              )}
            </div>

            {/* Add question form */}
            {showAddQuestion && (
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  placeholder="Question text..."
                  value={newQuestion.text}
                  onChange={e => setNewQuestion(q => ({ ...q, text: e.target.value }))}
                  style={{ minHeight: 60, resize: 'vertical', fontSize: 13 }}
                />
                <select value={newQuestion.type} onChange={e => setNewQuestion(q => ({ ...q, type: e.target.value }))} style={{ fontSize: 13 }}>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True / False</option>
                  <option value="short_answer">Short Answer</option>
                </select>
                {newQuestion.type === 'multiple_choice' && (
                  <>
                    {['A','B','C','D'].map((letter, i) => (
                      <input key={letter} type="text" placeholder={`Option ${letter}`}
                        value={newQuestion.options[i]}
                        onChange={e => setNewQuestion(q => { const opts = [...q.options]; opts[i] = e.target.value; return { ...q, options: opts }; })}
                        style={{ fontSize: 13 }}
                      />
                    ))}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <label style={{ fontSize: 12, color: 'var(--text2)' }}>Correct:</label>
                      <select value={newQuestion.correct} onChange={e => setNewQuestion(q => ({ ...q, correct: e.target.value }))} style={{ fontSize: 13, width: 'auto' }}>
                        {['A','B','C','D'].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {newQuestion.type === 'true_false' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, color: 'var(--text2)' }}>Correct:</label>
                    <select value={newQuestion.correct} onChange={e => setNewQuestion(q => ({ ...q, correct: e.target.value }))} style={{ fontSize: 13, width: 'auto' }}>
                      <option value="True">True</option>
                      <option value="False">False</option>
                    </select>
                  </div>
                )}
                {newQuestion.type === 'short_answer' && (
                  <input type="text" placeholder="Correct answer" value={newQuestion.correct}
                    onChange={e => setNewQuestion(q => ({ ...q, correct: e.target.value }))}
                    style={{ fontSize: 13 }}
                  />
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: 'var(--text2)' }}>Points</label>
                    <input type="number" value={newQuestion.points} onChange={e => setNewQuestion(q => ({ ...q, points: parseInt(e.target.value) }))} style={{ fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: 'var(--text2)' }}>Timer (sec)</label>
                    <input type="number" value={newQuestion.timer} onChange={e => setNewQuestion(q => ({ ...q, timer: parseInt(e.target.value) }))} style={{ fontSize: 13 }} />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={addQuestion} style={{ fontSize: 14 }}>Save Question</button>
              </div>
            )}

            {questions.length === 0 && !showAddQuestion && (
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>No questions yet — click + Add Question</p>
            )}
            {questions.map((q, i) => (
              <div key={q.id} onClick={() => setActiveQuestionIdx(i)} style={{
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                background: activeQuestionIdx === i ? 'rgba(124,106,245,0.2)' : 'var(--surface2)',
                border: `1px solid ${activeQuestionIdx === i ? 'var(--accent2)' : 'var(--border)'}`,
              }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 2 }}>Q{i + 1} · {q.question_type.replace('_', ' ')}</p>
                <p style={{ fontSize: 13 }}>{q.question_text.slice(0, 60)}{q.question_text.length > 60 ? '...' : ''}</p>
              </div>
            ))}
          </div>

          {/* Live answers */}
          <div className="card">
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 10 }}>
              Live Responses ({liveAnswers.length})
            </p>
            {liveAnswers.length === 0 && <p style={{ fontSize: 13, color: 'var(--text2)' }}>Waiting for answers...</p>}
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

          {/* Leaderboard */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text2)' }}>
                Leaderboard ({leaderboard.length} players)
              </p>
              {game && (
                <a href={`/leaderboard/${game.code}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent2)' }}>
                  Open on projector →
                </a>
              )}
            </div>
            {leaderboard.length === 0 && <p style={{ fontSize: 13, color: 'var(--text2)' }}>No players yet — share the join link!</p>}
            {leaderboard.slice(0, 10).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, background: 'var(--surface2)', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text2)', minWidth: 28 }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                {p.team_name && <span style={{ fontSize: 11, color: 'var(--text2)' }}>{p.team_name}</span>}
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{(p.score || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}    const res = await fetch('/api/games', {
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
