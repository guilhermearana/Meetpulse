import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { FloatingReaction } from '../types';

interface EmojiReactionsProps {
  reactions: FloatingReaction[];
}

export const EmojiReactions: React.FC<EmojiReactionsProps> = ({ reactions }) => {
  // Trigger confetti for special celebration emojis
  useEffect(() => {
    if (reactions.length > 0) {
      const latest = reactions[reactions.length - 1];
      if (latest.emoji === '🎉' || latest.emoji === '🚀' || latest.emoji === '🔥') {
        confetti({
          particleCount: 35,
          spread: 60,
          origin: { y: 0.85 },
          colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
        });
      }
    }
  }, [reactions]);

  return (
    <div id="emoji-reactions-layer" className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {reactions.map((rx) => (
        <div
          key={rx.id}
          className="absolute bottom-24 flex flex-col items-center animate-reaction-float select-none pointer-events-none"
          style={{
            left: `calc(50% + ${rx.xOffset}px)`,
          }}
        >
          <div className="text-4xl sm:text-5xl filter drop-shadow-lg transform transition-transform hover:scale-125">
            {rx.emoji}
          </div>
          <span className="text-[10px] font-semibold text-white/90 bg-zinc-900/80 px-2 py-0.5 rounded-full backdrop-blur-sm mt-1 shadow">
            {rx.senderName}
          </span>
        </div>
      ))}
    </div>
  );
};
