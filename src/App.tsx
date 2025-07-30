import React, { useState, useRef, useEffect, useCallback } from "react";
import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import JSZip from 'jszip';

import { config } from "./config";
import { ResponsePart, ConversationTurn, Chat, ChatContent, UserProfile } from "./types";
import { listChats, getChatContent, saveOrUpdateChat, renameChatFile, deleteChat } from "./services/googleDrive";
import { useGoogleAuth } from "./hooks/useGoogleAuth";

// --- ICON COMPONENTS (no changes) ---
const GemIcon = ({ className = "w-6 h-6" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const PaperclipIcon = ({ className = "w-5 h-5" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.44 11.05L12.39 19.64C11.11 20.87 9.07 21.01 7.64 19.93C6.21 18.85 6.04 16.86 7.27 15.58L15.86 6.53C16.65 5.74 17.91 5.74 18.7 6.53C19.49 7.32 19.49 8.58 18.7 9.37L10.11 18.42C9.67 18.86 9.01 19.03 8.38 18.85C7.75 18.67 7.23 18.16 7.05 17.53C6.87 16.9 7.04 16.24 7.48 15.8L16.03 6.75C17.26 5.47 19.3 5.33 20.38 6.41C21.46 7.49 21.6 9.53 20.32 10.81L11.27 19.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const FolderIcon = ({ className = "w-5 h-5" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 10H12L10 8H2C1.45 8 1 8.45 1 9V19C1 19.55 1.45 20 2 20H22C22.55 20 23 19.55 23 19V11C23 10.45 22.55 10 22 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const GithubIcon = ({ className = "w-5 h-5" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>);
const ArrowUpIcon = ({ className = "w-4 h-4" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const SpinnerIcon = ({ className = "w-4 h-4 animate-spin" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v3m0 12v3M4.2 4.2l2.1 2.1m11.4 11.4l2.1 2.1M3 12h3m12 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const PlusIcon = ({ className = "w-5 h-5" }) => (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const GoogleIcon = ({ className = "w-5 h-5" }) => (<svg className={className} role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 2.04-4.78 2.04-3.83 0-6.9-3.1-6.9-6.9s3.07-6.9 6.9-6.9c2.1 0 3.54.85 4.4 1.73l2.55-2.55C18.03 2.52 15.48 1.5 12.48 1.5c-6.18 0-11.16 4.92-11.16 10.92s4.98 10.92 11.16 10.92c6.5 0 10.8-4.55 10.8-11.16 0-.75-.08-1.35-.2-2.04h-10.6z" fill="currentColor" /></svg>);
const FileIconForAttachment = () => (<svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"></path> </svg>);
const FolderIconForAttachment = () => (<svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.9-2-2-2h-8l-2-2z"></path> </svg>);
const GithubIconForAttachment = () => (<svg viewBox="0 0 16 16" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path> </svg>);
const EditIcon = ({ className = "w-4 h-4" }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>);
const TrashIcon = ({ className = "w-4 h-4" }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>);
// --- HELPER COMPONENTS ---

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

// FIXED: Added remarkMath and rehypeKatex plugins for ReactMarkdown
const ContentRenderer = React.memo(({ content }: { content: string }) => {
    const safeContent = typeof content === 'string' ? content : '';
    const markdownPlugins = [remarkGfm, remarkMath]; // Added remarkMath
    const htmlPlugins = [rehypeKatex]; // Added rehypeKatex

    // Splitting for block math, as before. This ensures BlockMath is always used for $$...$$
    const parts = safeContent.split(/(\$\$[\s\S]*?\$\$)/g);

    return (
        <div className="leading-relaxed break-words prose dark:prose-invert max-w-none">
            {parts.map((part, index) => {
                if (part.startsWith('$$') && part.endsWith('$$')) {
                    const mathContent = part.slice(2, -2);
                    try {
                        return <BlockMath key={index} math={mathContent} />;
                    } catch (error) {
                        return <pre key={index} className="text-red-400 bg-red-900/20 p-2 rounded">Invalid LaTeX: {mathContent}</pre>
                    }
                } else if (part) {
                    return <ReactMarkdown key={index} remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>{part}</ReactMarkdown>;
                // Passing rehypePlugins
                }
                return null;
            })}
        </div>
    );
});

// FIXED: Added "safety" checks for each block type.
// Now the component won't crash if incomplete data comes from the backend.
const ResponseBlock = React.memo(({ part }: { part: ResponsePart }) => {
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
        case 'title': return (
            <div className="border-b-2 border-sky-500 dark:border-sky-400 pb-3 mb-4">
                <h1 className="text-4xl font-bold break-words title">
                    <ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>{part.content || ''}</ReactMarkdown>
                </h1>
                {part.subtitle && 
                    <div className="text-lg mt-1 subtitle">
                        <ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>{part.subtitle}</ReactMarkdown>
                    </div>
                }
            </div>
        );
        case 'heading': return <h2 className="text-2xl font-bold border-b dark:border-slate-700 pb-2 pt-4 break-words"><ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>{part.content || ''}</ReactMarkdown></h2>;
        case 'subheading': return <h3 className="text-xl font-semibold pt-3 break-words"><ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>{part.content || ''}</ReactMarkdown></h3>;
        case 'annotated_heading': return (<div className="flex items-center gap-3 pt-4"><h4 className="text-lg font-semibold break-words">{part.content || ''}</h4><span className="info-tag">{part.tag || ''}</span></div>);
        case 'quote_heading': return (
            <blockquote className="my-4 border-l-4 p-4 rounded-r-lg quote-heading-container">
                <div className="text-lg font-medium italic quote-text">
                    <ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>{part.content || ''}</ReactMarkdown>
                </div>
                {part.source && (
                    <footer className="block text-right text-sm mt-2 not-italic quote-cite">
                        — <cite>{part.source}</cite>
                    </footer>
                )}
            </blockquote>
        );
        case 'text': return <ContentRenderer content={part.content || ''} />;
        case 'code':
            const codeContent = String(part.content || '').trim();
            if (!codeContent) {
                return (
                    <div className="relative group my-4 rounded-md bg-yellow-200 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 p-4 text-sm">
                        <p><b>[Empty Response]</b> The AI returned an empty code block.</p>
                    </div>
                );
            }
            return (
                <div className="relative group my-4 rounded-md bg-[#282c34] overflow-x-auto">
                    <button onClick={() => handleCopy(codeContent)} className="absolute top-2 right-2 p-1.5 rounded-md bg-black/40 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-black/60" aria-label="Copy code">{copied ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}</button>
                    <SyntaxHighlighter 
                        language={part.language === 'error' ? 'bash' : (part.language || 'text')} 
                        style={oneDark}
                        showLineNumbers 
                        customStyle={{ margin: 0, padding: '1rem', paddingTop: '1rem' }}
                    >
                        {codeContent}
                    </SyntaxHighlighter>
                </div>
            );
        case 'math': return <BlockMath math={part.content || ''} />;
        case 'list':
          return (
            <ul className="list-disc pl-6 space-y-2 prose dark:prose-invert max-w-none">
              {Array.isArray(part.items) && part.items.map((item, i) => (
                <li key={i}>
                  <ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>
                      {item || ''}
                  </ReactMarkdown>
                </li>
              ))}
            </ul>
          );
        default:
            const unknownPart = part as any;
            return (<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert"><strong className="font-bold">Unknown block type!</strong><span className="block sm:inline"> Received an unknown block type '{unknownPart?.type}'.</span><pre className="mt-2 text-xs">{JSON.stringify(unknownPart, null, 2)}</pre></div>);
    }
});

const HelpModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-sm dark:border dark:border-gray-700 rounded-lg shadow-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-slate-100">{config.helpModal.title}</h3>
                <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
                    <p>{config.helpModal.introduction}</p>
                    <div><h4 className="font-semibold">{config.helpModal.apiKeyTitle}</h4><p>{config.helpModal.apiKeySection}</p></div>
                    <div><h4 className="font-semibold">{config.helpModal.filesTitle}</h4><p>{config.helpModal.filesSection}</p></div>
                    <div><h4 className="font-semibold">{config.helpModal.repoTitle}</h4><ReactMarkdown>{config.helpModal.repoSection}</ReactMarkdown></div>
                    <div><h4 className="font-semibold">{config.helpModal.contactTitle}</h4><ReactMarkdown>{config.helpModal.contactSection}</ReactMarkdown></div>
                </div>
                <div className="flex justify-end mt-6"><button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700">{config.helpModal.closeButton}</button></div>
            </div>
        </div>
    );
};

const RepoCloneModal = ({ isOpen, onClose, onSubmit, isCloning }: { isOpen: boolean, onClose: () => void, onSubmit: (url: string) => void, isCloning: boolean }) => {
    const [url, setUrl] = useState("");
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-sm dark:border dark:border-gray-700 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-slate-100">{config.repoModal.title}</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">{config.repoModal.description}</p>
                <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={config.repoModal.placeholder} className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 bg-gray-50 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 dark:bg-gray-700/50 dark:border-gray-600 dark:focus:border-blue-500 dark:text-white" />
                <div className="flex justify-end gap-4 mt-6">
                    <button onClick={onClose} disabled={isCloning} className="px-4 py-2 text-sm rounded-md text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-gray-800">{config.repoModal.cancelButton}</button>
                    <button onClick={() => onSubmit(url)} disabled={isCloning || !url} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-500">
                        {isCloning ? config.repoModal.submitButtonCloning : config.repoModal.submitButton}
                    </button>
                </div>
            </div>
        </div>
    );
};

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
};

const LOCAL_CHAT_ID = "local-session";
const createLocalChat = (): ChatContent => ({
    id: LOCAL_CHAT_ID,
    name: "New Chat",
    conversation: [],
});
export default function App() {
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [apiKey, setApiKey] = useState("");
    const [model, setModel] = useState(config.models[0].id);
    const [inputText, setInputText] = useState("");
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isContentLoading, setIsContentLoading] = useState(false); // For loading active chat content
    
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
    const skipNextFetch = useRef(false);

    useEffect(() => {
        document.documentElement.classList.toggle("dark", isDarkMode);
    }, [isDarkMode]);
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
        }
    }, [activeChatContent?.conversation, isLoading]);
    const handleCreateNewChat = useCallback(() => {
        setActiveChatId(LOCAL_CHAT_ID);
        setActiveChatContent(createLocalChat()); // Immediately set a new local chat
    }, []);
    useEffect(() => {
        if (skipNextFetch.current) {
            skipNextFetch.current = false;
            return;
        }

        const loadChatContent = async () => {
            if (!activeChatId || activeChatId === LOCAL_CHAT_ID) {
                if (activeChatContent?.id !== LOCAL_CHAT_ID) {
                    setActiveChatContent(createLocalChat());
                }
                setIsContentLoading(false); // Ensure loading state is false for local chat
                return;
            }

            if (!user) {
                handleCreateNewChat(); // This implicitly sets activeChatId to LOCAL_CHAT_ID
                setIsContentLoading(false);
                return;
            }

            // --- Change: Immediately clear content and show loading ---
            setActiveChatContent(null); // Key change for immediate feedback
            setIsContentLoading(true);
            setError(null);

            try {
                const chatContent = await getChatContent(activeChatId);
                setActiveChatContent(chatContent);
            } catch (err) {
                console.error("Failed to load chat content:", err);
                setError("Could not load the selected chat. Starting a new one.");
                handleCreateNewChat();
            } finally {
                setIsContentLoading(false);
            }
        };
        loadChatContent();
    }, [activeChatId, user, handleCreateNewChat]);
    // Dependencies should be stable

    useEffect(() => {
        if (editingChatId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [editingChatId]);
    useEffect(() => {
        const init = async () => {
            if (user && isInitialized) {
                setIsContentLoading(true); // Loading state for the chat list
                try {
                    const chatList = await listChats();
                    setChats(chatList);
                    if (activeChatId === LOCAL_CHAT_ID && chatList.length > 0) {
                        setActiveChatId(chatList[0].id);
                    } else if (chatList.length === 0) {
                        handleCreateNewChat();
                    }
                } catch (err) {
                    console.error("Failed to get chat list on sign-in:", err);
                    setError("Could not load chats from Google Drive.");
                    setChats([]);
                    handleCreateNewChat();
                } finally {
                    setIsContentLoading(false);
                }
            } else if (!user && isInitialized) {
                setChats([]);
                handleCreateNewChat();
            }
        };
        init();
    }, [user, isInitialized, handleCreateNewChat]);
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
        const originalId = editingChatId;
        setChats(prev => prev.map(c => c.id === originalId ? { ...c, name: newName } : c));
        if (activeChatId === originalId) {
            setActiveChatContent(prev => prev ? { ...prev, name: newName } : null);
        }
        
        handleCancelEditing();
        try {
            await renameChatFile(originalId, newName);
        } catch (err) {
            console.error("Failed to rename chat:", err);
            setError("Failed to rename the chat. Reverting changes.");
            if (originalChat) {
                setChats(prev => prev.map(c => c.id === originalId ? { ...c, name: originalChat.name } : c));
                if (activeChatId === originalId) {
                    setActiveChatContent(prev => prev ? { ...prev, name: originalChat.name } : null);
                }
            }
        }
    };
    const handleDeleteChat = async (chatIdToDelete: string) => {
        if (!user) {
            setError("You must be logged in to delete chats.");
            return;
        }
        
        const originalChats = [...chats];
        const chatToDeleteIndex = originalChats.findIndex(c => c.id === chatIdToDelete);
        
        // Optimistically update UI
        setChats(prev => prev.filter(c => c.id !== chatIdToDelete));
        if (activeChatId === chatIdToDelete) {
            const newChats = originalChats.filter(c => c.id !== chatIdToDelete);
            if (newChats.length > 0) {
                // Try to select the next or previous chat
                const nextIndex = chatToDeleteIndex >= newChats.length ? newChats.length - 1 : chatToDeleteIndex;
                setActiveChatId(newChats[nextIndex].id);
            } else {
                handleCreateNewChat();
            }
        }

        try {
            await deleteChat(chatIdToDelete);
        } catch (err) {
            console.error("Failed to delete chat:", err);
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
            setError(`Failed to delete chat from Google Drive: ${errorMessage}. Chat list has been restored.`);
            setChats(originalChats);
            if (activeChatId !== chatIdToDelete) {
                setActiveChatId(chatIdToDelete);
            }
        }
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const filesToUpload = e.target.files ? Array.from(e.target.files) : [];
        if (filesToUpload.length > 0) { setAttachedFiles(prevFiles => [...prevFiles, ...filesToUpload]);
        }
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
        } catch (err) { console.error("Failed to create zip file", err); setError("Failed to process the folder.");
        }
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
            setError(`Cloning Error: ${message}`);
        } finally {
            setIsCloning(false);
        }
    };
    
    const handleSubmit = async () => {
        if (!apiKey) {
            setError("Please enter your Gemini API key.");
            return;
        }
        if (!inputText.trim() || !activeChatContent) return;
    
        setIsLoading(true);
        setError(null);
        const userTurn: ConversationTurn = {
            type: 'user',
            prompt: inputText,
            attachments: [],
            timestamp: new Date().toLocaleTimeString()
        };
        const currentInput = inputText;
        const currentFiles = [...attachedFiles];
        setInputText("");
        setAttachedFiles([]);
    
        const isNewChat = activeChatContent.id === LOCAL_CHAT_ID;
        const updatedContentWithUserTurn: ChatContent = {
            ...activeChatContent,
            name: isNewChat ? (currentInput.substring(0, 40).trim() || "Untitled Chat") : activeChatContent.name,
            conversation: [...activeChatContent.conversation, userTurn],
        };
        setActiveChatContent(updatedContentWithUserTurn);
    
        try {
            const formData = new FormData();
            formData.append("apiKey", apiKey);
            formData.append("prompt", currentInput);
            formData.append("model", model);
            formData.append("refinerModel", config.refinerModel);
            currentFiles.forEach(file => formData.append("files", file, file.name));
            const response = await fetch(`${config.backendUrl}/api/generate`, {
                method: "POST",
                headers: { 'ngrok-skip-browser-warning': 'true' },
                body: formData
            });
            if (!response.ok) {
                const errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    throw new Error(errorJson.detail || "An unknown server error occurred");
                } catch(e) {
                    throw new Error(errorText || "An unknown server error occurred");
                }
            }
    
            const responseParts: ResponsePart[] = await response.json();
            const aiTurn: ConversationTurn = {
                type: 'ai',
                parts: responseParts,
                timestamp: new Date().toLocaleTimeString()
            };
            let finalChatContent = {
                ...updatedContentWithUserTurn,
                conversation: [...updatedContentWithUserTurn.conversation, aiTurn],
            };
            if (user && isInitialized) {
                try {
                    const savedChat = await saveOrUpdateChat(finalChatContent);
                    if (isNewChat) {
                        const newChatItem: Chat = { 
                            id: savedChat.id, 
                            name: savedChat.name, 
                            createdTime: new Date().toISOString() 
                        };
                        skipNextFetch.current = true;
                        
                        setChats(prev => [newChatItem, ...prev]);
                        setActiveChatContent(savedChat);
                        setActiveChatId(savedChat.id);

                    } else {
                        setActiveChatContent(savedChat);
                    }
                } catch (saveError) {
                    const message = saveError instanceof Error ? saveError.message : "An unknown error occurred.";
                    console.error("Failed to save chat:", saveError);
                    setError(`Could not save chat to Google Drive. Error: ${message}`);
                    setActiveChatContent(finalChatContent);
                }
            } else {
                 setActiveChatContent(finalChatContent);
            }
    
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            const errorTurn: ConversationTurn = {
                type: 'ai',
                parts: [{ type: 'code', language: 'error', content: `Request Error: ${message}` }],
                timestamp: new Date().toLocaleTimeString()
            };
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
                        <div className={`p-6 rounded-xl shadow-sm border border-gray-700/30 dark:border-gray-700 ${isDarkMode ? "bg-gray-800/60" : "bg-white/60"} flex-1 backdrop-blur-sm`}>
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
                                    <p className="text-xs text-gray-400">Connect your Gemini API key and start programming with Google's most advanced models.</p>
                                </div>
                            </div>
                        </div>
                    </aside>
                    <div className={`lg:col-span-2 rounded-xl shadow-sm border border-gray-700/30 dark:border-gray-700 flex flex-col min-h-0 ${isDarkMode ? "bg-gray-800/60" : "bg-white/60"} backdrop-blur-sm`}>
                        <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-700 scrollbar-track-transparent">
                            {isContentLoading && !activeChatContent && (
                                <div className="flex items-center justify-center h-full">
                                    <SpinnerIcon className="w-8 h-8 text-slate-400" />
                                </div>
                            )}
                            {(!isContentLoading || activeChatContent) && (activeChatContent?.conversation || []).length === 0 && !isLoading && !error && (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-70">
                                    <GemIcon className="w-16 h-16 mb-4" />
                                    <h3 className="text-lg font-medium mb-1">Start the conversation</h3>
                                    <p className="text-sm max-w-md">Enter your request below. If you are signed in, your chat will be saved automatically.</p>
                                </div>
                            )}
                            {activeChatContent?.conversation.map((turn, index) => (
                                <div key={index} className={`flex flex-col gap-2 chat-message-enter ${turn.type === 'user' ? 'items-end' : 'items-start'}`}>
                                    {turn.type === 'user' ? (
                                        <div className="user-bubble">
                                            <ReactMarkdown className="prose prose-invert max-w-none break-words" remarkPlugins={[remarkGfm]}>{turn.prompt}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <div className="ai-bubble">
                                            {turn.parts.map((part, i) => <ResponseBlock key={i} part={part} />)}
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
                                <button onClick={() => setIsRepoModalOpen(true)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors" aria-label="Attach GitHub repository"><GithubIcon /></button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
                                <input type="file" ref={folderInputRef} onChange={handleFolderChange} className="hidden" multiple {...{ webkitdirectory: "" } as any} />
                            </div>
                            <div className="relative">
                                <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }} placeholder="Ask Gemini anything..." rows={3}
                                    className={`w-full px-4 py-3 pr-24 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none ${isDarkMode ? "bg-gray-700/50 border-gray-600 focus:border-blue-500" : "bg-gray-50 border-gray-300 focus:border-blue-500"}`}
                                />
                                <div className="absolute right-3 bottom-3 flex items-center gap-2">
                                    <button onClick={handleSubmit} disabled={!inputText.trim() || isLoading || isContentLoading}
                                        className={`px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-2 ${(!inputText.trim() || isLoading || isContentLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {isLoading ? (<SpinnerIcon />) : (<ArrowUpIcon />)}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <aside className="lg:col-span-1 flex flex-col gap-4">
                        <div className={`p-4 rounded-xl shadow-sm border border-gray-700/30 dark:border-gray-700 ${isDarkMode ? "bg-gray-800/60" : "bg-white/60"} backdrop-blur-sm flex-1 flex flex-col`}>
                            {isAuthLoading ? (
                                <div className="flex-1 flex items-center justify-center"><SpinnerIcon className="w-8 h-8" /></div>
                            ) : user ? (
                                <> 
                                    <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
                                        <h2 className="text-lg font-semibold">Chat History</h2>
                                        <button onClick={handleCreateNewChat} className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors" aria-label="New Chat">
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
                                                        <p className="font-medium truncate pr-16">{chat.name}</p>
                                                        <p className="text-xs opacity-70 mt-1">{new Date(chat.createdTime).toLocaleString()}</p>
                                                        
                                                        <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleStartEditing(chat); }}
                                                                className="p-1 rounded-md hover:bg-gray-500/30 transition-opacity"
                                                                aria-label="Rename chat"
                                                            >
                                                                <EditIcon className="w-4 h-4 text-slate-400" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                                                                className="p-1 rounded-md hover:bg-red-500/40 transition-opacity"
                                                                aria-label="Delete chat"
                                                            >
                                                                <TrashIcon className="w-4 h-4 text-red-400" />
                                                            </button>
                                                        </div>
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
                                        Sign in with your Google account to automatically save and sync your chat history with Google Drive.
                                    </p>
                                    <button onClick={signIn} disabled={!isInitialized || isAuthLoading} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50">
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