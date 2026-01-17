import { useState, useEffect, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Spade, Heart, Diamond, Club, Trophy, Target, Play, RotateCcw } from 'lucide-react';

// ============================================
// CARD UTILITIES
// ============================================

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

const createDeck = () => {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}-${suit}` });
    }
  }
  return deck;
};

const shuffleDeck = (deck) => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const getCardValue = (card) => RANK_VALUES[card.rank];

const compareCards = (card1, card2, leadSuit) => {
  // Trump (spades) beats non-trump
  if (card1.suit === 'spades' && card2.suit !== 'spades') return 1;
  if (card2.suit === 'spades' && card1.suit !== 'spades') return -1;

  // If same suit type (both trump or both lead suit)
  if (card1.suit === card2.suit) {
    return getCardValue(card1) - getCardValue(card2);
  }

  // Lead suit beats non-lead, non-trump
  if (card1.suit === leadSuit) return 1;
  if (card2.suit === leadSuit) return -1;

  return 0;
};

const findWinner = (trick, leadSuit) => {
  let winnerIndex = 0;
  let winningCard = trick[0].card;

  for (let i = 1; i < trick.length; i++) {
    if (compareCards(trick[i].card, winningCard, leadSuit) > 0) {
      winnerIndex = i;
      winningCard = trick[i].card;
    }
  }

  return trick[winnerIndex].player;
};

const sortHand = (hand) => {
  const suitOrder = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
  return [...hand].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return getCardValue(b) - getCardValue(a);
  });
};

// ============================================
// SUIT ICON COMPONENT
// ============================================

const SuitIcon = ({ suit, size = 16, className = '' }) => {
  const props = { size, className };
  switch (suit) {
    case 'spades': return <Spade {...props} fill="currentColor" />;
    case 'hearts': return <Heart {...props} fill="currentColor" />;
    case 'diamonds': return <Diamond {...props} fill="currentColor" />;
    case 'clubs': return <Club {...props} fill="currentColor" />;
    default: return null;
  }
};

const getSuitColor = (suit) => {
  return suit === 'hearts' || suit === 'diamonds' ? 'text-red-500' : 'text-slate-900';
};

// ============================================
// CARD COMPONENT
// ============================================

const Card = ({ card, onClick, disabled, isPlayable, isSelected, faceDown = false, small = false, delay = 0, fromDeck = false }) => {
  const baseSize = small ? 'w-12 h-16' : 'w-16 h-24 sm:w-20 sm:h-28';

  const cardVariants = {
    initial: fromDeck
      ? { scale: 0.5, opacity: 0, x: 0, y: 0 }
      : { scale: 0.8, opacity: 0 },
    animate: {
      scale: isPlayable && !disabled ? 1.08 : 1,
      opacity: 1,
      y: isPlayable && !disabled ? -20 : 0,
      x: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
        delay
      }
    },
    hover: isPlayable && !disabled ? {
      y: -28,
      scale: 1.12,
      transition: { type: 'spring', stiffness: 400, damping: 20 }
    } : {},
    tap: isPlayable && !disabled ? { scale: 1.0, y: -15 } : {},
    exit: {
      scale: 0.8,
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };

  if (faceDown) {
    return (
      <Motion.div
        variants={cardVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={`${baseSize} rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800
          border-2 border-indigo-400/30 shadow-lg flex items-center justify-center
          ${small ? '' : 'cursor-default'}`}
      >
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-indigo-500/40 flex items-center justify-center
          border border-indigo-300/30">
          <Spade size={small ? 12 : 16} className="text-indigo-200" fill="currentColor" />
        </div>
      </Motion.div>
    );
  }

  const suitColor = getSuitColor(card.suit);

  return (
    <Motion.button
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      whileTap="tap"
      exit="exit"
      onClick={() => !disabled && isPlayable && onClick?.(card)}
      disabled={disabled || !isPlayable}
      className={`${baseSize} rounded-lg bg-white flex flex-col items-center justify-between p-1.5 sm:p-2
        border-2 transition-all duration-200
        ${isPlayable && !disabled
          ? 'border-emerald-400 cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.6),0_10px_30px_rgba(0,0,0,0.3)]'
          : 'border-slate-300 cursor-not-allowed shadow-md'}
        ${isSelected ? 'ring-4 ring-yellow-400' : ''}
      `}
      style={isPlayable && !disabled ? {
        boxShadow: '0 0 25px rgba(16, 185, 129, 0.5), 0 0 50px rgba(16, 185, 129, 0.2), 0 10px 30px rgba(0,0,0,0.3)'
      } : {}}
    >
      <div className={`self-start flex items-center gap-0.5 ${suitColor}`}>
        <span className="text-xs sm:text-sm font-bold">{card.rank}</span>
        <SuitIcon suit={card.suit} size={small ? 10 : 12} />
      </div>

      <div className={`${suitColor}`}>
        <SuitIcon suit={card.suit} size={small ? 20 : 28} />
      </div>

      <div className={`self-end flex items-center gap-0.5 rotate-180 ${suitColor}`}>
        <span className="text-xs sm:text-sm font-bold">{card.rank}</span>
        <SuitIcon suit={card.suit} size={small ? 10 : 12} />
      </div>
    </Motion.button>
  );
};

// ============================================
// PLAYER COMPONENT
// ============================================

const Player = ({ player, position, isCurrentTurn, showCards, onCardPlay, leadSuit, playedCard }) => {
  const positionStyles = {
    bottom: 'bottom-0 left-1/2 -translate-x-1/2 flex-col',
    top: 'top-0 left-1/2 -translate-x-1/2 flex-col-reverse',
    left: 'left-0 top-1/2 -translate-y-1/2 flex-row',
    right: 'right-0 top-1/2 -translate-y-1/2 flex-row-reverse',
  };

  const cardContainerStyles = {
    bottom: 'flex-row -space-x-8 sm:-space-x-10',
    top: 'flex-row -space-x-10',
    left: 'flex-col -space-y-14',
    right: 'flex-col -space-y-14',
  };

  const getPlayableCards = () => {
    if (!showCards || !player.hand) return [];

    if (!leadSuit) return player.hand.map(c => c.id);

    const hasLeadSuit = player.hand.some(c => c.suit === leadSuit);
    if (hasLeadSuit) {
      return player.hand.filter(c => c.suit === leadSuit).map(c => c.id);
    }

    const hasSpades = player.hand.some(c => c.suit === 'spades');
    if (hasSpades) {
      return player.hand.filter(c => c.suit === 'spades').map(c => c.id);
    }

    return player.hand.map(c => c.id);
  };

  const playableCardIds = getPlayableCards();
  const isHuman = position === 'bottom';

  return (
    <div className={`absolute ${positionStyles[position]} flex items-center gap-2 sm:gap-4 p-2 sm:p-4`}>
      {/* Player Info */}
      <Motion.div
        animate={{
          scale: isCurrentTurn ? 1.05 : 1,
          boxShadow: isCurrentTurn ? '0 0 20px rgba(16, 185, 129, 0.5)' : 'none'
        }}
        className={`px-3 py-2 rounded-xl backdrop-blur-md
          ${isCurrentTurn
            ? 'bg-emerald-500/20 border-2 border-emerald-400'
            : 'bg-slate-800/60 border border-slate-600/50'}
        `}
      >
        <div className="text-white font-semibold text-sm">{player.name}</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Bid: {player.bid ?? '-'}</span>
          <span className="text-emerald-400">Won: {player.tricksWon}</span>
        </div>
        <div className="text-xs text-yellow-400">Score: {player.score.toFixed(1)}</div>
      </Motion.div>

      {/* Cards */}
      {player.hand && player.hand.length > 0 && (
        <div className={`flex ${cardContainerStyles[position]}`}>
          <AnimatePresence mode="popLayout">
            {sortHand(player.hand).map((card, index) => (
              <Card
                key={card.id}
                card={card}
                faceDown={!showCards}
                small={!isHuman}
                isPlayable={showCards && isCurrentTurn && playableCardIds.includes(card.id)}
                onClick={onCardPlay}
                disabled={!isCurrentTurn}
                delay={index * 0.05}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Played Card Indicator */}
      {playedCard && (
        <Motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute"
          style={{
            top: position === 'bottom' ? '-60px' : position === 'top' ? '100%' : '50%',
            left: position === 'left' ? '100%' : position === 'right' ? '-60px' : '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <Card card={playedCard} isPlayable={false} disabled />
        </Motion.div>
      )}
    </div>
  );
};

// ============================================
// BIDDING MODAL
// ============================================

const BiddingModal = ({ onBid, currentBids }) => {
  const [selectedBid, setSelectedBid] = useState(1);

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 pt-8"
    >
      <Motion.div
        initial={{ scale: 0.8, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: -20 }}
        className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-md p-5 sm:p-6 rounded-2xl
          border border-slate-500/50 shadow-2xl max-w-sm w-full mx-4"
      >
        <div className="flex items-center gap-3 mb-6">
          <Target className="text-emerald-400" size={28} />
          <h2 className="text-2xl font-bold text-white">Place Your Bid</h2>
        </div>

        <p className="text-slate-400 mb-6">
          How many tricks do you expect to win this round?
        </p>

        {/* Current Bids Display */}
        {currentBids.length > 0 && (
          <div className="mb-6 p-4 bg-slate-700/50 rounded-xl">
            <p className="text-sm text-slate-400 mb-2">Current Bids:</p>
            <div className="flex flex-wrap gap-2">
              {currentBids.map((bid, i) => (
                <span key={i} className="px-3 py-1 bg-indigo-500/30 rounded-full text-indigo-300 text-sm">
                  {bid.name}: {bid.bid}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bid Selection */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((bid) => (
            <Motion.button
              key={bid}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedBid(bid)}
              className={`p-3 rounded-lg font-bold transition-all
                ${selectedBid === bid
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
              `}
            >
              {bid}
            </Motion.button>
          ))}
        </div>

        <Motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onBid(selectedBid)}
          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600
            text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30
            hover:from-emerald-600 hover:to-emerald-700 transition-all"
        >
          Confirm Bid: {selectedBid}
        </Motion.button>
      </Motion.div>
    </Motion.div>
  );
};

// ============================================
// ROUND SUMMARY MODAL
// ============================================

const RoundSummaryModal = ({ players, roundNumber, onContinue }) => {
  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <Motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 20 }}
        className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 sm:p-8 rounded-2xl
          border border-slate-600/50 shadow-2xl max-w-lg w-full mx-4"
      >
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="text-yellow-400" size={28} />
          <h2 className="text-2xl font-bold text-white">Round {roundNumber} Complete!</h2>
        </div>

        <div className="space-y-3 mb-6">
          {[...players].sort((a, b) => b.score - a.score).map((player, index) => (
            <Motion.div
              key={player.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center justify-between p-4 rounded-xl
                ${index === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-slate-700/50'}
              `}
            >
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold
                  ${index === 0 ? 'text-yellow-400' : 'text-slate-400'}
                `}>
                  #{index + 1}
                </span>
                <div>
                  <p className="text-white font-semibold">{player.name}</p>
                  <p className="text-sm text-slate-400">
                    Bid: {player.bid} | Won: {player.tricksWon}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-xl font-bold
                  ${player.tricksWon >= player.bid ? 'text-emerald-400' : 'text-red-400'}
                `}>
                  {player.roundScore > 0 ? '+' : ''}{player.roundScore.toFixed(1)}
                </p>
                <p className="text-sm text-slate-400">Total: {player.score.toFixed(1)}</p>
              </div>
            </Motion.div>
          ))}
        </div>

        <Motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onContinue}
          className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-600
            text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30
            hover:from-indigo-600 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
        >
          <Play size={20} />
          Continue to Round {roundNumber + 1}
        </Motion.button>
      </Motion.div>
    </Motion.div>
  );
};

