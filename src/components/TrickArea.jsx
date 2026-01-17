import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Spade, Heart, Diamond, Club } from 'lucide-react';
import Card from './Card';

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

const TrickArea = ({ currentTrick, leadSuit }) => {
  const centerOffsets = {
    0: { x: 0, y: 35, rotate: 0 },
    1: { x: -40, y: 0, rotate: -8 },
    2: { x: 0, y: -35, rotate: 0 },
    3: { x: 40, y: 0, rotate: 8 },
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
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

export default TrickArea;
