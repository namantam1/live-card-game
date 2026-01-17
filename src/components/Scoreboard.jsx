import { motion as Motion } from 'framer-motion';

const Scoreboard = ({ players, currentRound, totalRounds }) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <Motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-2 left-2 z-40
        bg-slate-900/90 backdrop-blur-sm rounded-full border border-slate-700/50
        px-1.5 py-0.5 sm:px-2 sm:py-1 flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs"
    >
      <span className="text-slate-400 font-medium">R{currentRound}/{totalRounds}</span>
      <div className="w-px h-3 sm:h-4 bg-slate-700" />
      {sortedPlayers.map((player, idx) => (
        <div key={player.id} className="flex items-center gap-0.5">
          <span className="text-xs sm:text-sm">{player.emoji}</span>
          <span className={`font-bold text-[8px] sm:text-[10px] ${idx === 0 ? 'text-yellow-400' : player.score >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {player.score.toFixed(1)}
          </span>
        </div>
      ))}
    </Motion.div>
  );
};

export default Scoreboard;
