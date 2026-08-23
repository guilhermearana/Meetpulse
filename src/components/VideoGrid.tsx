import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Participant, LayoutMode } from '../types';
import { VideoTile } from './VideoTile';

interface VideoGridProps {
  participants: Participant[];
  selfParticipant: Participant;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  pinnedSocketId: string | null;
  layoutMode: LayoutMode;
  isHost: boolean;
  onTogglePin: (socketId: string) => void;
  onKickParticipant?: (socketId: string) => void;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  participants,
  selfParticipant,
  localStream,
  remoteStreams,
  pinnedSocketId,
  layoutMode,
  isHost,
  onTogglePin,
  onKickParticipant,
}) => {
  // Combine self + remote participants safely
  const allParticipants = [selfParticipant, ...participants.filter((p) => p.socketId !== selfParticipant.socketId)];

  // Determine if we should be in spotlight mode (either manually pinned or someone sharing screen)
  const screenSharer = allParticipants.find((p) => p.isScreenSharing);
  const activeSpotlightId = pinnedSocketId || (screenSharer ? screenSharer.socketId : null);
  const isSpotlight = layoutMode === 'spotlight' || Boolean(activeSpotlightId);

  // If spotlight mode is active:
  if (isSpotlight && activeSpotlightId) {
    const spotlightParticipant = allParticipants.find((p) => p.socketId === activeSpotlightId) || allParticipants[0];
    const secondaryParticipants = allParticipants.filter((p) => p.socketId !== spotlightParticipant.socketId);

    const getStreamFor = (socketId: string) => {
      return socketId === selfParticipant.socketId ? localStream : remoteStreams.get(socketId) || null;
    };

    return (
      <div id="video-grid-spotlight" className="w-full h-full p-2 sm:p-4 flex flex-col lg:flex-row gap-3 overflow-hidden">
        {/* Main Stage (Large) */}
        <motion.div
          layout
          key={spotlightParticipant.socketId}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 h-full min-h-[300px] rounded-2xl overflow-hidden shadow-2xl relative"
        >
          <VideoTile
            participant={spotlightParticipant}
            stream={getStreamFor(spotlightParticipant.socketId)}
            isSelf={spotlightParticipant.socketId === selfParticipant.socketId}
            isPinned={true}
            isHost={isHost}
            onTogglePin={onTogglePin}
            onKickParticipant={onKickParticipant}
          />
        </motion.div>

        {/* Secondary Strip (Side or Bottom on Mobile) */}
        {secondaryParticipants.length > 0 && (
          <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:w-64 xl:w-72 shrink-0 py-1 lg:py-0">
            <AnimatePresence mode="popLayout">
              {secondaryParticipants.map((p) => (
                <motion.div
                  layout
                  key={p.socketId}
                  initial={{ opacity: 0, scale: 0.8, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.7, x: 20, transition: { duration: 0.2 } }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  className="w-44 h-32 lg:w-full lg:h-44 shrink-0 rounded-2xl overflow-hidden"
                >
                  <VideoTile
                    participant={p}
                    stream={getStreamFor(p.socketId)}
                    isSelf={p.socketId === selfParticipant.socketId}
                    isPinned={false}
                    isHost={isHost}
                    onTogglePin={onTogglePin}
                    onKickParticipant={onKickParticipant}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }

  // Standard Grid Mode (Dynamic column/row calculation)
  const count = allParticipants.length;

  let gridColsClass = 'grid-cols-1';
  if (count === 2) {
    gridColsClass = 'grid-cols-1 md:grid-cols-2';
  } else if (count === 3 || count === 4) {
    gridColsClass = 'grid-cols-1 sm:grid-cols-2';
  } else if (count >= 5 && count <= 6) {
    gridColsClass = 'grid-cols-2 lg:grid-cols-3';
  } else if (count > 6) {
    gridColsClass = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  }

  return (
    <div
      id="video-grid-container"
      className={`w-full h-full p-2 sm:p-4 grid ${gridColsClass} gap-3 auto-rows-fr overflow-y-auto`}
    >
      <AnimatePresence mode="popLayout">
        {allParticipants.map((p, index) => {
          const isSelf = p.socketId === selfParticipant.socketId;
          const stream = isSelf ? localStream : remoteStreams.get(p.socketId) || null;

          return (
            <motion.div
              layout
              key={p.socketId}
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              transition={{
                layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                opacity: { duration: 0.25 },
                scale: { type: 'spring', stiffness: 350, damping: 25 },
              }}
              className="w-full h-full min-h-[220px] max-h-[85vh] rounded-2xl overflow-hidden"
            >
              <VideoTile
                participant={p}
                stream={stream}
                isSelf={isSelf}
                isPinned={false}
                isHost={isHost}
                onTogglePin={onTogglePin}
                onKickParticipant={onKickParticipant}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
