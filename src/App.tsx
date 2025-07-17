import React, { useState, useRef, useEffect, useCallback } from "react";
import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import JSZip from 'jszip';
import { config } from "./config";

// ---[ 1. Типы данных ]---
// Типы остались без изменений, так как они хорошо спроектированы.
interface TitlePart { type: 'title'; content: string; subtitle?: string; }
interface HeadingPart { type: 'heading'; content: string; }
interface SubheadingPart { type: 'subheading'; content: string; }
interface AnnotatedHeadingPart { type: 'annotated_heading'; content: string; tag: string; }
interface QuoteHeadingPart { type: 'quote_heading'; content: string; source?: string; }
interface TextPart { type: 'text'; content: string; }
interface CodePart { type: 'code'; language: string; content: string; }
interface MathPart { type: 'math'; content: string; }
interface ListPart { type: 'list'; items: string[]; }

type ResponsePart =
  | TitlePart | HeadingPart | SubheadingPart | AnnotatedHeadingPart
  | QuoteHeadingPart | TextPart | CodePart | MathPart | ListPart;

interface UserTurn {
  type: 'user';
  prompt: string;
  attachments: File[];
  timestamp: string;
}

interface AITurn {
  type: 'ai';
  parts: ResponsePart[];
  timestamp: string;
}

type ConversationTurn = UserTurn | AITurn;

