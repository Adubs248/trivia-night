/**
 * client/src/components/player/QuestionView.jsx
 * The main answering interface for players
 * Supports: multiple_choice, true_false, short_answer
 */

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useSocket } from '../../hooks/useSocket';
import Timer from '../shared/Timer';
import { ResultBanner } from './ResultBanner';
import MediaDisplay from '../shared/MediaDisplay';

export default function QuestionView() {
  const {
    currentQuestion,
    timeRemaining,
    questionLocked,
    answerRevealed,
    selectedAnswer,
    setSelectedAnswer,
    submittedAnswer,
    setSubmittedAnswer,
    player,
    updatePlayerScore,
  } = useGameStore();

  const { submitAnswer } = useSocket();
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { isCorrect, pointsAwarded }
  const shortAnswerRef = useRef(null);
  const submittedRef = useRef(false);

  // Reset state when new question arrives
  useEffect(() => {
    setResult(null);
    setError('');
    submittedRef.current = false;
  }, [currentQuestion?.id]);

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeRemaining === 0 && !submittedRef.current && selectedAnswer) {
      handleSubmit();
    }
  }, [timeRemaining]);

  async function handleSubmit() {
    if (submittedRef.current || !currentQuestion) return;
    const answer = currentQuestion.question_type === 'short_answer'
      ? shortAnswerRef.current?.value?.trim()
      : selectedAnswer;
    if (!answer) { setError('Please select or enter an answer.'); return; }

    submittedRef.current = true;
    setSubmittedAnswer(answer);

    try {
      const res = await submitAnswer({ questionId: currentQuestion.id, answerText: answer });
      setResult(res);
      if (res.pointsAwarded > 0) {
        updatePlayerScore((player?.score || 0) + res.pointsAwarded);
      }
    } catch (err) {
      setError(err.message);
      submittedRef.current = false;
    }
  }

  if (!currentQuestion) {
    return (
      <div className="waiting-screen">
        <div className="waiting-icon">⏳</div>
        <h2>Waiting for the next question...</h2>
        <p>The host will start the next question shortly.</p>
      </div>
    );
  }

  const isLocked = questionLocked || submittedRef.current;
  const revealed = !!answerRevealed;

  return (
    <div className="question-view">
      <Timer seconds={timeRemaining} total={currentQuestion.timer_seconds} locked={isLocked} />

      {/* Media (image, audio, video) */}
      {currentQuestion.media_url && (
        <MediaDisplay url={currentQuestion.media_url} type={currentQuestion.media_type} />
      )}

      {/* Question text */}
      <div className="question-card">
        <span className="question-type-label">{currentQuestion.question_type.replace('_', ' ')}</span>
        <p className="question-text">{currentQuestion.question_text}</p>
      </div>

      {/* Result banner (after submission) */}
      {result && (
        <ResultBanner
          isCorrect={result.isCorrect}
          pointsAwarded={result.pointsAwarded}
          speedBonus={result.speedBonus}
        />
      )}

      {/* Answer revelation */}
      {revealed && answerRevealed.explanation && (
        <div className="explanation-box">
          <strong>Did you know?</strong> {answerRevealed.explanation}
        </div>
      )}

      {/* Multiple choice / True-False */}
      {(currentQuestion.question_type === 'multiple_choice' || currentQuestion.question_type === 'true_false') && (
        <div className="answers-grid">
          {currentQuestion.options?.map((opt) => {
            const letter = opt.letter;
            const isSelected = selectedAnswer === letter || submittedAnswer === letter;
            const isCorrectOpt = revealed && answerRevealed.correctAnswer === letter;
            const isWrongOpt = revealed && isSelected && !isCorrectOpt;

            return (
              <button
                key={letter}
                className={`answer-btn ${isSelected ? 'selected' : ''} ${isCorrectOpt ? 'correct' : ''} ${isWrongOpt ? 'wrong' : ''}`}
                onClick={() => !isLocked && setSelectedAnswer(letter)}
                disabled={isLocked}
                aria-pressed={isSelected}
              >
                <span className="answer-letter">{letter}</span>
                <span className="answer-text">{opt.text}</span>
                {isCorrectOpt && <span className="correct-checkmark" aria-label="Correct">✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Short answer */}
      {currentQuestion.question_type === 'short_answer' && (
        <div className="short-answer-area">
          <input
            ref={shortAnswerRef}
            type="text"
            placeholder="Type your answer..."
            disabled={isLocked}
            maxLength={200}
            className="short-answer-input"
            onKeyDown={(e) => e.key === 'Enter' && !isLocked && handleSubmit()}
          />
        </div>
      )}

      {/* Anagram */}
      {currentQuestion.question_type === 'anagram' && (
        <div className="anagram-area">
          <p className="anagram-hint">Rearrange the letters to find the answer</p>
          <input
            ref={shortAnswerRef}
            type="text"
            placeholder="Unscrambled word..."
            disabled={isLocked}
            className="short-answer-input"
          />
        </div>
      )}

      {/* Submit button */}
      {!isLocked && (
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={!selectedAnswer && currentQuestion.question_type !== 'short_answer'}
        >
          {selectedAnswer || currentQuestion.question_type === 'short_answer'
            ? 'LOCK IN ANSWER →'
            : 'SELECT AN ANSWER'}
        </button>
      )}

      {isLocked && !revealed && (
        <div className="locked-banner">
          <span>Answer submitted — waiting for host to reveal...</span>
        </div>
      )}

      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
