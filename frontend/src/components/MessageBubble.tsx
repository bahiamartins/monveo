import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Bot, User, Download, ImageIcon, Trash2, Paperclip } from 'lucide-react';
import type { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  onDelete?: () => void;
}

export function MessageBubble({ message, onDelete }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isUser = message.role === 'user';

  async function handleCopy() {
    await navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete?.();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} group`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white self-start mt-0.5 ${
          isUser ? 'bg-emerald-600' : 'bg-gray-600'
        }`}
      >
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>

      {/* Column: bubble + action bar + optional image */}
      <div className="flex flex-col gap-1 max-w-[80%]">
        {/* Attached file chip (user messages only) */}
        {message.fileUrl && message.fileName && (
          <a
            href={message.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 transition-colors max-w-fit"
          >
            <Paperclip size={12} />
            <span className="truncate max-w-[180px]">{message.fileName}</span>
            <Download size={11} className="shrink-0 opacity-70" />
          </a>
        )}

        {/* Text bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-emerald-600 text-white rounded-tr-sm'
              : 'bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100'
          }`}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-a:text-emerald-600 prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Action bar — in normal flow so hovering the buttons keeps group-hover active */}
        {(onDelete || !isUser) && (
          <div
            className={`flex items-center gap-2 px-1 h-5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${
              isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            {!isUser && (
              <button
                onClick={handleCopy}
                title="Copiar resposta"
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600 transition-colors"
              >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            )}

            {onDelete && (
              <>
                {!isUser && <span className="text-gray-200">·</span>}
                <button
                  onClick={handleDeleteClick}
                  title={confirmDelete ? 'Clique novamente para confirmar' : 'Apagar mensagem'}
                  className={`flex items-center gap-1 text-xs transition-colors ${
                    confirmDelete
                      ? 'text-red-500 font-medium'
                      : 'text-gray-400 hover:text-red-400'
                  }`}
                >
                  <Trash2 size={12} />
                  <span>{confirmDelete ? 'Confirmar?' : 'Apagar'}</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Generated image card */}
        {message.imageUrl && (
          <div className="rounded-2xl rounded-tl-sm overflow-hidden border border-gray-100 shadow-sm bg-white">
            {!imgLoaded && (
              <div className="flex items-center justify-center h-40 bg-gray-50 text-gray-300 gap-2">
                <ImageIcon size={24} />
                <span className="text-sm">Carregando imagem...</span>
              </div>
            )}
            <img
              src={message.imageUrl}
              alt="Imagem gerada"
              onLoad={() => setImgLoaded(true)}
              className={`w-full object-contain max-h-96 transition-opacity duration-300 ${
                imgLoaded ? 'opacity-100' : 'opacity-0 absolute'
              }`}
            />
            {imgLoaded && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <ImageIcon size={12} /> Imagem gerada por IA
                </span>
                <a
                  href={message.imageUrl}
                  download="monveo-imagem.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  <Download size={13} />
                  Baixar
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
