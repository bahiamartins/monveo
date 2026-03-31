import { useRef, useEffect, type KeyboardEvent } from 'react';
import { SendHorizonal, Loader2, Paperclip, X, FileText } from 'lucide-react';

export interface AttachedFile {
  name: string;
  uploading: boolean;
  error?: string;
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  loading: boolean;
  disabled?: boolean;
  attachedFile?: AttachedFile | null;
  onFileSelect: (file: File) => void;
  onFileClear: () => void;
}

const ACCEPTED = '.pdf,.docx,.doc,.txt,.md,.csv,.html,.htm,.xlsx,.xls,.jpg,.jpeg,.png,.webp,.gif';

export function ChatInput({
  value,
  onChange,
  onSend,
  loading,
  disabled,
  attachedFile,
  onFileSelect,
  onFileClear,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && value.trim()) onSend();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      e.target.value = '';
    }
  }

  const isBusy = disabled || loading;

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        {/* Attached file chip */}
        {attachedFile && (
          <div
            className={`flex items-center gap-2 self-start px-3 py-1.5 rounded-lg text-xs font-medium border ${
              attachedFile.error
                ? 'bg-red-50 border-red-200 text-red-600'
                : attachedFile.uploading
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            {attachedFile.uploading ? (
              <Loader2 size={13} className="animate-spin shrink-0" />
            ) : (
              <FileText size={13} className="shrink-0" />
            )}
            <span className="max-w-[240px] truncate">
              {attachedFile.error ?? attachedFile.name}
            </span>
            {!attachedFile.uploading && (
              <button
                onClick={onFileClear}
                className="ml-1 hover:opacity-70 transition-opacity shrink-0"
                title="Remover arquivo"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">
          {/* File attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy || attachedFile?.uploading}
            title="Anexar arquivo (PDF, DOCX, TXT, CSV…)"
            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 hover:text-emerald-600 transition-colors"
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={handleFileChange}
          />

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isBusy}
            placeholder={
              attachedFile && !attachedFile.uploading && !attachedFile.error
                ? `Faça uma pergunta sobre "${attachedFile.name}"…`
                : 'Digite sua mensagem… (Shift+Enter para nova linha)'
            }
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent disabled:opacity-50 leading-relaxed"
          />

          <button
            onClick={onSend}
            disabled={isBusy || !value.trim() || attachedFile?.uploading}
            title="Enviar"
            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <SendHorizonal size={18} />}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">
          Enter para enviar · Shift+Enter para nova linha · PDF, DOCX, XLSX, TXT, CSV, JPG, PNG aceitos
        </p>
      </div>
    </div>
  );
}
