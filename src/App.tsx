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
import { ResponsePart, ConversationTurn, Chat, ChatContent, UserProfile } from "./types";
import { listChats, getChatContent, saveChat, createNewChatFile } from "./services/googleDrive";
import { useGoogleAuth } from "./hooks/useGoogleAuth"; // <-- ИМПОРТ НОВОГО ХУКА

// --- ИКОНКИ (без изменений) ---
const GemIcon = ({ className = "w-6 h-6" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const PaperclipIcon = ({ className = "w-5 h-5" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.44 11.05L12.39 19.64C11.11 20.87 9.07 21.01 7.64 19.93C6.21 18.85 6.04 16.86 7.27 15.58L15.86 6.53C16.65 5.74 17.91 5.74 18.7 6.53C19.49 7.32 19.49 8.58 18.7 9.37L10.11 18.42C9.67 18.86 9.01 19.03 8.38 18.85C7.75 18.67 7.23 18.16 7.05 17.53C6.87 16.9 7.04 16.24 7.48 15.8L16.03 6.75C17.26 5.47 19.3 5.33 20.38 6.41C21.46 7.49 21.6 9.53 20.32 10.81L11.27 19.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const FolderIcon = ({ className = "w-5 h-5" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 10H12L10 8H2C1.45 8 1 8.45 1 9V19C1 19.55 1.45 20 2 20H22C22.55 20 23 19.55 23 19V11C23 10.45 22.55 10 22 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const GithubIcon = ({ className = "w-5 h-5" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>);
const ArrowUpIcon = ({ className = "w-4 h-4" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const SpinnerIcon = ({ className = "w-4 h-4 animate-spin" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v3m0 12v3M4.2 4.2l2.1 2.1m11.4 11.4l2.1 2.1M3 12h3m12 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const PlusIcon = ({ className = "w-5 h-5" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const GoogleIcon = ({ className = "w-5 h-5" }) => (<svg className={className} role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 2.04-4.78 2.04-3.83 0-6.9-3.1-6.9-6.9s3.07-6.9 6.9-6.9c2.1 0 3.54.85 4.4 1.73l2.55-2.55C18.03 2.52 15.48 1.5 12.48 1.5c-6.18 0-11.16 4.92-11.16 10.92s4.98 10.92 11.16 10.92c6.5 0 10.8-4.55 10.8-11.16 0-.75-.08-1.35-.2-2.04h-10.6z" fill="currentColor" /></svg>);

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ (без изменений) ---
// ... AttachmentChip, ResponseBlock, HelpModal, RepoCloneModal
// (Код этих компонентов не меняется, поэтому для краткости я его скрыл. В вашем файле он должен остаться)
const AttachmentChip = ({ file, onRemove }: { file: File, onRemove?: () => void }) => {
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
            {onRemove && <button onClick={onRemove} className="text-red-500 hover:text-red-400 font-bold text-lg leading-none flex items-center justify-center w-4 h-4">×</button>}
        </div>
    );
};

// ... и так далее для остальных компонентов

const AuthDisplay = ({ user, onLogin, onLogout, isLoading, isReady }: { user: UserProfile | null, onLogin: () => void, onLogout: () => void, isLoading: boolean, isReady: boolean }) => {
    if (user) {
        return (
            <div className="relative group">
                <img src={user.imageUrl} alt={user.name} className="w-8 h-8 rounded-full cursor-pointer" />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 hidden group-hover:block z-20">
                    <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b dark:border-gray-600">
                        <p className="font-semibold truncate">{user.name}</p>
                        <p className="text-xs truncate">{user.email}</p>
                    </div>
                    <a href="#" onClick={(e) => { e.preventDefault(); onLogout(); }} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                        Sign Out
                    </a>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={onLogin}
            disabled={isLoading || !isReady}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
            aria-label="Sign in with Google"
        >
            {isLoading ? <SpinnerIcon /> : <GoogleIcon />}
        </button>
    );
}


// --- ОСНОВНОЙ КОМПОНЕНТ APP ---
export default function App() {
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [apiKey, setApiKey] = useState("");
    const [model, setModel] = useState(config.models[0].id);
    const [inputText, setInputText] = useState("");
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // <-- ИСПОЛЬЗОВАНИЕ НОВОГО ХУКА
    const { user, signIn, signOut, isInitialized, isLoading: isAuthLoading } = useGoogleAuth();

    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChat, setActiveChat] = useState<ChatContent | null>(null);

    const [showHelp, setShowHelp] = useState(false);
    const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
    const [isCloning, setIsCloning] = useState(false);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    // --- Эффекты ---
    useEffect(() => {
        document.documentElement.classList.toggle("dark", isDarkMode);
    }, [isDarkMode]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
        }
    }, [activeChat?.conversation, isLoading]);

    const handleSelectChat = useCallback(async (chatId: string) => {
        if (chatId === 'new' && activeChat && !activeChat.id) return;
        
        // Сбрасываем ошибку при переключении чата
        setError(null);
        setIsLoading(true);
        try {
            const chatContent = await getChatContent(chatId);
            setActiveChat(chatContent);
        } catch (err) {
            console.error("Failed to load chat content:", err);
            setError("Could not load the selected chat.");
        } finally {
            setIsLoading(false);
        }
    }, [activeChat]);

    const refreshChats = useCallback(async () => {
        if (!user || !isInitialized) return;
        
        try {
            const chatList = await listChats();
            setChats(chatList);
            // Условие выбора чата изменено, чтобы не выбирать чат, если он уже активен
            if (chatList.length > 0 && (!activeChat || !chatList.some(c => c.id === activeChat.id))) {
                await handleSelectChat(chatList[0].id);
            } else if (chatList.length === 0) {
                setActiveChat(null);
            }
        } catch (err) {
            console.error("Failed to list chats:", err);
            setError("Could not load chats from Google Drive.");
        }
    }, [user, isInitialized, activeChat, handleSelectChat]);

    useEffect(() => {
        if (user && isInitialized) {
            refreshChats();
        }
        if (!user && isInitialized) {
            // Если пользователь вышел, очищаем состояние чатов
            setChats([]);
            setActiveChat(null);
        }
    }, [user, isInitialized, refreshChats]);

    // --- Обработчики ---
    const handleCreateNewChat = async () => {
        const newChat = await createNewChatFile(`New Chat ${new Date().toLocaleString()}`);
        setActiveChat(newChat);
        setChats(prev => [{ id: 'new', name: newChat.name, createdTime: new Date().toISOString() }, ...prev]);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const filesToUpload = e.target.files ? Array.from(e.target.files) : [];
        if (filesToUpload.length > 0) { setAttachedFiles(prevFiles => [...prevFiles, ...filesToUpload]); }
        e.target.value = '';
    };

    const removeFile = (indexToRemove: number) => {
        setAttachedFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    // --- Главная функция отправки ---
    const handleSubmit = async () => {
        if (!apiKey) { alert("Please enter your Gemini API key."); return; }
        if (!inputText.trim()) return;

        setIsLoading(true);
        setError(null);

        const timestamp = new Date().toLocaleTimeString();
        const currentUserTurn: ConversationTurn = {
            type: 'user', prompt: inputText, attachments: [], timestamp
        };

        const updatedConversation = [...(activeChat?.conversation || []), currentUserTurn];
        
        let currentChat = activeChat;
        if (!currentChat) {
            currentChat = await createNewChatFile(`Chat from ${timestamp}`);
        }

        const updatedChatContent: ChatContent = {
            ...currentChat,
            conversation: updatedConversation,
        };
        setActiveChat(updatedChatContent);

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
                method: "POST", headers: { 'ngrok-skip-browser-warning': 'true' }, body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "An unknown server error occurred");
            }

            const data: ResponsePart[] = await response.json();
            const aiTurn: ConversationTurn = { type: 'ai', parts: data, timestamp: new Date().toLocaleTimeString() };
            const finalConversation = [...updatedConversation, aiTurn];
            const chatToSave: ChatContent = { ...updatedChatContent, conversation: finalConversation };
            
            if (user && isInitialized) {
                const savedChatId = await saveChat(chatToSave);
                setActiveChat({ ...chatToSave, id: savedChatId });
                await refreshChats(); // Обновляем список, чтобы "New Chat" получил свой ID
            } else {
                setActiveChat(chatToSave);
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            const errorTurn: ConversationTurn = {
                type: 'ai', parts: [{ type: 'code', language: 'error', content: `Request failed: ${message}` }], timestamp: new Date().toLocaleTimeString()
            };
            setActiveChat(prev => ({ ...prev!, conversation: [...updatedConversation, errorTurn] }));
        } finally {
            setIsLoading(false);
        }
    };
    
    // Остальной JSX остается таким же, как в предыдущем ответе.
    // Просто замените весь блок return() в вашем файле на этот.
    return (
        <>
            {/* ... Modals ... */}

            <div className={`h-screen flex flex-col transition-colors duration-300 ${isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
                <header className="border-b border-gray-700/30 dark:border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 bg-gray-50/60 dark:bg-gray-900/60 backdrop-blur-md z-30">
                    <div className="flex items-center gap-2">
                        <GemIcon />
                        <h1 className="text-xl font-semibold tracking-tight">{config.appTitle}</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors" aria-label="Toggle theme">
                            {isDarkMode ? '☀️' : '🌙'}
                        </button>
                        <button onClick={() => setShowHelp(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                            {config.helpButtonText}
                        </button>
                        <AuthDisplay 
                            user={user} 
                            onLogin={signIn} 
                            onLogout={signOut} 
                            isLoading={isAuthLoading}
                            isReady={isInitialized}
                        />
                    </div>
                </header>

                <main className="max-w-7xl mx-auto grid flex-1 grid-cols-1 lg:grid-cols-4 gap-6 p-6 min-h-0">
                    {/* API Configuration (Слева) */}
                    <aside className="lg:col-span-1 flex flex-col gap-4">
                        <div className={`p-6 rounded-xl shadow-sm border border-gray-700/30 dark:border-gray-700 ${isDarkMode ? "bg-gray-800/60" : "bg-white/60"} flex-1`}>
                            {/* ... API Key and Model select ... */}
                        </div>
                    </aside>

                    {/* Chat Interface (Центр) */}
                    <div className={`lg:col-span-2 rounded-xl shadow-sm border border-gray-700/30 dark:border-gray-700 flex flex-col min-h-0 ${isDarkMode ? "bg-gray-800/60" : "bg-white/60"}`}>
                        {/* ... Chat display and input ... */}
                    </div>
                    
                    {/* Панель истории чатов (Справа) */}
                    <aside className="lg:col-span-1 flex flex-col gap-4">
                        <div className={`p-4 rounded-xl shadow-sm border border-gray-700/30 dark:border-gray-700 ${isDarkMode ? "bg-gray-800/60" : "bg-white/60"} flex-1 flex flex-col`}>
                            {isAuthLoading ? (
                                <div className="flex-1 flex items-center justify-center"><SpinnerIcon className="w-8 h-8" /></div>
                            ) : user ? (
                                <>
                                    <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
                                        <h2 className="text-lg font-semibold">Chat History</h2>
                                        <button onClick={handleCreateNewChat} className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors" aria-label="New chat">
                                            <PlusIcon />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                        {chats.map((chat) => (
                                            <div
                                                key={chat.id}
                                                onClick={() => handleSelectChat(chat.id)}
                                                className={`p-3 rounded-lg cursor-pointer transition-colors ${activeChat?.id === chat.id
                                                        ? "bg-blue-600/20"
                                                        : "hover:bg-gray-700/30"
                                                    }`}
                                            >
                                                <p className="font-medium truncate">{chat.name}</p>
                                                <p className="text-xs opacity-70 mt-1">{new Date(chat.createdTime).toLocaleString()}</p>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-70">
                                    <GoogleIcon className="w-12 h-12 mb-4" />
                                    <h3 className="text-lg font-medium mb-1">Save your chats</h3>
                                    <p className="text-sm max-w-md">
                                        Sign in with your Google Account to automatically save and sync your chat history to Google Drive.
                                    </p>
                                    <button onClick={signIn} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                                        Sign in with Google
                                    </button>
                                </div>
                            )}
                        </div>
                    </aside>
                </main>

                <footer className="mt-auto border-t border-gray-700/30 dark:border-gray-700 px-6 py-4 text-center text-sm text-gray-500">
                    <p>© 2025 Gemini Gateway Studio — Powered by Google AI</p>
                </footer>
            </div>
        </>
    );
}
