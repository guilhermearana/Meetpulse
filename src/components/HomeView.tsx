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
  SwitchCamera,
  Copy,
  Check,
  Shield,
  Clock,
  Sparkles,
  Users,
  Settings,
  ArrowRight,
  Database,
  Trash2,
  Calendar,
  Layers,
} from 'lucide-react';
import { generateMeetingCode, parseMeetingCode, getRandomAvatarColor, copyToClipboard } from '../utils/helpers';
import { useAudioVisualizer } from '../hooks/useAudioVisualizer';
import {
  saveMeetingToFirestore,
  subscribeToSavedMeetings,
  deleteMeetingFromFirestore,
  FirebaseMeeting,
} from '../services/firebase';

interface HomeViewProps {
  onStartMeeting: (options: {
    roomId: string;
    userName: string;
    isPrivate: boolean;
    startAudioMuted: boolean;
    startVideoMuted: boolean;
    avatarColor: string;
    meetingTitle?: string;
  }) => void;
  onJoinMeeting: (options: {
    roomId: string;
    userName: string;
    startAudioMuted: boolean;
    startVideoMuted: boolean;
    avatarColor: string;
  }) => void;
  initialRoomCode?: string;
}

export const HomeView: React.FC<HomeViewProps> = ({ onStartMeeting, onJoinMeeting, initialRoomCode = '' }) => {
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('meetpulse_username') || 'Usuário ' + Math.floor(100 + Math.random() * 900);
  });
  const [roomCodeInput, setRoomCodeInput] = useState<string>(initialRoomCode);
  const [showNewMeetingMenu, setShowNewMeetingMenu] = useState<boolean>(false);
  const [showCustomMeetingModal, setShowCustomMeetingModal] = useState<boolean>(false);
  const [customMeetingTitle, setCustomMeetingTitle] = useState<string>('');
  const [customMeetingDescription, setCustomMeetingDescription] = useState<string>('');
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedMeetingId, setCopiedMeetingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'database'>('create');

  // Firebase Saved Meetings State
  const [firebaseMeetings, setFirebaseMeetings] = useState<FirebaseMeeting[]>([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState<boolean>(true);

  // Preview camera/mic state
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [previewMicMuted, setPreviewMicMuted] = useState<boolean>(false);
  const [previewCamMuted, setPreviewCamMuted] = useState<boolean>(false);
  const [previewFacingMode, setPreviewFacingMode] = useState<'user' | 'environment'>('user');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [avatarColor] = useState<string>(() => getRandomAvatarColor());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Audio level visualizer for preview
  const { volume, isSpeaking } = useAudioVisualizer(previewStream, previewMicMuted);

  // Subscribe to Firebase Firestore Meetings in real time
  useEffect(() => {
    const unsubscribe = subscribeToSavedMeetings((meetings) => {
      setFirebaseMeetings(meetings);
      setIsLoadingMeetings(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Save username on change
  const handleNameChange = (val: string) => {
    setUserName(val);
    localStorage.setItem('meetpulse_username', val);
  };

  // Initialize preview stream with mobile-optimized fallback
  const startPreview = async (facing: 'user' | 'environment' = previewFacingMode) => {
    try {
      setMediaError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return;
      }

      if (previewStream) {
        previewStream.getTracks().forEach((t) => t.stop());
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: { ideal: facing },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: { ideal: 1 },
          },
        });
      } catch {
        // If combined fails, try generic audio
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false,
          });
          setPreviewCamMuted(true);
        } catch {
          // Try video only if mic is blocked on mobile OS
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: facing } },
              audio: false,
            });
            setPreviewMicMuted(true);
          } catch (bothErr) {
            console.warn('[HomeView] Could not load media preview:', bothErr);
            setMediaError('Câmera ou microfone não detectados ou bloqueados.');
          }
        }
      }

      if (stream) {
        setPreviewStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (err: unknown) {
      console.warn('[HomeView] Could not load camera/mic preview:', err);
      setMediaError('Câmera ou microfone não detectados ou bloqueados.');
    }
  };

  useEffect(() => {
    startPreview('user');

    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
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

  // Mobile / Camera flip in preview
  const flipPreviewCamera = async () => {
    const nextFacing = previewFacingMode === 'user' ? 'environment' : 'user';
    setPreviewFacingMode(nextFacing);
    await startPreview(nextFacing);
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
  const handleStartInstantMeeting = async (isPrivate = false, customTitle?: string) => {
    const code = generateMeetingCode();
    const effectiveTitle = customTitle?.trim() || (isPrivate ? 'Reunião Privada' : 'Reunião Instantânea');
    const effectiveHost = userName.trim() || 'Organizador';

    // Save to Firebase Firestore Database
    await saveMeetingToFirestore({
      roomId: code,
      title: effectiveTitle,
      hostName: effectiveHost,
      isInstant: true,
      description: customMeetingDescription || '',
    });

    // Stop preview stream before moving into room
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
    }

    onStartMeeting({
      roomId: code,
      userName: effectiveHost,
      isPrivate,
      startAudioMuted: previewMicMuted,
      startVideoMuted: previewCamMuted,
      avatarColor,
      meetingTitle: effectiveTitle,
    });
  };

  const handleCreateInviteOnly = async () => {
    const code = generateMeetingCode();
    const effectiveTitle = `Reunião #${code}`;
    const effectiveHost = userName.trim() || 'Organizador';

    // Save to Firebase Firestore Database
    await saveMeetingToFirestore({
      roomId: code,
      title: effectiveTitle,
      hostName: effectiveHost,
      isInstant: false,
    });

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

  const handleCopyInviteLink = async (roomId?: string) => {
    const target = roomId || createdInviteCode;
    if (!target) return;
    const url = `${window.location.origin}/?room=${target}`;
    const success = await copyToClipboard(url);
    if (success) {
      if (roomId) {
        setCopiedMeetingId(roomId);
        setTimeout(() => setCopiedMeetingId(null), 3000);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    }
  };

  const handleDeleteMeeting = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    if (confirm('Deseja remover esta reunião do banco de dados Firebase?')) {
      await deleteMeetingFromFirestore(roomId);
    }
  };

  return (
    <main id="home-view-container" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
      {/* Top Section / Header Tabs */}
      <div className="flex items-center justify-between pb-6 mb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'create'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Iniciar Reunião</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'database'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Database className="w-4 h-4 text-purple-300" />
            <span>Reuniões Gravadas no Firebase</span>
            {firebaseMeetings.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-bold">
                {firebaseMeetings.length}
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Firebase Firestore Ativo</span>
        </div>
      </div>

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Actions & Welcome */}
          <div className="lg:col-span-7 space-y-8 text-left">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>WebRTC HD + Firebase Firestore</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-600/10 border border-purple-500/20 text-purple-400 text-xs font-semibold">
                  <Layers className="w-3.5 h-3.5" />
                  <span>PWA Instalável (Mobile & PC)</span>
                </div>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-100 tracking-tight leading-tight">
                Reuniões de vídeo de alta qualidade para todos.
              </h1>
              <p className="text-base sm:text-lg text-gray-400 max-w-xl">
                Conecte-se, colabore e compartilhe com sua equipe ou amigos a qualquer hora, de qualquer celular ou computador.
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
                      onClick={() => {
                        setShowNewMeetingMenu(false);
                        handleStartInstantMeeting(false);
                      }}
                      className="w-full px-4 py-3 flex items-start gap-3 hover:bg-white/5 text-left transition-colors"
                    >
                      <Video className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-gray-100">Iniciar reunião instantânea</div>
                        <div className="text-xs text-gray-400">Gera a sala e salva automaticamente no Firebase</div>
                      </div>
                    </button>

                    <button
                      id="create-custom-meeting-btn"
                      onClick={() => {
                        setShowNewMeetingMenu(false);
                        setShowCustomMeetingModal(true);
                      }}
                      className="w-full px-4 py-3 flex items-start gap-3 hover:bg-white/5 text-left transition-colors"
                    >
                      <Calendar className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-gray-100">Criar reunião com título</div>
                        <div className="text-xs text-gray-400">Definir nome personalizado e registrar no banco</div>
                      </div>
                    </button>

                    <button
                      id="create-private-meeting-btn"
                      onClick={() => {
                        setShowNewMeetingMenu(false);
                        handleStartInstantMeeting(true);
                      }}
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
                      <LinkIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-gray-100">Criar link para compartilhar</div>
                        <div className="text-xs text-gray-400">Gere o link e salve na nuvem para mais tarde</div>
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
                    <span>Seu link de reunião foi registrado no Firebase!</span>
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
                  Copie este link e envie para as pessoas que você quer convidar. O código foi salvo no banco de dados Firestore.
                </p>

                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-blue-400 truncate select-all">
                    {window.location.origin}/?room={createdInviteCode}
                  </div>
                  <button
                    id="copy-invite-link-btn"
                    onClick={() => handleCopyInviteLink()}
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

            {/* Quick access to latest Firebase meetings */}
            {firebaseMeetings.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-400">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-purple-400" />
                    <span>Últimas reuniões registradas</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('database')}
                    className="text-blue-400 hover:text-blue-300 text-[11px]"
                  >
                    Ver todas ({firebaseMeetings.length}) →
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {firebaseMeetings.slice(0, 4).map((r) => (
                    <button
                      key={r.roomId}
                      onClick={() => handleJoinByCode(r.roomId)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-300 hover:text-white flex items-center gap-2 transition-colors border border-white/5"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="font-medium text-gray-200">{r.title}</span>
                      <span className="font-mono text-blue-400 text-[11px]">({r.roomId})</span>
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
                <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Câmera & Microfone (Mobile/Web)</div>
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
                  className={`w-full h-full object-cover ${previewFacingMode === 'user' ? '-scale-x-100' : ''} ${
                    previewCamMuted || !previewStream ? 'hidden' : 'block'
                  }`}
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

                {/* Camera facing mode badge on preview */}
                {!previewCamMuted && previewStream && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-gray-300 border border-white/10 font-medium">
                    {previewFacingMode === 'user' ? 'Frontal (Selfie)' : 'Traseira'}
                  </div>
                )}

                {/* Floating Media Controls on preview */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-black/70 backdrop-blur-md px-3.5 py-2 rounded-full border border-white/10 shadow-lg">
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

                  {/* Quick flip front/back camera (especially for phones) */}
                  <button
                    id="preview-flip-cam-btn"
                    onClick={flipPreviewCamera}
                    disabled={previewCamMuted || !previewStream}
                    title="Inverter câmera (Frontal / Traseira)"
                    className="p-2.5 rounded-full bg-white/10 text-blue-400 hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95"
                  >
                    <SwitchCamera className="w-4 h-4" />
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
      ) : (
        /* Database Tab: Firebase Firestore Meetings */
        <div className="space-y-6 text-left animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
                <Database className="w-6 h-6 text-purple-400" />
                <span>Reuniões Gravadas no Firebase Firestore</span>
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Todas as reuniões criadas pelos usuários ficam salvas e sincronizadas na nuvem em tempo real.
              </p>
            </div>

            <button
              onClick={() => setShowCustomMeetingModal(true)}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-2 self-start shadow-md shadow-purple-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Reunião com Título</span>
            </button>
          </div>

          {isLoadingMeetings ? (
            <div className="py-16 text-center text-gray-500 flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin"></div>
              <span className="text-xs">Carregando reuniões do Firebase...</span>
            </div>
          ) : firebaseMeetings.length === 0 ? (
            <div className="py-16 text-center bg-[#0A0A0A] rounded-3xl border border-white/5 p-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
                <Database className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-gray-200">Nenhuma reunião gravada ainda</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Crie uma reunião para que ela seja registrada automaticamente no Firestore.
              </p>
              <button
                onClick={() => handleStartInstantMeeting(false)}
                className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Criar primeira reunião</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {firebaseMeetings.map((m) => {
                const formattedDate = m.createdAt
                  ? new Date(m.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Recentemente';

                return (
                  <div
                    key={m.roomId}
                    className="p-5 rounded-2xl bg-[#0A0A0A] border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between space-y-4 group shadow-lg"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>{m.status === 'active' ? 'Ativa' : 'Salva'}</span>
                        </div>

                        <button
                          onClick={(e) => handleDeleteMeeting(e, m.roomId)}
                          title="Remover do banco"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-80 hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <h4 className="text-base font-bold text-gray-100 truncate">{m.title}</h4>
                      {m.description && (
                        <p className="text-xs text-gray-400 line-clamp-2">{m.description}</p>
                      )}

                      <div className="text-xs text-gray-400 space-y-1 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-gray-500" />
                          <span>Anfitrião: <strong className="text-gray-300">{m.hostName}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          <span>Criada: {formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                      <div className="flex-1 px-3 py-1.5 bg-black/40 rounded-xl border border-white/5 text-xs font-mono text-blue-400 truncate">
                        {m.roomId}
                      </div>

                      <button
                        onClick={() => handleCopyInviteLink(m.roomId)}
                        title="Copiar link"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                      >
                        {copiedMeetingId === m.roomId ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => handleJoinByCode(m.roomId)}
                        className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <span>Entrar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal to create custom meeting with title */}
      {showCustomMeetingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-left animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-base font-bold text-gray-100">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <span>Criar Reunião no Firebase</span>
              </div>
              <button
                onClick={() => setShowCustomMeetingModal(false)}
                className="text-xs text-gray-400 hover:text-white"
              >
                Fechar
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Dê um nome e descrição para identificar sua reunião facilmente no histórico e compartilhar com os convidados.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Título da Reunião
                </label>
                <input
                  type="text"
                  value={customMeetingTitle}
                  onChange={(e) => setCustomMeetingTitle(e.target.value)}
                  placeholder="Ex: Alinhamento de Projeto, Aula de Inglês..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[#121212] border border-white/10 text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  value={customMeetingDescription}
                  onChange={(e) => setCustomMeetingDescription(e.target.value)}
                  placeholder="Breve pauta ou instruções para os participantes..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl bg-[#121212] border border-white/10 text-gray-100 placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500/50 resize-none"
                  maxLength={150}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowCustomMeetingModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowCustomMeetingModal(false);
                  handleStartInstantMeeting(false, customMeetingTitle);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20"
              >
                Criar e Entrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
