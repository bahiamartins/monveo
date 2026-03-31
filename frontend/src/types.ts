export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
}

export interface Session {
  session_id: string;
  title: string;
  updated_at?: string;
}

export interface SessionDetail extends Session {
  messages: Message[];
}
