import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';

interface Participant {
  socketId: string;
  id: string;
  name: string;
  avatarColor: string;
  isHost: boolean;
  audioMuted: boolean;
  videoMuted: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  volumeLevel: number;
}

interface WaitingUser {
  socketId: string;
  id: string;
  name: string;
  avatarColor: string;
  requestedAt: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
  type: 'text' | 'system' | 'reaction';
}

interface Room {
  id: string;
  name: string;
  hostSocketId: string;
  isLocked: boolean;
  isPrivate: boolean;
  createdAt: number;
  participants: Map<string, Participant>;
  waitingRoom: Map<string, WaitingUser>;
  chatMessages: ChatMessage[];
}

const rooms = new Map<string, Room>();

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Initialize Socket.io with permissive CORS for development and cross-origin usage
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  app.use(express.json());

  // API endpoints
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      activeRooms: rooms.size,
      uptime: process.uptime(),
    });
  });

  app.get('/api/rooms/:roomId', (req, res) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId.toLowerCase().trim());
    if (!room) {
      return res.status(404).json({ exists: false, error: 'Reunião não encontrada' });
    }
    return res.json({
      exists: true,
      id: room.id,
      name: room.name,
      participantCount: room.participants.size,
      isLocked: room.isLocked,
      isPrivate: room.isPrivate,
      createdAt: room.createdAt,
    });
  });

  // Socket.IO signaling & room logic
  io.on('connection', (socket) => {
    let currentRoomId: string | null = null;
    let currentUser: Participant | null = null;

    // 1. Create room
    socket.on('room:create', (data: { roomId: string; roomName?: string; user: { id: string; name: string; avatarColor?: string; audioMuted?: boolean; videoMuted?: boolean }; isPrivate?: boolean }) => {
      const roomId = data.roomId.toLowerCase().trim();
      const hostUser: Participant = {
        socketId: socket.id,
        id: data.user.id,
        name: data.user.name || 'Organizador',
        avatarColor: data.user.avatarColor || '#3B82F6',
        isHost: true,
        audioMuted: !!data.user.audioMuted,
        videoMuted: !!data.user.videoMuted,
        isScreenSharing: false,
        isHandRaised: false,
        volumeLevel: 0,
      };

      const room: Room = {
        id: roomId,
        name: data.roomName || `Reunião ${roomId}`,
        hostSocketId: socket.id,
        isLocked: false,
        isPrivate: !!data.isPrivate,
        createdAt: Date.now(),
        participants: new Map([[socket.id, hostUser]]),
        waitingRoom: new Map(),
        chatMessages: [
          {
            id: 'sys-start',
            senderId: 'system',
            senderName: 'Sistema',
            text: `Reunião iniciada por ${hostUser.name}.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'system',
          },
        ],
      };

      rooms.set(roomId, room);
      socket.join(roomId);
      currentRoomId = roomId;
      currentUser = hostUser;

      socket.emit('room:joined', {
        room: {
          id: room.id,
          name: room.name,
          isLocked: room.isLocked,
          isPrivate: room.isPrivate,
          createdAt: room.createdAt,
        },
        self: hostUser,
        participants: Array.from(room.participants.values()),
        messages: room.chatMessages,
        waitingUsers: [],
      });
    });

    // 2. Join room request
    socket.on('room:join', (data: { roomId: string; user: { id: string; name: string; avatarColor?: string; audioMuted?: boolean; videoMuted?: boolean } }) => {
      const roomId = data.roomId.toLowerCase().trim();
      const room = rooms.get(roomId);

      if (!room) {
        // Automatically create if not exists
        const hostUser: Participant = {
          socketId: socket.id,
          id: data.user.id,
          name: data.user.name || 'Participante',
          avatarColor: data.user.avatarColor || '#10B981',
          isHost: true,
          audioMuted: !!data.user.audioMuted,
          videoMuted: !!data.user.videoMuted,
          isScreenSharing: false,
          isHandRaised: false,
          volumeLevel: 0,
        };

        const newRoom: Room = {
          id: roomId,
          name: `Reunião ${roomId}`,
          hostSocketId: socket.id,
          isLocked: false,
          isPrivate: false,
          createdAt: Date.now(),
          participants: new Map([[socket.id, hostUser]]),
          waitingRoom: new Map(),
          chatMessages: [
            {
              id: 'sys-start',
              senderId: 'system',
              senderName: 'Sistema',
              text: `Reunião criada por ${hostUser.name}.`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'system',
            },
          ],
        };

        rooms.set(roomId, newRoom);
        socket.join(roomId);
        currentRoomId = roomId;
        currentUser = hostUser;

        socket.emit('room:joined', {
          room: {
            id: newRoom.id,
            name: newRoom.name,
            isLocked: newRoom.isLocked,
            isPrivate: newRoom.isPrivate,
            createdAt: newRoom.createdAt,
          },
          self: hostUser,
          participants: Array.from(newRoom.participants.values()),
          messages: newRoom.chatMessages,
          waitingUsers: [],
        });
        return;
      }

      // Check if room is locked
      if (room.isLocked) {
        socket.emit('room:error', {
          code: 'ROOM_LOCKED',
          message: 'Esta reunião está bloqueada pelo organizador. Não é possível entrar no momento.',
        });
        return;
      }

      // Check if room is private / requires waiting room approval (and user is not host)
      if (room.isPrivate && socket.id !== room.hostSocketId) {
        const waitingUser: WaitingUser = {
          socketId: socket.id,
          id: data.user.id,
          name: data.user.name || 'Convidado',
          avatarColor: data.user.avatarColor || '#8B5CF6',
          requestedAt: Date.now(),
        };
        room.waitingRoom.set(socket.id, waitingUser);
        currentRoomId = roomId;

        socket.emit('waiting_room:status', {
          status: 'waiting',
          message: 'Aguardando autorização do organizador para entrar...',
        });

        // Notify host
        io.to(room.hostSocketId).emit('waiting_room:new_request', {
          waitingUser,
          waitingList: Array.from(room.waitingRoom.values()),
        });
        return;
      }

      // Direct entry
      const participant: Participant = {
        socketId: socket.id,
        id: data.user.id,
        name: data.user.name || 'Participante',
        avatarColor: data.user.avatarColor || '#3B82F6',
        isHost: false,
        audioMuted: !!data.user.audioMuted,
        videoMuted: !!data.user.videoMuted,
        isScreenSharing: false,
        isHandRaised: false,
        volumeLevel: 0,
      };

      room.participants.set(socket.id, participant);
      socket.join(roomId);
      currentRoomId = roomId;
      currentUser = participant;

      const joinMsg: ChatMessage = {
        id: `sys-join-${Date.now()}-${socket.id.slice(0, 4)}`,
        senderId: 'system',
        senderName: 'Sistema',
        text: `${participant.name} entrou na reunião.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
      };
      room.chatMessages.push(joinMsg);

      // Send joined info to newcomer
      socket.emit('room:joined', {
        room: {
          id: room.id,
          name: room.name,
          isLocked: room.isLocked,
          isPrivate: room.isPrivate,
          createdAt: room.createdAt,
        },
        self: participant,
        participants: Array.from(room.participants.values()),
        messages: room.chatMessages,
        waitingUsers: socket.id === room.hostSocketId ? Array.from(room.waitingRoom.values()) : [],
      });

      // Broadcast to other participants in the room
      socket.to(roomId).emit('user:joined', {
        participant,
        systemMessage: joinMsg,
      });
    });

    // 3. Host admits / rejects waiting user
    socket.on('waiting_room:admit', (data: { roomId: string; targetSocketId: string; allow: boolean }) => {
      const room = rooms.get(data.roomId.toLowerCase().trim());
      if (!room || socket.id !== room.hostSocketId) return;

      const waitingUser = room.waitingRoom.get(data.targetSocketId);
      if (!waitingUser) return;

      room.waitingRoom.delete(data.targetSocketId);

      // Notify host of updated waiting list
      io.to(room.hostSocketId).emit('waiting_room:updated', {
        waitingList: Array.from(room.waitingRoom.values()),
      });

      if (!data.allow) {
        io.to(data.targetSocketId).emit('waiting_room:rejected', {
          message: 'O organizador recusou a sua solicitação para entrar na reunião.',
        });
        return;
      }

      // Admitted! Add participant
      const targetSocket = io.sockets.sockets.get(data.targetSocketId);
      if (targetSocket) {
        const participant: Participant = {
          socketId: data.targetSocketId,
          id: waitingUser.id,
          name: waitingUser.name,
          avatarColor: waitingUser.avatarColor,
          isHost: false,
          audioMuted: false,
          videoMuted: false,
          isScreenSharing: false,
          isHandRaised: false,
          volumeLevel: 0,
        };

        room.participants.set(data.targetSocketId, participant);
        targetSocket.join(room.id);

        const joinMsg: ChatMessage = {
          id: `sys-admit-${Date.now()}`,
          senderId: 'system',
          senderName: 'Sistema',
          text: `${participant.name} foi autorizado a entrar.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'system',
        };
        room.chatMessages.push(joinMsg);

        targetSocket.emit('room:joined', {
          room: {
            id: room.id,
            name: room.name,
            isLocked: room.isLocked,
            isPrivate: room.isPrivate,
            createdAt: room.createdAt,
          },
          self: participant,
          participants: Array.from(room.participants.values()),
          messages: room.chatMessages,
          waitingUsers: [],
        });

        targetSocket.to(room.id).emit('user:joined', {
          participant,
          systemMessage: joinMsg,
        });
      }
    });

    // 4. WebRTC Signaling Events
    socket.on('webrtc:offer', (data: { targetSocketId: string; offer: RTCSessionDescriptionInit; senderId?: string }) => {
      io.to(data.targetSocketId).emit('webrtc:offer', {
        senderSocketId: socket.id,
        offer: data.offer,
      });
    });

    socket.on('webrtc:answer', (data: { targetSocketId: string; answer: RTCSessionDescriptionInit }) => {
      io.to(data.targetSocketId).emit('webrtc:answer', {
        senderSocketId: socket.id,
        answer: data.answer,
      });
    });

    socket.on('webrtc:ice_candidate', (data: { targetSocketId: string; candidate: RTCIceCandidateInit }) => {
      io.to(data.targetSocketId).emit('webrtc:ice_candidate', {
        senderSocketId: socket.id,
        candidate: data.candidate,
      });
    });

    // 5. Media & Status updates
    socket.on('user:update_media', (data: { roomId: string; audioMuted?: boolean; videoMuted?: boolean; isScreenSharing?: boolean; isHandRaised?: boolean }) => {
      const room = rooms.get(data.roomId.toLowerCase().trim());
      if (!room) return;

      const p = room.participants.get(socket.id);
      if (p) {
        if (data.audioMuted !== undefined) p.audioMuted = data.audioMuted;
        if (data.videoMuted !== undefined) p.videoMuted = data.videoMuted;
        if (data.isScreenSharing !== undefined) p.isScreenSharing = data.isScreenSharing;
        if (data.isHandRaised !== undefined) p.isHandRaised = data.isHandRaised;

        socket.to(room.id).emit('user:media_updated', {
          socketId: socket.id,
          audioMuted: p.audioMuted,
          videoMuted: p.videoMuted,
          isScreenSharing: p.isScreenSharing,
          isHandRaised: p.isHandRaised,
        });
      }
    });

    // 6. Speaking Level (throttled audio energy for active speaker indicator)
    socket.on('user:speaking', (data: { roomId: string; volumeLevel: number; isSpeaking: boolean }) => {
      const room = rooms.get(data.roomId.toLowerCase().trim());
      if (!room) return;

      const p = room.participants.get(socket.id);
      if (p) {
        p.volumeLevel = data.volumeLevel;
        socket.to(room.id).emit('user:speaking_updated', {
          socketId: socket.id,
          volumeLevel: data.volumeLevel,
          isSpeaking: data.isSpeaking,
        });
      }
    });

    // 7. Chat messages
    socket.on('chat:message', (data: { roomId: string; text: string; senderName?: string }) => {
      const room = rooms.get(data.roomId.toLowerCase().trim());
      if (!room) return;

      const p = room.participants.get(socket.id);
      const senderName = p ? p.name : data.senderName || 'Participante';

      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        senderId: socket.id,
        senderName,
        text: data.text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text',
      };

      room.chatMessages.push(msg);
      // Keep only last 150 messages in memory
      if (room.chatMessages.length > 150) {
        room.chatMessages.shift();
      }

      io.to(room.id).emit('chat:new_message', msg);
    });

    // 8. Reactions
    socket.on('reaction:send', (data: { roomId: string; emoji: string; senderName?: string }) => {
      const room = rooms.get(data.roomId.toLowerCase().trim());
      if (!room) return;

      const p = room.participants.get(socket.id);
      const senderName = p ? p.name : data.senderName || 'Participante';

      io.to(room.id).emit('reaction:received', {
        id: `rx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        emoji: data.emoji,
        senderId: socket.id,
        senderName,
        timestamp: Date.now(),
      });
    });

    // 9. Host controls: Kick participant
    socket.on('host:kick', (data: { roomId: string; targetSocketId: string }) => {
      const room = rooms.get(data.roomId.toLowerCase().trim());
      if (!room || socket.id !== room.hostSocketId) return;

      const targetParticipant = room.participants.get(data.targetSocketId);
      if (targetParticipant) {
        room.participants.delete(data.targetSocketId);

        const targetSocket = io.sockets.sockets.get(data.targetSocketId);
        if (targetSocket) {
          targetSocket.leave(room.id);
          targetSocket.emit('host:kicked_you', {
            message: 'Você foi removido da reunião pelo organizador.',
          });
        }

        const kickMsg: ChatMessage = {
          id: `sys-kick-${Date.now()}`,
          senderId: 'system',
          senderName: 'Sistema',
          text: `${targetParticipant.name} foi removido pelo organizador.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'system',
        };
        room.chatMessages.push(kickMsg);

        io.to(room.id).emit('user:left', {
          socketId: data.targetSocketId,
          participantName: targetParticipant.name,
          systemMessage: kickMsg,
          participants: Array.from(room.participants.values()),
        });
      }
    });

    // 10. Host controls: Lock/Unlock room
    socket.on('host:toggle_lock', (data: { roomId: string; isLocked: boolean }) => {
      const room = rooms.get(data.roomId.toLowerCase().trim());
      if (!room || socket.id !== room.hostSocketId) return;

      room.isLocked = data.isLocked;
      io.to(room.id).emit('room:lock_changed', {
        isLocked: room.isLocked,
        message: room.isLocked
          ? 'O organizador bloqueou a reunião. Novos participantes não podem entrar.'
          : 'O organizador desbloqueou a reunião.',
      });
    });

    // 11. Host controls: Toggle Private / Waiting Room
    socket.on('host:toggle_private', (data: { roomId: string; isPrivate: boolean }) => {
      const room = rooms.get(data.roomId.toLowerCase().trim());
      if (!room || socket.id !== room.hostSocketId) return;

      room.isPrivate = data.isPrivate;
      io.to(room.id).emit('room:private_changed', {
        isPrivate: room.isPrivate,
      });
    });

    // 12. Host controls: Mute all
    socket.on('host:mute_all', (data: { roomId: string }) => {
      const room = rooms.get(data.roomId.toLowerCase().trim());
      if (!room || socket.id !== room.hostSocketId) return;

      socket.to(room.id).emit('host:request_mute_all');
    });

    // 13. Disconnect & Leave
    const handleLeave = () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      // Check if was in waiting room
      if (room.waitingRoom.has(socket.id)) {
        room.waitingRoom.delete(socket.id);
        io.to(room.hostSocketId).emit('waiting_room:updated', {
          waitingList: Array.from(room.waitingRoom.values()),
        });
      }

      // Check if was active participant
      const participant = room.participants.get(socket.id);
      if (participant) {
        room.participants.delete(socket.id);

        const leaveMsg: ChatMessage = {
          id: `sys-leave-${Date.now()}-${socket.id.slice(0, 4)}`,
          senderId: 'system',
          senderName: 'Sistema',
          text: `${participant.name} saiu da reunião.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'system',
        };
        room.chatMessages.push(leaveMsg);

        // If host left and there are other participants, assign next participant as host
        if (participant.isHost && room.participants.size > 0) {
          const nextHostSocketId = Array.from(room.participants.keys())[0];
          const nextHost = room.participants.get(nextHostSocketId);
          if (nextHost) {
            nextHost.isHost = true;
            room.hostSocketId = nextHostSocketId;
            io.to(nextHostSocketId).emit('host:promoted', {
              message: 'Você agora é o organizador desta reunião.',
            });
          }
        }

        io.to(currentRoomId).emit('user:left', {
          socketId: socket.id,
          participantName: participant.name,
          systemMessage: leaveMsg,
          participants: Array.from(room.participants.values()),
          newHostSocketId: room.hostSocketId,
        });

        // Clean up empty rooms after 5 minutes
        if (room.participants.size === 0) {
          setTimeout(() => {
            const currentCheck = rooms.get(room.id);
            if (currentCheck && currentCheck.participants.size === 0) {
              rooms.delete(room.id);
            }
          }, 300000);
        }
      }

      socket.leave(currentRoomId);
      currentRoomId = null;
      currentUser = null;
    };

    socket.on('room:leave', handleLeave);
    socket.on('disconnect', handleLeave);
  });

  // Set Service-Worker headers
  app.get('/sw.js', (req, res, next) => {
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`MeetPulse Video Conferencing server running on http://localhost:${PORT}`);
  });
}

startServer();
