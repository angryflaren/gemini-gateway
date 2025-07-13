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
// Блоки ответа AI (без изменений)
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

// НОВЫЕ ТИПЫ для структуры диалога
interface UserMessage {
  id: string;
  sender: 'user';
  text: string;
  files: File[];
}

interface AiMessage {
  id:string;
  sender: 'ai';
  parts: ResponsePart[];
  isLoading: boolean;
}

type ChatMessage = UserMessage | AiMessage;


// --- 2. ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---
// Иконки (без изменений)
const GithubIcon = () => ( <svg viewBox="0 0 16 16" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path> </svg>);
const FolderIcon = () => ( <svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.9-2-2-2h-8l-2-2z"></path> </svg>);
const FileIcon = () => ( <svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"></path> </svg>);
const AiIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" height="1.5em" width="1.5em"><path d="M12,2A10,10,0,0,0,2,12A10,10,0,0,0,12,22A10,10,0,0,0,22,12A10,10,0,0,0,12,2M8,17.5A1.5,1.5,0,0,1,6.5,16A1.5,1.5,0,0,1,8,14.5A1.5,1.5,0,0,1,9.5,16A1.5,1.5,0,0,1,8,17.5M16,17.5A1.5,1.5,0,0,1,14.5,16A1.5,1.5,0,0,1,16,14.5A1.5,1.5,0,0,1,17.5,16A1.5,1.5,0,0,1,16,17.5M12,12.5A2.5,2.5,0,0,1,9.5,10A2.5,2.5,0,0,1,12,7.5A2.5,2.5,0,0,1,14.5,10A2.5,2.5,0,0,1,12,12.5Z"></path></svg>);
const UserIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" height="1.5em" width="1.5em"><path d="M12,2A10,10,0,0,0,2,12A10,10,0,0,0,12,22A10,10,0,0,0,22,12A10,10,0,0,0,12,2M12,6A3,3,0,0,1,15,9A3,3,0,0,1,12,12A3,3,0,0,1,9,9A3,3,0,0,1,12,6M12,14C16.42,14,20,15.79,20,18V19H4V18C4,15.79,7.58,14,12,14Z"></path></svg>);

// Модальные окна (без изменений)
const RepoCloneModal = ({ isOpen, onClose, onSubmit, isCloning }: { isOpen: boolean, onClose: () => void, onSubmit: (url: string) => void, isCloning: boolean }) => { /* ... код без изменений ... */ };
const HelpModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => { /* ... код без изменений ... */ };

// Компонент для отображения одного блока ответа AI (без изменений)
const ResponseBlock = React.memo(({ part, isDarkMode }: { part: ResponsePart; isDarkMode: boolean }) => { /* ... код без изменений ... */ });

// --- 3. НОВЫЕ КОМПОНЕНТЫ ДЛЯ ДИАЛОГА ---

// Компонент для отображения сообщения пользователя
const UserMessageBlock = ({ message }: { message: UserMessage }) => (
    <div className="flex gap-4 items-start">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
            <UserIcon />
        </div>
        <div className="flex-grow p-4 rounded-lg bg-sky-100 dark:bg-sky-900/50">
            <div className="prose dark:prose-invert max-w-none break-words">
                {message.text}
            </div>
            {message.files.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-sky-200 dark:border-sky-800/60 pt-3">
                    {message.files.map((file, index) => {
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
                            <div key={`${file.name}-${index}`} className="flex items-center gap-1 text-sm max-w-xs pl-2 pr-2 py-1 rounded-full bg-sky-200/50 text-sky-800 dark:bg-sky-800/70 dark:text-sky-200">
                                <Icon />
                                <span className="truncate" title={displayName}>{displayName}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    </div>
);

// Компонент для отображения ответа AI
const AiMessageBlock = ({ message, isDarkMode }: { message: AiMessage, isDarkMode: boolean }) => (
    <div className="flex gap-4 items-start">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
            <AiIcon />
        </div>
        <div className="flex-grow p-4 rounded-lg bg-white dark:bg-slate-800/80 min-w-0">
            {message.isLoading ? (
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-500"></div>
                    <span>Gemini is thinking...</span>
                </div>
            ) : (
                <div className="space-y-4">
                    {message.parts.map((part, index) => <ResponseBlock key={index} part={part} isDarkMode={isDarkMode} />)}
                </div>
            )}
        </div>
    </div>
);


// --- 4. ОСНОВНОЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ (ПЕРЕРАБОТАННЫЙ) ---
const App = () => {
  // --- Состояния (логика сохранена, структура адаптирована) ---
  const [apiKey, setApiKey] = useState("");
  const [inputText, setInputText] = useState("");
  const [model, setModel] = useState(config.models[0].id);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  
  // НОВОЕ: состояние для хранения истории чата
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  
  // Состояния для UI (без изменений)
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  
  // --- Ссылки (Refs) (без изменений) ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null); // Для авто-скролла

  // --- Эффекты (логика сохранена) ---
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // НОВЫЙ ЭФФЕКТ: авто-скролл при добавлении сообщений
  useEffect(() => {
      chatContainerRef.current?.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
      });
  }, [chatHistory]);

  // --- Обработчики событий (логика сохранена) ---
  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const removeFile = (indexToRemove: number) => {
    setAttachedFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };

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
    // Вместо очистки responseParts, показываем ошибку в модальном окне или как сообщение
    try {
        const response = await fetch(`${config.backendUrl}/api/clone_repo`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true'},
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
        // В идеале - показать ошибку в модальном окне, но для простоты можно alert
        alert(`Clone failed: ${message}`);
    } finally {
        setIsCloning(false);
    }
  };

  const handleUploadFileClick = () => fileInputRef.current?.click();
  const handleUploadFolderClick = () => folderInputRef.current?.click();
  const handleHelpClick = () => setShowHelp(!showHelp);

  // --- ОСНОВНАЯ ЛОГИКА ОТПРАВКИ (переработана для диалога) ---
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSending || (!inputText.trim() && attachedFiles.length === 0)) return;
    if (!apiKey) { alert("Please enter your API key in the sidebar."); return; }

    setIsSending(true);
    
    const userMessage: UserMessage = {
      id: uuidv4(),
      sender: 'user',
      text: inputText,
      files: attachedFiles,
    };

    const aiPlaceholderMessage: AiMessage = {
        id: uuidv4(),
        sender: 'ai',
        parts: [],
        isLoading: true,
    };

    // Обновляем историю сразу, чтобы пользователь видел свой запрос
    setChatHistory(prev => [...prev, userMessage, aiPlaceholderMessage]);

    // Очищаем поля ввода
    setInputText("");
    setAttachedFiles([]);
    
    const formData = new FormData();
    formData.append("apiKey", apiKey);
    formData.append("prompt", userMessage.text);
    formData.append("model", model);
    formData.append("refinerModel", config.refinerModel);
    userMessage.files.forEach(file => { formData.append("files", file); });

    try {
      const response = await fetch(`${config.backendUrl}/api/generate`, {
          method: "POST",
          headers: { 'ngrok-skip-browser-warning': 'true' },
          body: formData
      });

      if (!response.ok) {
        let errorDetail = "An unknown server error occurred";
        try {
            const errorData = await response.json();
            errorDetail = errorData.detail || JSON.stringify(errorData);
        } catch {
            errorDetail = await response.text();
        }
        throw new Error(errorDetail);
      }

      const data: ResponsePart[] = await response.json();
      const aiResponseMessage: AiMessage = {
          id: aiPlaceholderMessage.id, // Используем тот же ID
          sender: 'ai',
          parts: data,
          isLoading: false
      };
      // Заменяем плейсхолдер на реальный ответ
      setChatHistory(prev => prev.map(msg => msg.id === aiPlaceholderMessage.id ? aiResponseMessage : msg));

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      const errorResponse: AiMessage = {
          id: aiPlaceholderMessage.id,
          sender: 'ai',
          parts: [{ type: 'code', language: 'error', content: `Request failed: ${message}` }],
          isLoading: false
      }
      setChatHistory(prev => prev.map(msg => msg.id === aiPlaceholderMessage.id ? errorResponse : msg));
    } finally {
      setIsSending(false);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  }

  // --- РЕНДЕРИНГ (новая структура) ---
  return (
    <>
      <RepoCloneModal isOpen={isRepoModalOpen} onClose={() => setIsRepoModalOpen(false)} onSubmit={handleCloneRepo} isCloning={isCloning} />
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      
      <div className="min-h-screen flex transition-colors duration-300 bg-gray-100 text-gray-800 dark:bg-slate-950 dark:text-slate-200">
        
        {/* === САЙДБАР С НАСТРОЙКАМИ === */}
        <aside className="w-80 flex-shrink-0 bg-white dark:bg-slate-900/70 p-6 flex flex-col gap-6 border-r border-gray-200 dark:border-slate-800">
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{config.appTitle}</h1>
                <button onClick={toggleTheme} className="p-2 rounded-full transition-colors bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600" aria-label="Toggle theme">{isDarkMode ? '☀️' : '🌙'}</button>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-800 dark:text-slate-200">Gemini API Key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter your Gemini API key" className="w-full px-4 py-2 border rounded-md outline-none focus:ring-2 transition-colors bg-white border-gray-300 text-gray-800 focus:ring-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:focus:ring-sky-500 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-800 dark:text-slate-200">Select Gemini Model</label>
              <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full px-4 py-2 border rounded-md outline-none focus:ring-2 transition-colors bg-white border-gray-300 text-gray-800 focus:ring-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:focus:ring-sky-500 dark:text-white">{config.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            </div>
            <div className="flex items-center gap-2 opacity-50 cursor-not-allowed" title={config.dialog.historyToggleWarning}>
                <input id="context-toggle" type="checkbox" disabled className="w-4 h-4 rounded" />
                <label htmlFor="context-toggle" className="text-sm">{config.dialog.historyToggleLabel}</label>
            </div>

            <div className="mt-auto">
                <button onClick={handleHelpClick} className="w-full text-center px-3 py-2 text-sm rounded-md transition-colors bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20">{config.helpButtonText}</button>
            </div>
        </aside>

        {/* === ОСНОВНАЯ ОБЛАСТЬ ЧАТА === */}
        <main className="flex-1 flex flex-col max-h-screen">
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-8">
                {chatHistory.length === 0 ? (
                    <div className="text-center text-slate-500 dark:text-slate-400 py-20">
                        <h2 className="text-2xl font-semibold">Start your conversation</h2>
                        <p className="mt-2">Ask a question, paste some code, or upload a file to begin.</p>
                    </div>
                ) : (
                    chatHistory.map(msg =>
                        msg.sender === 'user'
                            ? <UserMessageBlock key={msg.id} message={msg} />
                            : <AiMessageBlock key={msg.id} message={msg} isDarkMode={isDarkMode}/>
                    )
                )}
            </div>
            
            {/* === ПОЛЕ ВВОДА === */}
            <div className="p-6 border-t border-gray-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto">
                    <div className="p-1 border rounded-xl shadow-sm transition-colors bg-white border-gray-300/80 dark:bg-slate-800 dark:border-slate-700/80 focus-within:ring-2 focus-within:ring-sky-500">
                        {attachedFiles.length > 0 && (
                          <div className="px-3 pt-2 flex flex-wrap gap-2">
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
                                  <button onClick={() => removeFile(index)} className="w-4 h-4 flex items-center justify-center text-red-500 hover:text-red-400 font-bold rounded-full hover:bg-red-500/10">×</button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <textarea
                            rows={3}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleTextareaKeyDown}
                            placeholder="Type your request here... (Shift+Enter for new line)"
                            className="w-full px-4 py-2 bg-transparent resize-none outline-none transition-colors text-gray-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                        <div className="px-2 pb-1 flex justify-between items-center">
                          <div className="relative"><button onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)} className="p-2 rounded-full transition-colors text-slate-500 hover:text-slate-800 hover:bg-gray-200 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700" aria-label="Attach file"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                            {isAttachMenuOpen && (
                              <div className="absolute bottom-full mb-2 w-64 rounded-md shadow-lg py-1 z-10 bg-white dark:bg-slate-700">
                                <button onClick={handleUploadFileClick} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-600">Upload Files</button>
                                <button onClick={handleUploadFolderClick} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-600">Upload Folder</button>
                                <button onClick={() => { setIsRepoModalOpen(true); setIsAttachMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-600">GitHub Repository</button>
                              </div>)}
                          </div>
                          <button onClick={() => handleSend()} disabled={isSending || (!inputText.trim() && attachedFiles.length === 0)} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition font-semibold disabled:bg-slate-500 disabled:cursor-not-allowed flex items-center gap-2">
                              {isSending ? `Generating...` : 'Send'}
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" /></svg>
                          </button>
                        </div>
                    </div>
                </div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
            <input type="file" ref={folderInputRef} onChange={handleFolderChange} className="hidden" multiple webkitdirectory="" />
        </main>
      </div>
    </>
  );
};

export default App;
