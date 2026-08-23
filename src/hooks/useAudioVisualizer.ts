import { useEffect, useRef, useState } from 'react';

export function useAudioVisualizer(
  stream: MediaStream | null,
  isMuted: boolean,
  onSpeakingChange?: (volume: number, isSpeaking: boolean) => void
) {
  const [volume, setVolume] = useState<number>(0);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastEmitRef = useRef<number>(0);

  useEffect(() => {
    if (!stream || isMuted) {
      setVolume(0);
      setIsSpeaking(false);
      if (onSpeakingChange) onSpeakingChange(0, false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled) {
      setVolume(0);
      setIsSpeaking(false);
      if (onSpeakingChange) onSpeakingChange(0, false);
      return;
    }

    let isSubscribed = true;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      // Resume AudioContext if browser initially placed it in suspended state
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Unlock on user interaction if needed
      const unlockAudio = () => {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      };
      window.addEventListener('click', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });
      window.addEventListener('touchstart', unlockAudio, { once: true });

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudioLevel = () => {
        if (!isSubscribed) return;

        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));

        setVolume(normalized);
        const speaking = normalized > 10;
        setIsSpeaking(speaking);

        const now = Date.now();
        // Throttle updates to callback (every 180ms)
        if (onSpeakingChange && now - lastEmitRef.current > 180) {
          lastEmitRef.current = now;
          onSpeakingChange(normalized, speaking);
        }

        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (err) {
      console.warn('[AudioVisualizer] Failed to initialize AudioContext:', err);
    }

    return () => {
      isSubscribed = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stream, isMuted]);

  return { volume, isSpeaking };
}