// ============================================
// GAME OVER MODAL
// ============================================

const GameOverModal = ({ players, onRestart }) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <Motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 20 }}
        className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 sm:p-8 rounded-2xl
          border border-slate-600/50 shadow-2xl max-w-lg w-full mx-4"
      >
        <Motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="flex justify-center mb-6"
        >
          <div className="relative">
            <Trophy className="text-yellow-400" size={64} />
            <Motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border-4 border-dashed border-yellow-400/30"
              style={{ width: '120%', height: '120%', top: '-10%', left: '-10%' }}
            />
          </div>
        </Motion.div>

        <h2 className="text-3xl font-bold text-center text-white mb-2">Game Over!</h2>
        <p className="text-center text-yellow-400 text-xl mb-6">
          {winner.name} Wins!
        </p>

        <div className="space-y-3 mb-6">
          {sortedPlayers.map((player, index) => (
            <Motion.div
              key={player.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className={`flex items-center justify-between p-4 rounded-xl
                ${index === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50' : 'bg-slate-700/50'}
              `}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `#${index + 1}`}
                </span>
                <p className={`font-semibold ${index === 0 ? 'text-yellow-400' : 'text-white'}`}>
                  {player.name}
                </p>
              </div>
              <p className={`text-xl font-bold ${index === 0 ? 'text-yellow-400' : 'text-slate-300'}`}>
                {player.score.toFixed(1)}
              </p>
            </Motion.div>
          ))}
        </div>

        <Motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRestart}
          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600
            text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30
            hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw size={20} />
          Play Again
        </Motion.button>
      </Motion.div>
    </Motion.div>
  );
};

