import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Hand,
  Smile,
  MessageSquare,
  Users,
  PhoneOff,
  Maximize,
  Minimize,
  Shield,
  Info,
  ChevronUp,
  Settings,
} from 'lucide-react';

interface MeetingControlsProps {
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isHost: boolean;
  unreadChatCount: number;
  participantCount: number;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  isFullscreen: boolean;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  currentAudioId: string;
  currentVideoId: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleHand: () => void;
  onSendReaction: (emoji: string) => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleFullscreen: () => void;
  onOpenInvite: () => void;
  onOpenSecurity: () => void;
  onOpenSettings: () => void;
  onSelectAudioDevice: (deviceId: string) => void;
  onSelectVideoDevice: (deviceId: string) => void;
  onLeaveMeeting: () => void;
}

const EMOJI_LIST = ['👍', '❤️', '👏', '🎉', '😂', '😮', '🔥', '🚀'];

export const MeetingControls: React.FC<MeetingControlsProps> = ({
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  isHandRaised,
  isHost,
  unreadChatCount,
  participantCount,
  isChatOpen,
  isParticipantsOpen,
  isFullscreen,
  audioDevices,
  videoDevices,
  currentAudioId,
  currentVideoId,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleHand,
  onSendReaction,
  onToggleChat,
  onToggleParticipants,
  onToggleFullscreen,
  onOpenInvite,
  onOpenSecurity,
  onOpenSettings,
  onSelectAudioDevice,
  onSelectVideoDevice,
  onLeaveMeeting,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [showAudioMenu, setShowAudioMenu] = useState<boolean>(false);
  const [showVideoMenu, setShowVideoMenu] = useState<boolean>(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<boolean>(false);

  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const audioMenuRef = useRef<HTMLDivElement | null>(null);
  const videoMenuRef = useRef<HTMLDivElement | null>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target as Node)) {
        setShowAudioMenu(false);
      }
      if (videoMenuRef.current && !videoMenuRef.current.contains(e.target as Node)) {
        setShowVideoMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div id="meeting-controls-bar" className="w-full h-20 px-6 bg-[#0A0A0A] border-t border-white/5 flex items-center justify-between z-40">
      {/* Left section: Meeting Info */}
      <div className="hidden md:flex items-center gap-2">
        <button
          id="meeting-info-btn"
          onClick={onOpenInvite}
          title="Detalhes da reunião e link de convite"
          className="px-3.5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-2 border border-white/10 transition-all"
        >
          <Info className="w-4 h-4 text-blue-400" />
          <span>Convidar</span>
        </button>

        {isHost && (
          <button
            id="host-security-btn"
            onClick={onOpenSecurity}
            title="Controles do organizador (Segurança)"
            className="px-3.5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-2 border border-white/10 transition-all"
          >
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="hidden lg:inline">Segurança</span>
          </button>
        )}
      </div>

      {/* Center Section: Core Media & Interaction Buttons */}
      <div className="flex-1 md:flex-initial flex items-center justify-center gap-2 sm:gap-3">
        {/* Microphone Button + Device Selector */}
        <div className="relative flex items-center" ref={audioMenuRef}>
          <button
            id="toggle-mic-btn"
            onClick={onToggleAudio}
            title={isAudioMuted ? 'Ativar microfone' : 'Desativar microfone'}
            className={`p-3.5 rounded-2xl transition-all flex items-center justify-center border shadow-md ${
              isAudioMuted
                ? 'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-red-600/20'
                : 'bg-white/5 hover:bg-white/10 text-gray-200 border-white/10 active:scale-95'
            }`}
          >
            {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {audioDevices.length > 1 && (
            <button
              onClick={() => setShowAudioMenu(!showAudioMenu)}
              title="Selecionar microfone"
              className="p-1 text-gray-400 hover:text-white -ml-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}

          {showAudioMenu && (
            <div className="absolute bottom-full mb-3 left-0 w-64 bg-[#0A0A0A] border border-white/10 rounded-2xl p-2 shadow-2xl z-50 text-left">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 py-1.5">Microfone</div>
              {audioDevices.map((d) => (
                <button
                  key={d.deviceId}
                  onClick={() => {
                    onSelectAudioDevice(d.deviceId);
                    setShowAudioMenu(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs text-left truncate transition-colors ${
                    currentAudioId === d.deviceId ? 'bg-blue-600 text-white font-medium shadow-sm shadow-blue-600/20' : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  {d.label || `Microfone (${d.deviceId.slice(0, 5)})`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Camera Button + Device Selector */}
        <div className="relative flex items-center" ref={videoMenuRef}>
          <button
            id="toggle-cam-btn"
            onClick={onToggleVideo}
            title={isVideoMuted ? 'Ligar câmera' : 'Desligar câmera'}
            className={`p-3.5 rounded-2xl transition-all flex items-center justify-center border shadow-md ${
              isVideoMuted
                ? 'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-red-600/20'
                : 'bg-white/5 hover:bg-white/10 text-gray-200 border-white/10 active:scale-95'
            }`}
          >
            {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {videoDevices.length > 1 && (
            <button
              onClick={() => setShowVideoMenu(!showVideoMenu)}
              title="Selecionar câmera"
              className="p-1 text-gray-400 hover:text-white -ml-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}

          {showVideoMenu && (
            <div className="absolute bottom-full mb-3 left-0 w-64 bg-[#0A0A0A] border border-white/10 rounded-2xl p-2 shadow-2xl z-50 text-left">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 py-1.5">Câmera</div>
              {videoDevices.map((d) => (
                <button
                  key={d.deviceId}
                  onClick={() => {
                    onSelectVideoDevice(d.deviceId);
                    setShowVideoMenu(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs text-left truncate transition-colors ${
                    currentVideoId === d.deviceId ? 'bg-blue-600 text-white font-medium shadow-sm shadow-blue-600/20' : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  {d.label || `Câmera (${d.deviceId.slice(0, 5)})`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Screen Share Button */}
        <button
          id="toggle-screenshare-btn"
          onClick={onToggleScreenShare}
          title={isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar sua tela'}
          className={`p-3.5 rounded-2xl transition-all flex items-center justify-center border shadow-md ${
            isScreenSharing
              ? 'bg-blue-600 text-white hover:bg-blue-500 border-blue-500 shadow-blue-600/20'
              : 'bg-white/5 hover:bg-white/10 text-gray-200 border-white/10'
          }`}
        >
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>

        {/* Raise Hand Button */}
        <button
          id="toggle-hand-btn"
          onClick={onToggleHand}
          title={isHandRaised ? 'Abaixar a mão' : 'Levantar a mão'}
          className={`p-3.5 rounded-2xl transition-all flex items-center justify-center border shadow-md ${
            isHandRaised
              ? 'bg-amber-500 hover:bg-amber-400 text-black border-amber-400 ring-2 ring-amber-300/40 animate-pulse'
              : 'bg-white/5 hover:bg-white/10 text-gray-200 border-white/10'
          }`}
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* Reactions Button + Emoji Picker */}
        <div className="relative" ref={emojiPickerRef}>
          <button
            id="toggle-reactions-btn"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Reagir com emoji"
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 transition-all shadow-md active:scale-95"
          >
            <Smile className="w-5 h-5" />
          </button>

          {showEmojiPicker && (
            <div
              id="emoji-picker-popup"
              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#0A0A0A] backdrop-blur-md border border-white/10 rounded-2xl p-2 shadow-2xl flex items-center gap-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSendReaction(emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-2xl transition-transform hover:scale-125 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Settings button */}
        <button
          id="open-settings-btn"
          onClick={onOpenSettings}
          title="Configurações de áudio e vídeo"
          className="hidden sm:flex p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all shadow-md"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Leave Meeting (Red Button) */}
        <div className="relative">
          <button
            id="leave-call-btn"
            onClick={() => setShowLeaveConfirm(true)}
            title="Sair da chamada"
            className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold flex items-center gap-2 shadow-lg shadow-red-600/20 transition-all"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline text-xs font-bold">Sair</span>
          </button>

          {/* Leave confirm modal */}
          {showLeaveConfirm && (
            <div className="absolute bottom-full mb-3 right-0 sm:left-1/2 sm:-translate-x-1/2 w-64 bg-[#0A0A0A] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 text-left space-y-3">
              <div className="text-sm font-bold text-gray-100">Deseja sair da chamada?</div>
              <p className="text-xs text-gray-400">Você pode retornar a qualquer momento se a sala continuar ativa.</p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={onLeaveMeeting}
                  className="flex-1 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/20 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Section: Drawers & Fullscreen */}
      <div className="flex items-center gap-2">
        {/* Chat Drawer Toggle */}
        <button
          id="toggle-chat-drawer-btn"
          onClick={onToggleChat}
          title="Chat da reunião"
          className={`relative p-3 rounded-2xl border transition-all ${
            isChatOpen
              ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
              : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/10'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold animate-pulse shadow-sm">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Participants Drawer Toggle */}
        <button
          id="toggle-participants-drawer-btn"
          onClick={onToggleParticipants}
          title="Participantes"
          className={`relative p-3 rounded-2xl border transition-all ${
            isParticipantsOpen
              ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
              : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/10'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-gray-200 text-[10px] font-bold">
            {participantCount}
          </span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          id="toggle-fullscreen-btn"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'}
          className={`p-3 rounded-2xl border transition-all ${
            isFullscreen
              ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 hover:bg-blue-600/30'
              : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/10'
          }`}
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};
