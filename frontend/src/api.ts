import type { Session, SessionDetail } from './types';

const BASE = '/api';

export interface ChatResponse {
  response: string;
  image_url?: string;
}

export type UploadResponse =
  | { type: 'text'; content: string; filename: string; file_url?: string }
  | { type: 'image'; b64: string; mime_type: string; filename: string; file_url?: string };

export type FileContext =
  | { type: 'text'; content: string; name: string; fileUrl?: string }
  | { type: 'image'; b64: string; mimeType: string; name: string; fileUrl?: string };

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao enviar arquivo');
  return data as UploadResponse;
}

export async function sendChat(
  prompt: string,
  sessionId: string,
  title?: string,
  fileContext?: FileContext,
): Promise<ChatResponse> {
  const body: Record<string, string> = { prompt, session_id: sessionId };
  if (title) body.title = title;
  if (fileContext) {
    body.file_name = fileContext.name;
    if (fileContext.fileUrl) body.file_url = fileContext.fileUrl;
    if (fileContext.type === 'text') {
      body.file_context = fileContext.content;
    } else {
      body.file_image_b64 = fileContext.b64;
      body.file_image_mime = fileContext.mimeType;
    }
  }
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Guard against HTML error pages (nginx 502, Flask 500, proxy not running, etc.)
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Backend indisponível (HTTP ${res.status}). Verifique se o servidor está rodando.`,
    );
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erro do servidor (${res.status})`);
  return { response: data.response as string, image_url: data.image_url };
}

async function parseJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Backend indisponível (HTTP ${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function listSessions(): Promise<Session[]> {
  const res = await fetch(`${BASE}/sessions`);
  const data = await parseJson<{ sessions: Session[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Failed to list sessions');
  return data.sessions;
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  const res = await fetch(`${BASE}/sessions/${sessionId}`);
  const data = await parseJson<SessionDetail & { error?: string }>(res);
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to get session');
  return data;
}

export async function renameSession(sessionId: string, title: string): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/title`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const data = await parseJson<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Failed to rename session');
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${sessionId}`, { method: 'DELETE' });
  const data = await parseJson<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Failed to delete session');
}

export async function deleteMessage(sessionId: string, msgIndex: number): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/messages/${msgIndex}`, {
    method: 'DELETE',
  });
  const data = await parseJson<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error || 'Failed to delete message');
}
