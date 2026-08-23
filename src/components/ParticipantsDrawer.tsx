import React, { useState } from 'react';
import {
  Users,
  X,
  Search,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Shield,
  Hand,
  Monitor,
  UserX,
  VolumeX,
  UserCheck,
  Share2,
  Copy,
  Check,
} from 'lucide-react';
import { Participant, WaitingUser } from '../types';
import { getInitials, copyToClipboard } from '../utils/helpers';

interface ParticipantsDrawerProps {
  participants: Participant[];
  selfSocketId: string;
  isHost: boolean;
  waitingUsers: WaitingUser[];
  meetingCode: string;
  onAdmitWaitingUser: (socketId: string, allow: boolean) => void;
  onMuteAll: () => void;
  onKickParticipant: (socketId: string) => void;
  onClose: () => void;
  onOpenInvite: () => void;
}

export const ParticipantsDrawer: React.FC<ParticipantsDrawerProps> = ({
  participants,
  selfSocketId,
  isHost,
  waitingUsers,
  meetingCode,
  onAdmitWaitingUser,
  onMuteAll,
  onKickParticipant,
  onClose,
  onOpenInvite,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const filteredParticipants = participants.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/?room=${meetingCode}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <aside
      id="participants-drawer"
      className="w-full sm:w-80 md:w-96 h-full bg-[#0A0A0A] border-l border-white/5 flex flex-col z-30 shadow-2xl transition-all duration-200"
    >
      {/* Drawer Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-gray-100 text-sm">
            Participantes ({participants.length})
          </h3>
        </div>
        <button
          id="close-participants-btn"
          onClick={onClose}
          className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Host Controls bar & Invite button */}
      <div className="p-3 border-b border-white/5 bg-[#050505]/50 flex items-center gap-2">
        <button
          id="drawer-copy-invite-btn"
          onClick={handleCopyLink}
          className="flex-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-200 flex items-center justify-center gap-1.5 transition-all border border-white/10"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Link copiado!' : 'Copiar link'}</span>
        </button>

        {isHost && (
          <button
            id="drawer-mute-all-btn"
            onClick={onMuteAll}
            title="Solicitar que todos silenciem o microfone"
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-red-950/40 text-xs font-semibold text-gray-300 hover:text-red-400 flex items-center gap-1.5 transition-all border border-white/10"
          >
            <VolumeX className="w-3.5 h-3.5 text-red-400" />
            <span>Silenciar todos</span>
          </button>
        )}
      </div>

      {/* Waiting Room Queue (if Host) */}
      {isHost && waitingUsers.length > 0 && (
        <div className="p-3 bg-purple-950/30 border-b border-purple-800/30 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-purple-300">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Sala de Espera ({waitingUsers.length})
            </span>
          </div>

          <div className="space-y-2 max-h-36 overflow-y-auto">
            {waitingUsers.map((w) => (
              <div
                key={w.socketId}
                className="p-2.5 bg-[#121212] rounded-xl border border-purple-500/30 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 truncate">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                    style={{ backgroundColor: w.avatarColor || '#8B5CF6' }}
                  >
                    {getInitials(w.name)}
                  </div>
                  <span className="text-xs font-medium text-gray-200 truncate">{w.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onAdmitWaitingUser(w.socketId, true)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
                  >
                    <UserCheck className="w-3 h-3" />
                    <span>Permitir</span>
                  </button>
                  <button
                    onClick={() => onAdmitWaitingUser(w.socketId, false)}
                    className="p-1 hover:bg-white/10 text-red-400 rounded-lg transition-colors"
                    title="Recusar entrada"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="p-3 border-b border-white/5">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-participants-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar participantes..."
            className="w-full pl-9 pr-3 py-2 bg-[#121212] border border-white/10 rounded-xl text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
          />
        </div>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredParticipants.map((p) => {
          const isSelf = p.socketId === selfSocketId;
          const isSpeaking = !p.audioMuted && (p.volumeLevel || 0) > 12;

          return (
            <div
              key={p.socketId}
              className="p-2.5 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between gap-3 group"
            >
              {/* Avatar & Name */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 relative shadow-sm"
                  style={{ backgroundColor: p.avatarColor || '#3B82F6' }}
                >
                  {getInitials(p.name)}
                  {isSpeaking && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#0A0A0A] animate-ping" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-200 truncate">
                      {p.name}
                    </span>
                    {isSelf && (
                      <span className="text-[10px] text-gray-400 font-normal shrink-0">(Você)</span>
                    )}
                    {p.isHost && (
                      <span
                        title="Organizador da reunião"
                        className="px-1.5 py-0.5 rounded bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[9px] font-bold shrink-0 flex items-center gap-0.5"
                      >
                        <Shield className="w-2.5 h-2.5" />
                        Host
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Icons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Screen Share */}
                {p.isScreenSharing && (
                  <span title="Compartilhando tela" className="text-blue-400">
                    <Monitor className="w-4 h-4" />
                  </span>
                )}

                {/* Hand Raised */}
                {p.isHandRaised && (
                  <span title="Mão levantada" className="text-amber-400 text-sm animate-bounce">
                    ✋
                  </span>
                )}

                {/* Mic Status */}
                {p.audioMuted ? (
                  <span title="Microfone desligado" className="text-red-400">
                    <MicOff className="w-4 h-4" />
                  </span>
                ) : (
                  <span title="Microfone ligado" className={isSpeaking ? 'text-blue-400' : 'text-gray-400'}>
                    <Mic className="w-4 h-4" />
                  </span>
                )}

                {/* Video Status */}
                {p.videoMuted ? (
                  <span title="Câmera desligada" className="text-red-400">
                    <VideoOff className="w-4 h-4" />
                  </span>
                ) : (
                  <span title="Câmera ligada" className="text-gray-400">
                    <Video className="w-4 h-4" />
                  </span>
                )}

                {/* Host Kick Option */}
                {isHost && !isSelf && (
                  <button
                    onClick={() => onKickParticipant(p.socketId)}
                    title="Remover participante"
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-950/50 text-gray-400 hover:text-red-400 rounded transition-opacity"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
