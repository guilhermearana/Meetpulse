import React from 'react';
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
        <div className="flex-1 h-full min-h-[300px] rounded-2xl overflow-hidden shadow-2xl relative">
          <VideoTile
            participant={spotlightParticipant}
            stream={getStreamFor(spotlightParticipant.socketId)}
            isSelf={spotlightParticipant.socketId === selfParticipant.socketId}
            isPinned={true}
            isHost={isHost}
            onTogglePin={onTogglePin}
            onKickParticipant={onKickParticipant}
          />
        </div>

        {/* Secondary Strip (Side or Bottom on Mobile) */}
        {secondaryParticipants.length > 0 && (
          <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:w-64 xl:w-72 shrink-0 py-1 lg:py-0">
            {secondaryParticipants.map((p) => (
              <div key={p.socketId} className="w-44 h-32 lg:w-full lg:h-44 shrink-0">
                <VideoTile
                  participant={p}
                  stream={getStreamFor(p.socketId)}
                  isSelf={p.socketId === selfParticipant.socketId}
                  isPinned={false}
                  isHost={isHost}
                  onTogglePin={onTogglePin}
                  onKickParticipant={onKickParticipant}
                />
              </div>
            ))}
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
      {allParticipants.map((p) => {
        const isSelf = p.socketId === selfParticipant.socketId;
        const stream = isSelf ? localStream : remoteStreams.get(p.socketId) || null;

        return (
          <div key={p.socketId} className="w-full h-full min-h-[220px] max-h-[85vh]">
            <VideoTile
              participant={p}
              stream={stream}
              isSelf={isSelf}
              isPinned={false}
              isHost={isHost}
              onTogglePin={onTogglePin}
              onKickParticipant={onKickParticipant}
            />
          </div>
        );
      })}
    </div>
  );
};
