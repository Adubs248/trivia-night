/**
 * client/src/store/gameStore.js
 * Zustand global state — all game state in one place
 */

import { create } from 'zustand';

export const useGameStore = create((set, get) => ({
  // Connection
  connected: false,
  setConnected: (v) => set({ connected: v }),

  // Game session
  game: null,
  setGame: (game) => set({ game }),

  // Player
  player: null,
  setPlayer: (player) => set({ player }),
  updatePlayerScore: (score) => set((s) => ({ player: s.player ? { ...s.player, score } : null })),

  // Current question
  currentQuestion: null,
  setCurrentQuestion: (q) => set({ currentQuestion: q, selectedAnswer: null, submittedAnswer: null }),

  // Timer
  timeRemaining: 0,
  setTimeRemaining: (t) => set({ timeRemaining: t }),

  // Answer state
  selectedAnswer: null,
  setSelectedAnswer: (a) => set({ selectedAnswer: a }),

  submittedAnswer: null,
  setSubmittedAnswer: (a) => set({ submittedAnswer: a }),

  questionLocked: false,
  setQuestionLocked: (v) => set({ questionLocked: v }),

  answerRevealed: null,      // { correctAnswer, explanation }
  setAnswerRevealed: (v) => set({ answerRevealed: v }),

  // Leaderboard
  leaderboard: [],
  setLeaderboard: (lb) => set({ leaderboard: lb }),

  // Host: live answers feed
  liveAnswers: [],
  addLiveAnswer: (answer) => set((s) => ({
    liveAnswers: [answer, ...s.liveAnswers].slice(0, 50), // keep last 50
  })),
  clearLiveAnswers: () => set({ liveAnswers: [] }),

  // Host: player count
  playerCount: 0,
  setPlayerCount: (n) => set({ playerCount: n }),

  // Achievements
  achievements: [],
  addAchievement: (badge) => set((s) => ({ achievements: [...s.achievements, badge] })),

  // Poll
  activePoll: null,
  setPoll: (poll) => set({ activePoll: poll }),
  updatePollResults: (responses) => set((s) => ({
    activePoll: s.activePoll ? { ...s.activePoll, responses } : null,
  })),

  // Round info
  rounds: [],
  setRounds: (rounds) => set({ rounds }),
  currentRound: null,
  setCurrentRound: (round) => set({ currentRound: round }),

  // Reset for new game
  reset: () => set({
    game: null, player: null, currentQuestion: null, timeRemaining: 0,
    selectedAnswer: null, submittedAnswer: null, questionLocked: false,
    answerRevealed: null, leaderboard: [], liveAnswers: [], playerCount: 0,
    achievements: [], activePoll: null, rounds: [], currentRound: null,
  }),
}));
