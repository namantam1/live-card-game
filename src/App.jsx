import { useState, useEffect, useCallback, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Spade, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

// Utils
import { createAudioContext, playCardSound, playTrumpSound, startBackgroundMusic, stopBackgroundMusic } from './utils/audio';
import { createDeck, shuffleDeck, findWinner, getCardValue, sortHand } from './utils/cards';

// Components
import Card from './components/Card';
import Player from './components/Player';
import Scoreboard from './components/Scoreboard';
import InlineBiddingUI from './components/BiddingUI';
import { RoundSummaryModal, GameOverModal } from './components/Modals';
import TrickArea from './components/TrickArea';

const TOTAL_ROUNDS = 5;

const initialPlayerState = () => [
  { id: 0, name: 'You', emoji: '😎', hand: [], bid: null, tricksWon: 0, score: 0, roundScore: 0, isHuman: true },
  { id: 1, name: 'Ace', emoji: '🤖', hand: [], bid: null, tricksWon: 0, score: 0, roundScore: 0, isHuman: false },
  { id: 2, name: 'Max', emoji: '🦊', hand: [], bid: null, tricksWon: 0, score: 0, roundScore: 0, isHuman: false },
  { id: 3, name: 'Zara', emoji: '🐱', hand: [], bid: null, tricksWon: 0, score: 0, roundScore: 0, isHuman: false },
];

export default function App() {
  const [gamePhase, setGamePhase] = useState('start');
  const [players, setPlayers] = useState(initialPlayerState());
  const [currentRound, setCurrentRound] = useState(1);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [currentTrick, setCurrentTrick] = useState([]);
  const [leadSuit, setLeadSuit] = useState(null);
  const [trickNumber, setTrickNumber] = useState(0);
  const [biddingPlayer, setBiddingPlayer] = useState(0);
  const [dealingComplete, setDealingComplete] = useState(false);

  // Audio state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContextRef = useRef(null);

  // Initialize audio context on first interaction
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = createAudioContext();
    }
    if (soundEnabled) {
      startBackgroundMusic();
    }
  }, [soundEnabled]);

  // Toggle sound
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev;
      if (newValue) {
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
        }
        startBackgroundMusic();
      } else {
        stopBackgroundMusic();
      }
      return newValue;
    });
  }, []);

  // Play card sound
  const playSoundEffect = useCallback((isTrump = false) => {
    if (soundEnabled && audioContextRef.current) {
      if (isTrump) {
        playTrumpSound(audioContextRef.current);
      } else {
        playCardSound(audioContextRef.current);
      }
    }
  }, [soundEnabled]);

  // Calculate round score
  const calculateRoundScore = useCallback(() => {
    setPlayers(prev => prev.map(p => {
      let roundScore;
      if (p.tricksWon >= p.bid) {
        roundScore = p.bid + (p.tricksWon - p.bid) * 0.1;
      } else {
        roundScore = -p.bid;
      }
      return {
        ...p,
        roundScore,
        score: p.score + roundScore,
      };
    }));

    setGamePhase('roundEnd');
  }, []);

  // Deal cards to all players
  const dealCards = useCallback((preserveScores = false, currentScores = []) => {
    const deck = shuffleDeck(createDeck());
    const newPlayers = initialPlayerState().map((p, i) => ({
      ...p,
      hand: sortHand(deck.slice(i * 13, (i + 1) * 13)),
      score: preserveScores ? (currentScores[i] || 0) : 0,
    }));

    setPlayers(newPlayers);
    setCurrentTrick([]);
    setLeadSuit(null);
    setTrickNumber(0);
    setDealingComplete(false);

    setTimeout(() => {
      setDealingComplete(true);
      setBiddingPlayer(0);
      setGamePhase('bidding');
    }, 1500);
  }, []);

  // Start new game
  const startGame = useCallback(() => {
    initAudio();
    setPlayers(initialPlayerState());
    setCurrentRound(1);
    setGamePhase('dealing');
    dealCards(false);
  }, [dealCards, initAudio]);

  // Handle bidding
  const handleBid = useCallback((bid) => {
    setPlayers(prev => prev.map((p, i) =>
      i === biddingPlayer ? { ...p, bid } : p
    ));

    if (biddingPlayer < 3) {
      setBiddingPlayer(prev => prev + 1);
    } else {
      setGamePhase('playing');
      setCurrentTurn(0);
    }
  }, [biddingPlayer]);

  // Bot bidding logic
  useEffect(() => {
    if (gamePhase === 'bidding' && biddingPlayer > 0 && biddingPlayer <= 3) {
      const timer = setTimeout(() => {
        const player = players[biddingPlayer];
        const highCards = player.hand.filter(c => getCardValue(c) >= 11).length;
        const spades = player.hand.filter(c => c.suit === 'spades').length;
        const bid = Math.max(1, Math.min(13, Math.floor((highCards + spades) / 2) + 1));
        handleBid(bid);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [gamePhase, biddingPlayer, players, handleBid]);

  // Play a card
  const playCard = useCallback((card) => {
    if (gamePhase !== 'playing') return;

    const playerIndex = currentTurn;
    const player = players[playerIndex];

    if (leadSuit) {
      const hasLeadSuit = player.hand.some(c => c.suit === leadSuit);
      if (hasLeadSuit && card.suit !== leadSuit) return;

      if (!hasLeadSuit) {
        const hasSpades = player.hand.some(c => c.suit === 'spades');
        if (hasSpades && card.suit !== 'spades') return;
      }
    }

    const isTrumpPlay = card.suit === 'spades' && leadSuit && leadSuit !== 'spades';
    playSoundEffect(isTrumpPlay);

    if (currentTrick.length === 0) {
      setLeadSuit(card.suit);
    }

    setPlayers(prev => prev.map((p, i) =>
      i === playerIndex
        ? { ...p, hand: p.hand.filter(c => c.id !== card.id) }
        : p
    ));

    const newTrick = [...currentTrick, { player: playerIndex, card }];
    setCurrentTrick(newTrick);

    if (newTrick.length === 4) {
      setTimeout(() => {
        const winner = findWinner(newTrick, leadSuit || card.suit);

        setPlayers(prev => prev.map((p, i) =>
          i === winner ? { ...p, tricksWon: p.tricksWon + 1 } : p
        ));

        setCurrentTrick([]);
        setLeadSuit(null);
        setTrickNumber(prev => prev + 1);

        if (trickNumber + 1 >= 13) {
          setTimeout(() => calculateRoundScore(), 500);
        } else {
          setCurrentTurn(winner);
        }
      }, 1000);
    } else {
      setCurrentTurn((playerIndex + 1) % 4);
    }
  }, [gamePhase, currentTurn, players, currentTrick, leadSuit, trickNumber, calculateRoundScore, playSoundEffect]);

  // Bot card play
  useEffect(() => {
    if (gamePhase === 'playing' && currentTurn > 0 && currentTrick.length < 4) {
      const timer = setTimeout(() => {
        const player = players[currentTurn];
        if (!player.hand.length) return;

        let validCards = [...player.hand];

        if (leadSuit) {
          const leadSuitCards = validCards.filter(c => c.suit === leadSuit);
          if (leadSuitCards.length > 0) {
            validCards = leadSuitCards;
          } else {
            const spadeCards = validCards.filter(c => c.suit === 'spades');
            if (spadeCards.length > 0) {
              validCards = spadeCards;
            }
          }
        }

        validCards.sort((a, b) => getCardValue(a) - getCardValue(b));
        const cardToPlay = validCards[0];

        if (cardToPlay) {
          playCard(cardToPlay);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [gamePhase, currentTurn, currentTrick, players, leadSuit, playCard]);

  // Continue to next round
  const continueToNextRound = useCallback(() => {
    if (currentRound >= TOTAL_ROUNDS) {
      setGamePhase('gameOver');
    } else {
      const currentScores = players.map(p => p.score);
      setCurrentRound(prev => prev + 1);
      setPlayers(prev => prev.map(p => ({
        ...p,
        hand: [],
        bid: null,
        tricksWon: 0,
        roundScore: 0,
      })));
      setGamePhase('dealing');
      setTimeout(() => dealCards(true, currentScores), 500);
    }
  }, [currentRound, dealCards, players]);

  // Restart game
  const restartGame = useCallback(() => {
    setPlayers(initialPlayerState());
    setCurrentRound(1);
    setCurrentTurn(0);
    setCurrentTrick([]);
    setLeadSuit(null);
    setTrickNumber(0);
    setBiddingPlayer(0);
    setGamePhase('dealing');
    dealCards(false);
  }, [dealCards]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900
      flex items-center justify-center p-4 overflow-hidden">

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.3) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)`
        }} />
      </div>

      {/* Game Table */}
      <div className="relative w-full max-w-5xl aspect-square max-h-[90vh]">
        {/* Table Surface */}
        <div className="absolute inset-[15%] rounded-full bg-gradient-to-br from-emerald-900/50 to-emerald-950/50
          border-8 border-amber-900/50 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-4 rounded-full border-2 border-emerald-700/30" />
        </div>

        {/* Trump Indicator */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          px-4 py-2 bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-600/50">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Trump:</span>
            <Spade size={20} className="text-slate-200" fill="currentColor" />
          </div>
          <div className="text-center text-xs text-slate-500 mt-1">
            Round {currentRound}/{TOTAL_ROUNDS}
          </div>
        </div>

        {/* Start Screen */}
        <AnimatePresence>
          {gamePhase === 'start' && (
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center z-50"
            >
              <div className="text-center">
                <Motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Spade size={48} className="text-indigo-400 mx-auto mb-4 sm:mb-6 sm:w-20 sm:h-20" fill="currentColor" />
                </Motion.div>
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-2 sm:mb-4">Call Break</h1>
                <p className="text-slate-400 text-sm sm:text-base mb-4 sm:mb-8">A classic trick-taking card game</p>
                <Motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-indigo-500 to-purple-500
                    text-white font-bold text-sm sm:text-lg rounded-xl shadow-lg shadow-indigo-500/30
                    hover:from-indigo-600 hover:to-purple-600 transition-all flex items-center gap-2 mx-auto"
                >
                  <Play size={20} className="sm:w-6 sm:h-6" />
                  Start Game
                </Motion.button>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>

        {/* Players */}
        {(gamePhase === 'dealing' || gamePhase === 'playing' || gamePhase === 'bidding') && dealingComplete && (
          <>
            <Player
              player={players[0]}
              position="bottom"
              isCurrentTurn={currentTurn === 0 && gamePhase === 'playing'}
              showCards={true}
              onCardPlay={playCard}
              leadSuit={leadSuit}
            />
            <Player
              player={players[1]}
              position="left"
              isCurrentTurn={currentTurn === 1 && gamePhase === 'playing'}
              showCards={false}
            />
            <Player
              player={players[2]}
              position="top"
              isCurrentTurn={currentTurn === 2 && gamePhase === 'playing'}
              showCards={false}
            />
            <Player
              player={players[3]}
              position="right"
              isCurrentTurn={currentTurn === 3 && gamePhase === 'playing'}
              showCards={false}
            />
          </>
        )}

        {/* Trick Area */}
        {gamePhase === 'playing' && (
          <TrickArea currentTrick={currentTrick} leadSuit={leadSuit} />
        )}

        {/* Dealing Animation */}
        <AnimatePresence>
          {gamePhase === 'dealing' && !dealingComplete && (
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="relative"
              >
                {[0, 1, 2, 3].map((i) => (
                  <Motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.2 }}
                    className="absolute"
                    style={{
                      transform: `rotate(${i * 90}deg) translateY(-40px)`,
                    }}
                  >
                    <Card faceDown small />
                  </Motion.div>
                ))}
              </Motion.div>
              <p className="absolute bottom-1/3 text-white text-lg">Dealing cards...</p>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Buttons */}
      {gamePhase !== 'start' && (
        <div className="fixed top-4 right-4 flex gap-2 z-50">
          <Motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleSound}
            className="p-2 bg-slate-800/80 backdrop-blur-sm
              text-white rounded-lg border border-slate-600/50
              hover:bg-slate-700/80 transition-all"
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </Motion.button>
          <Motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={restartGame}
            className="px-3 py-2 bg-slate-800/80 backdrop-blur-sm
              text-white font-medium text-sm rounded-lg border border-slate-600/50
              hover:bg-slate-700/80 transition-all flex items-center gap-1"
          >
            <RotateCcw size={16} />
            <span className="hidden sm:inline">Reset</span>
          </Motion.button>
        </div>
      )}

      {/* Scoreboard */}
      {gamePhase !== 'start' && dealingComplete && (
        <Scoreboard players={players} currentRound={currentRound} totalRounds={TOTAL_ROUNDS} />
      )}

      {/* Inline Bidding UI */}
      <AnimatePresence>
        {gamePhase === 'bidding' && biddingPlayer === 0 && dealingComplete && (
          <InlineBiddingUI onBid={handleBid} />
        )}
      </AnimatePresence>

      {/* AI Bidding Indicator */}
      <AnimatePresence>
        {gamePhase === 'bidding' && biddingPlayer > 0 && (
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3
              bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-600/50"
          >
            <p className="text-white">
              <span className="text-indigo-400 font-semibold">{players[biddingPlayer]?.name}</span> is bidding...
            </p>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Round Summary Modal */}
      <AnimatePresence>
        {gamePhase === 'roundEnd' && (
          <RoundSummaryModal
            players={players}
            roundNumber={currentRound}
            onContinue={continueToNextRound}
          />
        )}
      </AnimatePresence>

      {/* Game Over Modal */}
      <AnimatePresence>
        {gamePhase === 'gameOver' && (
          <GameOverModal
            players={players}
            onRestart={restartGame}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
