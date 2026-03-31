import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { Bot } from 'lucide-react';
import type { Message } from '../types';

interface ChatAreaProps {
  messages: Message[];
  loading: boolean;
  sessionTitle?: string;
  onDeleteMessage?: (index: number) => void;
}

export function ChatArea({ messages, loading, sessionTitle, onDeleteMessage }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4 px-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
          <Bot size={32} className="text-emerald-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Monveo SEO Chat</h2>
          <p className="mt-1 text-sm text-gray-400 max-w-sm">
            Seu assistente especialista em SEO. Faça perguntas sobre conteúdo, palavras-chave, meta descrições ou estratégias de otimização.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-5">
        {sessionTitle && messages.length > 0 && (
          <p className="text-center text-xs text-gray-400 font-medium uppercase tracking-wider">
            {sessionTitle}
          </p>
        )}
        {messages.map((msg, index) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onDelete={onDeleteMessage ? () => onDeleteMessage(index) : undefined}
          />
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-600 text-white">
              <Bot size={15} />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
