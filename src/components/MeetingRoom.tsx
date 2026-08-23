import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield,
  Copy,
  Check,
  Grid,
  Maximize,
  Minimize,
  Layout,
  Clock,
  Lock,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import {
  Participant,
  RoomInfo,
  ChatMessage,
  FloatingReaction,
  LayoutMode,
  WaitingUser,
  DeviceSettings,
} from '../types';
import { getSocket } from '../services/socket';
import { WebRTCManager } from '../services/webrtc';
import { useMediaDevices } from '../hooks/useMediaDevices';
import { useAudioVisualizer } from '../hooks/useAudioVisualizer';
import { formatCallDuration, copyToClipboard } from '../utils/helpers';
import { recordMeetingHistory, updateMeetingInFirestore } from '../services/firebase';
import { VideoGrid } from './VideoGrid';
import { MeetingControls } from './MeetingControls';
import { ChatDrawer } from './ChatDrawer';
import { ParticipantsDrawer } from './ParticipantsDrawer';
import { InviteModal } from './InviteModal';
import { HostSecurityModal } from './HostSecurityModal';
import { DeviceSettingsModal } from './DeviceSettingsModal';
import { EmojiReactions } from './EmojiReactions';

interface MeetingRoomProps {
  initialRoom: RoomInfo;
  selfUser: Participant;
  initialParticipants: Participant[];
  initialMessages: ChatMessage[];
  initialWaitingUsers: WaitingUser[];
  initialStream?: MediaStream | null;
  onLeave: () => void;
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  initialRoom,
  selfUser,
  initialParticipants,
  initialMessages,
  initialWaitingUsers,
  initialStream,
  onLeave,
}) => {
  const [room, setRoom] = useState<RoomInfo>(initialRoom);
  const [selfParticipant, setSelfParticipant] = useState<Participant>(selfUser);
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const [waitingUsers, setWaitingUsers] = useState<WaitingUser[]>(initialWaitingUsers);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [pinnedSocketId, setPinnedSocketId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');

  // Drawers & Modals
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState<boolean>(false);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [hostNotification, setHostNotification] = useState<string | null>(null);

  // WebRTC & Media
  const {
    localStream,
    screenStream,
    audioDevices,
    videoDevices,
    audioOutputDevices,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    facingMode,
    isMobileDevice,
    settings,
    setSettings,
    setMicGain,
    startUserMedia,
    switchAudioDevice,
    switchVideoDevice,
    flipCamera,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    stopAll,
  } = useMediaDevices();

  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const activeStream = isScreenSharing && screenStream ? screenStream : localStream;

  // Record meeting participation in Firebase Firestore
  useEffect(() => {
    recordMeetingHistory({
      roomId: room.id,
      userName: selfUser.name,
      role: selfUser.isHost ? 'host' : 'participant',
      device: isMobileDevice ? 'mobile' : 'desktop',
    });

    if (selfUser.isHost) {
      updateMeetingInFirestore(room.id, {
        status: 'active',
        participantCount: participants.length,
      });
    }
  }, [room.id, selfUser.name, selfUser.isHost, isMobileDevice]);

  // Audio level meter on local stream
  useAudioVisualizer(localStream, isAudioMuted, (volume, isSpeaking) => {
    const socket = getSocket();
    socket.emit('user:speaking', {
      roomId: room.id,
      volumeLevel: volume,
      isSpeaking,
    });
  });

  // Call timer interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Media and WebRTC
  useEffect(() => {
    const rtc = new WebRTCManager();
    webrtcManagerRef.current = rtc;

    rtc.onRemoteStream((socketId, stream) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(socketId, stream);
        return next;
      });
    });

    rtc.onRemoteStreamRemoved((socketId) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    });

    // Start or seamlessly reuse local camera/mic media
    startUserMedia({
      startAudioMuted: selfUser.audioMuted,
      startVideoMuted: selfUser.videoMuted,
      existingStream: initialStream,
    }).then((stream) => {
      if (stream) {
        rtc.setLocalStream(stream);
      }
      // Initiate WebRTC mesh connections to existing participants.
      // Glare prevention: só quem tem o menor socketId inicia a oferta.
      // O outro lado espera passivamente a oferta chegar (evita corrida
      // de ofertas simultâneas, que trava a conexão sem erro visível).
      participants.forEach((p) => {
        if (p.socketId !== selfParticipant.socketId && selfParticipant.socketId < p.socketId) {
          rtc.initiateCall(p.socketId);
        }
      });
    });

    return () => {
      rtc.closeAll();
      stopAll();
    };
  }, []);

  // Update WebRTC manager when activeStream changes (e.g. screen sharing or track toggle)
  useEffect(() => {
    if (webrtcManagerRef.current && activeStream) {
      webrtcManagerRef.current.setLocalStream(activeStream);
    }
  }, [activeStream]);

  // Socket.IO meeting room listeners
  useEffect(() => {
    const socket = getSocket();

    // 1. New user joined
    const handleUserJoined = (data: { participant: Participant; systemMessage: ChatMessage }) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.socketId === data.participant.socketId)) return prev;
        return [...prev, data.participant];
      });

      setMessages((prev) => [...prev, data.systemMessage]);

      // Initiate WebRTC call to newcomer — mesma regra de desempate
      if (webrtcManagerRef.current && selfParticipant.socketId < data.participant.socketId) {
        webrtcManagerRef.current.initiateCall(data.participant.socketId);
      }
    };

    // 2. User left
    const handleUserLeft = (data: { socketId: string; participantName: string; systemMessage: ChatMessage; participants: Participant[]; newHostSocketId?: string }) => {
      setParticipants(data.participants);
      setMessages((prev) => [...prev, data.systemMessage]);

      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.removePeer(data.socketId);
      }

      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(data.socketId);
        return next;
      });

      if (pinnedSocketId === data.socketId) {
        setPinnedSocketId(null);
      }

      // Check if self became host
      if (data.newHostSocketId === socket.id) {
        setSelfParticipant((prev) => ({ ...prev, isHost: true }));
      }
    };

    // 3. User media status updated
    const handleMediaUpdated = (data: { socketId: string; audioMuted?: boolean; videoMuted?: boolean; isScreenSharing?: boolean; isHandRaised?: boolean }) => {
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.socketId === data.socketId) {
            return {
              ...p,
              audioMuted: data.audioMuted !== undefined ? data.audioMuted : p.audioMuted,
              videoMuted: data.videoMuted !== undefined ? data.videoMuted : p.videoMuted,
              isScreenSharing: data.isScreenSharing !== undefined ? data.isScreenSharing : p.isScreenSharing,
              isHandRaised: data.isHandRaised !== undefined ? data.isHandRaised : p.isHandRaised,
            };
          }
          return p;
        })
      );
    };

    // 4. Speaking level updated
    const handleSpeakingUpdated = (data: { socketId: string; volumeLevel: number; isSpeaking: boolean }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === data.socketId ? { ...p, volumeLevel: data.volumeLevel } : p))
      );
    };

    // 5. Chat message received
    const handleChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (!isChatOpen && msg.senderId !== socket.id) {
        setUnreadChatCount((prev) => prev + 1);
      }
    };

    // 6. Reaction received
    const handleReaction = (data: { id: string; emoji: string; senderId: string; senderName: string; timestamp: number }) => {
      const rx: FloatingReaction = {
        ...data,
        xOffset: (Math.random() - 0.5) * 260,
      };
      setReactions((prev) => [...prev.slice(-15), rx]);

      // Remove after 3s
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== rx.id));
      }, 3000);
    };

    // 7. Host events (Room locked, Waiting list, Host promoted, Kicked)
    const handleLockChanged = (data: { isLocked: boolean; message: string }) => {
      setRoom((prev) => ({ ...prev, isLocked: data.isLocked }));
      setHostNotification(data.message);
      setTimeout(() => setHostNotification(null), 4000);
    };

    const handlePrivateChanged = (data: { isPrivate: boolean }) => {
      setRoom((prev) => ({ ...prev, isPrivate: data.isPrivate }));
    };

    const handleWaitingRequest = (data: { waitingUser: WaitingUser; waitingList: WaitingUser[] }) => {
      setWaitingUsers(data.waitingList);
      setHostNotification(`${data.waitingUser.name} está aguardando na sala de espera.`);
      setTimeout(() => setHostNotification(null), 5000);
    };

    const handleWaitingUpdated = (data: { waitingList: WaitingUser[] }) => {
      setWaitingUsers(data.waitingList);
    };

    const handleHostPromoted = (data: { message: string }) => {
      setSelfParticipant((prev) => ({ ...prev, isHost: true }));
      setHostNotification(data.message);
      setTimeout(() => setHostNotification(null), 4000);
    };

    const handleMuteAllRequest = () => {
      if (!isAudioMuted) {
        toggleAudio();
        setHostNotification('O organizador solicitou que todos os participantes mutassem o microfone.');
        setTimeout(() => setHostNotification(null), 4000);
      }
    };

    const handleKicked = (data: { message: string }) => {
      alert(data.message || 'Você foi removido da reunião.');
      onLeave();
    };

    socket.on('user:joined', handleUserJoined);
    socket.on('user:left', handleUserLeft);
    socket.on('user:media_updated', handleMediaUpdated);
    socket.on('user:speaking_updated', handleSpeakingUpdated);
    socket.on('chat:new_message', handleChatMessage);
    socket.on('reaction:received', handleReaction);
    socket.on('room:lock_changed', handleLockChanged);
    socket.on('room:private_changed', handlePrivateChanged);
    socket.on('waiting_room:new_request', handleWaitingRequest);
    socket.on('waiting_room:updated', handleWaitingUpdated);
    socket.on('host:promoted', handleHostPromoted);
    socket.on('host:request_mute_all', handleMuteAllRequest);
    socket.on('host:kicked_you', handleKicked);

    return () => {
      socket.off('user:joined', handleUserJoined);
      socket.off('user:left', handleUserLeft);
      socket.off('user:media_updated', handleMediaUpdated);
      socket.off('user:speaking_updated', handleSpeakingUpdated);
      socket.off('chat:new_message', handleChatMessage);
      socket.off('reaction:received', handleReaction);
      socket.off('room:lock_changed', handleLockChanged);
      socket.off('room:private_changed', handlePrivateChanged);
      socket.off('waiting_room:new_request', handleWaitingRequest);
      socket.off('waiting_room:updated', handleWaitingUpdated);
      socket.off('host:promoted', handleHostPromoted);
      socket.off('host:request_mute_all', handleMuteAllRequest);
      socket.off('host:kicked_you', handleKicked);
    };
  }, [isAudioMuted, isChatOpen, onLeave, pinnedSocketId, room.id, toggleAudio]);

  // Audio / Video / Hand toggles
  const handleToggleAudio = async () => {
    const nextMuted = await toggleAudio();
    setSelfParticipant((prev) => ({ ...prev, audioMuted: nextMuted }));
    const socket = getSocket();
    socket.emit('user:update_media', {
      roomId: room.id,
      audioMuted: nextMuted,
    });
  };

  const handleToggleVideo = async () => {
    const nextMuted = await toggleVideo();
    setSelfParticipant((prev) => ({ ...prev, videoMuted: nextMuted }));
    const socket = getSocket();
    socket.emit('user:update_media', {
      roomId: room.id,
      videoMuted: nextMuted,
    });
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      setSelfParticipant((prev) => ({ ...prev, isScreenSharing: false }));
      const socket = getSocket();
      socket.emit('user:update_media', {
        roomId: room.id,
        isScreenSharing: false,
      });
    } else {
      const stream = await startScreenShare();
      if (stream) {
        setSelfParticipant((prev) => ({ ...prev, isScreenSharing: true }));
        const socket = getSocket();
        socket.emit('user:update_media', {
          roomId: room.id,
          isScreenSharing: true,
        });
      }
    }
  };

  const handleToggleHand = () => {
    const nextHand = !selfParticipant.isHandRaised;
    setSelfParticipant((prev) => ({ ...prev, isHandRaised: nextHand }));
    const socket = getSocket();
    socket.emit('user:update_media', {
      roomId: room.id,
      isHandRaised: nextHand,
    });
  };

  const handleSendReaction = (emoji: string) => {
    const socket = getSocket();
    socket.emit('reaction:send', {
      roomId: room.id,
      emoji,
      senderName: selfParticipant.name,
    });
  };

  const handleSendMessage = (text: string) => {
    const socket = getSocket();
    socket.emit('chat:message', {
      roomId: room.id,
      text,
      senderName: selfParticipant.name,
    });
  };

  // Host Actions
  const handleKickParticipant = (targetSocketId: string) => {
    if (!selfParticipant.isHost) return;
    const socket = getSocket();
    socket.emit('host:kick', {
      roomId: room.id,
      targetSocketId,
    });
  };

  const handleToggleLock = (lockState: boolean) => {
    if (!selfParticipant.isHost) return;
    const socket = getSocket();
    socket.emit('host:toggle_lock', {
      roomId: room.id,
      isLocked: lockState,
    });
  };

  const handleTogglePrivate = (privateState: boolean) => {
    if (!selfParticipant.isHost) return;
    const socket = getSocket();
    socket.emit('host:toggle_private', {
      roomId: room.id,
      isPrivate: privateState,
    });
  };

  const handleMuteAll = () => {
    if (!selfParticipant.isHost) return;
    const socket = getSocket();
    socket.emit('host:mute_all', { roomId: room.id });
    setHostNotification('Solicitação de silenciar todos enviada.');
    setTimeout(() => setHostNotification(null), 3000);
  };

  const handleAdmitWaitingUser = (targetSocketId: string, allow: boolean) => {
    if (!selfParticipant.isHost) return;
    const socket = getSocket();
    socket.emit('waiting_room:admit', {
      roomId: room.id,
      targetSocketId,
      allow,
    });
  };

  // Fullscreen sync and keyboard shortcut
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if inside input/textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleCopyCode = async () => {
    const ok = await copyToClipboard(room.id);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleSelectAudioDevice = async (deviceId: string) => {
    const updated = await switchAudioDevice(deviceId);
    if (updated && webrtcManagerRef.current) {
      webrtcManagerRef.current.setLocalStream(updated);
    }
  };

  const handleSelectVideoDevice = async (deviceId: string) => {
    const updated = await switchVideoDevice(deviceId);
    if (updated && webrtcManagerRef.current) {
      webrtcManagerRef.current.setLocalStream(updated);
    }
  };

  const handleFlipCamera = useCallback(async () => {
    const updated = await flipCamera();
    if (updated && webrtcManagerRef.current) {
      webrtcManagerRef.current.setLocalStream(updated);
    }
  }, [flipCamera]);

  return (
    <div id="meeting-room-wrapper" className="fixed inset-0 w-full h-full bg-[#050505] flex flex-col overflow-hidden select-none">
      {/* Floating Emoji Reactions Layer */}
      <EmojiReactions reactions={reactions} />

      {/* Top Header Bar */}
      <header id="meeting-top-bar" className="w-full px-4 py-2.5 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/5 flex items-center justify-between z-30 shrink-0">
        {/* Left: Meeting Name & Code */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-100 tracking-tight truncate max-w-[150px] sm:max-w-[240px]">
              {room.name}
            </h2>
            <button
              id="copy-room-code-badge"
              onClick={handleCopyCode}
              title="Copiar código da reunião"
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-gray-300 flex items-center gap-1.5 transition-all"
            >
              <span>{room.id}</span>
              {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
            </button>
          </div>

          {/* Status Badges */}
          <div className="hidden sm:flex items-center gap-1.5">
            {room.isLocked && (
              <span className="px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/80 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                Bloqueada
              </span>
            )}
            {room.isPrivate && (
              <span className="px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-800/80 text-purple-300 text-[10px] font-bold flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" />
                Privada
              </span>
            )}
          </div>
        </div>

        {/* Center: Live Timer */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-gray-300">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <span>{formatCallDuration(callDuration)}</span>
        </div>

        {/* Right: Layout Switcher & Fullscreen */}
        <div className="flex items-center gap-1.5">
          <button
            id="layout-grid-btn"
            onClick={() => {
              setLayoutMode('grid');
              setPinnedSocketId(null);
            }}
            title="Modo Grade"
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              layoutMode === 'grid' && !pinnedSocketId
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            id="layout-spotlight-btn"
            onClick={() => setLayoutMode('spotlight')}
            title="Modo Destaque / Foco"
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              layoutMode === 'spotlight' || pinnedSocketId
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10'
            }`}
          >
            <Layout className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-white/10 mx-0.5"></div>

          <button
            id="top-fullscreen-btn"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'}
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              isFullscreen
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10'
            }`}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Host Notification Toast */}
      {hostNotification && (
        <div
          id="host-toast-notification"
          className="absolute top-14 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-2xl shadow-2xl z-50 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 border border-blue-400/40"
        >
          <Sparkles className="w-4 h-4" />
          <span>{hostNotification}</span>
        </div>
      )}

      {/* Main Stage & Drawers */}
      <div className="flex-1 w-full h-full flex overflow-hidden relative">
        {/* Video Grid Canvas */}
        <div className="flex-1 h-full overflow-hidden flex flex-col">
          <VideoGrid
            participants={participants}
            selfParticipant={selfParticipant}
            localStream={activeStream}
            remoteStreams={remoteStreams}
            pinnedSocketId={pinnedSocketId}
            layoutMode={layoutMode}
            isHost={selfParticipant.isHost}
            onTogglePin={(socketId) => {
              setPinnedSocketId((curr) => (curr === socketId ? null : socketId));
            }}
            onKickParticipant={handleKickParticipant}
          />
        </div>

        {/* Chat Drawer */}
        {isChatOpen && (
          <ChatDrawer
            messages={messages}
            currentUserId={selfParticipant.socketId}
            onSendMessage={handleSendMessage}
            onClose={() => setIsChatOpen(false)}
          />
        )}

        {/* Participants Drawer */}
        {isParticipantsOpen && (
          <ParticipantsDrawer
            participants={[selfParticipant, ...participants.filter((p) => p.socketId !== selfParticipant.socketId)]}
            selfSocketId={selfParticipant.socketId}
            isHost={selfParticipant.isHost}
            waitingUsers={waitingUsers}
            meetingCode={room.id}
            onAdmitWaitingUser={handleAdmitWaitingUser}
            onMuteAll={handleMuteAll}
            onKickParticipant={handleKickParticipant}
            onClose={() => setIsParticipantsOpen(false)}
            onOpenInvite={() => setShowInviteModal(true)}
          />
        )}
      </div>

      {/* Bottom Controls Bar */}
      <MeetingControls
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        isScreenSharing={isScreenSharing}
        isHandRaised={selfParticipant.isHandRaised}
        isHost={selfParticipant.isHost}
        unreadChatCount={unreadChatCount}
        participantCount={participants.length}
        isChatOpen={isChatOpen}
        isParticipantsOpen={isParticipantsOpen}
        isFullscreen={isFullscreen}
        audioDevices={audioDevices}
        videoDevices={videoDevices}
        currentAudioId={settings.audioInputId}
        currentVideoId={settings.videoInputId}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onFlipCamera={handleFlipCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleHand={handleToggleHand}
        onSendReaction={handleSendReaction}
        onToggleChat={() => {
          setIsChatOpen(!isChatOpen);
          if (!isChatOpen) setUnreadChatCount(0);
          if (isParticipantsOpen) setIsParticipantsOpen(false);
        }}
        onToggleParticipants={() => {
          setIsParticipantsOpen(!isParticipantsOpen);
          if (isChatOpen) setIsChatOpen(false);
        }}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenInvite={() => setShowInviteModal(true)}
        onOpenSecurity={() => setShowSecurityModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onSelectAudioDevice={handleSelectAudioDevice}
        onSelectVideoDevice={handleSelectVideoDevice}
        onLeaveMeeting={onLeave}
      />

      {/* Modals */}
      {showInviteModal && (
        <InviteModal
          meetingCode={room.id}
          meetingName={room.name}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {showSecurityModal && (
        <HostSecurityModal
          isLocked={room.isLocked}
          isPrivate={room.isPrivate}
          onToggleLock={handleToggleLock}
          onTogglePrivate={handleTogglePrivate}
          onMuteAll={handleMuteAll}
          onClose={() => setShowSecurityModal(false)}
        />
      )}

      {showSettingsModal && (
        <DeviceSettingsModal
          settings={settings}
          audioDevices={audioDevices}
          videoDevices={videoDevices}
          audioOutputDevices={audioOutputDevices}
          onUpdateSettings={async (newSettings) => {
            setSettings((prev) => ({ ...prev, ...newSettings }));
            if (newSettings.audioInputId !== undefined && newSettings.audioInputId !== settings.audioInputId) {
              const updated = await switchAudioDevice(newSettings.audioInputId);
              if (updated && webrtcManagerRef.current) {
                webrtcManagerRef.current.setLocalStream(updated);
              }
            }
            if (newSettings.videoInputId !== undefined && newSettings.videoInputId !== settings.videoInputId) {
              const updated = await switchVideoDevice(newSettings.videoInputId);
              if (updated && webrtcManagerRef.current) {
                webrtcManagerRef.current.setLocalStream(updated);
              }
            }
          }}
          onMicGainChange={(gain) => setMicGain(gain)}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
};