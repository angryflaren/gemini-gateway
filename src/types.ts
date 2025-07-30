// --- Types for AI responses (from the old App.tsx) ---
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

// --- Types for the conversation structure ---
interface UserTurn {
  type: 'user';
  prompt: string;
  attachments: { name: string; type: string; content: string }[]; // File content as base64
  timestamp: string;
}

interface AITurn {
  type: 'ai';
  parts: ResponsePart[];
  timestamp: string;
}

export type ConversationTurn = UserTurn | AITurn;

// --- Types for chats on Google Drive ---
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

// --- Type for Google user profile ---
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
}