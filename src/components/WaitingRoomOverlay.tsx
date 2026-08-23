import React from 'react';
import { Shield, Clock, PhoneOff, Video } from 'lucide-react';

interface WaitingRoomOverlayProps {
  meetingCode: string;
  userName: string;
  onCancel: () => void;
}

export const WaitingRoomOverlay: React.FC<WaitingRoomOverlayProps> = ({
  meetingCode,
  userName,
  onCancel,
}) => {
  return (
    <div id="waiting-room-screen" className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center p-6 z-50 select-none">
      <div className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mx-auto flex items-center justify-center">
          <Shield className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-100 tracking-tight">
            Aguardando autorização...
          </h2>
          <p className="text-sm text-gray-400">
            Olá, <strong className="text-gray-200">{userName}</strong>. O organizador desta reunião foi notificado sobre a sua solicitação para entrar.
          </p>
        </div>

        <div className="p-3.5 bg-[#121212] rounded-2xl border border-white/10 flex items-center justify-center gap-2 text-xs text-gray-400 font-mono">
          <Clock className="w-4 h-4 text-blue-400 animate-spin" />
          <span>Reunião: {meetingCode}</span>
        </div>

        <div className="pt-2">
          <button
            id="cancel-waiting-room-btn"
            onClick={onCancel}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-white/10"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Cancelar e voltar ao início</span>
          </button>
        </div>
      </div>
    </div>
  );
};
