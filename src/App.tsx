/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect } from "react";
import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import JSZip from 'jszip';
import { config } from "./config";
import { v4 as uuidv4 } from 'uuid';


// --- 1. ТИПЫ ДАННЫХ ---
// Определения ResponsePart остаются без изменений
interface TitlePart { type: 'title'; content: string; subtitle?: string; }
interface HeadingPart { type: 'heading'; content: string; }
interface SubheadingPart { type: 'subheading'; content: string; }
interface AnnotatedHeadingPart { type: 'annotated_heading'; content: string; tag: string; }
interface QuoteHeadingPart { type: 'quote_heading'; content: string; source?: string; }
interface TextPart { type: 'text'; content: string; }
interface CodePart { type: 'code'; language: string; content: string; }
interface MathPart { type: 'math'; content: string; }
interface ListPart { type: 'list'; items: string[]; }
interface SystemMessagePart { type: 'system_message'; content: string; }

type ResponsePart =
  | TitlePart
  | HeadingPart
  | SubheadingPart
  | AnnotatedHeadingPart
  | QuoteHeadingPart
  | TextPart
  | CodePart
  | MathPart
  | ListPart
  | SystemMessagePart;

// НОВЫЙ ТИП: Определяет один "ход" в диалоге
interface ChatTurn {
  id: string;
  role: 'user' | 'model';
  parts: ResponsePart[];
  isLoading?: boolean;
}

// --- Вспомогательные иконкы (без изменений) ---
const GithubIcon = () => ( <svg viewBox="0 0 16 16" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path> </svg>);
const FolderIcon = () => ( <svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.9-2-2-2h-8l-2-2z"></path> </svg>);
const FileIcon = () => ( <svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"></path> </svg>);
const SendIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>);


const RepoCloneModal = ({ isOpen, onClose, onSubmit, isCloning }: { isOpen: boolean, onClose: () => void, onSubmit: (url: string) => void, isCloning: boolean }) => {
  const [url, setUrl] = useState("");
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-slate-100">{config.repoModal.title}</h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">{config.repoModal.description}</p>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={config.repoModal.placeholder} className="w-full px-4 py-2 border rounded-md outline-none focus:ring-2 bg-white border-gray-300 text-gray-800 focus:ring-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:focus:ring-sky-500 dark:text-white"/>
        <div className="flex justify-end gap-4 mt-6">
          <button onClick={onClose} disabled={isCloning} className="px-4 py-2 text-sm rounded-md text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700">{config.repoModal.cancelButton}</button>
          <button onClick={() => onSubmit(url)} disabled={isCloning || !url} className="px-4 py-2 text-sm rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:bg-slate-500">
            {isCloning ? config.repoModal.submitButtonCloning : config.repoModal.submitButton}
          </button>
        </div>
      </div>
    </div>
  );
};

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 p-0.5">
    <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 5.85c-.09.55-.525.954-1.095 1.034l-3.022.504a1.875 1.875 0 00-1.556 2.89l1.173 2.535c.34.733.204 1.62-.358 2.15l-1.62 1.523a1.875 1.875 0 000 2.652l1.62 1.523c.562.53.7 1.417.358 2.15l-1.173 2.535a1.875 1.875 0 001.556 2.89l3.022.504c.57.08 1.005.484 1.095 1.034l.178 2.033c.15.904.933 1.567 1.85 1.567h1.844c.917 0 1.699-.663 1.85-1.567l.178-2.034c.09-.55.525-.954 1.095-1.034l3.022-.504a1.875 1.875 0 001.556-2.89l-1.173-2.535c-.34-.733-.204-1.62.358-2.15l1.62-1.523a1.875 1.875 0 000-2.652l-1.62-1.523c-.562-.53-.7-1.417-.358-2.15l1.173-2.535a1.875 1.875 0 00-1.556-2.89l-3.022-.504c-.57-.08-1.005-.484-1.095-1.034L13.172 3.817c-.15-.904-.933-1.567-1.85-1.567h-1.844zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
  </svg>
);

