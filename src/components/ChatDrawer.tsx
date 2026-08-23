import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, Smile, MessageSquare, Shield, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatDrawerProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
  onClose: () => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '👏', '🔥', '😂', '🎉', '🙌'];

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  messages,
  currentUserId,
  onSendMessage,
  onClose,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleInsertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  return (
    <motion.aside
      id="chat-drawer"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="w-full sm:w-80 md:w-96 h-full bg-[#0A0A0A] border-l border-white/5 flex flex-col z-30 shadow-2xl"
    >
      {/* Drawer Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <h3 className="font-bold text-gray-100 text-sm">Mensagens na chamada</h3>
        </div>
        <button
          id="close-chat-btn"
          onClick={onClose}
          className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Notice info banner */}
      <div className="px-4 py-2 bg-blue-600/10 border-b border-blue-500/20 text-blue-400 text-[11px] flex items-center gap-1.5 font-medium">
        <Sparkles className="w-3.5 h-3.5 shrink-0 text-blue-400" />
        <span>Mensagens só podem ser vistas pelas pessoas presentes na chamada.</span>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs text-center p-4">
            <MessageSquare className="w-8 h-8 text-gray-600 mb-2 opacity-50" />
            <p>Nenhuma mensagem ainda.</p>
            <p className="text-[11px] text-gray-600 mt-1">Diga um "Olá" para começar!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              if (msg.type === 'system') {
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-center py-1"
                  >
                    <span className="inline-block px-3 py-1 rounded-full bg-white/5 text-gray-400 text-[11px] font-medium border border-white/10">
                      {msg.text}
                    </span>
                  </motion.div>
                );
              }

              const isMe = msg.senderId === currentUserId;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-300">
                      {isMe ? 'Você' : msg.senderName}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">{msg.time}</span>
                  </div>

                  <div
                    className={`px-3.5 py-2.5 rounded-2xl max-w-[88%] text-sm break-words shadow-sm ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-600/20'
                        : 'bg-[#121212] text-gray-100 rounded-tl-none border border-white/10'
                    }`}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emoji Bar */}
      <div className="px-4 py-1.5 border-t border-white/5 flex items-center gap-1 overflow-x-auto bg-[#050505]/50">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleInsertEmoji(emoji)}
            className="p-1 rounded-lg hover:bg-white/10 text-base transition-transform hover:scale-125"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Message Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/5 bg-[#050505] flex items-center gap-2">
        <input
          id="chat-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enviar uma mensagem..."
          className="flex-1 px-3.5 py-2.5 bg-[#121212] border border-white/10 rounded-xl text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
          maxLength={500}
        />
        <button
          id="send-chat-msg-btn"
          type="submit"
          disabled={!inputText.trim()}
          className={`p-2.5 rounded-xl font-medium transition-all ${
            inputText.trim()
              ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-md shadow-blue-600/20'
              : 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </motion.aside>
  );
};
