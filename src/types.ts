// --- Типы для ответов AI (из старого App.tsx) ---
interface TitlePart { type: 'title'; content: string; subtitle?: string; }
interface HeadingPart { type: 'heading'; content: string; }
interface SubheadingPart { type: 'subheading'; content: string; }
interface AnnotatedHeadingPart { type: 'annotated_heading'; content: string; tag: string; }
interface QuoteHeadingPart { type: 'quote_heading'; content: string; source?: string; }
interface TextPart { type: 'text'; content: string; }
interface CodePart { type: 'code'; language: string; content: string; }
interface MathPart { type: 'math'; content: string; }
interface ListPart { type: 'list'; items: string[]; }

export type ResponsePart =
  | TitlePart | HeadingPart | SubheadingPart | AnnotatedHeadingPart
  | QuoteHeadingPart | TextPart | CodePart | MathPart | ListPart;

// --- Типы для структуры диалога ---
interface UserTurn {
  type: 'user';
  prompt: string;
  attachments: { name: string; type: string; content: string }[]; // Содержимое файла как base64
  timestamp: string;
}

interface AITurn {
  type: 'ai';
  parts: ResponsePart[];
  timestamp: string;
}

export type ConversationTurn = UserTurn | AITurn;

// --- Типы для чатов на Google Drive ---
export interface Chat {
  id: string;
  name: string;
  createdTime: string;
}

export interface ChatContent {
  id: string;
  name: string;
  conversation: ConversationTurn[];
}

// --- Тип для профиля пользователя Google ---
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
}
