// src/App.tsx

import React, { useState, useRef, useEffect, useCallback } from "react";
// ... (все импорты остаются без изменений)
import { listChats, getChatContent, saveChat, createNewChatFile, renameChatFile } from "./services/googleDrive";
import { useGoogleAuth } from "./hooks/useGoogleAuth";

// ... (все иконки и вспомогательные компоненты остаются без изменений)

// --- НОВОЕ: Константа и хелпер для создания локальной сессии ---
const LOCAL_CHAT_ID = "local-session";
const createLocalChat = (): ChatContent => ({
    id: LOCAL_CHAT_ID,
    name: "Temporary Chat",
    conversation: [],
});

// --- ОСНОВНОЙ КОМПОНЕНТ APP ---
export default function App() {
    // ... (все хуки useState, useRef и useEffect для UI остаются без изменений)
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [apiKey, setApiKey] = useState("");
    const [model, setModel] = useState(config.models[0].id);
    const [inputText, setInputText] = useState("");
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    
    const [isLoading, setIsLoading] = useState(false);
    const [isContentLoading, setIsContentLoading] = useState(false);
    
    const [error, setError] = useState<string | null>(null);

    const { user, signIn, signOut, isInitialized, isLoading: isAuthLoading } = useGoogleAuth();

    const [chats, setChats] = useState<Chat[]>([]);
    
    const [activeChatId, setActiveChatId] = useState<string | null>(LOCAL_CHAT_ID);
    const [activeChatContent, setActiveChatContent] = useState<ChatContent | null>(createLocalChat());
    
    const [editingChatId, setEditingChatId] = useState<string | null>(null);
    const [editingChatName, setEditingChatName] = useState("");

    const [showHelp, setShowHelp] = useState(false);
    const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
    const [isCloning, setIsCloning] = useState(false);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        document.documentElement.classList.toggle("dark", isDarkMode);
    }, [isDarkMode]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
        }
    }, [activeChatContent?.conversation, isLoading]);

    useEffect(() => {
        const loadChatContent = async () => {
            if (!activeChatId || activeChatId === LOCAL_CHAT_ID || !user) {
                 if (activeChatId === LOCAL_CHAT_ID) {
                    setActiveChatContent(createLocalChat());
                }
                return;
            }
            setIsContentLoading(true);
            setError(null);
            try {
                const chatContent = await getChatContent(activeChatId);
                setActiveChatContent(chatContent);
            } catch (err) {
                console.error("Failed to load chat content:", err);
                setError("Could not load the selected chat.");
                setActiveChatContent(createLocalChat());
                setActiveChatId(LOCAL_CHAT_ID);
            } finally {
                setIsContentLoading(false);
            }
        };
        loadChatContent();
    }, [activeChatId, user]);

    useEffect(() => {
        if (editingChatId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [editingChatId]);

    const refreshChats = useCallback(async (selectChatId?: string | 'first') => {
        if (!user || !isInitialized) return;
        setIsContentLoading(true);
        try {
            const chatList = await listChats();
            setChats(chatList);
            const newActiveChatId = (() => {
                if (chatList.length === 0) return LOCAL_CHAT_ID;
                if (selectChatId === 'first') return chatList[0].id;
                if (selectChatId && chatList.some(c => c.id === selectChatId)) return selectChatId;
                if (!activeChatId || activeChatId === LOCAL_CHAT_ID || !chatList.some(c => c.id === activeChatId)) return chatList[0].id;
                return activeChatId;
            })();

            if (newActiveChatId !== activeChatId) {
                setActiveChatId(newActiveChatId);
            } else {
                 // Если активный чат не изменился, все равно нужно снять флаг загрузки
                setIsContentLoading(false);
            }
            
            if (newActiveChatId === LOCAL_CHAT_ID && activeChatContent?.id !== LOCAL_CHAT_ID) {
                setActiveChatContent(createLocalChat());
            }
        } catch (err) {
            console.error("Failed to list chats:", err);
            setError("Could not load chats from Google Drive.");
            setIsContentLoading(false);
        }
    }, [user, isInitialized, activeChatId, activeChatContent]);
    
    useEffect(() => {
        if (user && isInitialized) {
            refreshChats(); 
        } else if (!user && isInitialized) {
            setChats([]);
            setActiveChatId(LOCAL_CHAT_ID);
            setActiveChatContent(createLocalChat());
        }
    }, [user, isInitialized, refreshChats]);

    // ИСПРАВЛЕНИЕ: Упрощенная и более надежная логика
    const handleCreateNewChat = async () => {
        if (isAuthLoading || !user) {
            // Если пользователь не вошел, просто сбрасываем состояние к пустому локальному чату
            setActiveChatId(LOCAL_CHAT_ID);
            setActiveChatContent(createLocalChat());
            return;
        };
        setIsLoading(true); // Используем общий лоадер
        setError(null);
        try {
            // 1. Создаем новый пустой файл на Drive
            const newChat = await createNewChatFile(`New Chat ${new Date().toLocaleString()}`);
            // 2. Обновляем список чатов, указав, что хотим выбрать только что созданный
            await refreshChats(newChat.id);
        } catch (err) {
            console.error("Failed to create new chat:", err);
            setError("Could not create a new chat in Google Drive.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleStartEditing = (chat: Chat) => {
        setEditingChatId(chat.id);
        setEditingChatName(chat.name);
    };

    const handleCancelEditing = () => {
        setEditingChatId(null);
        setEditingChatName("");
    };

    const handleRenameChat = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!editingChatId || !editingChatName.trim()) {
            handleCancelEditing();
            return;
        }

        const originalChat = chats.find(c => c.id === editingChatId);
        if (originalChat?.name === editingChatName.trim()) {
            handleCancelEditing();
            return;
        }

        const newName = editingChatName.trim();
        setChats(prev => prev.map(c => c.id === editingChatId ? { ...c, name: newName } : c));
        if (activeChatId === editingChatId) {
            setActiveChatContent(prev => prev ? { ...prev, name: newName } : null);
        }
        
        const originalId = editingChatId;
        handleCancelEditing();

        try {
            await renameChatFile(originalId, newName);
        } catch (err) {
            console.error("Failed to rename chat:", err);
            setError("Could not rename the chat. Reverting change.");
            setChats(prev => prev.map(c => c.id === originalId ? { ...c, name: originalChat?.name || c.name } : c));
            if (activeChatId === originalId) {
                setActiveChatContent(prev => prev ? { ...prev, name: originalChat?.name || prev.name } : null);
            }
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const filesToUpload = e.target.files ? Array.from(e.target.files) : [];
        if (filesToUpload.length > 0) { setAttachedFiles(prevFiles => [...prevFiles, ...filesToUpload]); }
        e.target.value = '';
    };

    const removeFile = (indexToRemove: number) => {
        setAttachedFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleUploadFileClick = () => fileInputRef.current?.click();
    const handleUploadFolderClick = () => folderInputRef.current?.click();
    
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
    
    // --- ИЗМЕНЕНИЕ: Полностью переработанная логика handleSubmit ---
    const handleSubmit = async () => {
        if (!apiKey) { alert("Please enter your Gemini API key."); return; }
        if (!inputText.trim() || !activeChatContent) return;

        setIsLoading(true);
        setError(null);

        const userTurn: ConversationTurn = {
            type: 'user',
            prompt: inputText,
            attachments: [], // Логику для base64 можно будет добавить позже
            timestamp: new Date().toLocaleTimeString()
        };
        
        // Очищаем поля ввода сразу
        const currentInput = inputText;
        const currentFiles = [...attachedFiles];
        setInputText("");
        setAttachedFiles([]);

        // Используем функциональное обновление, чтобы избежать проблем с "устаревшим" состоянием
        setActiveChatContent(prev => {
            if (!prev) return prev; // На всякий случай
            const isFirstMessage = prev.id === LOCAL_CHAT_ID && prev.conversation.length === 0;
            const newName = isFirstMessage ? currentInput.substring(0, 50) || "New Chat" : prev.name;
            return {
                ...prev,
                name: newName,
                conversation: [...prev.conversation, userTurn]
            };
        });

        try {
            const formData = new FormData();
            formData.append("apiKey", apiKey);
            formData.append("prompt", currentInput);
            formData.append("model", model);
            formData.append("refinerModel", config.refinerModel);
            currentFiles.forEach(file => formData.append("files", file));

            const response = await fetch(`${config.backendUrl}/api/generate`, {
                method: "POST",
                headers: { 'ngrok-skip-browser-warning': 'true' },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "An unknown server error occurred");
            }

            const responseParts: ResponsePart[] = await response.json();
            const aiTurn: ConversationTurn = {
                type: 'ai',
                parts: responseParts,
                timestamp: new Date().toLocaleTimeString()
            };
            
            // Снова используем функциональное обновление для добавления ответа AI
            setActiveChatContent(prev => {
                if (!prev) return null;
                const updatedConversation = [...prev.conversation, aiTurn];

                // Асинхронно сохраняем чат в фоне
                // Это не будет блокировать обновление UI
                const handleSave = async () => {
                    if (user && isInitialized) {
                        let chatToSave = { ...prev, conversation: updatedConversation };
                        
                        // Если это был локальный чат, создаем его на Drive
                        if (chatToSave.id === LOCAL_CHAT_ID) {
                            try {
                                const newChatFile = await createNewChatFile(chatToSave.name);
                                chatToSave.id = newChatFile.id; // Присваиваем новый ID
                                await saveChat(chatToSave);
                                // Обновляем список чатов в боковой панели и делаем новый чат активным
                                await refreshChats(newChatFile.id);
                            } catch (e) {
                                console.error("Failed to promote local chat to Drive:", e);
                                setError("Could not save the new chat to Google Drive.");
                            }
                        } else {
                            // Просто сохраняем существующий чат
                            await saveChat(chatToSave);
                        }
                    }
                };

                handleSave();
                
                return { ...prev, conversation: updatedConversation };
            });

        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            const errorTurn: ConversationTurn = {
                type: 'ai',
                parts: [{ type: 'code', language: 'error', content: `Request failed: ${message}` }],
                timestamp: new Date().toLocaleTimeString()
            };
            // Добавляем сообщение об ошибке в чат
            setActiveChatContent(prev => prev ? { ...prev, conversation: [...prev.conversation, errorTurn] } : null);
        } finally {
            setIsLoading(false);
        }
    };


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
                                        {config.models.map((m) => (<option key={m.id} value={m.id} className="dark:bg-slate-800">{m.name}</option>))}
                                    </select>
                                </div>
                                <div className="pt-2">
                                    <p className="text-xs text-gray-400 mb-2">This is a professional AI assistant for developers.</p>
                                    <p className="text-xs text-gray-400">Connect your Gemini API key and start coding with the power of Google's most advanced models.</p>
                                </div>
                            </div>
                        </div>
                    </aside>

                    <div className={`lg:col-span-2 rounded-xl shadow-sm border border-gray-700/30 dark:border-gray-700 flex flex-col min-h-0 ${isDarkMode ? "bg-gray-800/60" : "bg-white/60"}`}>
                        <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-700 scrollbar-track-transparent">
                            {isContentLoading && (
                                <div className="flex items-center justify-center h-full">
                                    <SpinnerIcon className="w-8 h-8 text-slate-400" />
                                </div>
                            )}

                            {!isContentLoading && (activeChatContent?.conversation || []).length === 0 && !isLoading && (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-70">
                                    <GemIcon className="w-16 h-16 mb-4" />
                                    <h3 className="text-lg font-medium mb-1">Start your conversation</h3>
                                    <p className="text-sm max-w-md">Enter your prompt below. If you are logged into Google, your chat will be saved automatically.</p>
                                </div>
                            )}

                            {activeChatContent?.conversation.map((turn, index) => (
                                <div key={index} className={`flex flex-col gap-2 ${turn.type === 'user' ? 'items-end' : 'items-start'}`}>
                                    {turn.type === 'user' ? (
                                        <div className="user-bubble">
                                            <ReactMarkdown className="prose dark:prose-invert max-w-none break-words" remarkPlugins={[remarkGfm]}>{turn.prompt}</ReactMarkdown>
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
                                    <div className="ai-bubble opacity-80">
                                        <div className="flex items-center gap-2">
                                            <SpinnerIcon className="w-5 h-5" /> Gemini is thinking...
                                        </div>
                                    </div>
                                </div>
                            )}
                            {error && <div className="text-red-500 bg-red-500/10 p-3 rounded-lg">{error}</div>}
                        </div>

                        <div className="border-t border-gray-700/30 dark:border-gray-700 p-4 bg-gray-100/50 dark:bg-gray-900/50">
                            {attachedFiles.length > 0 && (
                                <div className="mb-3 flex flex-wrap gap-2">
                                    {attachedFiles.map((file, index) => (
                                        <AttachmentChip key={`${file.name}-${index}`} file={file} onRemove={() => removeFile(index)} />
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-2 mb-3">
                                <button onClick={handleUploadFileClick} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors" aria-label="Attach file"><PaperclipIcon /></button>
                                <button onClick={handleUploadFolderClick} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors" aria-label="Attach folder"><FolderIcon /></button>
                                <button onClick={() => setIsRepoModalOpen(true)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors" aria-label="Attach GitHub repo"><GithubIcon /></button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
                                <input type="file" ref={folderInputRef} onChange={handleFolderChange} className="hidden" multiple webkitdirectory="" />
                            </div>
                            <div className="relative">
                                <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }} placeholder="Ask Gemini something..." rows={3}
                                    className={`w-full px-4 py-3 pr-24 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none ${isDarkMode ? "bg-gray-700/50 border-gray-600 focus:border-blue-500" : "bg-gray-50 border-gray-300 focus:border-blue-500"}`}
                                />
                                <div className="absolute right-3 bottom-3 flex items-center gap-2">
                                    {/* --- ИЗМЕНЕНИЕ: Упрощенное условие для disabled --- */}
                                    <button onClick={handleSubmit} disabled={!inputText.trim() || isLoading || isContentLoading}
                                        className={`px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-2 ${(!inputText.trim() || isLoading || isContentLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {isLoading ? (<SpinnerIcon />) : (<ArrowUpIcon />)}
                                    </button>
                                </div>
                            </div>
                        </div>
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
                                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                        {chats.map((chat) => (
                                            <div
                                                key={chat.id}
                                                onClick={() => editingChatId !== chat.id && setActiveChatId(chat.id)}
                                                onDoubleClick={() => handleStartEditing(chat)}
                                                className={`group p-3 rounded-lg cursor-pointer transition-colors relative ${activeChatId === chat.id ? "bg-blue-600/20" : "hover:bg-gray-700/30"}`}
                                            >
                                                {editingChatId === chat.id ? (
                                                    <form onSubmit={handleRenameChat}>
                                                        <input
                                                            ref={renameInputRef}
                                                            type="text"
                                                            value={editingChatName}
                                                            onChange={(e) => setEditingChatName(e.target.value)}
                                                            onBlur={() => handleRenameChat()}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Escape') handleCancelEditing();
                                                            }}
                                                            className="rename-input"
                                                        />
                                                    </form>
                                                ) : (
                                                    <>
                                                        <p className="font-medium truncate pr-6">{chat.name}</p>
                                                        <p className="text-xs opacity-70 mt-1">{new Date(chat.createdTime).toLocaleString()}</p>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleStartEditing(chat); }}
                                                            className="absolute top-1/2 right-2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-gray-500/30 transition-opacity"
                                                            aria-label="Rename chat"
                                                        >
                                                            <EditIcon className="w-4 h-4 text-slate-400" />
                                                        </button>
                                                    </>
                                                )}
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
