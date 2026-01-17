import { useState } from 'react';
import { motion as Motion } from 'framer-motion';

const InlineBiddingUI = ({ onBid }) => {
  const [selectedBid, setSelectedBid] = useState(1);

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-[42%] left-1/2 -translate-x-1/2 z-30 w-[70%] max-w-[250px]"
    >
      <div className="bg-slate-800/95 backdrop-blur-sm p-2 rounded-lg border border-slate-600/50 shadow-xl">
        <div className="grid grid-cols-8 gap-0.5 mb-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((bid) => (
            <Motion.button
              key={bid}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSelectedBid(bid)}
              className={`w-6 h-6 rounded font-bold text-[10px] transition-all
                ${selectedBid === bid
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
              `}
            >
              {bid}
            </Motion.button>
          ))}
        </div>
        <Motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => onBid(selectedBid)}
          className="w-full py-1 bg-emerald-500 text-white font-bold text-xs rounded
            hover:bg-emerald-600 transition-all"
        >
          Bid {selectedBid}
        </Motion.button>
      </div>
    </Motion.div>
  );
};

export default InlineBiddingUI;
