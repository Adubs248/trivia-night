/**
 * client/src/hooks/useSocket.js
 * Central Socket.IO hook for the React frontend
 * Handles connection, reconnection, and all game events
 */

import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';

const SOCKET_URL = window.location.origin;

let socketInstance = null;

export function useSocket() {
  const socketRef = useRef(null);
  const {
    setConnected,
    setPlayer,
    setGame,
    setCurrentQuestion,
    setTimeRemaining,
    setQuestionLocked,
    setAnswerRevealed,
    setLeaderboard,
    addLiveAnswer,
    setPlayerCount,
    addAchievement,
    setPoll,
    updatePollResults,
  } = useGameStore();

  useEffect(() => {
    // Reuse socket if already connected
    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
    }
    socketRef.current = socketInstance;
    const socket = socketRef.current;

    // Connection lifecycle
    socket.on('connect', () => {
      setConnected(true);
      console.log('Socket connected:', socket.id);
    });
    socket.on('disconnect', () => {
      setConnected(false);
      console.log('Socket disconnected, will reconnect...');
    });
    socket.on('reconnect', (attempt) => {
      setConnected(true);
      console.log('Reconnected after', attempt, 'attempts');
    });

    // ---- PLAYER EVENTS ----

    // New question starts
    socket.on('question_start', ({ question, timeRemaining }) => {
      setCurrentQuestion(question);
      setTimeRemaining(timeRemaining);
      setQuestionLocked(false);
      setAnswerRevealed(null);
    });

    // Timer runs out or host locks
    socket.on('question_locked', () => {
      setQuestionLocked(true);
    });

    // Host reveals correct answer
    socket.on('answer_revealed', ({ correctAnswer, explanation }) => {
      setAnswerRevealed({ correctAnswer, explanation });
    });

    // Leaderboard pushed from server
    socket.on('leaderboard_update', ({ leaderboard }) => {
      setLeaderboard(leaderboard);
    });

    // Achievement badge earned
    socket.on('achievement_unlocked', ({ badges }) => {
      badges.forEach(b => addAchievement(b));
    });

    // Another device took over this session
    socket.on('session_taken', ({ message }) => {
      alert(message);
      socket.disconnect();
    });

    // Poll started
    socket.on('poll_started', ({ poll }) => {
      setPoll(poll);
    });

    // ---- HOST EVENTS ----

    // Live answer feed
    socket.on('player_answered', (data) => {
      addLiveAnswer(data);
    });

    socket.on('player_count_update', ({ count }) => {
      setPlayerCount(count);
    });

    socket.on('timer_tick', ({ remaining }) => {
      setTimeRemaining(remaining);
    });

    socket.on('poll_update', ({ responses }) => {
      updatePollResults(responses);
    });

    return () => {
      // Remove listeners but keep socket alive for reconnects
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnect');
      socket.off('question_start');
      socket.off('question_locked');
      socket.off('answer_revealed');
      socket.off('leaderboard_update');
      socket.off('achievement_unlocked');
      socket.off('session_taken');
      socket.off('poll_started');
      socket.off('player_answered');
      socket.off('player_count_update');
      socket.off('timer_tick');
      socket.off('poll_update');
    };
  }, []);

  // Emit helpers with promise wrappers
  const joinGame = useCallback((params) => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('join_game', params, (res) => {
        if (res.error) reject(new Error(res.error));
        else {
          setPlayer(res.player);
          setGame(res.game);
          resolve(res);
        }
      });
    });
  }, []);

  const submitAnswer = useCallback((params) => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('submit_answer', params, (res) => {
        if (res.error) reject(new Error(res.error));
        else resolve(res);
      });
    });
  }, []);

  const hostJoin = useCallback((params) => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('host_join', params, (res) => {
        if (res.error) reject(new Error(res.error));
        else resolve(res);
      });
    });
  }, []);

  const startQuestion = useCallback((params) => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('start_question', params, (res) => {
        if (res.error) reject(new Error(res.error));
        else resolve(res);
      });
    });
  }, []);

  const lockAnswers = useCallback((params) => {
    socketRef.current.emit('lock_answers', params, () => {});
  }, []);

  const revealAnswers = useCallback((params) => {
    socketRef.current.emit('reveal_answers', params, () => {});
  }, []);

  const awardBonus = useCallback((params) => {
    socketRef.current.emit('award_bonus', params, () => {});
  }, []);

  const endRound = useCallback((params) => {
    return new Promise((resolve) => {
      socketRef.current.emit('end_round', params, resolve);
    });
  }, []);

  const requestLeaderboard = useCallback(() => {
    return new Promise((resolve) => {
      socketRef.current.emit('request_leaderboard', {}, resolve);
    });
  }, []);

  return {
    socket: socketRef.current,
    joinGame,
    submitAnswer,
    hostJoin,
    startQuestion,
    lockAnswers,
    revealAnswers,
    awardBonus,
    endRound,
    requestLeaderboard,
  };
}
