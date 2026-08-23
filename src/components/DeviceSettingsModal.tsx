import React, { useState } from 'react';
import { X, Mic, Video, Volume2, CheckCircle2, Sliders, Volume1 } from 'lucide-react';
import { DeviceSettings } from '../types';

interface DeviceSettingsModalProps {
  settings: DeviceSettings;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  onUpdateSettings: (settings: Partial<DeviceSettings>) => void;
  onMicGainChange: (gain: number) => void;
  onClose: () => void;
}

export const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({
  settings,
  audioDevices,
  videoDevices,
  audioOutputDevices,
  onUpdateSettings,
  onMicGainChange,
  onClose,
}) => {
  const [testPlaying, setTestPlaying] = useState<boolean>(false);

  const handleTestSpeaker = () => {
    try {
      setTestPlaying(true);
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
      setTimeout(() => setTestPlaying(false), 550);
    } catch {
      setTestPlaying(false);
    }
  };

  return (
    <div id="device-settings-modal-backdrop" className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div
        id="device-settings-modal"
        className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-left"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">Configurações de Áudio e Vídeo</h3>
              <p className="text-xs text-gray-400">Escolha seus dispositivos padrão</p>
            </div>
          </div>
          <button
            id="close-device-settings-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Microfone */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-blue-400" />
              <span>Microfone</span>
            </label>
            <select
              id="select-audio-input"
              value={settings.audioInputId}
              onChange={(e) => onUpdateSettings({ audioInputId: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#121212] border border-white/10 rounded-xl text-xs text-gray-100 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
            >
              {audioDevices.length === 0 && <option value="">Microfone Padrão do Sistema</option>}
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="bg-[#0A0A0A] text-gray-100">
                  {d.label || `Microfone ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
          </div>

          {/* Ganho do Microfone */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Volume1 className="w-4 h-4 text-blue-400" />
                <span>Ganho do Microfone</span>
              </label>
              <span className="text-xs font-mono text-blue-400">{settings.micGain ?? 5}/10</span>
            </div>
            <input
              id="mic-gain-slider"
              type="range"
              min={0}
              max={10}
              step={1}
              value={settings.micGain ?? 5}
              onChange={(e) => onMicGainChange(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="text-[11px] text-gray-400">Aumente se o microfone estiver soando baixo (útil em celulares Android)</div>
          </div>

          {/* Câmera */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Video className="w-4 h-4 text-blue-400" />
              <span>Câmera</span>
            </label>
            <select
              id="select-video-input"
              value={settings.videoInputId}
              onChange={(e) => onUpdateSettings({ videoInputId: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#121212] border border-white/10 rounded-xl text-xs text-gray-100 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
            >
              {videoDevices.length === 0 && <option value="">Câmera Padrão do Sistema</option>}
              {videoDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="bg-[#0A0A0A] text-gray-100">
                  {d.label || `Câmera ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
          </div>

          {/* Alto-falantes e Teste de Som */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-blue-400" />
                <span>Alto-falantes / Fones</span>
              </label>
              <button
                id="test-speaker-sound-btn"
                onClick={handleTestSpeaker}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                {testPlaying ? 'Tocando...' : 'Testar som'}
              </button>
            </div>
            <select
              id="select-audio-output"
              value={settings.audioOutputId}
              onChange={(e) => onUpdateSettings({ audioOutputId: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#121212] border border-white/10 rounded-xl text-xs text-gray-100 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
            >
              {audioOutputDevices.length === 0 && <option value="">Alto-falante Padrão</option>}
              {audioOutputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="bg-[#0A0A0A] text-gray-100">
                  {d.label || `Saída de Áudio ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
          </div>

          {/* Advanced Toggles */}
          <div className="pt-2 border-t border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-200">Cancelamento de Eco</div>
                <div className="text-[11px] text-gray-400">Reduz retorno e eco do microfone</div>
              </div>
              <input
                type="checkbox"
                checked={settings.echoCancellation}
                onChange={(e) => onUpdateSettings({ echoCancellation: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-[#121212] border-white/10 accent-blue-600"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-200">Supressão de Ruído</div>
                <div className="text-[11px] text-gray-400">Filtra ruídos contínuos do ambiente</div>
              </div>
              <input
                type="checkbox"
                checked={settings.noiseSuppression}
                onChange={(e) => onUpdateSettings({ noiseSuppression: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-[#121212] border-white/10 accent-blue-600"
              />
            </div>
          </div>
        </div>

        <button
          id="save-device-settings-btn"
          onClick={onClose}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Pronto</span>
        </button>
      </div>
    </div>
  );
};