// ============================================
// TRICK AREA COMPONENT
// ============================================

const TrickArea = ({ currentTrick, leadSuit }) => {
  // Offset positions for cards in center - slight spread so all cards are visible
  const centerOffsets = {
    0: { x: 0, y: 35, rotate: 0 },      // Bottom player - slightly below center
    1: { x: -40, y: 0, rotate: -8 },    // Left player - slightly left
    2: { x: 0, y: -35, rotate: 0 },     // Top player - slightly above center
    3: { x: 40, y: 0, rotate: 8 },      // Right player - slightly right
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Lead Suit Indicator */}
      {leadSuit && (
        <Motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2
            bg-slate-800/80 backdrop-blur-sm rounded-full border border-slate-600/50
            flex items-center gap-2"
        >
          <span className="text-slate-400 text-sm">Lead:</span>
          <SuitIcon suit={leadSuit} size={18} className={getSuitColor(leadSuit)} />
        </Motion.div>
      )}

      {/* Played Cards - All in center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <AnimatePresence>
          {currentTrick.map((play) => {
            const offset = centerOffsets[play.player];
            return (
              <Motion.div
                key={play.card.id}
                initial={{
                  scale: 0.5,
                  opacity: 0,
                  x: offset.x * 3,
                  y: offset.y * 3,
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  x: offset.x,
                  y: offset.y,
                  rotate: offset.rotate,
                  transition: { type: 'spring', stiffness: 300, damping: 25 }
                }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
              >
                <Card card={play.card} isPlayable={false} disabled />
              </Motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ============================================
// MAIN APP COMPONENT
// ============================================

const TOTAL_ROUNDS = 5;

const initialPlayerState = () => [
  { id: 0, name: 'You', hand: [], bid: null, tricksWon: 0, score: 0, roundScore: 0, isHuman: true },
  { id: 1, name: 'Bot West', hand: [], bid: null, tricksWon: 0, score: 0, roundScore: 0, isHuman: false },
  { id: 2, name: 'Bot North', hand: [], bid: null, tricksWon: 0, score: 0, roundScore: 0, isHuman: false },
  { id: 3, name: 'Bot East', hand: [], bid: null, tricksWon: 0, score: 0, roundScore: 0, isHuman: false },
];

export default function App() {
  const [gamePhase, setGamePhase] = useState('start'); // start, dealing, bidding, playing, roundEnd, gameOver
  const [players, setPlayers] = useState(initialPlayerState());
  const [currentRound, setCurrentRound] = useState(1);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [currentTrick, setCurrentTrick] = useState([]);
  const [leadSuit, setLeadSuit] = useState(null);
  const [trickNumber, setTrickNumber] = useState(0);
  const [biddingPlayer, setBiddingPlayer] = useState(0);
  const [dealingComplete, setDealingComplete] = useState(false);

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

    // Simulate dealing animation
    setTimeout(() => {
      setDealingComplete(true);
      setBiddingPlayer(0);
      setGamePhase('bidding');
    }, 1500);
  }, []);

  // Start new game
  const startGame = useCallback(() => {
    setPlayers(initialPlayerState());
    setCurrentRound(1);
    setGamePhase('dealing');
    dealCards(false);
  }, [dealCards]);

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
        // Simple bot bid: count high cards and spades
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

    // Validate card play
    if (leadSuit) {
      const hasLeadSuit = player.hand.some(c => c.suit === leadSuit);
      if (hasLeadSuit && card.suit !== leadSuit) return;

      if (!hasLeadSuit) {
        const hasSpades = player.hand.some(c => c.suit === 'spades');
        if (hasSpades && card.suit !== 'spades') return;
      }
    }

    // Set lead suit if first card
    if (currentTrick.length === 0) {
      setLeadSuit(card.suit);
    }

    // Remove card from hand
    setPlayers(prev => prev.map((p, i) =>
      i === playerIndex
        ? { ...p, hand: p.hand.filter(c => c.id !== card.id) }
        : p
    ));

    // Add to current trick
    const newTrick = [...currentTrick, { player: playerIndex, card }];
    setCurrentTrick(newTrick);

    // Check if trick is complete
    if (newTrick.length === 4) {
      setTimeout(() => {
        const winner = findWinner(newTrick, leadSuit || card.suit);

        setPlayers(prev => prev.map((p, i) =>
          i === winner ? { ...p, tricksWon: p.tricksWon + 1 } : p
        ));

        setCurrentTrick([]);
        setLeadSuit(null);
        setTrickNumber(prev => prev + 1);

        // Check if round is over
        if (trickNumber + 1 >= 13) {
          setTimeout(() => calculateRoundScore(), 500);
        } else {
          setCurrentTurn(winner);
        }
      }, 1000);
    } else {
      setCurrentTurn((playerIndex + 1) % 4);
    }
  }, [gamePhase, currentTurn, players, currentTrick, leadSuit, trickNumber, calculateRoundScore]);

  // Bot card play
  useEffect(() => {
    if (gamePhase === 'playing' && currentTurn > 0 && currentTrick.length < 4) {
      const timer = setTimeout(() => {
        const player = players[currentTurn];
        if (!player.hand.length) return;

        let validCards = [...player.hand];

        // Filter by lead suit if necessary
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

        // Bot plays lowest valid card
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
    setGamePhase('start');
    setPlayers(initialPlayerState());
    setCurrentRound(1);
    setCurrentTurn(0);
    setCurrentTrick([]);
    setLeadSuit(null);
    setTrickNumber(0);
  }, []);

  // Get current bids for display
  const getCurrentBids = () => {
    return players
      .filter((p, i) => i < biddingPlayer && p.bid !== null)
      .map(p => ({ name: p.name, bid: p.bid }));
  };

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
                  <Spade size={80} className="text-indigo-400 mx-auto mb-6" fill="currentColor" />
                </Motion.div>
                <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Call Break</h1>
                <p className="text-slate-400 mb-8">A classic trick-taking card game</p>
                <Motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500
                    text-white font-bold text-lg rounded-xl shadow-lg shadow-indigo-500/30
                    hover:from-indigo-600 hover:to-purple-600 transition-all flex items-center gap-2 mx-auto"
                >
                  <Play size={24} />
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

      {/* Reset Button */}
      {gamePhase !== 'start' && (
        <Motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={restartGame}
          className="fixed top-4 right-4 px-4 py-2 bg-slate-800/80 backdrop-blur-sm
            text-white font-medium rounded-lg border border-slate-600/50
            hover:bg-slate-700/80 transition-all flex items-center gap-2 z-50"
        >
          <RotateCcw size={18} />
          Reset
        </Motion.button>
      )}

      {/* Bidding Modal */}
      <AnimatePresence>
        {gamePhase === 'bidding' && biddingPlayer === 0 && dealingComplete && (
          <BiddingModal
            onBid={handleBid}
            currentBids={getCurrentBids()}
          />
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
