import React, { useState } from 'react';
import { X, Copy, Check, Share2, Link as LinkIcon, Shield, Send } from 'lucide-react';
import { copyToClipboard } from '../utils/helpers';

interface InviteModalProps {
  meetingCode: string;
  meetingName: string;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  meetingCode,
  meetingName,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedFull, setCopiedFull] = useState<boolean>(false);

  const meetingUrl = `${window.location.origin}/?room=${meetingCode}`;
  const formattedInvitation = `Participe da minha videochamada no MeetPulse!\n\nReunião: ${meetingName}\nCódigo: ${meetingCode}\nLink direto: ${meetingUrl}`;

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(meetingUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyCode = async () => {
    const ok = await copyToClipboard(meetingCode);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleCopyFull = async () => {
    const ok = await copyToClipboard(formattedInvitation);
    if (ok) {
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2500);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(formattedInvitation);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div id="invite-modal-backdrop" className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div
        id="invite-modal"
        className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-left"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">Convite para a reunião</h3>
              <p className="text-xs text-gray-400">Compartilhe as informações de acesso</p>
            </div>
          </div>
          <button
            id="close-invite-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meeting Link Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Link da reunião
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3.5 py-2.5 bg-[#121212] border border-white/10 rounded-xl text-xs font-mono text-gray-300 truncate select-all">
              {meetingUrl}
            </div>
            <button
              id="copy-invite-url-btn"
              onClick={handleCopyLink}
              className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all shadow-md shadow-blue-600/20"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* Meeting Code Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Código da chamada
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3.5 py-2.5 bg-[#121212] border border-white/10 rounded-xl text-xs font-mono text-gray-300 tracking-wider select-all font-bold">
              {meetingCode}
            </div>
            <button
              id="copy-code-btn"
              onClick={handleCopyCode}
              className="px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all border border-white/10"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            id="share-whatsapp-btn"
            onClick={handleShareWhatsApp}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20"
          >
            <Send className="w-4 h-4" />
            <span>Enviar no WhatsApp</span>
          </button>

          <button
            id="copy-full-invitation-btn"
            onClick={handleCopyFull}
            className="px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border border-white/10"
          >
            {copiedFull ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedFull ? 'Copiado!' : 'Copiar convite'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
