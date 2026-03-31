import { useState, useRef, useEffect } from 'react';
import { MessageSquarePlus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { Session } from '../types';

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onRenameSession,
  onDeleteSession,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function startEdit(session: Session) {
    setEditingId(session.session_id);
    setEditValue(session.title);
  }

  function commitEdit(sessionId: string) {
    const trimmed = editValue.trim();
    if (trimmed) onRenameSession(sessionId, trimmed);
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  return (
    <aside className="flex flex-col w-64 min-w-[16rem] h-full bg-gray-900 text-gray-100 border-r border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
        <span className="text-lg font-bold tracking-tight text-emerald-400">Monveo SEO</span>
        <button
          onClick={onNewChat}
          title="Nova conversa"
          className="p-1.5 rounded-md hover:bg-gray-700 transition-colors text-gray-300 hover:text-white"
        >
          <MessageSquarePlus size={18} />
        </button>
      </div>

      {/* Sessions list */}
      <nav className="flex-1 overflow-y-auto py-2">
        {sessions.length === 0 && (
          <p className="px-4 py-6 text-xs text-gray-500 text-center">Nenhuma conversa ainda</p>
        )}
        {sessions.map((session) => {
          const isActive = session.session_id === activeSessionId;
          const isEditing = editingId === session.session_id;

          return (
            <div
              key={session.session_id}
              className={`group flex items-center gap-1 mx-2 my-0.5 rounded-lg px-2 py-2 cursor-pointer transition-colors ${
                isActive ? 'bg-emerald-700/30 text-white' : 'hover:bg-gray-800 text-gray-300'
              }`}
              onClick={() => !isEditing && onSelectSession(session.session_id)}
            >
              {isEditing ? (
                <div className="flex flex-1 items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(session.session_id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    className="flex-1 min-w-0 bg-gray-700 text-white text-sm px-2 py-0.5 rounded outline-none border border-emerald-400"
                  />
                  <button onClick={() => commitEdit(session.session_id)} className="text-emerald-400 hover:text-emerald-300 shrink-0">
                    <Check size={14} />
                  </button>
                  <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-200 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 min-w-0 text-sm truncate">{session.title}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      title="Renomear"
                      onClick={(e) => { e.stopPropagation(); startEdit(session); }}
                      className="p-0.5 rounded hover:text-emerald-300 text-gray-400"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      title="Excluir"
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(session.session_id); }}
                      className="p-0.5 rounded hover:text-red-400 text-gray-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500">
        Especialista em SEO
      </div>
    </aside>
  );
}
