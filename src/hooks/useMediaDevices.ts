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
  });

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
    }) => {
      try {
        setPermissionError(null);

        // Stop any previous tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        const chosenFacing = options?.facingMode || facingModeRef.current || 'user';
        setFacingMode(chosenFacing);

        const audioConstraints: MediaTrackConstraints | boolean = options?.audioInputId
          ? {
              deviceId: { ideal: options.audioInputId },
              echoCancellation: options?.echoCancellation ?? settingsRef.current.echoCancellation ?? true,
              noiseSuppression: options?.noiseSuppression ?? settingsRef.current.noiseSuppression ?? true,
              autoGainControl: true,
              channelCount: { ideal: 1 },
              sampleRate: { ideal: 48000 },
            }
          : {
              echoCancellation: options?.echoCancellation ?? settingsRef.current.echoCancellation ?? true,
              noiseSuppression: options?.noiseSuppression ?? settingsRef.current.noiseSuppression ?? true,
              autoGainControl: true,
              channelCount: { ideal: 1 },
              sampleRate: { ideal: 48000 },
            };

        const videoConstraints: MediaTrackConstraints | boolean = options?.videoInputId
          ? {
              deviceId: { ideal: options.videoInputId },
              width: { ideal: isMobileDevice ? 1280 : 1280 },
              height: { ideal: isMobileDevice ? 720 : 720 },
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
          console.warn('[useMediaDevices] Full constraints failed, attempting fallback:', mediaErr);

          // 2. Try generic audio + facingMode video
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: { facingMode: { ideal: chosenFacing } },
            });
          } catch {
            // 3. Try audio only if video failed (e.g. no camera or webcam busy)
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false,
              });
            } catch {
              // 4. Try basic audio true
              try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              } catch {
                // 5. Try video only if microphone is unavailable/disabled on OS
                try {
                  stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
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
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: settingsRef.current.videoInputId
          ? {
              deviceId: { ideal: settingsRef.current.videoInputId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
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
