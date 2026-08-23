import React, { useEffect, useRef, useState } from 'react';
import {
  Video,
  Plus,
  Link as LinkIcon,
  Keyboard,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Copy,
  Check,
  Shield,
  Clock,
  Sparkles,
  Users,
  Settings,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { generateMeetingCode, parseMeetingCode, getRandomAvatarColor, copyToClipboard } from '../utils/helpers';
import { useAudioVisualizer } from '../hooks/useAudioVisualizer';

interface HomeViewProps {
  onStartMeeting: (options: { roomId: string; userName: string; isPrivate: boolean; startAudioMuted: boolean; startVideoMuted: boolean; avatarColor: string }) => void;
  onJoinMeeting: (options: { roomId: string; userName: string; startAudioMuted: boolean; startVideoMuted: boolean; avatarColor: string }) => void;
  initialRoomCode?: string;
}

export const HomeView: React.FC<HomeViewProps> = ({ onStartMeeting, onJoinMeeting, initialRoomCode = '' }) => {
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('meetpulse_username') || 'Usuário ' + Math.floor(100 + Math.random() * 900);
  });
  const [roomCodeInput, setRoomCodeInput] = useState<string>(initialRoomCode);
  const [showNewMeetingMenu, setShowNewMeetingMenu] = useState<boolean>(false);
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [recentRooms, setRecentRooms] = useState<Array<{ id: string; name: string; date: string }>>([]);

  // Preview camera/mic state
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [previewMicMuted, setPreviewMicMuted] = useState<boolean>(false);
  const [previewCamMuted, setPreviewCamMuted] = useState<boolean>(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [avatarColor] = useState<string>(() => getRandomAvatarColor());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Audio level visualizer for preview
  const { volume, isSpeaking } = useAudioVisualizer(previewStream, previewMicMuted);

  // Load recent rooms
  useEffect(() => {
    try {
      const saved = localStorage.getItem('meetpulse_recent_rooms');
      if (saved) {
        setRecentRooms(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save username on change
  const handleNameChange = (val: string) => {
    setUserName(val);
    localStorage.setItem('meetpulse_username', val);
  };

  // Initialize preview stream
  useEffect(() => {
    let streamInstance: MediaStream | null = null;

    const startPreview = async () => {
      try {
        setMediaError(null);
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: true,
          });
          streamInstance = stream;
          setPreviewStream(stream);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        }
      } catch (err: unknown) {
        console.warn('[HomeView] Could not load camera preview:', err);
        setMediaError('Câmera ou microfone não detectados ou bloqueados.');
      }
    };

    startPreview();

    return () => {
      if (streamInstance) {
        streamInstance.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Attach stream to video tag whenever stream changes
  useEffect(() => {
    if (videoRef.current && previewStream) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  // Toggle preview Mic
  const togglePreviewMic = () => {
    if (previewStream) {
      const audioTracks = previewStream.getAudioTracks();
      const newState = !previewMicMuted;
      audioTracks.forEach((t) => {
        t.enabled = !newState;
      });
      setPreviewMicMuted(newState);
    } else {
      setPreviewMicMuted(!previewMicMuted);
    }
  };

  // Toggle preview Cam
  const togglePreviewCam = () => {
    if (previewStream) {
      const videoTracks = previewStream.getVideoTracks();
      const newState = !previewCamMuted;
      videoTracks.forEach((t) => {
        t.enabled = !newState;
      });
      setPreviewCamMuted(newState);
    } else {
      setPreviewCamMuted(!previewCamMuted);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowNewMeetingMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Actions
  const handleStartInstantMeeting = (isPrivate = false) => {
    const code = generateMeetingCode();
    // Stop preview stream before moving into room
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
    }
    onStartMeeting({
      roomId: code,
      userName: userName.trim() || 'Organizador',
      isPrivate,
      startAudioMuted: previewMicMuted,
      startVideoMuted: previewCamMuted,
      avatarColor,
    });
  };

  const handleCreateInviteOnly = () => {
    const code = generateMeetingCode();
    setCreatedInviteCode(code);
    setShowNewMeetingMenu(false);
  };

  const handleJoinByCode = (codeToJoin?: string) => {
    const target = parseMeetingCode(codeToJoin || roomCodeInput);
    if (!target) return;

    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
    }

    onJoinMeeting({
      roomId: target,
      userName: userName.trim() || 'Participante',
      startAudioMuted: previewMicMuted,
      startVideoMuted: previewCamMuted,
      avatarColor,
    });
  };

  const handleCopyInviteLink = async () => {
    if (!createdInviteCode) return;
    const url = `${window.location.origin}/?room=${createdInviteCode}`;
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <main id="home-view-container" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Actions & Welcome */}
        <div className="lg:col-span-7 space-y-8 text-left">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Conexão WebRTC Ultra-rápida & Sem Limite de Tempo</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-100 tracking-tight leading-tight">
              Reuniões de vídeo de alta qualidade para todos.
            </h1>
            <p className="text-base sm:text-lg text-gray-400 max-w-xl">
              Conecte-se, colabore e compartilhe com sua equipe ou amigos a qualquer hora e de qualquer lugar, com segurança e velocidade.
            </p>
          </div>

          {/* Name Input */}
          <div className="p-4 bg-[#0A0A0A] rounded-2xl border border-white/5 space-y-2">
            <label htmlFor="user-name-input" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Seu nome de exibição
            </label>
            <input
              id="user-name-input"
              type="text"
              value={userName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Digite como gostaria de ser chamado"
              className="w-full px-4 py-2.5 rounded-xl bg-[#121212] border border-white/10 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 text-sm font-medium transition-all"
              maxLength={30}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* Nova Reunião Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                id="new-meeting-btn"
                onClick={() => setShowNewMeetingMenu(!showNewMeetingMenu)}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/20 transition-all"
              >
                <Plus className="w-5 h-5" />
                <span>Nova reunião</span>
              </button>

              {showNewMeetingMenu && (
                <div
                  id="new-meeting-menu"
                  className="absolute left-0 top-full mt-2 w-72 bg-[#0A0A0A] rounded-2xl shadow-2xl border border-white/10 py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  <button
                    id="create-instant-meeting-btn"
                    onClick={() => handleStartInstantMeeting(false)}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-white/5 text-left transition-colors"
                  >
                    <Video className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-gray-100">Iniciar reunião instantânea</div>
                      <div className="text-xs text-gray-400">Entrar imediatamente em uma sala aberta</div>
                    </div>
                  </button>

                  <button
                    id="create-private-meeting-btn"
                    onClick={() => handleStartInstantMeeting(true)}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-white/5 text-left transition-colors"
                  >
                    <Shield className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-gray-100">Reunião privada (Sala de espera)</div>
                      <div className="text-xs text-gray-400">Participantes precisam da sua aprovação para entrar</div>
                    </div>
                  </button>

                  <button
                    id="create-invite-link-btn"
                    onClick={handleCreateInviteOnly}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-white/5 text-left transition-colors border-t border-white/5"
                  >
                    <LinkIcon className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-gray-100">Criar link para compartilhar</div>
                      <div className="text-xs text-gray-400">Gere um código e convide outras pessoas</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Input Room Code / Join */}
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Keyboard className="w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="room-code-input"
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && roomCodeInput.trim()) {
                      handleJoinByCode();
                    }
                  }}
                  placeholder="Digite o código ou link da reunião"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#0A0A0A] border border-white/10 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 text-sm font-medium transition-all"
                />
              </div>

              <button
                id="join-meeting-btn"
                disabled={!roomCodeInput.trim()}
                onClick={() => handleJoinByCode()}
                className={`px-5 py-3.5 rounded-2xl font-semibold text-sm transition-all flex items-center gap-1.5 shrink-0 ${
                  roomCodeInput.trim()
                    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/10 cursor-pointer shadow-sm'
                    : 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                }`}
              >
                <span>Entrar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Generated Invite Modal Box */}
          {createdInviteCode && (
            <div
              id="created-invite-box"
              className="p-5 rounded-2xl bg-blue-600/10 border border-blue-500/20 space-y-3 animate-in fade-in slide-in-from-top-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                  <LinkIcon className="w-4 h-4" />
                  <span>Seu link de reunião está pronto!</span>
                </div>
                <button
                  id="close-invite-box-btn"
                  onClick={() => setCreatedInviteCode(null)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Fechar
                </button>
              </div>

              <p className="text-xs text-gray-300">
                Copie este link e envie para as pessoas que você quer convidar. Guarde-o para entrar quando quiser.
              </p>

              <div className="flex items-center gap-2">
                <div className="flex-1 px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-blue-400 truncate select-all">
                  {window.location.origin}/?room={createdInviteCode}
                </div>
                <button
                  id="copy-invite-link-btn"
                  onClick={handleCopyInviteLink}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow-md shadow-blue-600/20"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
                <button
                  id="enter-created-room-btn"
                  onClick={() => handleJoinByCode(createdInviteCode)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-medium text-xs shrink-0 transition-colors"
                >
                  Entrar agora
                </button>
              </div>
            </div>
          )}

          {/* Recent Rooms Quick Access */}
          {recentRooms.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Reuniões Recentes</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentRooms.slice(0, 4).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleJoinByCode(r.id)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors border border-white/5"
                  >
                    <span className="font-mono text-blue-400">{r.id}</span>
                    <span className="text-gray-500 text-[10px]">({r.date})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Pre-Join Live Preview Card */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-md bg-[#0A0A0A] rounded-3xl p-5 shadow-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Teste de Câmera & Áudio</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Pronto para conectar</span>
              </div>
            </div>

            {/* Video preview container */}
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[#121212] flex items-center justify-center border border-white/5 shadow-inner">
              {/* Video Element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${previewCamMuted || !previewStream ? 'hidden' : 'block'}`}
              />

              {/* Avatar when camera off */}
              {(previewCamMuted || !previewStream) && (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-xl border-2 border-white/10"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {userName ? userName.slice(0, 2).toUpperCase() : 'ME'}
                  </div>
                  <span className="text-xs font-medium text-gray-400">{userName || 'Você'}</span>
                </div>
              )}

              {/* Speaking indicator overlay */}
              {isSpeaking && !previewMicMuted && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-semibold flex items-center gap-1.5 shadow backdrop-blur-sm animate-in fade-in">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  <span>Falando</span>
                </div>
              )}

              {/* Floating Media Controls on preview */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-full border border-white/10 shadow-lg">
                <button
                  id="preview-toggle-mic-btn"
                  onClick={togglePreviewMic}
                  title={previewMicMuted ? 'Ativar microfone' : 'Desativar microfone'}
                  className={`p-2.5 rounded-full transition-all ${
                    previewMicMuted ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {previewMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  id="preview-toggle-cam-btn"
                  onClick={togglePreviewCam}
                  title={previewCamMuted ? 'Ligar câmera' : 'Desligar câmera'}
                  className={`p-2.5 rounded-full transition-all ${
                    previewCamMuted ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {previewCamMuted ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Mic Energy Level Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Mic className="w-3.5 h-3.5 text-blue-400" />
                  Sensibilidade do microfone
                </span>
                <span className="text-gray-300 font-mono">{previewMicMuted ? 'Silenciado' : `${volume}%`}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 rounded-full ${
                    previewMicMuted ? 'bg-gray-700' : volume > 50 ? 'bg-emerald-400' : 'bg-blue-500'
                  }`}
                  style={{ width: `${previewMicMuted ? 0 : volume}%` }}
                />
              </div>
            </div>

            {mediaError && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                {mediaError}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
