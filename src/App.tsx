import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { MeetingRoom } from './components/MeetingRoom';
import { WaitingRoomOverlay } from './components/WaitingRoomOverlay';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { getSocket, disconnectSocket } from './services/socket';
import { RoomInfo, Participant, ChatMessage, WaitingUser } from './types';
import { parseMeetingCode } from './utils/helpers';
import { AlertCircle, CheckCircle2, Shield, Info, HelpCircle, Smartphone } from 'lucide-react';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('meetpulse_theme') === 'light' ? false : true;
  });

  const [viewState, setViewState] = useState<'home' | 'waiting_room' | 'in_meeting'>('home');
  const [initialRoomCode, setInitialRoomCode] = useState<string>('');

  // Meeting State
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [selfUser, setSelfUser] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [waitingUsers, setWaitingUsers] = useState<WaitingUser[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  // Apply dark mode class to root HTML
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('meetpulse_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('meetpulse_theme', 'light');
    }
  }, [darkMode]);

  // Check URL query parameters for ?room=xyz
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      const parsed = parseMeetingCode(roomParam);
      if (parsed) {
        setInitialRoomCode(parsed);
      }
    }
  }, []);

  // Socket global listeners for room entry
  useEffect(() => {
    const socket = getSocket();

    const handleRoomJoined = (data: {
      room: RoomInfo;
      self: Participant;
      participants: Participant[];
      messages: ChatMessage[];
      waitingUsers: WaitingUser[];
    }) => {
      setCurrentRoom(data.room);
      setSelfUser(data.self);
      setParticipants(data.participants);
      setMessages(data.messages);
      setWaitingUsers(data.waitingUsers);
      setViewState('in_meeting');
      setErrorMessage(null);

      // Save to recent rooms in local storage
      try {
        const existing = JSON.parse(localStorage.getItem('meetpulse_recent_rooms') || '[]');
        const filtered = existing.filter((r: { id: string }) => r.id !== data.room.id);
        const updated = [
          {
            id: data.room.id,
            name: data.room.name,
            date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          },
          ...filtered,
        ].slice(0, 8);
        localStorage.setItem('meetpulse_recent_rooms', JSON.stringify(updated));
      } catch {
        // ignore
      }

      // Update URL without full reload
      const newUrl = `${window.location.pathname}?room=${data.room.id}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    };

    const handleWaitingRoomStatus = () => {
      setViewState('waiting_room');
    };

    const handleWaitingRoomRejected = (data: { message: string }) => {
      setViewState('home');
      setErrorMessage(data.message || 'Sua solicitação de entrada foi recusada pelo organizador.');
    };

    const handleRoomError = (data: { code: string; message: string }) => {
      setViewState('home');
      setErrorMessage(data.message || 'Não foi possível entrar na reunião.');
    };

    const handleConnectError = () => {
      setViewState('home');
      setErrorMessage('Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente em instantes.');
    };

    socket.on('room:joined', handleRoomJoined);
    socket.on('waiting_room:status', handleWaitingRoomStatus);
    socket.on('waiting_room:rejected', handleWaitingRoomRejected);
    socket.on('room:error', handleRoomError);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('room:joined', handleRoomJoined);
      socket.off('waiting_room:status', handleWaitingRoomStatus);
      socket.off('connect_error', handleConnectError);
      socket.off('waiting_room:rejected', handleWaitingRoomRejected);
      socket.off('room:error', handleRoomError);
    };
  }, []);

  // Handlers for starting and joining
  const handleStartMeeting = (options: {
    roomId: string;
    userName: string;
    isPrivate: boolean;
    startAudioMuted: boolean;
    startVideoMuted: boolean;
    avatarColor: string;
    meetingTitle?: string;
    stream?: MediaStream | null;
  }) => {
    const socket = getSocket();
    const userId = `user_${Math.random().toString(36).substring(2, 9)}`;

    if (options.stream) {
      setActiveStream(options.stream);
    }

    setSelfUser({
      socketId: socket.id || '',
      id: userId,
      name: options.userName,
      avatarColor: options.avatarColor,
      isHost: true,
      audioMuted: options.startAudioMuted,
      videoMuted: options.startVideoMuted,
      isScreenSharing: false,
      isHandRaised: false,
      volumeLevel: 0,
    });

    socket.emit('room:create', {
      roomId: options.roomId,
      roomName: options.meetingTitle || `Reunião ${options.roomId}`,
      user: {
        id: userId,
        name: options.userName,
        avatarColor: options.avatarColor,
        audioMuted: options.startAudioMuted,
        videoMuted: options.startVideoMuted,
      },
      isPrivate: options.isPrivate,
    });
  };

  const handleJoinMeeting = (options: {
    roomId: string;
    userName: string;
    startAudioMuted: boolean;
    startVideoMuted: boolean;
    avatarColor: string;
    stream?: MediaStream | null;
  }) => {
    const socket = getSocket();
    const userId = `user_${Math.random().toString(36).substring(2, 9)}`;

    if (options.stream) {
      setActiveStream(options.stream);
    }

    setSelfUser({
      socketId: socket.id || '',
      id: userId,
      name: options.userName,
      avatarColor: options.avatarColor,
      isHost: false,
      audioMuted: options.startAudioMuted,
      videoMuted: options.startVideoMuted,
      isScreenSharing: false,
      isHandRaised: false,
      volumeLevel: 0,
    });

    socket.emit('room:join', {
      roomId: options.roomId,
      user: {
        id: userId,
        name: options.userName,
        avatarColor: options.avatarColor,
        audioMuted: options.startAudioMuted,
        videoMuted: options.startVideoMuted,
      },
    });
  };

  const handleLeaveMeeting = () => {
    const socket = getSocket();
    socket.emit('room:leave');
    setCurrentRoom(null);
    setActiveStream(null);
    setViewState('home');

    // Clean URL param
    const cleanUrl = window.location.pathname;
    window.history.pushState({ path: cleanUrl }, '', cleanUrl);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      darkMode ? 'bg-[#050505] text-gray-100' : 'bg-gray-50 text-gray-900'
    }`}>
      {/* Show Error Toast if any */}
      {errorMessage && (
        <div
          id="global-error-toast"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4"
        >
          <div className="p-4 bg-red-600/90 backdrop-blur-md text-white rounded-2xl shadow-2xl flex items-start justify-between gap-3 border border-red-500/40">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs font-semibold">{errorMessage}</div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-white/80 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Screen Routing with Smooth Framer Motion transitions */}
      <AnimatePresence mode="wait">
        {viewState === 'home' && (
          <motion.div
            key="home-screen"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col w-full"
          >
            <Header
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode(!darkMode)}
              onOpenHelp={() => setShowHelpModal(true)}
            />
            <HomeView
              onStartMeeting={handleStartMeeting}
              onJoinMeeting={handleJoinMeeting}
              initialRoomCode={initialRoomCode}
            />
          </motion.div>
        )}

        {viewState === 'waiting_room' && selfUser && (
          <motion.div
            key="waiting-room-screen"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -15 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 w-full h-full"
          >
            <WaitingRoomOverlay
              meetingCode={initialRoomCode || (currentRoom ? currentRoom.id : '')}
              userName={selfUser.name}
              onCancel={handleLeaveMeeting}
            />
          </motion.div>
        )}

        {viewState === 'in_meeting' && currentRoom && selfUser && (
          <motion.div
            key="meeting-room-screen"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97, filter: 'blur(6px)' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 w-full h-full"
          >
            <MeetingRoom
              initialRoom={currentRoom}
              selfUser={selfUser}
              initialParticipants={participants}
              initialMessages={messages}
              initialWaitingUsers={waitingUsers}
              onLeave={handleLeaveMeeting}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating PWA Install Banner */}
      <PWAInstallBanner />

      {/* Help & Guide Modal */}
      {showHelpModal && (
        <div
          id="help-guide-modal-backdrop"
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div
            id="help-guide-modal"
            className="w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-gray-100">
                  Guia do MeetPulse
                </h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-300">
              <div className="p-3 rounded-xl bg-[#121212] border border-white/5 space-y-1">
                <div className="font-bold text-gray-100 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                  <span>📱 Aplicativo PWA (Celular & Computador)</span>
                </div>
                <div>Instale o MeetPulse no seu celular (Android/iOS) ou no computador clicando em "Instalar App" no topo para ter acesso rápido como um app nativo sem barras de navegador.</div>
              </div>

              <div className="p-3 rounded-xl bg-[#121212] border border-white/5 space-y-1">
                <div className="font-bold text-gray-100">📹 Como convidar pessoas?</div>
                <div>Dentro da chamada, clique no botão "Convidar" no topo ou na barra de ferramentas para copiar o link direto ou enviar pelo WhatsApp.</div>
              </div>

              <div className="p-3 rounded-xl bg-[#121212] border border-white/5 space-y-1">
                <div className="font-bold text-gray-100">🔐 Segurança & Sala de Espera</div>
                <div>Como organizador, você pode bloquear a reunião para impedir novas entradas ou ativar a Sala de Espera para aprovar manualmente cada convidado.</div>
              </div>

              <div className="p-3 rounded-xl bg-[#121212] border border-white/5 space-y-1">
                <div className="font-bold text-gray-100">🖥️ Compartilhamento de Tela & Emojis</div>
                <div>Compartilhe apresentações, abas ou janelas inteiras com áudio do sistema, e envie reações flutuantes em tempo real com efeitos comemorativos.</div>
              </div>

              <div className="p-3 rounded-xl bg-[#121212] border border-white/5 space-y-1">
                <div className="font-bold text-gray-100">⛶ Modo Tela Cheia</div>
                <div>Clique no ícone de tela cheia no cabeçalho ou na barra de ferramentas, use o atalho <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-blue-400 font-mono text-[10px]">F</kbd>, ou dê um clique duplo sobre qualquer vídeo para expandi-lo individualmente.</div>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}