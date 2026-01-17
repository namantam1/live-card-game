import { motion as Motion } from 'framer-motion';
import { Trophy, Play, RotateCcw } from 'lucide-react';

export const RoundSummaryModal = ({ players, roundNumber, onContinue }) => {
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

export const GameOverModal = ({ players, onRestart }) => {
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
