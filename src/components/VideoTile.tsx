import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Pin,
  PinOff,
  Volume2,
  VolumeX,
  MoreVertical,
  UserX,
  Shield,
  Monitor,
  Maximize,
  Minimize,
} from 'lucide-react';
import { Participant } from '../types';
import { getInitials } from '../utils/helpers';

interface VideoTileProps {
  participant: Participant;
  stream: MediaStream | null;
  isSelf: boolean;
  isPinned: boolean;
  isHost: boolean;
  onTogglePin: (socketId: string) => void;
  onKickParticipant?: (socketId: string) => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  stream,
  isSelf,
  isPinned,
  isHost,
  onTogglePin,
  onKickParticipant,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [volume, setVolume] = useState<number>(1);
  const [isTileMuted, setIsTileMuted] = useState<boolean>(false);
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);
  const [isTileFullscreen, setIsTileFullscreen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsTileFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleTileFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (document.fullscreenElement === containerRef.current) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } else {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  // Set stream to video element
  useEffect(() => {
    if (videoRef.current) {
      if (stream) {
        videoRef.current.srcObject = stream;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  // Adjust volume on remote stream
  useEffect(() => {
    if (videoRef.current && !isSelf) {
      videoRef.current.volume = isTileMuted ? 0 : volume;
    }
  }, [volume, isTileMuted, isSelf]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
        setShowVolumeSlider(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasVideo = !participant.videoMuted && stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
  const isSpeaking = !participant.audioMuted && (participant.volumeLevel || 0) > 12;

  return (
    <div
      ref={containerRef}
      id={`video-tile-${participant.socketId}`}
      onDoubleClick={handleToggleTileFullscreen}
      className={`relative w-full h-full rounded-2xl overflow-hidden bg-[#121212] border transition-all duration-200 flex items-center justify-center select-none group shadow-lg ${
        isSpeaking
          ? 'border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.2)] ring-1 ring-blue-500/40'
          : isPinned
          ? 'border-blue-500 ring-2 ring-blue-500/40'
          : 'border-white/5 hover:border-white/15'
      }`}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf} // Self video is always muted locally to avoid feedback
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          isSelf && !participant.isScreenSharing ? '-scale-x-100' : ''
        } ${hasVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Avatar Fallback when camera is OFF */}
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#121212] to-[#0A0A0A] p-4">
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-xl border-2 border-white/10 transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundColor: participant.avatarColor || '#3B82F6' }}
          >
            {getInitials(participant.name)}
          </div>
          <span className="mt-3 text-sm font-semibold text-gray-200 truncate max-w-[180px]">
            {participant.name} {isSelf && '(Você)'}
          </span>
          {isSpeaking && (
            <div className="mt-1 flex items-center gap-1">
              <span className="w-1.5 h-3 bg-blue-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-4 bg-blue-400 rounded-full animate-bounce [animation-delay:0.15s]"></span>
              <span className="w-1.5 h-2.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.3s]"></span>
            </div>
          )}
        </div>
      )}

      {/* Screen Sharing Badge */}
      {participant.isScreenSharing && (
        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-blue-600/90 text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-md border border-blue-400/30 z-10">
          <Monitor className="w-3.5 h-3.5" />
          <span>Apresentando tela</span>
        </div>
      )}

      {/* Hand Raised Badge */}
      {participant.isHandRaised && (
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs flex items-center gap-1.5 shadow-lg animate-bounce z-10">
          <span>✋</span>
          <span>Mão levantada</span>
        </div>
      )}

      {/* Top action buttons on hover */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20">
        {/* Tile Fullscreen Button */}
        <button
          id={`tile-fullscreen-btn-${participant.socketId}`}
          onClick={handleToggleTileFullscreen}
          title={isTileFullscreen ? 'Sair da tela cheia do vídeo' : 'Expandir vídeo em tela cheia'}
          className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
            isTileFullscreen
              ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
              : 'bg-black/60 text-gray-300 hover:text-white border-white/10 hover:bg-white/10'
          }`}
        >
          {isTileFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>

        {/* Pin / Spotlight Button */}
        <button
          id={`pin-btn-${participant.socketId}`}
          onClick={() => onTogglePin(participant.socketId)}
          title={isPinned ? 'Desafixar' : 'Fixar participante'}
          className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
            isPinned
              ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
              : 'bg-black/60 text-gray-300 hover:text-white border-white/10 hover:bg-white/10'
          }`}
        >
          {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
        </button>

        {/* Remote Volume slider trigger */}
        {!isSelf && (
          <div className="relative">
            <button
              id={`vol-btn-${participant.socketId}`}
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              title="Ajustar volume deste participante"
              className="p-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-all"
            >
              {isTileMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {showVolumeSlider && (
              <div
                className="absolute right-0 top-full mt-2 p-3 bg-[#0A0A0A] backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl w-40 z-30 flex flex-col gap-2"
                ref={menuRef}
              >
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span>Volume</span>
                  <span className="font-mono text-blue-400">{isTileMuted ? '0%' : `${Math.round(volume * 100)}%`}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isTileMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsTileMuted(false);
                  }}
                  className="w-full h-1.5 bg-[#121212] border border-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <button
                  onClick={() => setIsTileMuted(!isTileMuted)}
                  className="text-xs text-gray-400 hover:text-white text-left transition-colors pt-1 border-t border-white/5"
                >
                  {isTileMuted ? 'Ativar áudio' : 'Silenciar para mim'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Host action menu */}
        {isHost && !isSelf && (
          <div className="relative">
            <button
              id={`host-more-btn-${participant.socketId}`}
              onClick={() => setShowMenu(!showMenu)}
              title="Mais ações de organizador"
              className="p-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-full mt-2 w-48 bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl py-1.5 z-40 text-left"
                ref={menuRef}
              >
                {onKickParticipant && (
                  <button
                    onClick={() => {
                      onKickParticipant(participant.socketId);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 flex items-center gap-2 transition-colors"
                  >
                    <UserX className="w-4 h-4" />
                    <span>Remover da reunião</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Name & Mic status pill */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 max-w-[85%] z-10">
        <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2 text-xs font-medium text-gray-200 shadow-md">
          {/* Audio status indicator */}
          <div className="shrink-0">
            {participant.audioMuted ? (
              <MicOff className="w-3.5 h-3.5 text-red-400" />
            ) : isSpeaking ? (
              <div className="flex items-center gap-0.5 text-blue-400">
                <span className="w-1 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                <span className="w-1 h-3 bg-blue-400 rounded-full animate-bounce [animation-delay:0.1s]"></span>
                <span className="w-1 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              </div>
            ) : (
              <Mic className="w-3.5 h-3.5 text-gray-400" />
            )}
          </div>

          <span className="truncate text-gray-200">
            {participant.name} {isSelf && '(Você)'}
          </span>

          {participant.isHost && (
            <span title="Organizador" className="p-0.5 rounded text-blue-400">
              <Shield className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
