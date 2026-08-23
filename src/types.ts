export interface Participant {
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

export interface WaitingUser {
  socketId: string;
  id: string;
  name: string;
  avatarColor: string;
  requestedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
  type: 'text' | 'system' | 'reaction';
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  xOffset: number; // For randomized horizontal drift
}

export interface RoomInfo {
  id: string;
  name: string;
  isLocked: boolean;
  isPrivate: boolean;
  createdAt: number;
}

export type LayoutMode = 'grid' | 'spotlight' | 'sidebar';

export interface DeviceSettings {
  audioInputId: string;
  videoInputId: string;
  audioOutputId: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
}

export interface PeerConnectionState {
  peerConnection: RTCPeerConnection;
  remoteStream: MediaStream;
}
