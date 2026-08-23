import React, { useState } from 'react';
import { Download, X, Share2, PlusSquare, Sparkles, CheckCircle2, WifiOff } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

interface PWAInstallBannerProps {
  onInstallClicked?: () => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = () => {
  const {
    isInstallable,
    isInstalled,
    isOnline,
    isIOS,
    showIOSPrompt,
    setShowIOSPrompt,
    promptInstall,
  } = usePWA();

  const [dismissed, setDismissed] = useState<boolean>(() => {
    return sessionStorage.getItem('pwa_banner_dismissed') === 'true';
  });

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      setDismissed(true);
    }
  };

  return (
    <>
      {/* Offline Alert Bar */}
      {!isOnline && (
        <div className="w-full bg-amber-500/90 text-gray-950 font-semibold px-4 py-2 text-xs flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="w-4 h-4 text-gray-950" />
          <span>Você está offline no momento. O MeetPulse continuará carregando via cache PWA assim que a rede restabelecer.</span>
        </div>
      )}

      {/* Floating Install Prompt Banner for Desktop / Android */}
      {isInstallable && !isInstalled && !dismissed && (
        <div
          id="pwa-install-banner"
          className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] bg-[#0F0F0F] border border-blue-500/30 rounded-2xl p-4 shadow-2xl shadow-blue-500/10 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-600/20">
              <Download className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-100">Instalar MeetPulse</span>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-semibold">PWA</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-snug">
                Acesse reuniões com 1 clique direto da sua tela inicial ou área de trabalho.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id="pwa-install-action-btn"
              onClick={handleInstall}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20 flex items-center gap-1"
            >
              <span>Instalar</span>
            </button>
            <button
              onClick={handleDismiss}
              title="Fechar aviso"
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* iOS Manual Add-to-Home-Screen Instructions Modal */}
      {showIOSPrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-left animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-bold text-gray-100">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <span>Instalar no iPhone / iPad</span>
              </div>
              <button
                onClick={() => setShowIOSPrompt(false)}
                className="text-xs text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Para instalar o MeetPulse no iOS e usá-lo em tela cheia como um aplicativo nativo:
            </p>

            <div className="space-y-2.5 text-xs text-gray-300 bg-white/5 p-3.5 rounded-2xl border border-white/5">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-bold text-[10px]">
                  1
                </div>
                <div>
                  Toque no botão <strong className="text-white">Compartilhar</strong> <Share2 className="w-3.5 h-3.5 inline text-blue-400 mx-1" /> no Safari.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-bold text-[10px]">
                  2
                </div>
                <div>
                  Role as opções e selecione <strong className="text-white">Adicionar à Tela de Início</strong> <PlusSquare className="w-3.5 h-3.5 inline text-emerald-400 mx-1" />.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-bold text-[10px]">
                  3
                </div>
                <div>
                  Toque em <strong className="text-white">Adicionar</strong> no canto superior direito para concluir.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSPrompt(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-md shadow-blue-600/20"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
