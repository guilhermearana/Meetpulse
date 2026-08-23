import React, { useEffect, useState } from 'react';
import { Video, Moon, Sun, HelpCircle, Maximize, Minimize } from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenHelp?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ darkMode, onToggleDarkMode, onOpenHelp }) => {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
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

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
      setDate(
        now.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      );
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header id="main-header" className="w-full h-14 px-6 flex items-center justify-between border-b border-white/5 bg-[#0A0A0A] transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
          <Video className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-100 tracking-tight">MeetPulse</h1>
          <div className="h-4 w-[1px] bg-white/10 mx-1 hidden sm:block"></div>
          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-blue-400">
            HD Live
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Date & Time */}
        <div className="hidden md:flex items-center gap-2 text-sm text-gray-400 font-medium">
          <span className="text-gray-200">{time}</span>
          <span className="text-white/20">•</span>
          <span className="capitalize">{date}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Fullscreen Button */}
          <button
            id="header-fullscreen-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Sair da tela cheia (F)' : 'Entrar em tela cheia (F)'}
            className={`p-2 rounded-xl text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border transition-all flex items-center gap-1.5 ${
              isFullscreen ? 'border-blue-500/40 text-blue-400 bg-blue-500/10' : 'border-white/10'
            }`}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            <span className="hidden lg:inline text-xs font-medium">
              {isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            </span>
          </button>

          {onOpenHelp && (
            <button
              id="help-btn"
              onClick={onOpenHelp}
              title="Ajuda e recursos"
              className="p-2 rounded-xl text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}

          <button
            id="theme-toggle-btn"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            className="p-2 rounded-xl text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-gray-400" />}
          </button>
        </div>
      </div>
    </header>
  );
};
