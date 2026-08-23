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

  const [settings, setSettings] = useState<DeviceSettings>({
    audioInputId: '',
    videoInputId: '',
    audioOutputId: '',
    noiseSuppression: true,
    echoCancellation: true,
  });

  const localStreamRef = useRef<MediaStream | null>(null);
  localStreamRef.current = localStream;

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

  // Request initial stream
  const startUserMedia = useCallback(
    async (options?: { audioInputId?: string; videoInputId?: string; startAudioMuted?: boolean; startVideoMuted?: boolean }) => {
      try {
        setPermissionError(null);

        // Stop any previous tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        const constraints: MediaStreamConstraints = {
          audio: {
            deviceId: options?.audioInputId ? { exact: options.audioInputId } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: {
            deviceId: options?.videoInputId ? { exact: options.videoInputId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (mediaErr: unknown) {
          // If video failed (e.g. camera busy or no webcam), try audio only
          console.warn('[useMediaDevices] Full media failed, attempting audio only:', mediaErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          } catch (audioErr: unknown) {
            console.error('[useMediaDevices] Failed audio also:', audioErr);
            throw mediaErr;
          }
        }

        if (options?.startAudioMuted) {
          stream.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
          setIsAudioMuted(true);
        } else {
          setIsAudioMuted(false);
        }

        if (options?.startVideoMuted) {
          stream.getVideoTracks().forEach((track) => {
            track.enabled = false;
          });
          setIsVideoMuted(true);
        } else {
          setIsVideoMuted(false);
        }

        setLocalStream(stream);
        setPermissionGranted(true);
        await refreshDevices();
        return stream;
      } catch (err: unknown) {
        const error = err as Error;
        console.error('[useMediaDevices] getUserMedia error:', error);
        setPermissionGranted(false);
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setPermissionError('Permissão para câmera ou microfone negada. Por favor, permita o acesso nas configurações do navegador.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setPermissionError('Nenhuma câmera ou microfone foi detectado em seu dispositivo.');
        } else {
          setPermissionError(`Não foi possível acessar a câmera/microfone (${error.message || 'Erro de hardware'}).`);
        }
        return null;
      }
    },
    [refreshDevices]
  );

  // Toggle Audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const newState = !audioTracks[0].enabled;
        audioTracks.forEach((t) => {
          t.enabled = newState;
        });
        setIsAudioMuted(!newState);
        return !newState;
      }
    }
    return isAudioMuted;
  }, [isAudioMuted]);

  // Toggle Video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const newState = !videoTracks[0].enabled;
        videoTracks.forEach((t) => {
          t.enabled = newState;
        });
        setIsVideoMuted(!newState);
        return !newState;
      }
    }
    return isVideoMuted;
  }, [isVideoMuted]);

  // Start / Stop Screen Share
  const startScreenShare = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert('Compartilhamento de tela não é suportado pelo seu navegador.');
        return null;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        } as MediaTrackConstraints,
        audio: true,
      });

      const videoTrack = displayStream.getVideoTracks()[0];
      videoTrack.onended = () => {
        stopScreenShare();
      };

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
    settings,
    setSettings,
    startUserMedia,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    stopAll,
    refreshDevices,
  };
}