const SettingsModal = ({ isOpen, onClose, currentApiKey, onSave }: { isOpen: boolean, onClose: () => void, currentApiKey: string, onSave: (key: string) => void }) => {
  const [key, setKey] = useState(currentApiKey);

  useEffect(() => {
    setKey(currentApiKey);
  }, [currentApiKey, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(key);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-slate-100">Настройки</h3>
        <div className="space-y-2">
            <label htmlFor="apiKeyInput" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Google Gemini API Key
            </label>
            <input 
                id="apiKeyInput"
                type="password" 
                value={key} 
                onChange={(e) => setKey(e.target.value)} 
                placeholder="Введите ваш API ключ..." 
                className="w-full px-4 py-2 border rounded-md outline-none focus:ring-2 bg-white border-gray-300 text-gray-800 focus:ring-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:focus:ring-sky-500 dark:text-white"
            />
             <p className="text-xs text-gray-500 dark:text-slate-400">
                Ваш ключ хранится только в вашем браузере.
            </p>
        </div>
        <div className="flex justify-end gap-4 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700">Отмена</button>
          <button onClick={handleSave} className="px-4 py-2 text-sm rounded-md bg-sky-600 text-white hover:bg-sky-700">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

const ResponseBlock = React.memo(({ part, isDarkMode }: { part: ResponsePart; isDarkMode: boolean }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (contentToCopy: string) => {
    if (typeof contentToCopy !== 'string') return;
    navigator.clipboard.writeText(contentToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  switch (part.type) {
    case 'title':
        return (
            <div className="border-b-2 border-sky-500 dark:border-sky-400 pb-3 mb-4">
                <h1 className="text-3xl font-bold break-words title"><ReactMarkdown>{part.content}</ReactMarkdown></h1>
                {part.subtitle && <p className="text-md mt-1 subtitle"><ReactMarkdown>{part.subtitle}</ReactMarkdown></p>}
            </div>
        );
    case 'heading':
      return <h2 className="text-2xl font-bold border-b dark:border-slate-700 pb-2 pt-4 break-words"><ReactMarkdown>{part.content}</ReactMarkdown></h2>;
    case 'subheading':
        return <h3 className="text-xl font-semibold pt-3 break-words"><ReactMarkdown>{part.content}</ReactMarkdown></h3>;
    case 'annotated_heading':
        return (
            <div className="flex items-center gap-3 pt-4">
                <h4 className="text-lg font-semibold break-words">{part.content}</h4>
                <span className="info-tag">{part.tag}</span>
            </div>
        );
    case 'quote_heading':
        return (
            <div className="my-4 border-l-4 p-4 rounded-r-lg quote-heading-container">
                <p className="text-lg font-medium italic quote-text"><ReactMarkdown>{part.content}</ReactMarkdown></p>
                {part.source && <cite className="block text-right text-sm mt-2 not-italic quote-cite">— {part.source}</cite>}
            </div>
        );
    case 'text':
        return (
            <ReactMarkdown
                className="leading-relaxed break-words prose dark:prose-invert max-w-none"
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
            >
                {part.content}
            </ReactMarkdown>
        );
    case 'system_message':
        return (
            <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-2">
                {part.content}
            </div>
        );
    case 'code':
      const codeContent = String(part.content || '');
      return (
        <div className="relative group my-2 rounded-lg bg-[#282c34] text-left">
          <button onClick={() => handleCopy(codeContent)} className="absolute top-2 right-2 p-1.5 rounded-md bg-black/40 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-black/60" aria-label="Copy code">
            {copied ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
          </button>
          <SyntaxHighlighter
            language={part.language === 'error' ? 'bash' : part.language}
            style={isDarkMode ? oneDark : oneLight}
            showLineNumbers
            customStyle={{
                margin: 0,
                border: 'none',
                padding: '1rem',
                backgroundColor: 'transparent',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
            }}
            codeTagProps={{
              className: "text-sm"
            }}
          >
            {codeContent}
          </SyntaxHighlighter>
        </div>
      );
    case 'math':
      return <BlockMath math={part.content} />;
    case 'list':
      return (
        <ul className="list-disc pl-6 space-y-2 prose dark:prose-invert max-w-none text-left">
          {part.items.map((item, i) => (<li key={i}><ReactMarkdown>{item}</ReactMarkdown></li>))}
        </ul>
      );
    default:
      const unknownPart = part as any;
      return (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-left" role="alert">
          <strong className="font-bold">Unknown Block Type!</strong>
          <span className="block sm:inline"> An unknown block type '{unknownPart?.type}' was received.</span>
          <pre className="mt-2 text-xs">{JSON.stringify(unknownPart, null, 2)}</pre>
        </div>
      );
  }
});

const HelpModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-slate-100">{config.helpModal.title}</h3>
                <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
                    <p>{config.helpModal.introduction}</p>
                    <div><h4 className="font-semibold">{config.helpModal.apiKeyTitle}</h4><p>{config.helpModal.apiKeySection}</p></div>
                    <div><h4 className="font-semibold">{config.helpModal.filesTitle}</h4><p>{config.helpModal.filesSection}</p></div>
                    <div><h4 className="font-semibold">{config.helpModal.repoTitle}</h4><ReactMarkdown>{config.helpModal.repoSection}</ReactMarkdown></div>
                    <div><h4 className="font-semibold">{config.helpModal.contactTitle}</h4><ReactMarkdown>{config.helpModal.contactSection}</ReactMarkdown></div>
                </div>
                <div className="flex justify-end mt-6"><button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-sky-600 text-white hover:bg-sky-700">{config.helpModal.closeButton}</button></div>
            </div>
        </div>
    );
};

// НОВЫЙ КОМПОНЕНТ: "Пузырь" для одного сообщения в чате
const ChatBubble = ({ turn, isDarkMode }: { turn: ChatTurn; isDarkMode: boolean }) => {
    const bubbleClasses = turn.role === 'user'
        ? "bg-sky-500 text-white self-end"
        : "bg-white dark:bg-slate-700 self-start";

    if (turn.isLoading) {
        return (
            <div className={`chat-bubble self-start bg-white dark:bg-slate-700`}>
                <div className="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        )
    }

    return (
        <div className={`chat-bubble ${bubbleClasses}`}>
            <div className="space-y-4">
                {turn.parts.map((part, index) => <ResponseBlock key={index} part={part} isDarkMode={isDarkMode} />)}
            </div>
        </div>
    );
};


const App = () => {
  // --- Состояния ---
  const [apiKey, setApiKey] = useState(localStorage.getItem("gemini-api-key") || "");
  const [inputText, setInputText] = useState("");
  const [model, setModel] = useState(config.models[0].id);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  
  // --- Ref-ы ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // --- Эффекты ---
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    // Сохранение API ключа в localStorage
    localStorage.setItem("gemini-api-key", apiKey);
  }, [apiKey]);
  
  useEffect(() => {
    // Автоматическая прокрутка чата вниз
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatHistory]);


  // --- Обработчики событий ---
  const toggleTheme = () => setIsDarkMode(!isDarkMode);
  const removeFile = (indexToRemove: number) => { setAttachedFiles(prev => prev.filter((_, i) => i !== indexToRemove)); };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading || !inputText.trim()) return;
    if (!apiKey) {
        setChatHistory(prev => [...prev, {
            id: uuidv4(),
            role: 'model',
            parts: [{ type: 'system_message', content: 'Ошибка: Пожалуйста, введите ваш Gemini API ключ в настройках.' }]
        }]);
        return;
    }

    setIsLoading(true);

    // 1. Добавить сообщение пользователя в историю
    const userTurn: ChatTurn = {
        id: uuidv4(),
        role: 'user',
        parts: [{ type: 'text', content: inputText.trim() }]
    };
    // 2. Добавить плейсхолдер для ответа модели
    const modelLoadingTurn: ChatTurn = {
        id: uuidv4(),
        role: 'model',
        parts: [],
        isLoading: true
    };
    setChatHistory(prev => [...prev, userTurn, modelLoadingTurn]);
    setInputText(""); // Очистить поле ввода
    
    // --- Подготовка и отправка запроса ---
    const formData = new FormData();
    formData.append("apiKey", apiKey);
    formData.append("prompt", inputText.trim());
    formData.append("model", model);
    formData.append("refinerModel", config.refinerModel);
    attachedFiles.forEach(file => { formData.append("files", file); });
    setAttachedFiles([]); // Очистить файлы после отправки

    try {
        const response = await fetch(`${config.backendUrl}/api/generate`, {
            method: "POST",
            headers: { 'ngrok-skip-browser-warning': 'true' },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || JSON.stringify(errorData));
        }

        const data: ResponsePart[] = await response.json();
        const modelResponseTurn: ChatTurn = { id: modelLoadingTurn.id, role: 'model', parts: data };

        // 3. Заменить плейсхолдер на реальный ответ
        setChatHistory(prev => prev.map(turn => turn.id === modelLoadingTurn.id ? modelResponseTurn : turn));

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        const errorTurn: ChatTurn = {
            id: modelLoadingTurn.id,
            role: 'model',
            parts: [{ type: 'code', language: 'error', content: `Request failed: ${message}` }]
        };
        // 4. Заменить плейсхолдер на сообщение об ошибке
        setChatHistory(prev => prev.map(turn => turn.id === modelLoadingTurn.id ? errorTurn : turn));
    } finally {
        setIsLoading(false);
    }
  };
  
  // Остальные обработчики (файлы, репозитории, модальные окна) с минимальными изменениями
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesToUpload = e.target.files ? Array.from(e.target.files) : [];
    if (filesToUpload.length > 0) { setAttachedFiles(prevFiles => [...prevFiles, ...filesToUpload]); }
    e.target.value = '';
    setIsAttachMenuOpen(false);
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
    } catch (err) { console.error("Failed to create zip file", err); }
    if (e.target) e.target.value = "";
    setIsAttachMenuOpen(false);
  };

  const handleCloneRepo = async (url: string) => {
    setIsCloning(true);
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
      const errorTurn: ChatTurn = {
        id: uuidv4(),
        role: 'model',
        parts: [{ type: 'code', language: 'error', content: `Clone failed: ${message}` }]
      };
      setChatHistory(prev => [...prev, errorTurn]);
    } finally {
      setIsCloning(false);
    }
  };

  const handleUploadFileClick = () => fileInputRef.current?.click();
  const handleUploadFolderClick = () => folderInputRef.current?.click();

  // --- Рендеринг ---
  return (
    <>
      <RepoCloneModal isOpen={isRepoModalOpen} onClose={() => setIsRepoModalOpen(false)} onSubmit={handleCloneRepo} isCloning={isCloning} />
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} currentApiKey={apiKey} onSave={setApiKey} />
      
      <div className="flex h-screen flex-col transition-colors duration-300 bg-gray-50 text-gray-800 dark:bg-slate-900 dark:text-slate-200">
        <header className="px-6 py-3 flex justify-between items-center shadow-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{config.appTitle}</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHelp(true)} className="px-3 py-1 text-xs rounded-md transition-colors bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20">{config.helpButtonText}</button>
            <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 rounded-full transition-colors bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600" aria-label="Settings"><SettingsIcon/></button>
            <button onClick={toggleTheme} className="p-2 rounded-full transition-colors bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600" aria-label="Toggle theme">{isDarkMode ? '☀️' : '🌙'}</button>
          </div>
        </header>

        <main className="flex-grow flex w-full max-w-4xl mx-auto overflow-hidden">
            {/* Панель настроек слева (опционально, сейчас скрыта, но можно будет добавить) */}
            {/* <aside className="w-1/4 p-4 border-r dark:border-slate-800">...</aside> */}

            <div className="flex flex-col flex-1">
                {/* Область чата */}
                <div ref={chatContainerRef} className="flex-grow p-6 space-y-6 overflow-y-auto">
                    {chatHistory.length === 0 && (
                        <div className="text-center text-slate-500 dark:text-slate-400 mt-8">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Gemini Gateway Studio</h2>
                            <p className="mt-2">Начните диалог, задав вопрос ниже.</p>
                        </div>
                    )}
                    {chatHistory.map(turn => <ChatBubble key={turn.id} turn={turn} isDarkMode={isDarkMode} />)}
                </div>

                {/* Поле ввода */}
                <div className="p-4 bg-white/50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                    <form onSubmit={handleSubmit} className="w-full">
                         {attachedFiles.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-2">
                                {attachedFiles.map((file, index) => {
                                const isRepo = file.name.startsWith('gh_repo:::');
                                const isFolder = file.name.endsWith('.zip');
                                let displayName: string = file.name;
                                let Icon = FileIcon;
                                if (isRepo) {
                                    displayName = file.name.replace('gh_repo:::', '').replace('_context.txt', '').replace(/---/g, '/');
                                    Icon = GithubIcon;
                                } else if (isFolder) {
                                    displayName = file.name.replace('.zip', '');
                                    Icon = FolderIcon;
                                }
                                return (
                                    <div key={`${file.name}-${index}`} className="flex items-center gap-1 text-sm max-w-xs pl-2 pr-1 py-1 rounded-full bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-300">
                                    <Icon />
                                    <span className="truncate" title={displayName}>{displayName}</span>
                                    <button type="button" onClick={() => removeFile(index)} className="text-red-500 hover:text-red-400 font-bold w-5 h-5 flex items-center justify-center rounded-full">&times;</button>
                                    </div>
                                );
                                })}
                            </div>
                        )}
                        <div className="relative">
                            <textarea
                                rows={1}
                                value={inputText}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Спросите что-нибудь у Gemini..."
                                className="w-full pl-12 pr-14 py-3 border rounded-lg resize-none outline-none focus:ring-2 transition-colors bg-white border-gray-300 text-gray-800 focus:ring-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:focus:ring-sky-500 dark:text-white"
                            />
                             <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                 <button type="button" onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)} className="p-2 rounded-full transition-colors text-slate-500 hover:bg-gray-200 dark:text-slate-400 dark:hover:bg-slate-600" aria-label="Attach file">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                 </button>
                                {isAttachMenuOpen && (
                                <div className="absolute bottom-full mb-2 w-56 rounded-md shadow-lg py-1 z-10 bg-white dark:bg-slate-700 ring-1 ring-black ring-opacity-5">
                                    <button onClick={handleUploadFileClick} className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-600"> <FileIcon/> Загрузить файлы</button>
                                    <button onClick={handleUploadFolderClick} className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-600"><FolderIcon/> Загрузить папку</button>
                                    <button onClick={() => { setIsRepoModalOpen(true); setIsAttachMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-600"><GithubIcon/> Репозиторий GitHub</button>
                                </div>)}
                            </div>
                            <button type="submit" disabled={isLoading || !inputText.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-md bg-sky-600 text-white hover:bg-sky-700 transition font-semibold disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed">
                                <SendIcon/>
                            </button>
                        </div>
                         {/* НОВЫЙ ЭЛЕМЕНТ УПРАВЛЕНИЯ */}
                        <div className="flex items-center justify-start mt-3 pl-2">
                             <div className="history-toggle-wrapper" title={config.dialog.historyToggleWarning}>
                                <label className="flex items-center cursor-not-allowed">
                                    <input type="checkbox" disabled className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 cursor-not-allowed" />
                                    <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{config.dialog.historyToggleLabel}</span>
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </main>
        
        {/* Скрытые инпуты для файлов */}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
        <input type="file" ref={folderInputRef} onChange={handleFolderChange} className="hidden" multiple webkitdirectory="" />
      </div>
    </>
  );
};

export default App;
