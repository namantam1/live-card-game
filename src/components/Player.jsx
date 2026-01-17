import { motion as Motion, AnimatePresence } from 'framer-motion';
import Card from './Card';
import { sortHand } from '../utils/cards';

const Player = ({ player, position, isCurrentTurn, showCards, onCardPlay, leadSuit }) => {
  const positionStyles = {
    bottom: 'bottom-[-20px] left-1/2 -translate-x-1/2 flex-col',
    top: 'top left-1/2 -translate-x-1/2 flex-col-reverse',
    left: 'left-1 top-1/2 -translate-y-1/2 flex-row',
    right: 'right-1 top-1/2 -translate-y-1/2 flex-row-reverse',
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
  const cardCount = player.hand?.length || 0;

  const getCardTransform = (index, total) => {
    if (position === 'left' || position === 'right') {
      return {};
    }
    const mid = (total - 1) / 2;
    const offset = index - mid;
    const rotation = offset * (isHuman ? 2 : 3);
    const yOffset = Math.abs(offset) * (isHuman ? 2 : 1);
    return {
      transform: `rotate(${rotation}deg) translateY(${yOffset}px)`,
      transformOrigin: 'bottom center'
    };
  };

  return (
    <div className={`absolute ${positionStyles[position]} flex items-center gap-1 p-1`}>
      <Motion.div
        animate={{
          scale: isCurrentTurn ? 1.1 : 1,
          boxShadow: isCurrentTurn ? '0 0 20px rgba(16, 185, 129, 0.6)' : 'none'
        }}
        className={`flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-md
          ${isCurrentTurn
            ? 'bg-emerald-500/40 border-2 border-emerald-400'
            : 'bg-slate-800/70 border border-slate-600/50'}
        `}
      >
        <span className="text-lg">{player.emoji}</span>
        <div className="text-xs font-medium text-emerald-400">
          {player.bid !== null ? `${player.tricksWon}/${player.bid}` : '-'}
        </div>
      </Motion.div>

      {player.hand && player.hand.length > 0 && (
        <div className={`flex ${position === 'left' || position === 'right' ? 'flex-col' : 'flex-row'} items-end justify-center`}>
          <AnimatePresence mode="popLayout">
            {sortHand(player.hand).map((card, index) => (
              <div
                key={card.id}
                style={{
                  ...getCardTransform(index, cardCount),
                  marginLeft: (position === 'bottom' || position === 'top') ? (index === 0 ? 0 : '-1.5rem') : undefined,
                  marginTop: (position === 'left' || position === 'right') ? (index === 0 ? 0 : '-2.5rem') : undefined,
                }}
              >
                <Card
                  card={card}
                  faceDown={!showCards}
                  small={!isHuman}
                  isPlayable={showCards && isCurrentTurn && playableCardIds.includes(card.id)}
                  onClick={onCardPlay}
                  disabled={!isCurrentTurn}
                  delay={index * 0.03}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default Player;
