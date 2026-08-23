import React from 'react';
import { X, Shield, Lock, Unlock, Users, VolumeX, AlertCircle } from 'lucide-react';

interface HostSecurityModalProps {
  isLocked: boolean;
  isPrivate: boolean;
  onToggleLock: (isLocked: boolean) => void;
  onTogglePrivate: (isPrivate: boolean) => void;
  onMuteAll: () => void;
  onClose: () => void;
}

export const HostSecurityModal: React.FC<HostSecurityModalProps> = ({
  isLocked,
  isPrivate,
  onToggleLock,
  onTogglePrivate,
  onMuteAll,
  onClose,
}) => {
  return (
    <div id="host-security-modal-backdrop" className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div
        id="host-security-modal"
        className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-left"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">Controles de Segurança</h3>
              <p className="text-xs text-gray-400">Gerenciamento do organizador da chamada</p>
            </div>
          </div>
          <button
            id="close-security-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Lock Room Switch */}
          <div className="p-4 bg-[#121212] rounded-2xl border border-white/5 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                {isLocked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4 text-emerald-400" />}
                <span>Bloquear Reunião</span>
              </div>
              <p className="text-xs text-gray-400">
                Impede que novos participantes entrem na reunião, mesmo que possuam o link.
              </p>
            </div>
            <button
              id="toggle-room-lock-switch"
              onClick={() => onToggleLock(!isLocked)}
              className={`w-12 h-7 rounded-full transition-colors relative p-1 shrink-0 ${
                isLocked ? 'bg-amber-500 shadow-md shadow-amber-500/20' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  isLocked ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Private / Waiting Room Switch */}
          <div className="p-4 bg-[#121212] rounded-2xl border border-white/5 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                <Users className="w-4 h-4 text-blue-400" />
                <span>Sala de Espera (Aprovação)</span>
              </div>
              <p className="text-xs text-gray-400">
                Novos convidados precisam da sua autorização para ter acesso ao áudio e vídeo.
              </p>
            </div>
            <button
              id="toggle-waiting-room-switch"
              onClick={() => onTogglePrivate(!isPrivate)}
              className={`w-12 h-7 rounded-full transition-colors relative p-1 shrink-0 ${
                isPrivate ? 'bg-blue-600 shadow-md shadow-blue-600/20' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  isPrivate ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Mute All Action */}
          <div className="p-4 bg-[#121212] rounded-2xl border border-white/5 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                <VolumeX className="w-4 h-4 text-red-400" />
                <span>Silenciar todos</span>
              </div>
              <p className="text-xs text-gray-400">
                Desativa o microfone de todos os outros participantes na sala.
              </p>
            </div>
            <button
              id="security-mute-all-btn"
              onClick={() => {
                onMuteAll();
                onClose();
              }}
              className="px-3.5 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-500/40 rounded-xl text-xs font-bold shrink-0 transition-colors shadow-sm"
            >
              Silenciar
            </button>
          </div>
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-[11px] text-gray-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
          <span>Você é o organizador principal desta chamada. Suas alterações são aplicadas imediatamente a todos.</span>
        </div>
      </div>
    </div>
  );
};
