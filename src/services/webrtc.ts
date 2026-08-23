import { getSocket } from './socket';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // TURN é necessário quando STUN sozinho não fecha a conexão
    // (NAT simétrico, redes corporativas, algumas 4G/5G).
    // OpenRelay (Metered) é gratuito, sem cadastro, com limite de banda.
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

export interface RemotePeer {
  socketId: string;
  peerConnection: RTCPeerConnection;
  stream: MediaStream;
  pendingCandidates: RTCIceCandidateInit[];
}

export class WebRTCManager {
  private peers: Map<string, RemotePeer> = new Map();
  private localStream: MediaStream | null = null;
  private onRemoteStreamCallback: ((socketId: string, stream: MediaStream) => void) | null = null;
  private onRemoteStreamRemovedCallback: ((socketId: string) => void) | null = null;

  constructor() {
    this.setupSocketListeners();
  }

  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;

    if (!this.localStream) return;

    // Update existing peer connections with the new stream tracks
    this.peers.forEach((peer) => {
      const senders = peer.peerConnection.getSenders();
      this.localStream?.getTracks().forEach((track) => {
        const sender = senders.find((s) => (s.track ? s.track.kind === track.kind : false));
        if (sender) {
          sender.replaceTrack(track).catch((err) => {
            console.warn('[WebRTC] Error replacing track:', err);
          });
        } else {
          const emptySender = senders.find((s) => !s.track);
          if (emptySender) {
            emptySender.replaceTrack(track).catch((err) => {
              console.warn('[WebRTC] Error replacing track on empty sender:', err);
            });
          } else {
            try {
              peer.peerConnection.addTrack(track, this.localStream!);
            } catch (err) {
              console.warn('[WebRTC] Error adding track:', err);
            }
          }
        }
      });
    });
  }

  public onRemoteStream(callback: (socketId: string, stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  public onRemoteStreamRemoved(callback: (socketId: string) => void) {
    this.onRemoteStreamRemovedCallback = callback;
  }

  private setupSocketListeners() {
    const socket = getSocket();

    // 1. Receive Offer
    socket.on('webrtc:offer', async (data: { senderSocketId: string; offer: RTCSessionDescriptionInit }) => {
      try {
        const peer = this.getOrCreatePeer(data.senderSocketId);
        await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

        // Process any queued ICE candidates
        while (peer.pendingCandidates.length > 0) {
          const candidate = peer.pendingCandidates.shift();
          if (candidate) {
            await peer.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
          }
        }

        const answer = await peer.peerConnection.createAnswer();
        await peer.peerConnection.setLocalDescription(answer);

        socket.emit('webrtc:answer', {
          targetSocketId: data.senderSocketId,
          answer,
        });
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    });

    // 2. Receive Answer
    socket.on('webrtc:answer', async (data: { senderSocketId: string; answer: RTCSessionDescriptionInit }) => {
      try {
        const peer = this.peers.get(data.senderSocketId);
        if (peer) {
          await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));

          // Process any queued ICE candidates
          while (peer.pendingCandidates.length > 0) {
            const candidate = peer.pendingCandidates.shift();
            if (candidate) {
              await peer.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
            }
          }
        }
      } catch (err) {
        console.error('[WebRTC] Error handling answer:', err);
      }
    });

    // 3. Receive ICE Candidate
    socket.on('webrtc:ice_candidate', async (data: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
      try {
        const peer = this.peers.get(data.senderSocketId);
        if (peer) {
          if (peer.peerConnection.remoteDescription) {
            await peer.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.warn);
          } else {
            peer.pendingCandidates.push(data.candidate);
          }
        }
      } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
      }
    });
  }

  public async initiateCall(targetSocketId: string) {
    try {
      const peer = this.getOrCreatePeer(targetSocketId);
      const offer = await peer.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await peer.peerConnection.setLocalDescription(offer);

      const socket = getSocket();
      socket.emit('webrtc:offer', {
        targetSocketId,
        offer,
      });
    } catch (err) {
      console.error('[WebRTC] Error initiating call to', targetSocketId, err);
    }
  }

  private getOrCreatePeer(targetSocketId: string): RemotePeer {
    let peer = this.peers.get(targetSocketId);
    if (peer) return peer;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    const remoteStream = new MediaStream();

    peer = {
      socketId: targetSocketId,
      peerConnection: pc,
      stream: remoteStream,
      pendingCandidates: [],
    };

    // Add local tracks if available
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket.emit('webrtc:ice_candidate', {
          targetSocketId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle Incoming remote tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
            remoteStream.addTrack(track);
          }
        });
      } else if (event.track) {
        if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }
      }

      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(targetSocketId, new MediaStream(remoteStream.getTracks()));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(targetSocketId);
      }
    };

    this.peers.set(targetSocketId, peer);
    return peer;
  }

  public removePeer(socketId: string) {
    const peer = this.peers.get(socketId);
    if (peer) {
      peer.peerConnection.close();
      this.peers.delete(socketId);
      if (this.onRemoteStreamRemovedCallback) {
        this.onRemoteStreamRemovedCallback(socketId);
      }
    }
  }

  public getRemoteStream(socketId: string): MediaStream | undefined {
    return this.peers.get(socketId)?.stream;
  }

  public closeAll() {
    this.peers.forEach((peer) => {
      peer.peerConnection.close();
    });
    this.peers.clear();
  }
}