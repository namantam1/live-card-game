import { motion as Motion } from 'framer-motion';
import { getCardImagePath } from '../utils/cards';

const Card = ({ card, onClick, disabled, isPlayable, faceDown = false, small = false, delay = 0 }) => {
  const baseSize = small
    ? 'w-7 h-10 sm:w-10 sm:h-14'
    : 'w-10 h-14 sm:w-14 sm:h-20 md:w-16 md:h-[92px]';

  const cardVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: {
      scale: isPlayable && !disabled ? 1.05 : 1,
      opacity: 1,
      y: isPlayable && !disabled ? -12 : 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
        delay
      }
    },
    hover: isPlayable && !disabled ? {
      y: -20,
      scale: 1.1,
      transition: { type: 'spring', stiffness: 400, damping: 20 }
    } : {},
    tap: isPlayable && !disabled ? { scale: 1.0, y: -10 } : {},
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
        className={`${baseSize} rounded shadow-md`}
      >
        <img
          src="/cards/back.svg"
          alt="Card back"
          className="w-full h-full"
        />
      </Motion.div>
    );
  }

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
      className={`${baseSize} rounded transition-all duration-200
        ${isPlayable && !disabled
          ? 'shadow-lg shadow-emerald-500/40 cursor-pointer'
          : 'shadow-sm cursor-default'}
      `}
    >
      <img
        src={getCardImagePath(card)}
        alt={`${card.rank} of ${card.suit}`}
        className="w-full h-full"
      />
    </Motion.button>
  );
};

export default Card;