// ---[ 2. Иконки ]---
// Добавлены иконки Google и Google Drive для новой функциональности.
const GemIcon = ({ className = "w-6 h-6" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const PaperclipIcon = ({ className = "w-5 h-5" }) => ( <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.44 11.05L12.39 19.64C11.11 20.87 9.07 21.01 7.64 19.93C6.21 18.85 6.04 16.86 7.27 15.58L15.86 6.53C16.65 5.74 17.91 5.74 18.7 6.53C19.49 7.32 19.49 8.58 18.7 9.37L10.11 18.42C9.67 18.86 9.01 19.03 8.38 18.85C7.75 18.67 7.23 18.16 7.05 17.53C6.87 16.9 7.04 16.24 7.48 15.8L16.03 6.75C17.26 5.47 19.3 5.33 20.38 6.41C21.46 7.49 21.6 9.53 20.32 10.81L11.27 19.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const FolderIcon = ({ className = "w-5 h-5" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 10H12L10 8H2C1.45 8 1 8.45 1 9V19C1 19.55 1.45 20 2 20H22C22.55 20 23 19.55 23 19V11C23 10.45 22.55 10 22 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const GithubIcon = ({ className = "w-5 h-5" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>);
const GoogleIcon = ({ className = "w-5 h-5" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 6.93l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path></svg>);
const GoogleDriveIcon = ({ className = "w-5 h-5" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.71 1.5L1.5 12.01L4.61 17.26L10.74 6.76L7.71 1.5Z" fill="#3777E3"/><path d="M16.14 1.5L10.74 6.75L13.85 12L19.38 12L16.14 1.5Z" fill="#FFC107"/><path d="M19.38 12L13.85 12L10.73 17.25L16.25 22.5L22.5 12L19.38 12Z" fill="#34A853"/></svg>);
const ArrowUpIcon = ({ className = "w-4 h-4" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const InfoIcon = ({ className = "w-3 h-3" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>);
const SpinnerIcon = ({ className = "w-4 h-4 animate-spin" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v3m0 12v3M4.2 4.2l2.1 2.1m11.4 11.4l2.1 2.1M3 12h3m12 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const FileIconForAttachment = () => ( <svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"></path> </svg>);
const FolderIconForAttachment = () => ( <svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.9-2-2-2h-8l-2-2z"></path> </svg>);
const GithubIconForAttachment = () => ( <svg viewBox="0 0 16 16" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path> </svg>);


// ---[ 3. Вспомогательные компоненты (Декомпозиция) ]---

// Компонент для отображения экрана входа
const AuthScreen = ({ onLogin }: { onLogin: () => void }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <GemIcon className="w-20 h-20 mb-6 text-sky-500" />
        <h2 className="text-3xl font-bold mb-2">{config.appTitle}</h2>
        <p className="max-w-md mb-8 text-gray-600 dark:text-gray-400">
            Для начала работы и сохранения истории чатов, пожалуйста, войдите через ваш Google аккаунт.
        </p>
        <button
            onClick={onLogin}
            className="flex items-center justify-center gap-3 px-6 py-3 bg-white text-gray-800 font-semibold rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
            <GoogleIcon />
            Войти через Google
        </button>
    </div>
);

// Компонент для "чипа" вложения
const AttachmentChip = ({ file }: { file: File }) => {
    // ... логика без изменений
    const isRepo = file.name.startsWith('gh_repo:::');
    const isFolder = file.name.endsWith('.zip');
    let displayName: string = file.name;
    let Icon = FileIconForAttachment;
  
    if (isRepo) {
      displayName = file.name.replace('gh_repo:::', '').replace('_context.txt', '').replace(/---/g, '/');
      Icon = GithubIconForAttachment;
    } else if (isFolder) {
      displayName = file.name.replace('.zip', '');
      Icon = FolderIconForAttachment;
    }
    
    return (
      <div className="flex items-center gap-1 text-sm max-w-xs pl-2 pr-1 py-1 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-slate-300">
        <Icon />
        <span className="truncate" title={displayName}>{displayName}</span>
      </div>
    );
};
  
// Компонент для блока ответа от AI
const ResponseBlock = React.memo(({ part, isDarkMode }: { part: ResponsePart; isDarkMode: boolean }) => {
    // ... логика без изменений
    const [copied, setCopied] = useState(false);
    const handleCopy = (contentToCopy: string) => {
        if (typeof contentToCopy !== 'string') return;
        navigator.clipboard.writeText(contentToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        });
    };

    const markdownPlugins = [remarkMath, remarkGfm];
    const htmlPlugins = [rehypeKatex];

    switch (part.type) {
        case 'title': return (<div className="border-b-2 border-sky-500 dark:border-sky-400 pb-3 mb-4"><h1 className="text-4xl font-bold break-words title"><ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>{part.content}</ReactMarkdown></h1>{part.subtitle && <p className="text-lg mt-1 subtitle"><ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>{part.subtitle}</ReactMarkdown></p>}</div>);
        case 'heading': return <h2 className="text-2xl font-bold border-b dark:border-slate-700 pb-2 pt-4 break-words"><ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>{part.content}</ReactMarkdown></h2>;
        case 'subheading': return <h3 className="text-xl font-semibold pt-3 break-words"><ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>{part.content}</ReactMarkdown></h3>;
        case 'annotated_heading': return (<div className="flex items-center gap-3 pt-4"><h4 className="text-lg font-semibold break-words">{part.content}</h4><span className="info-tag">{part.tag}</span></div>);
        case 'quote_heading': return (
            <blockquote className="my-4 border-l-4 p-4 rounded-r-lg quote-heading-container">
                <p className="text-lg font-medium italic quote-text"><ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>{part.content}</ReactMarkdown></p>
                {part.source && (<footer className="block text-right text-sm mt-2 not-italic quote-cite">— <cite>{part.source}</cite></footer>)}
            </blockquote>
        );
        case 'text': return (<ReactMarkdown className="leading-relaxed break-words prose dark:prose-invert max-w-none" remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>{part.content}</ReactMarkdown>);
        case 'code':
            const codeContent = String(part.content || '');
            return (
                <div className="relative group my-4 rounded-md bg-gray-200 dark:bg-[#282c34] overflow-x-auto">
                    <button onClick={() => handleCopy(codeContent)} className="absolute top-2 right-2 p-1.5 rounded-md bg-black/40 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-black/60" aria-label="Copy code">{copied ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}</button>
                    <SyntaxHighlighter language={part.language === 'error' ? 'bash' : part.language} style={isDarkMode ? oneDark : oneLight} showLineNumbers customStyle={{ margin: 0, padding: '1rem', paddingTop: '1rem', backgroundColor: 'transparent' }}>{codeContent}</SyntaxHighlighter>
                </div>
            );
        case 'math': return <BlockMath math={part.content} />;
        case 'list': return (<ul className="list-disc pl-6 space-y-2 prose dark:prose-invert max-w-none">{part.items.map((item, i) => (<li key={i}><ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>{item}</ReactMarkdown></li>))}</ul>);
        default:
            const unknownPart = part as any;
            return (<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert"><strong className="font-bold">Unknown Block Type!</strong><span className="block sm:inline"> An unknown block type '{unknownPart?.type}' was received.</span><pre className="mt-2 text-xs">{JSON.stringify(unknownPart, null, 2)}</pre></div>);
    }
});
  
// Модальные окна без изменений, т.к. они уже хорошо реализованы.
const HelpModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => { /* ... код без изменений ... */ };
const RepoCloneModal = ({ isOpen, onClose, onSubmit, isCloning }: { isOpen: boolean, onClose: () => void, onSubmit: (url: string) => void, isCloning: boolean }) => { /* ... код без изменений ... */ };


// ---[ 4. ОСНОВНОЙ КОМПОНЕНТ APP ]---
export default function App() {
  // --- State Management ---
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(config.models[0].id);
  const [inputText, setInputText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // --- UI State ---
  const [showHelp, setShowHelp] = useState(false);
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  
  // --- НОВЫЙ STATE для аутентификации ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<{name: string, email: string, picture: string} | null>(null);
  
  // --- Refs ---
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [conversation, isLoading]);
  
  // ---[ MOCK-функции для Google API ]---
  /**
   * @description Имитирует процесс входа пользователя через Google.
   * В реальном приложении здесь будет вызов SDK Google Identity Services.
   * После успешного входа мы получаем профиль пользователя и "загружаем" его историю.
   */
  const handleGoogleLogin = useCallback(async () => {
    console.log("Имитация входа через Google...");
    // Имитация задержки сети
    await new Promise(res => setTimeout(res, 500)); 

    // Mock-данные пользователя
    const mockProfile = {
        name: "Alexey Smirnov",
        email: "alexey.s@example.com",
        picture: "https://lh3.googleusercontent.com/a/ACg8ocJ-9...=s96-c" // Пример URL
    };
    setUserProfile(mockProfile);
    setIsAuthenticated(true);
    console.log("Пользователь аутентифицирован:", mockProfile.name);
    
    // После входа, имитируем загрузку истории с Google Drive
    await loadHistoryFromDrive(mockProfile.email);
  }, []);

  /**
   * @description Имитирует сохранение истории чата в Google Drive.
   * В реальном приложении здесь будет вызов Google Drive API для создания/обновления файла.
   * @param userEmail - Email пользователя для идентификации файла.
   * @param history - Массив диалогов для сохранения.
   */
  const saveHistoryToDrive = async (userEmail: string, history: ConversationTurn[]) => {
      if (!isAuthenticated) return;
      console.log(`Имитация сохранения истории для ${userEmail} в Google Drive...`);
      // 1. Сериализовать историю в JSON
      const historyJson = JSON.stringify(history, null, 2);
      // 2. В реальном приложении: использовать gapi.client.drive для поиска файла
      //    или создания нового с именем вроде `gemini-gateway-history-${userEmail}.json`
      // 3. Обновить содержимое файла
      await new Promise(res => setTimeout(res, 300)); // Имитация вызова API
      console.log("История успешно 'сохранена'.");
      // Можно показать уведомление пользователю
  };

  /**
   * @description Имитирует загрузку истории чата с Google Drive.
   * @param userEmail - Email пользователя для поиска файла истории.
   */
  const loadHistoryFromDrive = async (userEmail: string) => {
    if (!isAuthenticated) return;
    console.log(`Имитация загрузки истории для ${userEmail} с Google Drive...`);
    // В реальном приложении: использовать gapi.client.drive для поиска и чтения файла
    await new Promise(res => setTimeout(res, 400)); // Имитация вызова API
    // Допустим, мы не нашли историю для нового пользователя или она пуста
    setConversation([]); 
    console.log("История 'загружена'. Новых сообщений нет.");
  };

  // --- Основные обработчики ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesToUpload = e.target.files ? Array.from(e.target.files) : [];
    if (filesToUpload.length > 0) { setAttachedFiles(prevFiles => [...prevFiles, ...filesToUpload]); }
    e.target.value = '';
  };
  
  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const zip = new JSZip();
    let folderName = "";
    Array.from(files).forEach(file => {
      const relativePath = (file as any).webkitRelativePath;
      if (relativePath) {
        if (!folderName) folderName = relativePath.split('/')[0];
        zip.file(relativePath, file);
      }
    });
    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipFile = new File([zipBlob], `${folderName || 'project'}.zip`, { type: "application/zip" });
      setAttachedFiles(prevFiles => [...prevFiles, zipFile]);
    } catch (err) { console.error("Failed to create zip file", err); setError("Failed to process folder."); }
    if (e.target) e.target.value = "";
  };

  const handleCloneRepo = async (url: string) => {
    setIsCloning(true);
    setError(null);
    try {
      const response = await fetch(`${config.backendUrl}/api/clone_repo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify({ url })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to clone repository');
      }
      const data = await response.json();
      const repoFile = new File([data.processed_text], `gh_repo:::${data.repo_name.replace('gh_repo:::', '')}_context.txt`, { type: "text/plain" });
      setAttachedFiles(prevFiles => [...prevFiles, repoFile]);
      setIsRepoModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      setError(`Clone failed: ${message}`);
    } finally {
      setIsCloning(false);
    }
  };

  const removeFile = (indexToRemove: number) => {
    setAttachedFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };
  
  const handleSubmit = async () => {
    if (!apiKey) { alert("Please enter your API key."); return; }
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    const newUserTurn: UserTurn = {
      type: 'user',
      prompt: inputText,
      attachments: attachedFiles,
      timestamp: new Date().toLocaleTimeString()
    };
    
    const updatedConversation = [...conversation, newUserTurn];
    setConversation(updatedConversation);

    const formData = new FormData();
    formData.append("apiKey", apiKey);
    formData.append("prompt", inputText);
    formData.append("model", model);
    formData.append("refinerModel", config.refinerModel);
    attachedFiles.forEach(file => { formData.append("files", file); });
    
    setInputText("");
    setAttachedFiles([]);
    
    try {
      const response = await fetch(`${config.backendUrl}/api/generate`, {
          method: "POST",
          headers: { 'ngrok-skip-browser-warning': 'true' },
          body: formData
      });

      if (!response.ok) {
        let errorDetail = "An unknown server error occurred";
        try { const errorData = await response.json(); errorDetail = errorData.detail || JSON.stringify(errorData); } 
        catch (jsonError) { errorDetail = await response.text(); }
        throw new Error(errorDetail);
      }

      const data: ResponsePart[] = await response.json();
      const newAiTurn: AITurn = { type: 'ai', parts: data, timestamp: new Date().toLocaleTimeString() };
      const finalConversation = [...updatedConversation, newAiTurn];
      setConversation(finalConversation);

      // После успешного ответа AI, сохраняем обновленную историю
      if (userProfile) {
          await saveHistoryToDrive(userProfile.email, finalConversation);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      const errorTurn: AITurn = { type: 'ai', parts: [{ type: 'code', language: 'error', content: `Request failed: ${message}` }], timestamp: new Date().toLocaleTimeString() };
      setConversation(prev => [...prev, errorTurn]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Рендеринг ---
  return (
    <>
      <RepoCloneModal isOpen={isRepoModalOpen} onClose={() => setIsRepoModalOpen(false)} onSubmit={handleCloneRepo} isCloning={isCloning} />
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <div className={`h-screen flex flex-col transition-colors duration-300 ${isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
        <header className="border-b border-gray-700/30 dark:border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 bg-gray-50/60 dark:bg-gray-900/60 backdrop-blur-md z-30">
             <div className="flex items-center gap-2">
                <GemIcon />
                <h1 className="text-xl font-semibold tracking-tight">{config.appTitle}</h1>
            </div>
            <div className="flex items-center gap-4">
                {/* ТРЕБОВАНИЕ 3: Замена иконок на Unicode символы */}
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-2xl rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors" aria-label="Toggle theme">
                    {isDarkMode ? '☀️' : '🌙'}
                </button>
                <button onClick={() => setShowHelp(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                    {config.helpButtonText}
                </button>
                {/* ТРЕБОВАНИЕ 1: Отображение иконки Google для входа/профиля */}
                {isAuthenticated && userProfile ? (
                    <img src={userProfile.picture} alt={userProfile.name} className="w-8 h-8 rounded-full" title={`Вы вошли как ${userProfile.name}`} />
                ) : (
                    <button onClick={handleGoogleLogin} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors" aria-label="Login with Google">
                       <GoogleIcon />
                    </button>
                )}
            </div>
        </header>
        
        {/* ТРЕБОВАНИЕ 1: Окно чата доступно только после аутентификации */}
        {!isAuthenticated ? (
            <main className="flex-1 flex min-h-0">
                <AuthScreen onLogin={handleGoogleLogin} />
            </main>
        ) : (
          /* ТРЕБОВАНИЕ 2: Позиционирование окна чатов (сохранена структура) */
          <main className="max-w-6xl w-full mx-auto grid flex-1 grid-cols-1 lg:grid-cols-3 gap-6 p-6 min-h-0">
            <aside className="lg:col-span-1 flex flex-col gap-4">
              <div className={`p-6 rounded-xl shadow-sm border border-gray-700/30 dark:border-gray-700 ${isDarkMode ? "bg-gray-800/60" : "bg-white/60"} flex-1`}>
                <h2 className="text-lg font-semibold mb-4">API Configuration</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="api-key" className="block text-sm font-medium mb-1">Gemini API Key</label>
                    <input id="api-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIzaSy..."
                      className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isDarkMode ? "bg-gray-700/50 border-gray-600 focus:border-blue-500" : "bg-gray-50 border-gray-300 focus:border-blue-500"}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="model-select" className="block text-sm font-medium mb-1">Select Gemini Model</label>
                    <select id="model-select" value={model} onChange={(e) => setModel(e.target.value)} className="w-full px-4 py-2 rounded-lg border appearance-none select-arrow bg-gray-50 border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400">
                      {config.models.map((m) => ( <option key={m.id} value={m.id} className="dark:bg-slate-800">{m.name}</option>))}
                    </select>
                  </div>
                   <div className="pt-2">
                     <button onClick={() => saveHistoryToDrive(userProfile?.email || 'user', conversation)} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-md text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-gray-700">
                        <GoogleDriveIcon />
                        Сохранить историю в Google Drive
                     </button>
                   </div>
                </div>
              </div>
            </aside>

            {/* Правая часть - чат */}
            <div className={`lg:col-span-2 rounded-xl shadow-sm border border-gray-700/30 dark:border-gray-700 flex flex-col min-h-0 ${isDarkMode ? "bg-gray-800/60" : "bg-white/60"}`}>
              <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-700 scrollbar-track-transparent">
                  {conversation.length === 0 && !isLoading && (
                      <div className="flex flex-col items-center justify-center h-full text-center opacity-70">
                        <GemIcon className="w-16 h-16 mb-4" />
                        <h3 className="text-lg font-medium mb-1">Начните диалог</h3>
                        <p className="text-sm max-w-md">Введите ваш запрос. Вы можете прикреплять файлы, папки или репозитории для контекста.</p>
                      </div>
                  )}
                  {conversation.map((turn, index) => (
                    <div key={index} className={`flex flex-col gap-2 ${turn.type === 'user' ? 'items-end' : 'items-start'}`}>
                      {turn.type === 'user' ? (
                        <div className="user-bubble">
                          <ReactMarkdown className="prose dark:prose-invert max-w-none break-words" remarkPlugins={[remarkGfm]}>{turn.prompt}</ReactMarkdown>
                          {turn.attachments.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/20 flex flex-wrap gap-2">
                              {turn.attachments.map((file, i) => <AttachmentChip key={i} file={file} />)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="ai-bubble">
                          {turn.parts.map((part, i) => <ResponseBlock key={i} part={part} isDarkMode={isDarkMode} />)}
                        </div>
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400 px-2">{turn.timestamp}</span>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex items-start gap-3">
                      <div className="ai-bubble opacity-80"><div className="flex items-center gap-2"><SpinnerIcon className="w-5 h-5"/> Gemini думает...</div></div>
                    </div>
                  )}
                  {error && <div className="text-red-500 bg-red-500/10 p-3 rounded-lg">{error}</div>}
              </div>

              <div className="border-t border-gray-700/30 dark:border-gray-700 p-4 bg-gray-100/50 dark:bg-gray-900/50">
                {attachedFiles.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {attachedFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center gap-1 text-sm max-w-xs pl-2 pr-1 py-1 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-slate-300">
                          <AttachmentChip file={file} /><button onClick={() => removeFile(index)} className="text-red-500 hover:text-red-400 font-bold text-lg leading-none flex items-center justify-center w-4 h-4">×</button>
                        </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors" aria-label="Attach file"><PaperclipIcon /></button>
                  <button onClick={() => folderInputRef.current?.click()} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors" aria-label="Attach folder"><FolderIcon /></button>
                  <button onClick={() => setIsRepoModalOpen(true)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors" aria-label="Attach GitHub repo"><GithubIcon /></button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
                  <input type="file" ref={folderInputRef} onChange={handleFolderChange} className="hidden" multiple {...{ webkitdirectory: "" }}/>
                </div>
                <div className="relative">
                  <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }}} placeholder="Спросите Gemini о чем-нибудь..." rows={3}
                    className={`w-full px-4 py-3 pr-48 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none ${isDarkMode ? "bg-gray-700/50 border-gray-600 focus:border-blue-500" : "bg-gray-50 border-gray-300 focus:border-blue-500"}`}
                  />
                  <div className="absolute right-3 bottom-3 flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <input type="checkbox" id="use-history" disabled className="w-3 h-3 rounded border-gray-600 accent-blue-600 cursor-not-allowed"/>
                      <label htmlFor="use-history" className="cursor-not-allowed">Запомнить контекст</label>
                      <span className="tooltip group relative inline-block ml-1"><InfoIcon /><span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs p-2 rounded opacity-90 w-64 text-center z-10 whitespace-normal">{config.dialog.historyToggleWarning}</span></span>
                    </div>
                    <button onClick={handleSubmit} disabled={!inputText.trim() || isLoading} className={`px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-2 ${(!inputText.trim() || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {isLoading ? (<SpinnerIcon />) : (<ArrowUpIcon />)}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}
        <footer className="mt-auto border-t border-gray-700/30 dark:border-gray-700 px-6 py-4 text-center text-sm text-gray-500">
          <p>© 2025 Gemini Gateway Studio — Powered by Google AI</p>
        </footer>
      </div>
    </>
  );
}
