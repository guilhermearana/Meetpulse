import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceSettings } from '../types';

export function useMediaDevices() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const isMobileDevice = typeof window !== 'undefined' && (
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
  );

  const [settings, setSettings] = useState<DeviceSettings>({
    audioInputId: '',
    videoInputId: '',
    audioOutputId: '',
    noiseSuppression: true,
    echoCancellation: true,
    micGain: 5, // 0-10, onde 5 = ganho neutro (1x)
  });

  // Web Audio API: usado para aplicar boost manual de ganho no microfone,
  // já que o autoGainControl do navegador nem sempre normaliza bem
  // (comum em Chrome Android com mic embutido).
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Converte a escala 0-10 (UI) para um multiplicador de ganho real.
  // 5 = 1x (neutro), 0 = mudo, 10 = 3x de amplificação.
  const gainScaleToMultiplier = (scale: number) => {
    const clamped = Math.max(0, Math.min(10, scale));
    if (clamped <= 5) return clamped / 5; // 0..5 -> 0..1x
    return 1 + ((clamped - 5) / 5) * 2; // 5..10 -> 1x..3x
  };

  // Aplica o GainNode numa audio track crua, retornando uma nova track
  // já processada (a track original é mantida rodando por baixo, o
  // navegador cuida do roteamento). Reaproveita o mesmo AudioContext.
  const applyMicGain = useCallback((audioTrack: MediaStreamTrack, gainScale: number): MediaStreamTrack => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      const gainNode = ctx.createGain();
      gainNode.gain.value = gainScaleToMultiplier(gainScale);
      const destination = ctx.createMediaStreamDestination();
      source.connect(gainNode).connect(destination);
      gainNodeRef.current = gainNode;
      const processedTrack = destination.stream.getAudioTracks()[0];
      processedTrack.enabled = audioTrack.enabled;
      return processedTrack;
    } catch (err) {
      console.warn('[useMediaDevices] Error applying mic gain, using raw track:', err);
      return audioTrack;
    }
  }, []);

  // Ajusta o ganho em tempo real (0-10), sem precisar reabrir o microfone.
  const setMicGain = useCallback((gainScale: number) => {
    setSettings((prev) => ({ ...prev, micGain: gainScale }));
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = gainScaleToMultiplier(gainScale);
    }
  }, []);

  const localStreamRef = useRef<MediaStream | null>(null);
  localStreamRef.current = localStream;

  const isAudioMutedRef = useRef<boolean>(isAudioMuted);
  isAudioMutedRef.current = isAudioMuted;

  const isVideoMutedRef = useRef<boolean>(isVideoMuted);
  isVideoMutedRef.current = isVideoMuted;

  const facingModeRef = useRef<'user' | 'environment'>(facingMode);
  facingModeRef.current = facingMode;

  const settingsRef = useRef<DeviceSettings>(settings);
  settingsRef.current = settings;

  // Enumerate devices
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);
      setAudioOutputDevices(audioOutputs);
    } catch (err) {
      console.warn('[useMediaDevices] Error enumerating devices:', err);
    }
  }, []);

  // Request initial stream with multi-level resilient fallback
  const startUserMedia = useCallback(
    async (options?: {
      audioInputId?: string;
      videoInputId?: string;
      facingMode?: 'user' | 'environment';
      startAudioMuted?: boolean;
      startVideoMuted?: boolean;
      echoCancellation?: boolean;
      noiseSuppression?: boolean;
      existingStream?: MediaStream | null;
    }) => {
      try {
        setPermissionError(null);

        // 1. If an existing live stream is provided (e.g. from HomeView preview), reuse it seamlessly
        if (
          options?.existingStream &&
          options.existingStream.active &&
          options.existingStream.getTracks().some((t) => t.readyState === 'live')
        ) {
          const stream = options.existingStream;
          const audioMuted = options?.startAudioMuted !== undefined ? options.startAudioMuted : isAudioMutedRef.current;
          const videoMuted = options?.startVideoMuted !== undefined ? options.startVideoMuted : isVideoMutedRef.current;

          stream.getAudioTracks().forEach((track) => {
            track.enabled = !audioMuted;
          });
          setIsAudioMuted(audioMuted);

          stream.getVideoTracks().forEach((track) => {
            track.enabled = !videoMuted;
          });
          setIsVideoMuted(videoMuted);

          setLocalStream(stream);
          localStreamRef.current = stream;
          setPermissionGranted(true);
          await refreshDevices();
          return stream;
        }

        // Stop any previous local tracks
        if (localStreamRef.current && localStreamRef.current !== options?.existingStream) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        const chosenFacing = options?.facingMode || facingModeRef.current || 'user';
        setFacingMode(chosenFacing);
        facingModeRef.current = chosenFacing;

        const audioConstraints: MediaTrackConstraints | boolean = options?.audioInputId
          ? {
              deviceId: { ideal: options.audioInputId },
              echoCancellation: options?.echoCancellation ?? settingsRef.current.echoCancellation ?? true,
              noiseSuppression: options?.noiseSuppression ?? settingsRef.current.noiseSuppression ?? true,
              autoGainControl: true,
            }
          : {
              echoCancellation: options?.echoCancellation ?? settingsRef.current.echoCancellation ?? true,
              noiseSuppression: options?.noiseSuppression ?? settingsRef.current.noiseSuppression ?? true,
              autoGainControl: true,
            };

        const videoConstraints: MediaTrackConstraints | boolean = options?.videoInputId
          ? {
              deviceId: { ideal: options.videoInputId },
              facingMode: { ideal: chosenFacing },
            }
          : isMobileDevice
          ? {
              facingMode: { ideal: chosenFacing },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: { ideal: chosenFacing },
            };

        let stream: MediaStream | null = null;

        // 1. Try ideal audio + video
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: videoConstraints,
          });
        } catch (mediaErr: unknown) {
          console.warn('[useMediaDevices] Primary constraints failed, attempting fallback:', mediaErr);

          // 2. Try generic audio + facingMode video
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: { facingMode: { ideal: chosenFacing } },
            });
          } catch {
            // 3. Try standard audio: true, video: true
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
              });
            } catch {
              // 4. Try audio only if video failed (e.g. camera occupied)
              try {
                stream = await navigator.mediaDevices.getUserMedia({
                  audio: true,
                  video: false,
                });
              } catch {
                // 5. Try video only if microphone is unavailable/blocked
                try {
                  stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: true,
                  });
                } catch {
                  throw mediaErr;
                }
              }
            }
          }
        }

        if (!stream) {
          throw new Error('Não foi possível obter o fluxo de mídia.');
        }

        // Aplica o boost manual de ganho na track de áudio (substitui a
        // track crua pela processada via GainNode, mantendo o vídeo intacto)
        const rawAudioTrack = stream.getAudioTracks()[0];
        if (rawAudioTrack) {
          const gainedTrack = applyMicGain(rawAudioTrack, settingsRef.current.micGain ?? 5);
          if (gainedTrack !== rawAudioTrack) {
            stream.removeTrack(rawAudioTrack);
            stream.addTrack(gainedTrack);
          }
        }

        const audioMuted = options?.startAudioMuted !== undefined ? options.startAudioMuted : isAudioMutedRef.current;
        const videoMuted = options?.startVideoMuted !== undefined ? options.startVideoMuted : isVideoMutedRef.current;

        stream.getAudioTracks().forEach((track) => {
          track.enabled = !audioMuted;
        });
        setIsAudioMuted(audioMuted);

        stream.getVideoTracks().forEach((track) => {
          track.enabled = !videoMuted;
        });
        setIsVideoMuted(videoMuted);

        setLocalStream(stream);
        localStreamRef.current = stream;
        setPermissionGranted(true);
        await refreshDevices();
        return stream;
      } catch (err: unknown) {
        const error = err as Error;
        console.error('[useMediaDevices] getUserMedia error:', error);
        setPermissionGranted(false);
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setPermissionError('Permissão para câmera ou microfone negada. Por favor, permita o acesso nas configurações do seu navegador ou aparelho.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setPermissionError('Nenhuma câmera ou microfone foi detectado em seu dispositivo.');
        } else {
          setPermissionError(`Não foi possível acessar a câmera/microfone (${error.message || 'Erro de dispositivo'}).`);
        }
        return null;
      }
    },
    [isMobileDevice, refreshDevices]
  );

  // Seamlessly switch audio input device without interrupting video
  const switchAudioDevice = useCallback(
    async (deviceId: string) => {
      setSettings((prev) => ({ ...prev, audioInputId: deviceId }));
      try {
        const audioConstraints: MediaTrackConstraints = deviceId
          ? {
              deviceId: { ideal: deviceId },
              echoCancellation: settingsRef.current.echoCancellation ?? true,
              noiseSuppression: settingsRef.current.noiseSuppression ?? true,
              autoGainControl: true,
            }
          : {
              echoCancellation: settingsRef.current.echoCancellation ?? true,
              noiseSuppression: settingsRef.current.noiseSuppression ?? true,
              autoGainControl: true,
            };

        const newAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });

        const newTrack = newAudioStream.getAudioTracks()[0];
        if (!newTrack) return null;

        newTrack.enabled = !isAudioMutedRef.current;

        const currentStream = localStreamRef.current;
        if (currentStream) {
          // Stop and remove old audio tracks
          currentStream.getAudioTracks().forEach((oldTrack) => {
            oldTrack.stop();
            currentStream.removeTrack(oldTrack);
          });
          currentStream.addTrack(newTrack);
          // Create new MediaStream reference to trigger React re-renders and effects
          const updatedStream = new MediaStream(currentStream.getTracks());
          setLocalStream(updatedStream);
          return updatedStream;
        } else {
          const freshStream = new MediaStream([newTrack]);
          setLocalStream(freshStream);
          return freshStream;
        }
      } catch (err) {
        console.warn('[useMediaDevices] Failed to switch audio device:', err);
        return null;
      }
    },
    []
  );

  // Seamlessly switch video input device without interrupting audio
  const switchVideoDevice = useCallback(
    async (deviceId: string) => {
      setSettings((prev) => ({ ...prev, videoInputId: deviceId }));
      try {
        const videoConstraints: MediaTrackConstraints = deviceId
          ? {
              deviceId: { ideal: deviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: { ideal: facingModeRef.current },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: { ideal: facingModeRef.current },
            };

        const newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        const newTrack = newVideoStream.getVideoTracks()[0];
        if (!newTrack) return null;

        newTrack.enabled = !isVideoMutedRef.current;

        const currentStream = localStreamRef.current;
        if (currentStream) {
          currentStream.getVideoTracks().forEach((oldTrack) => {
            oldTrack.stop();
            currentStream.removeTrack(oldTrack);
          });
          currentStream.addTrack(newTrack);
          const updatedStream = new MediaStream(currentStream.getTracks());
          setLocalStream(updatedStream);
          return updatedStream;
        } else {
          const freshStream = new MediaStream([newTrack]);
          setLocalStream(freshStream);
          return freshStream;
        }
      } catch (err) {
        console.warn('[useMediaDevices] Failed to switch video device:', err);
        return null;
      }
    },
    []
  );

  // Mobile camera flip (front <-> back)
  const flipCamera = useCallback(async () => {
    const nextFacing = facingModeRef.current === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    facingModeRef.current = nextFacing;

    try {
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: nextFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      }).catch(async () => {
        // Fallback with ideal
        return await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      });

      const newTrack = newVideoStream.getVideoTracks()[0];
      if (!newTrack) return null;

      newTrack.enabled = !isVideoMutedRef.current;

      const currentStream = localStreamRef.current;
      if (currentStream) {
        currentStream.getVideoTracks().forEach((oldTrack) => {
          oldTrack.stop();
          currentStream.removeTrack(oldTrack);
        });
        currentStream.addTrack(newTrack);
        const updatedStream = new MediaStream(currentStream.getTracks());
        setLocalStream(updatedStream);
        return updatedStream;
      } else {
        const freshStream = new MediaStream([newTrack]);
        setLocalStream(freshStream);
        return freshStream;
      }
    } catch (err) {
      console.warn('[useMediaDevices] Failed to flip camera:', err);
      return null;
    }
  }, []);

  // Toggle Audio with auto-recovery if audio track was lost
  const toggleAudio = useCallback(async () => {
    const currentStream = localStreamRef.current;
    if (currentStream) {
      const audioTracks = currentStream.getAudioTracks();
      if (audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
        const nextState = !audioTracks[0].enabled;
        audioTracks.forEach((t) => {
          t.enabled = nextState;
        });
        const muted = !nextState;
        setIsAudioMuted(muted);
        return muted;
      }
    }

    // If stream has no active live audio track, request microphone again
    try {
      const newAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: settingsRef.current.audioInputId
          ? {
              deviceId: { ideal: settingsRef.current.audioInputId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const newTrack = newAudioStream.getAudioTracks()[0];
      if (newTrack) {
        newTrack.enabled = true;
        if (currentStream) {
          currentStream.addTrack(newTrack);
          setLocalStream(new MediaStream(currentStream.getTracks()));
        } else {
          setLocalStream(new MediaStream([newTrack]));
        }
        setIsAudioMuted(false);
        return false;
      }
    } catch (err) {
      console.warn('[useMediaDevices] Error re-acquiring microphone track:', err);
    }

    const nextMuted = !isAudioMutedRef.current;
    setIsAudioMuted(nextMuted);
    return nextMuted;
  }, []);

  // Toggle Video with auto-recovery if video track was lost
  const toggleVideo = useCallback(async () => {
    const currentStream = localStreamRef.current;
    if (currentStream) {
      const videoTracks = currentStream.getVideoTracks();
      if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
        const nextState = !videoTracks[0].enabled;
        videoTracks.forEach((t) => {
          t.enabled = nextState;
        });
        const muted = !nextState;
        setIsVideoMuted(muted);
        return muted;
      }
    }

    // If stream has no active live video track, request camera again
    try {
      const videoConstraints: MediaTrackConstraints | boolean = settingsRef.current.videoInputId
        ? { deviceId: { ideal: settingsRef.current.videoInputId } }
        : isMobileDevice
        ? { facingMode: { ideal: facingModeRef.current || 'user' } }
        : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: facingModeRef.current || 'user' } };

      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
      }).catch(async () => {
        return await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      });
      const newTrack = newVideoStream.getVideoTracks()[0];
      if (newTrack) {
        newTrack.enabled = true;
        if (currentStream) {
          currentStream.addTrack(newTrack);
          setLocalStream(new MediaStream(currentStream.getTracks()));
        } else {
          setLocalStream(new MediaStream([newTrack]));
        }
        setIsVideoMuted(false);
        return false;
      }
    } catch (err) {
      console.warn('[useMediaDevices] Error re-acquiring video track:', err);
    }

    const nextMuted = !isVideoMutedRef.current;
    setIsVideoMuted(nextMuted);
    return nextMuted;
  }, []);

  // Start / Stop Screen Share
  const startScreenShare = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        return null;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        } as MediaTrackConstraints,
        audio: true,
      });

      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      setScreenStream(displayStream);
      setIsScreenSharing(true);
      return displayStream;
    } catch (err: unknown) {
      console.warn('[useMediaDevices] Screen share cancelled or failed:', err);
      setIsScreenSharing(false);
      return null;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    setScreenStream(null);
    setIsScreenSharing(false);
  }, [screenStream]);

  // Stop everything on unmount
  const stopAll = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      gainNodeRef.current = null;
    }
  }, [screenStream]);

  useEffect(() => {
    navigator.mediaDevices?.addEventListener('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', refreshDevices);
    };
  }, [refreshDevices]);

  return {
    localStream,
    screenStream,
    audioDevices,
    videoDevices,
    audioOutputDevices,
    permissionGranted,
    permissionError,
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
    refreshDevices,
  };
}