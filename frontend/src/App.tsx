import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { ChatInput, type AttachedFile } from './components/ChatInput';
import {
  sendChat,
  listSessions,
  getSession,
  renameSession,
  deleteSession,
  deleteMessage,
  uploadFile,
  type FileContext,
} from './api';
import type { Message, Session } from './types';

function makeTitleFromPrompt(prompt: string): string {
  return prompt.trim().split(/\s+/).slice(0, 6).join(' ');
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // File attachment state
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [fileContext, setFileContext] = useState<FileContext | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await listSessions();
      setSessions(data);
    } catch {
      // silently fail — backend may not be running yet
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  function startNewChat() {
    setActiveSessionId(null);
    setActiveTitle('');
    setMessages([]);
    setInput('');
    setIsFirstMessage(true);
    setAttachedFile(null);
    setFileContext(null);
  }

  async function handleSelectSession(sessionId: string) {
    try {
      const data = await getSession(sessionId);
      setActiveSessionId(sessionId);
      setActiveTitle(data.title);
      setIsFirstMessage(false);
      setMessages(
        data.messages.map((m) => ({
          id: uuidv4(),
          role: m.role as 'user' | 'assistant',
          text: m.text,
          timestamp: m.timestamp,
        })),
      );
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }

  async function handleRenameSession(sessionId: string, newTitle: string) {
    try {
      await renameSession(sessionId, newTitle);
      setSessions((prev) =>
        prev.map((s) => (s.session_id === sessionId ? { ...s, title: newTitle } : s)),
      );
      if (activeSessionId === sessionId) setActiveTitle(newTitle);
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  }

  async function handleDeleteMessage(index: number) {
    if (!activeSessionId) return;
    setMessages((prev) => prev.filter((_, i) => i !== index));
    try {
      await deleteMessage(activeSessionId, index);
    } catch (err) {
      console.error('Failed to delete message:', err);
      handleSelectSession(activeSessionId);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (activeSessionId === sessionId) startNewChat();
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }

  async function handleFileSelect(file: File) {
    const MAX_MB = 15;
    if (file.size > MAX_MB * 1024 * 1024) {
      setAttachedFile({ name: file.name, uploading: false, error: `Arquivo muito grande (máx ${MAX_MB} MB)` });
      return;
    }
    setAttachedFile({ name: file.name, uploading: true });
    setFileContext(null);
    try {
      const result = await uploadFile(file);
      setAttachedFile({ name: result.filename, uploading: false });
      if (result.type === 'text') {
        setFileContext({ type: 'text', content: result.content, name: result.filename, fileUrl: result.file_url });
      } else {
        setFileContext({ type: 'image', b64: result.b64, mimeType: result.mime_type, name: result.filename, fileUrl: result.file_url });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar arquivo';
      setAttachedFile({ name: file.name, uploading: false, error: msg });
    }
  }

  function handleFileClear() {
    setAttachedFile(null);
    setFileContext(null);
  }

  async function handleSend() {
    const prompt = input.trim();
    if (!prompt || loading || attachedFile?.uploading) return;

    let sessionId = activeSessionId;
    let title: string | undefined;

    if (!sessionId) {
      sessionId = uuidv4();
      title = makeTitleFromPrompt(
        fileContext ? `[${fileContext.name}] ${prompt}` : prompt,
      );
      setActiveSessionId(sessionId);
      setActiveTitle(title);
      setIsFirstMessage(false);
    }

    // Show user message with file hint if applicable
    const displayText = fileContext ? prompt : prompt;
    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      text: displayText,
      fileUrl: fileContext?.fileUrl,
      fileName: fileContext?.name,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { response, image_url } = await sendChat(
        prompt,
        sessionId,
        isFirstMessage ? title : undefined,
        fileContext ?? undefined,
      );
      const aiMsg: Message = {
        id: uuidv4(),
        role: 'assistant',
        text: response,
        imageUrl: image_url,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Keep file context for follow-up questions — user clears manually
      const updatedSessions = await listSessions();
      setSessions(updatedSessions);
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Erro desconhecido';
      setMessages((prev) => [
        ...prev,
        { id: uuidv4(), role: 'assistant', text: `**Erro:** ${errText}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Mobile sidebar toggle */}
      <button
        className="fixed top-3 left-3 z-20 md:hidden bg-gray-900 text-white p-2 rounded-lg shadow"
        onClick={() => setSidebarOpen((o) => !o)}
      >
        ☰
      </button>

      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed md:relative md:translate-x-0 z-10 h-full transition-transform duration-200`}
      >
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={(id) => {
            handleSelectSession(id);
            setSidebarOpen(false);
          }}
          onNewChat={() => {
            startNewChat();
            setSidebarOpen(false);
          }}
          onRenameSession={handleRenameSession}
          onDeleteSession={handleDeleteSession}
        />
      </div>

      {/* Main chat */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Top bar */}
        <header className="flex items-center px-4 md:px-6 py-3 border-b border-gray-200 bg-white shadow-sm shrink-0">
          <h1 className="text-base font-semibold text-gray-800 truncate">
            {activeTitle || 'Nova conversa'}
          </h1>
        </header>

        {/* Messages */}
        <ChatArea
          messages={messages}
          loading={loading}
          sessionTitle=""
          onDeleteMessage={activeSessionId ? handleDeleteMessage : undefined}
        />

        {/* Input */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          loading={loading}
          attachedFile={attachedFile}
          onFileSelect={handleFileSelect}
          onFileClear={handleFileClear}
        />
      </div>
    </div>
  );
}
