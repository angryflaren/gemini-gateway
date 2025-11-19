import React, { useState, useRef, useEffect, useCallback } from "react";
import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";
import ignore from 'ignore';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import JSZip from 'jszip';
import { useVirtualizer } from '@tanstack/react-virtual';
import { config } from './config';
import { IGNORED_FOLDERS, IGNORED_FILES, BLOCKED_EXTENSIONS, WARNING_PATTERNS } from './file.config.js';
import { ResponsePart, ConversationTurn, Chat, ChatContent, UserProfile, UserTurn } from "./types";
import { listChats, getChatContent, saveOrUpdateChat, renameChatFile, deleteChat, uploadFile, getFileWithMetadata, deleteFile } from "./services/googleDrive";
import { saveLocalFile, getLocalFile, deleteLocalFile, clearAllLocalFiles, getLocalUsage } from "./services/localStore";
import { useGoogleAuth } from "./hooks/useGoogleAuth";


interface HistoricalFile {
    id: string;
    name: string;
    size: number; // в байтах
}

// --- Иконки ---
const GemIcon = ({ className = "w-6 h-6" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const PaperclipIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21.44 11.05L12.39 19.64C11.11 20.87 9.07 21.01 7.64 19.93C6.21 18.85 6.04 16.86 7.27 15.58L15.86 6.53C16.65 5.74 17.91 5.74 18.7 6.53C19.49 7.32 19.49 8.58 18.7 9.37L10.11 18.42C9.67 18.86 9.01 19.03 8.38 18.85C7.75 18.67 7.23 18.16 7.05 17.53C6.87 16.9 7.04 16.24 7.48 15.8L16.03 6.75C17.26 5.47 19.3 5.33 20.38 6.41C21.46 7.49 21.6 9.53 20.32 10.81L11.27 19.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const FolderIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 10H12L10 8H2C1.45 8 1 8.45 1 9V19C1 19.55 1.45 20 2 20H22C22.55 20 23 19.55 23 19V11C23 10.45 22.55 10 22 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const GithubIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
    </svg>
);

const ArrowUpIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const SpinnerIcon = ({ className = "w-4 h-4 animate-spin" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3v3m0 12v3M4.2 4.2l2.1 2.1m11.4 11.4l2.1 2.1M3 12h3m12 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const PlusIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const GoogleIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 2.04-4.78 2.04-3.83 0-6.9-3.1-6.9-6.9s3.07-6.9 6.9-6.9c2.1 0 3.54.85 4.4 1.73l2.55-2.55C18.03 2.52 15.48 1.5 12.48 1.5c-6.18 0-11.16 4.92-11.16 10.92s4.98 10.92 11.16 10.92c6.5 0 10.8-4.55 10.8-11.16 0-.75-.08-1.35-.2-2.04h-10.6z" fill="currentColor" />
    </svg>
);

const FileIconForAttachment = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"></path>
    </svg>
);

const FolderIconForAttachment = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0">
        <path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.9-2-2-2h-8l-2-2z"></path>
    </svg>
);

const GithubIconForAttachment = () => (
    <svg viewBox="0 0 16 16" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
    </svg>
);

const EditIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
    </svg>
);

const TrashIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

const CloseIcon = ({ className = "w-3 h-3" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const InfoIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
);

const ChevronDownIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const ACCEPTED_FILE_TYPES = config.app.acceptedFileTypes;

const FileTypeIcon = ({ fileName, className = "w-5 h-5" }: { fileName: string, className?: string }) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    // PDF (Красный классический)
    if (ext === 'pdf') {
        return (
            <svg className={`${className} text-red-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M9 13v-1h6v1" />
                <path d="M12 18v-6" />
                <path d="M9 17v-1" />
            </svg>
        );
    }

    // Word (Синий .doc, .docx)
    if (['doc', 'docx'].includes(ext)) {
        return (
            <svg className={`${className} text-blue-600`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M8 13h8" />
                <path d="M8 17h8" />
                <path d="M10 9h4" />
            </svg>
        );
    }

    // Excel (Зеленый .xls, .xlsx, .csv)
    if (['xls', 'xlsx', 'csv', 'tsv'].includes(ext)) {
        return (
            <svg className={`${className} text-emerald-600`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M8 13h8" />
                <path d="M8 17h8" />
                <path d="M10 9v8" />
                <path d="M8 15h8" />
            </svg>
        );
    }

    // PowerPoint (Оранжевый .ppt, .pptx)
    if (['ppt', 'pptx'].includes(ext)) {
        return (
            <svg className={`${className} text-orange-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <rect x="8" y="12" width="8" height="6" rx="1" />
                <line x1="12" y1="12" x2="12" y2="18" />
            </svg>
        );
    }

    // Code (Фиолетовый/Серый для .js, .py, .ts, .html, .json и др.)
    const codeExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'json', 'xml', 'sql', 'rb', 'java', 'cpp', 'c', 'h', 'go', 'rs', 'php', 'sh', 'yaml', 'yml', 'md'];
    if (codeExts.includes(ext)) {
        return (
            <svg className={`${className} text-slate-600 dark:text-slate-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
            </svg>
        );
    }
    
    // Archives (Желтый .zip, .rar, .7z)
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
        return (
             <svg className={`${className} text-yellow-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10H12L10 8H2C1.45 8 1 8.45 1 9V19C1 19.55 1.45 20 2 20H22C22.55 20 23 19.55 23 19V11C23 10.45 22.55 10 22 10Z" />
                <line x1="12" y1="15" x2="12" y2="15.01" strokeWidth="3"/>
            </svg>
        );
    }

    // Default (Серый стандартный файл)
    return (
        <svg className={`${className} text-gray-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
        </svg>
    );
};


const AttachmentChip = ({ file, onRemove }: { file: File, onRemove?: () => void }) => {
    const isRepo = file.name.startsWith(config.storage.repoFilePrefix);
    const isFolder = file.name.endsWith('.zip') && !file.type; 
    
    let displayName: string = file.name;
    
    let IconComponent;

    if (isRepo) {
        displayName = file.name.replace(config.storage.repoFilePrefix, '').replace(config.storage.repoFileSuffix, '').replace(/---/g, '/');
        // Github иконка
        IconComponent = <GithubIconForAttachment />; 
    } else if (isFolder) {
        // Если это "папка" (zip)
        displayName = file.name.replace('.zip', '');
        IconComponent = <FolderIconForAttachment />;
    } else {
        IconComponent = <FileTypeIcon fileName={file.name} />;
    }

    return (
        <div className="flex-shrink-0 flex items-center gap-2 text-xs font-medium w-48 pl-3 pr-1 py-1.5 rounded-lg border border-gray-200 bg-gray-50/50 text-gray-700 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300 backdrop-blur-sm transition-all hover:bg-gray-100 dark:hover:bg-slate-700">
            {/* Чтобы иконка не сжималась */}
            <div className="flex-shrink-0 flex items-center justify-center">
                {IconComponent}
            </div>
            
            <span className="truncate flex-1 select-none" title={displayName}>
                {displayName}
            </span>
            
            {onRemove && (
                <button
                    onClick={onRemove}
                    className="p-1 rounded-md flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                    aria-label={`Remove file ${displayName}`}
                >
                    <CloseIcon />
                </button>
            )}
        </div>
    );
};

const ContentRenderer = React.memo(({ content }: { content: string }) => {
    const safeContent = typeof content === 'string' ? content : '';
    return (
        <div className="leading-relaxed break-words prose dark:prose-invert max-w-none">
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
            >
                {safeContent}
            </ReactMarkdown>
        </div>
    );
});

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
        case 'title':
            return (
                <div className="border-b-2 border-sky-500 dark:border-sky-400 pb-3 mb-4">
                    <h1 className="text-4xl font-bold break-words title">
                        <ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>
                            {part.content || ''}
                        </ReactMarkdown>
                    </h1>
                    {part.subtitle && (
                        <div className="text-lg mt-1 subtitle">
                            <ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>
                                {part.subtitle}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            );
        case 'heading':
            return (
                <h2 className="text-2xl font-bold border-b dark:border-slate-700 pb-2 pt-4 break-words">
                    <ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>
                        {part.content || ''}
                    </ReactMarkdown>
                </h2>
            );
        case 'subheading':
            return (
                <h3 className="text-xl font-semibold pt-3 break-words">
                    <ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>
                        {part.content || ''}
                    </ReactMarkdown>
                </h3>
            );
        case 'annotated_heading':
            return (
                <div className="flex items-center gap-3 pt-4">
                    <h4 className="text-lg font-semibold break-words">{part.content || ''}</h4>
                    <span className="info-tag">{part.tag || ''}</span>
                </div>
            );
        case 'quote_heading':
            return (
                <blockquote className="my-4 border-l-4 p-4 rounded-r-lg quote-heading-container">
                    <div className="text-lg font-medium italic quote-text">
                        <ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={htmlPlugins}>
                            {part.content || ''}
                        </ReactMarkdown>
                    </div>
                    {part.source && (
                        <footer className="block text-right text-sm mt-2 not-italic quote-cite">— <cite>{part.source}</cite></footer>
                    )}
                </blockquote>
            );
        case 'text':
            return <ContentRenderer content={part.content || ''} />;
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
                <div className="relative group my-3 rounded-md bg-[#282c34] overflow-x-auto border border-gray-700/50">
                    <button
                        onClick={() => handleCopy(codeContent)}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-black/40 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-black/60"
                        aria-label="Copy code"
                    >
                        {copied ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        )}
                    </button>
                    <SyntaxHighlighter
                        language={part.language === 'error' ? 'bash' : (part.language || 'text')}
                        style={oneDark}
                        showLineNumbers
                        customStyle={{ 
							margin: 0, 
							padding: '0.75rem', 
							paddingTop: '0.75rem',
							fontSize: '13px',
							lineHeight: '1.4'
						}}
						lineNumberStyle={{ minWidth: '2.5em', paddingRight: '1em', color: '#5c6370', fontSize: '12px' }}
                    >
                        {codeContent}
                    </SyntaxHighlighter>
                </div>
            );
        case 'math':
            return <BlockMath math={part.content || ''} />;
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
            return (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">Unknown block type!</strong>
                    <span className="block sm:inline"> Received an unknown block type '{unknownPart?.type}'.</span>
                    <pre className="mt-2 text-xs">{JSON.stringify(unknownPart, null, 2)}</pre>
                </div>
            );
    }
});

const HelpModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    if (!isOpen) return null;

    const LinkRenderer = (props: React.ComponentPropsWithoutRef<"a">) => {
        const { href, children } = props;
        const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'));
        if (isExternal) {
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
        }
        return <a href={href}>{children}</a>;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-sm dark:border dark:border-gray-700 rounded-lg shadow-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-slate-100">{config.helpModal.title}</h3>
                <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
                    <p>{config.helpModal.introduction}</p>
                    <div>
                        <h4 className="font-semibold">{config.helpModal.apiKeyTitle}</h4>
                        <ReactMarkdown components={{ a: LinkRenderer }}>{config.helpModal.apiKeySection}</ReactMarkdown>
                    </div>
                    <div>
                        <h4 className="font-semibold">{config.helpModal.filesTitle}</h4>
                        <p>{config.helpModal.filesSection}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold">{config.helpModal.repoTitle}</h4>
                        <ReactMarkdown components={{ a: LinkRenderer }}>{config.helpModal.repoSection}</ReactMarkdown>
                    </div>
                    <div>
                        <h4 className="font-semibold">{config.helpModal.contactTitle}</h4>
                        <ReactMarkdown components={{ a: LinkRenderer }}>{config.helpModal.contactSection}</ReactMarkdown>
                    </div>
                </div>
                <div className="flex justify-end mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700">{config.helpModal.closeButton}</button>
                </div>
            </div>
        </div>
    );
};

const RepoCloneModal = ({
    isOpen,
    onClose,
    onSubmit,
    isCloning
}: {
    isOpen: boolean,
    onClose: () => void,
    onSubmit: (url: string) => void,
    isCloning: boolean
}) => {
    const [url, setUrl] = useState("");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-sm dark:border dark:border-gray-700 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-slate-100">{config.repoModal.title}</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">{config.repoModal.description}</p>
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={config.repoModal.placeholder}
                    className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 bg-gray-50 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 dark:bg-gray-700/50 dark:border-gray-600 dark:focus:border-blue-500 dark:text-white"
                />
                <div className="flex justify-end gap-4 mt-6">
                    <button
                        onClick={onClose}
                        disabled={isCloning}
                        className="px-4 py-2 text-sm rounded-md text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-gray-800"
                    >
                        {config.repoModal.cancelButton}
                    </button>
                    <button
                        onClick={() => onSubmit(url)}
                        disabled={isCloning || !url}
                        className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-500"
                    >
                        {isCloning ? config.repoModal.submitButtonCloning : config.repoModal.submitButton}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CheckboxIcon = ({ checked }: { checked: boolean }) => (
    <svg 
        className={`w-5 h-5 transition-colors duration-200 ${
            checked ? "text-blue-600" : "text-gray-400 dark:text-slate-500"
        }`} 
        fill="currentColor" 
        viewBox="0 0 20 20" 
        xmlns="http://www.w3.org/2000/svg"
    >
        {checked ? (
            // Галочка в круге
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        ) : (
            // Крестик в круге
			<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.586 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.414 1.414a1 1 0 101.414 1.414L10 11.414l1.414 1.414a1 1 0 001.414-1.414L11.414 10l1.414-1.414a1 1 0 00-1.414-1.414L10 8.586 8.586 7.293z" clipRule="evenodd" />        )}
    </svg>
);

const WarningModal = ({
    isOpen,
    onClose,
    onSubmit,
    files,
}: {
    isOpen: boolean,
    onClose: () => void,
    onSubmit: (confirmedFiles: File[]) => void,
    files: File[];
}) => {
    const [selectedFiles, setSelectedFiles] = useState<Set<File>>(new Set());

    useEffect(() => {
        if (isOpen) {
            setSelectedFiles(new Set(files));
        }
    }, [isOpen, files]);

    const handleToggle = (file: File) => {
        setSelectedFiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(file)) {
                newSet.delete(file);
            } else {
                newSet.add(file);
            }
            return newSet;
        });
    };

    const handleSubmit = () => {
        onSubmit(Array.from(selectedFiles));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-sm dark:border dark:border-gray-700 rounded-lg shadow-xl p-6 w-full max-w-lg"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-slate-100">Confirm File Upload</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                    The following files might be large or consume many tokens (e.g., PDFs, logs, lock-files). Please select the ones you want to include.
                </p>
                <div className="max-h-64 overflow-y-auto space-y-2 p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50 border dark:border-gray-700">
                    {files.map((file, index) => {
                        const isChecked = selectedFiles.has(file);
                        return (
                            <label
                                key={index}
                                htmlFor={`warn-file-${index}`}
                                className="flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors hover:bg-gray-200 dark:hover:bg-gray-700/50"
                            >
                                <input
                                    type="checkbox"
                                    id={`warn-file-${index}`}
                                    checked={isChecked}
                                    onChange={() => handleToggle(file)}
                                    className="sr-only"
                                />
                                <CheckboxIcon checked={isChecked} />
                                <span className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate" title={file.name}>
                                    {file.name}
                                </span>
                                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </span>
                            </label>
                        );
                    })}
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm rounded-md text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-gray-800"
                    >
                        {config.repoModal.cancelButton}
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-500"
                        disabled={selectedFiles.size === 0}
                    >
                        Add Selected ({selectedFiles.size})
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Для управления файлами истории ---
const FileManagementModal = ({
    isOpen,
    onClose,
    files,
    deselectedIds,
    onToggleFile,
}: {
    isOpen: boolean;
    onClose: () => void;
    files: HistoricalFile[];
    deselectedIds: Set<string>;
    onToggleFile: (fileId: string) => void;
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-sm dark:border dark:border-gray-700 rounded-lg shadow-xl p-6 w-full max-w-lg"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-slate-100">Manage History Files</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                    {config.dialog.fileManagerWarning}
                </p>
                <div className="max-h-64 overflow-y-auto space-y-2 p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50 border dark:border-gray-700">
                    {files.length === 0 ? (
                        <p className="p-2 text-sm text-center text-gray-500 dark:text-gray-400">No historical files found.</p>
                    ) : (
                        files.map((file) => {
                            const isChecked = !deselectedIds.has(file.id);
                            return (
                                <label
                                    key={file.id}
                                    htmlFor={`hist-file-${file.id}`}
                                    className="flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors hover:bg-gray-200 dark:hover:bg-gray-700/50"
                                >
                                    <input
                                        type="checkbox"
                                        id={`hist-file-${file.id}`}
                                        checked={isChecked}
                                        onChange={() => onToggleFile(file.id)}
                                        className="sr-only"
                                    />
                                    <CheckboxIcon checked={isChecked} />
                                    <span className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate" title={file.name}>
                                        {file.name}
                                    </span>
                                    <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                </label>
                            );
                        })
                    )}
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

interface CustomSelectOption {
  id: string;
  name: string;
}

const CustomSelect = ({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  label: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.id === value) || options[0];
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative w-full" ref={selectRef}>
      <label htmlFor={`custom-select-button-${label}`} className="block text-sm font-medium mb-1">{label}</label>
      <button
        type="button"
        id={`custom-select-button-${label}`}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 rounded-lg border text-left flex justify-between items-center bg-gray-50 border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
      >
        <span className="truncate">{selectedOption.name}</span>
        <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>
      
      {/* Выпадающее меню */}
      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 shadow-lg rounded-lg border dark:border-slate-600 overflow-y-auto max-h-60">
          <ul className="py-1">
            {options.map((option) => (
              <li
                key={option.id}
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                }}
                // Стили для опций, включая подсветку выбранной
                className={`px-4 py-2 cursor-pointer transition-colors hover:bg-blue-600/20 ${
                  option.id === value 
                  ? 'font-semibold text-blue-500' 
                  : 'text-gray-900 dark:text-slate-200 hover:text-blue-400'
                }`}
              >
                {option.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const AuthDisplay = ({ user, onLogin, onLogout, isLoading, isReady }: { user: UserProfile | null, onLogin: () => void, onLogout: () => void, isLoading: boolean, isReady: boolean }) => {
    if (user) {
        return (
            <div className="relative group">
                <img src={user.imageUrl} alt={user.name} className="w-8 h-8 rounded-full cursor-pointer" />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg py-1 hidden group-hover:block z-20">
                    <div className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 border-b dark:border-slate-600">
                        <p className="font-semibold truncate">{user.name}</p>
                        <p className="text-xs truncate">{user.email}</p>
                    </div>
                    <a href="#" onClick={(e) => { e.preventDefault(); onLogout(); }} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700">
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
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
            aria-label="Sign in with Google"
        >
            {isLoading ? <SpinnerIcon /> : <GoogleIcon />}
        </button>
    );
};

const LOCAL_CHAT_ID = config.storage.localSessionId;

const createLocalChat = (): ChatContent => ({
    id: LOCAL_CHAT_ID,
    name: config.app.defaultNewChatName,
    conversation: [],
});

export default function App() {
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

    const [baseTokenCount, setBaseTokenCount] = useState(0);
    const [deltaTokenCount, setDeltaTokenCount] = useState(0);
    const [baseTextTokenCount, setBaseTextTokenCount] = useState(0);
    const [isTokenCounting, setIsTokenCounting] = useState(false);
    const [isDeltaCounting, setIsDeltaCounting] = useState(false);
    const [tokenCountError, setTokenCountError] = useState<string | null>(null);
    const [currentModelLimit, setCurrentModelLimit] = useState(config.models[0].context_window);
    const [warningModalOpen, setWarningModalOpen] = useState(false);
    const [filesToWarn, setFilesToWarn] = useState<File[]>([]);
    const [filesToAdd, setFilesToAdd] = useState<File[]>([]);
    const [showHelp, setShowHelp] = useState(false);
    const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
    const [isCloning, setIsCloning] = useState(false);
    const [rememberContext, setRememberContext] = useState(false);
	
	const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
	const [isInputCollapsed, setIsInputCollapsed] = useState(false);
	const [showScrollButton, setShowScrollButton] = useState(false);
    const attachMenuRef = useRef<HTMLDivElement>(null);
	
	const [isDragging, setIsDragging] = useState(false);

    const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
    const [historicalFiles, setHistoricalFiles] = useState<HistoricalFile[]>([]);
    const [deselectedFileIds, setDeselectedFileIds] = useState(new Set<string>());
    const [localUsageBytes, setLocalUsageBytes] = useState(0);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const skipNextFetch = useRef(false);
    const chatListContainerRef = useRef<HTMLDivElement>(null);
	
	
	const handleScroll = () => {
        if (chatContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
            // Если расстояние до низа меньше 100px, считаем что внизу
            const isBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 100;
            setShowScrollButton(!isBottom);
        }
    };
	
    const rowVirtualizer = useVirtualizer({
        count: chats.length,
        getScrollElement: () => chatListContainerRef.current,
        estimateSize: () => 76,
        overscan: 5,
    });
	
	useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
                setIsAttachMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        const selectedModelConfig = config.models.find(m => m.id === model);
        if (selectedModelConfig) {
            setCurrentModelLimit(selectedModelConfig.context_window);
        } else {
            setCurrentModelLimit(config.models[0].context_window);
        }
    }, [model]);

    useEffect(() => {
        document.documentElement.classList.toggle("dark", isDarkMode);
    }, [isDarkMode]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
        }
    }, [activeChatContent?.conversation, isLoading]);

    const handleCreateNewChat = useCallback(async () => {
        setActiveChatId(LOCAL_CHAT_ID);
        setActiveChatContent(createLocalChat());
        setHistoricalFiles([]);
        setDeselectedFileIds(new Set());
        setBaseTokenCount(0);
        setBaseTextTokenCount(0);
        if (!user) { // Очищаем IndexedDB(если не вошли в аккаунт)
            try {
                await clearAllLocalFiles();
                setLocalUsageBytes(0);
            } catch (err) {
                console.error("Failed to clear local storage:", err);
            }
        }
    }, [user]);

    useEffect(() => {
        const init = async () => {
            if (user && isInitialized) {
                setIsContentLoading(true);
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
                    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
                    if (errorMessage.includes("Authentication error")) {
                        setError("Your session has expired. Please sign in again.");
                        signOut();
                    } else {
                        setError("Could not load chats from Google Drive.");
                    }
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
    }, [user, isInitialized, handleCreateNewChat, signOut]);

    useEffect(() => {
        if (skipNextFetch.current) {
            skipNextFetch.current = false;
            return;
        }
        const loadChatContent = async () => {
            if (!activeChatId || activeChatId === LOCAL_CHAT_ID) {
                if (activeChatId === LOCAL_CHAT_ID && (!activeChatContent || activeChatContent.id !== LOCAL_CHAT_ID)) {
                    setActiveChatContent(createLocalChat());
                }
                setHistoricalFiles([]);
                setDeselectedFileIds(new Set());
                setBaseTokenCount(0);
                setBaseTextTokenCount(0);
                return;
            }
            if (!user) {
                setError("Please sign in to view your saved chats.");
                handleCreateNewChat();
                return;
            }
            setActiveChatContent(null);
            setIsContentLoading(true);
            setError(null);
            setHistoricalFiles([]);
            setDeselectedFileIds(new Set());
            setBaseTokenCount(0);
            setBaseTextTokenCount(0);
            try {
                const chatContent = await getChatContent(activeChatId);
                setActiveChatContent(chatContent);
            } catch (err) {
                console.error("Failed to load chat content:", err);
                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
                if (errorMessage.includes("Authentication error")) {
                    setError("Your session has expired. Please sign in again to load chats.");
                    signOut();
                } else {
                    setError("Could not load the selected chat. Starting a new one.");
                    handleCreateNewChat();
                }
            } finally {
                setIsContentLoading(false);
            }
        };
        loadChatContent();
    }, [activeChatId, user, handleCreateNewChat, signOut]);

    useEffect(() => {
        if (editingChatId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [editingChatId]);

    const calculateBaseTokenCount = useCallback(async () => {
        // Если нет ключа, тумблера или истории - выходим
        if (!apiKey.trim() || !rememberContext || !activeChatContent || activeChatContent.conversation.length === 0) {
            setBaseTokenCount(0);
            setBaseTextTokenCount(0);
            setHistoricalFiles([]);
            return;
        }

        setIsTokenCounting(true);
        setTokenCountError(null);
        
        // Один FormData для всех данных
        const historyFormData = new FormData();
        historyFormData.append("apiKey", apiKey);
        historyFormData.append("model", model);
        historyFormData.append("prompt", "");

        try {
            // --- Собираем файлы из истории (GDrive/LocalDB) ---
            const allFileFetchPromises: Promise<{ id: string, name: string, size: number, blob: Blob } | null>[] = [];
            const oldFileIds = new Set<string>();
            const isUserLoggedIn = user && isInitialized;

            activeChatContent.conversation.forEach(turn => {
                if (turn.type === 'user' && turn.attachments) {
                    turn.attachments.forEach(att => {
                        if (att.fileId) {
                            if (isUserLoggedIn && !att.fileId.startsWith(config.storage.localFilePrefix)) {
                                oldFileIds.add(att.fileId);
                            } else if (!isUserLoggedIn && att.fileId.startsWith(config.storage.localFilePrefix)) {
                                oldFileIds.add(att.fileId);
                            }
                        }
                    });
                }
            });

            for (const fileId of oldFileIds) {
                allFileFetchPromises.push(
                    (async () => {
                        try {
                            if (isUserLoggedIn) {
                                // Логика GDrive
                                const fileData = await getFileWithMetadata(fileId); 
                                return { id: fileId, ...fileData };
                            } else {
                                // Логика LocalDB
                                const { blob, name } = await getLocalFile(fileId); 
                                return { id: fileId, name, size: blob.size, blob };
                            }
                        } catch (fetchError) {
                            console.error(`BaseCount: Failed to re-fetch file ${fileId}:`, fetchError);
                            return null;
                        }
                    })()
                );
            }

            const allFilesDataRaw = await Promise.all(allFileFetchPromises);
            const allFilesData = allFilesDataRaw.filter(f => f !== null) as { id: string, name: string, size: number, blob: Blob }[];
            
            setHistoricalFiles(allFilesData.map(f => ({ id: f.id, name: f.name, size: f.size })));
            
            // Добавляем отфильтрованные файлы в *тот же* FormData
            const filesToCount = allFilesData.filter(f => !deselectedFileIds.has(f.id));
            filesToCount.forEach(f => {
                historyFormData.append("files", new File([f.blob], f.name), f.name);
            });

            // --- Собираем текст истории ---
            const historyForApi = activeChatContent.conversation.map(turn => {
                if (turn.type === 'user') { return { role: 'user', parts: [turn.prompt] }; }
                else {
                    const modelParts = turn.parts.map(part => {
                        switch (part.type) {
                            case 'code': return `\`\`\`${part.language || ''}\n${part.content}\n\`\`\``;
                            case 'list': return part.items.map(item => `- ${item}`).join('\n');
                            case 'title': return `# ${part.content}`;
                            case 'heading': return `## ${part.content}`;
                            case 'subheading': return `### ${part.content}`;
                            default: return (part as any).content || '';
                        }
                    }).filter(Boolean);
                    return { role: 'model', parts: modelParts };
                }
            });
            const historyJson = JSON.stringify(historyForApi);
            const historyFile = new File([new Blob([historyJson], { type: 'application/json' })], "chat_history.json");
            // Добавляем файл истории в *тот же* FormData
            historyFormData.append("files", historyFile, historyFile.name);

            // --- Один единственный запрос ---
            const response = await fetch(`${config.backendUrl}/api/count_tokens`, {
                method: "POST", headers: { 'ngrok-skip-browser-warning': 'true' }, body: historyFormData
            });

            if (!response.ok) {
                 const errorData = await response.json();
                throw new Error(errorData.detail || "Failed to count base tokens");
            }
            
            const data = (await response.json());
            setBaseTokenCount(data.total_tokens || 0);
            
            setBaseTextTokenCount(0); 

        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            console.error("Base token count error:", message);
            setTokenCountError("!");
            setBaseTokenCount(0);
            setBaseTextTokenCount(0);
        } finally {
            setIsTokenCounting(false);
        }
    }, [apiKey, model, rememberContext, activeChatContent, user, isInitialized, deselectedFileIds]);

    const calculateDeltaTokenCount = useCallback(async () => {
        // Если нет ключа, или нечего считать - выходим
        if (!apiKey.trim()) {
            setDeltaTokenCount(0);
            return;
        }
        if (!inputText.trim() && attachedFiles.length === 0) {
            setDeltaTokenCount(0);
            return;
        }

        setIsDeltaCounting(true);
        
        try {
            const formData = new FormData();
            formData.append("apiKey", apiKey);
            formData.append("model", model);
            
            formData.append("prompt", inputText);
            attachedFiles.forEach(file => {
                formData.append("files", file, file.name);
            });

            // Вызов эндпоинта
            const response = await fetch(`${config.backendUrl}/api/count_tokens`, {
                method: "POST",
                headers: { 'ngrok-skip-browser-warning': 'true' },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Failed to count delta tokens");
            }
            
            const data = await response.json();
            setDeltaTokenCount(data.total_tokens || 0);
            setTokenCountError(null); // Сбрасываем ошибку *только* при успехе

        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            console.error("Delta token count error:", message);
            setTokenCountError("!");
            setDeltaTokenCount(0);
        } finally {
            setIsDeltaCounting(false);
        }
    }, [apiKey, model, inputText, attachedFiles]);

    useEffect(() => {
        const timer = setTimeout(() => {
            calculateDeltaTokenCount();
        }, 1500);
        return () => {
            clearTimeout(timer);
        };
    }, [calculateDeltaTokenCount]);

    useEffect(() => {
        if (rememberContext && isInitialized && !isLoading) {
            calculateBaseTokenCount();
        } else if (!rememberContext) { // Сбрасываем, если выключили тумблер
            setBaseTokenCount(0);
            setBaseTextTokenCount(0);
            setHistoricalFiles([]);
        }
    }, [rememberContext, activeChatContent, user, isInitialized, calculateBaseTokenCount, isLoading]);

    const handleStartEditing = (chat: Chat) => {
        setEditingChatId(chat.id);
        setEditingChatName(chat.name);
    };

    const handleToggleDeselectedFile = (fileId: string) => {
        setDeselectedFileIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileId)) {
                newSet.delete(fileId);
            } else {
                newSet.add(fileId);
            }
            return newSet;
        });
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
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
            if (errorMessage.includes("Authentication error")) {
                setError("Your session has expired. Please sign in again.");
                signOut();
            } else {
                setError("Failed to rename the chat. Reverting changes.");
                if (originalChat) {
                    setChats(prev => prev.map(c => c.id === originalId ? { ...c, name: originalChat.name } : c));
                    if (activeChatId === originalId) {
                        setActiveChatContent(prev => prev ? { ...prev, name: originalChat.name } : null);
                    }
                }
            }
        }
    };

    const handleDeleteChat = async (chatIdToDelete: string) => {
        // --- Логика для авторизованного пользователя (Google Drive) ---
        if (user) {
            const originalChats = [...chats];
            const chatToDeleteIndex = originalChats.findIndex(c => c.id === chatIdToDelete);
            setChats(prev => prev.filter(c => c.id !== chatIdToDelete));
            if (activeChatId === chatIdToDelete) {
                const newChats = originalChats.filter(c => c.id !== chatIdToDelete);
                if (newChats.length > 0) {
                    const nextIndex = chatToDeleteIndex >= newChats.length ? newChats.length - 1 : chatToDeleteIndex;
                    setActiveChatId(newChats[nextIndex].id);
                } else {
                    handleCreateNewChat();
                }
            }
			
            // --- Фоновое удаление (последовательно) ---
            try {
                // получаем контент, чтобы найти ID файлов
                const chatContent = await getChatContent(chatIdToDelete);
                const fileIdsToDelete = new Set<string>();
                chatContent.conversation.forEach(turn => {
                    if (turn.type === 'user' && turn.attachments) {
                        turn.attachments.forEach(att => {
                            if (att.fileId && !att.fileId.startsWith(config.storage.localFilePrefix)) {
                                fileIdsToDelete.add(att.fileId);
                            }
                        });
                    }
                });
                // Затем удаляем все вложенные файлы (параллельно)
                if (fileIdsToDelete.size > 0) {
                    const deletePromises = Array.from(fileIdsToDelete).map(id => deleteFile(id));
                    await Promise.allSettled(deletePromises);
                    console.log(`Deleted ${fileIdsToDelete.size} associated GDrive files.`);
                }
                // Удаляем сам файл чата .json
                await deleteChat(chatIdToDelete);
                console.log(`Successfully deleted chat ${chatIdToDelete}.`);
            } catch (err) {
                console.error("Failed to delete chat or files:", err);
                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
                if (errorMessage.includes("File not found")) {
                    console.warn("Chat or files were already deleted, no restore needed.");
                    return;
                }
                if (errorMessage.includes("Authentication error")) {
                    setError("Your session has expired. Please sign in again.");
                    signOut();
                } else {
                    setError(`Failed to delete chat: ${errorMessage}. Chat restored.`);
                }
                setChats(originalChats);
            }
        }
        // --- Логика для неавторизованного пользователя (LocalDB) ---
        else {
            if (chatIdToDelete === LOCAL_CHAT_ID && activeChatContent) {
                try {
                    const fileIdsToDelete = new Set<string>();
                    activeChatContent.conversation.forEach(turn => {
                        if (turn.type === 'user' && turn.attachments) {
                            turn.attachments.forEach(att => {
                                if (att.fileId?.startsWith(config.storage.localFilePrefix)) {
                                    fileIdsToDelete.add(att.fileId);
                                }
                            });
                        }
                    });
                    if (fileIdsToDelete.size > 0) {
                        const deletePromises = Array.from(fileIdsToDelete).map(id => deleteLocalFile(id));
                        await Promise.allSettled(deletePromises);
                    }
                } catch (err) {
                    console.error("Failed to delete local files:", err);
                }
            }
            handleCreateNewChat();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const filesToUpload = e.target.files ? Array.from(e.target.files) : [];
        if (filesToUpload.length === 0) return;
        const ig = ignore().add(Array.from(IGNORED_FILES));
        const igWarn = ignore().add(Array.from(WARNING_PATTERNS));
        const allowedFiles: File[] = [];
        const rejectedFiles: string[] = [];
        const ignoredFiles: string[] = [];
        const warningFiles: File[] = [];
        for (const file of filesToUpload) {
            const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
            if (BLOCKED_EXTENSIONS.has(fileExtension)) {
                rejectedFiles.push(file.name);
            } else if (ig.ignores(file.name)) {
                ignoredFiles.push(file.name);
            } else if (igWarn.ignores(file.name)) {
                warningFiles.push(file);
            } else {
                allowedFiles.push(file);
            }
        }
        if (rejectedFiles.length > 0) {
            setError(`For security, you cannot upload: ${rejectedFiles.join(', ')}.`);
        }
        if (ignoredFiles.length > 0) {
            console.log(`Ignoring noisy files: ${ignoredFiles.join(', ')}`);
        }
        if (warningFiles.length > 0) {
            setFilesToAdd(allowedFiles);
            setFilesToWarn(warningFiles);
            setWarningModalOpen(true);
        } else {
            setAttachedFiles(prevFiles => [...prevFiles, ...allowedFiles]);
        }
        e.target.value = '';
    };

    const handleWarningConfirm = (confirmedFiles: File[]) => {
        setAttachedFiles(prev => [...prev, ...filesToAdd, ...confirmedFiles]);
        setWarningModalOpen(false);
        setFilesToAdd([]);
        setFilesToWarn([]);
    };

    const handleWarningCancel = () => {
        setAttachedFiles(prev => [...prev, ...filesToAdd]);
        setWarningModalOpen(false);
        setFilesToAdd([]);
        setFilesToWarn([]);
    };

    const removeFile = (indexToRemove: number) => {
        setAttachedFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleUploadFileClick = () => fileInputRef.current?.click();

    const handleUploadFolderClick = () => folderInputRef.current?.click();

    const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const fileList = Array.from(files);
        let folderName = "";
        const gitignoreFile = fileList.find(f => (f as any).webkitRelativePath.endsWith('.gitignore'));
        const ig = ignore();
        const folderPatterns = Array.from(IGNORED_FOLDERS).map(f => `${f}/`);
        ig.add([...IGNORED_FILES, ...folderPatterns]);
        if (gitignoreFile) {
            try {
                const gitignoreContent = await gitignoreFile.text();
                ig.add(gitignoreContent);
                console.log("Loaded rules from user's .gitignore");
            } catch (err) {
                console.error("Could not read .gitignore file, using defaults.", err);
            }
        }
        const zip = new JSZip();
        fileList.forEach(file => {
            const relativePath = (file as any).webkitRelativePath;
            if (!relativePath) return;
            if (!folderName) {
                folderName = relativePath.split('/')[0];
            }
            const universalPath = relativePath.replace(/\\/g, '/');
            const pathToTest = universalPath.includes('/') ? universalPath.substring(universalPath.indexOf('/') + 1) : universalPath;
            if (ig.ignores(pathToTest)) {
                console.log(`Ignoring: ${universalPath}`);
                return;
            }
            zip.file(relativePath, file);
        });
        try {
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const zipFile = new File([zipBlob], `${folderName || 'project'}.zip`, { type: "application/zip" });
            setAttachedFiles(prevFiles => [...prevFiles, zipFile]);
        } catch (err) {
            console.error("Failed to create zip file", err);
            setError("Failed to process the folder.");
        }
        if (e.target) e.target.value = "";
    };
	
	// --- Функционал Drag & Drop ---
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const items = Array.from(e.dataTransfer.items);
        if (items.length === 0) return;

        // Проверяем, есть ли папки среди перетаскиваемого
        const entries = items.map(item => item.webkitGetAsEntry()).filter(entry => entry !== null);
		
        const hasFolder = entries.some(entry => entry.isDirectory);
		const shouldZip = hasFolder || entries.length > 10;

        // --- Вариант 1: Смешанный контент или папки ---
        if (hasFolder) {
            const zip = new JSZip();
            const ig = ignore().add(Array.from(IGNORED_FILES));
            const folderPatterns = Array.from(IGNORED_FOLDERS).map(f => `${f}/`);
            ig.add(folderPatterns);

            let gitignoreFound = false;
            const filesProcessed: { path: string, file: File }[] = [];

            // Рекурсивная функция сканирования
            const traverseFileTree = async (item: any, path = ""): Promise<void> => {
                if (item.isFile) {
                    const file = await new Promise<File>((resolve, reject) => item.file(resolve, reject));
                    // Ищем .gitignore в корне
                    if (path === "" && file.name === ".gitignore") {
                         try {
                            const content = await file.text();
                            ig.add(content);
                            gitignoreFound = true;
                         } catch (err) { console.error("Error reading .gitignore", err); }
                    }
                    filesProcessed.push({ path: path + file.name, file });
                } else if (item.isDirectory) {
                    const dirReader = item.createReader();
                    const entries = await new Promise<any[]>((resolve, reject) => {
                        dirReader.readEntries(resolve, reject);
                    });
                    for (const entry of entries) {
                        await traverseFileTree(entry, path + item.name + "/");
                    }
                }
            };

            // Запускаем сканирование
            await Promise.all(entries.map(entry => traverseFileTree(entry)));

            if (gitignoreFound) console.log("Loaded rules from dropped .gitignore");

            // Фильтрация и добавление в ZIP
            filesProcessed.forEach(({ path, file }) => {
                if (ig.ignores(path)) {
                    console.log(`Ignoring: ${path}`);
                    return;
                }
                zip.file(path, file);
            });

            try {
                const zipBlob = await zip.generateAsync({ type: "blob" });
                
                // Определяем базовое имя (имя первой папки или 'project-context')
                const rootName = entries.find(e => e.isDirectory)?.name || 'batch_upload';
                
                const timestamp = new Date().toISOString()
                    .replace('T', '_')
                    .replace(/:/g, '-')
                    .split('.')[0];
					
				const fileName = `${rootName}_${timestamp}.zip`;
                const zipFile = new File([zipBlob], fileName, { type: "application/zip" });
                setAttachedFiles(prev => [...prev, zipFile]);
            } catch (err) {
                console.error("Failed to zip dropped folders", err);
                setError("Failed to process dropped folders.");
            }

        } 
        // --- Вариант 2: Только файлы ---
        else {
            const files = Array.from(e.dataTransfer.files);
            const ig = ignore().add(Array.from(IGNORED_FILES));
            const igWarn = ignore().add(Array.from(WARNING_PATTERNS));
            
            const allowedFiles: File[] = [];
            const rejectedFiles: string[] = [];
            const warningFiles: File[] = [];
            
            for (const file of files) {
                const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
                if (BLOCKED_EXTENSIONS.has(fileExtension)) {
                    rejectedFiles.push(file.name);
                } else if (ig.ignores(file.name)) {
                } else if (igWarn.ignores(file.name)) {
                    warningFiles.push(file);
                } else {
                    allowedFiles.push(file);
                }
            }

            if (rejectedFiles.length > 0) {
                setError(`Security: Cannot upload: ${rejectedFiles.join(', ')}`);
            }
            
            if (warningFiles.length > 0) {
                setFilesToAdd(allowedFiles);
                setFilesToWarn(warningFiles);
                setWarningModalOpen(true);
            } else {
                setAttachedFiles(prev => [...prev, ...allowedFiles]);
            }
        }
    };
    // ------------------------------

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
            const textSizeInBytes = new TextEncoder().encode(data.processed_text).length;

            // Проверяем лимиты в зависимости от статуса пользователя
            if (user && isInitialized) {
                // --- 1. Пользователь авторизован (GDrive) ---
                const limitMB = config.repoModal.maxCloneSizeMB;
                const textSizeInMB = textSizeInBytes / (1024 * 1024);
                if (textSizeInMB > limitMB) {
                    throw new Error(`Processed repo text is too large (${textSizeInMB.toFixed(2)} MB). GDrive limit is ${limitMB} MB.`);
                }
            } else {
                // --- 2. Пользователь НЕ авторизован (LocalDB) ---
                const maxLocalBytes = config.localQuotaMB * 1024 * 1024;
                const currentUsage = await getLocalUsage();
                
                if (currentUsage + textSizeInBytes > maxLocalBytes) {
                    const repoSizeMB = (textSizeInBytes / (1024 * 1024)).toFixed(2);
                    const currentUsageMB = (currentUsage / (1024 / 1024)).toFixed(2);
                    throw new Error(`Repo is ${repoSizeMB} MB. Local storage limit of ${config.localQuotaMB} MB will be exceeded (Current usage: ${currentUsageMB} MB). Please sign in.`);
                }
            }

            const repoFile = new File(
                [data.processed_text],
                `${config.storage.repoFilePrefix}${data.repo_name.replace(config.storage.repoFilePrefix, '')}${config.storage.repoFileSuffix}`,
                { type: "text/plain" }
            );

            setAttachedFiles(prevFiles => [...prevFiles, repoFile]);
            setIsRepoModalOpen(false);

        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            setError(`Cloning Error: ${message}`);
        } finally {
            setIsCloning(false);
        }
    };
	
	const scrollToBottom = () => {
		if (chatContainerRef.current) {
			// Прокручиваем к максимальной высоте контейнера, т.е. к последнему сообщению
			chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
		}
	};

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const filesToUpload: File[] = [];
        for (const item of e.clipboardData.items) {
            if (item.kind === "file") {
                const file = item.getAsFile();
                if (file) {
                    const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
                    const extension = file.name.split(".").pop() || "bin";
                    const newName = `pasted-${timestamp}.${extension}`;
                    const newFile = new File([file], newName, { type: file.type });
                    filesToUpload.push(newFile);
                }
            }
        }
        if (filesToUpload.length > 0) {
            e.preventDefault();
            setAttachedFiles(prevFiles => [...prevFiles, ...filesToUpload]);
        }
    };

    const handleSubmit = async () => {
		if (!apiKey) {
			setError("Please enter your Gemini API key.");
			return;
		}
		if (!inputText.trim() && attachedFiles.length === 0) return;
		if (!activeChatContent) return;

		setIsLoading(true);
		setError(null);

		const currentInput = inputText;
		const currentFiles = [...attachedFiles];
		const isUserLoggedIn = user && isInitialized;
		const originalConversation = activeChatContent.conversation;
		
		// Создаем "временные" вложения (только имена)
		const provisionalAttachments = currentFiles.map(file => ({ name: file.name }));
		const userTurn: ConversationTurn = {
			type: 'user',
			prompt: currentInput,
			attachments: provisionalAttachments,
			timestamp: new Date().toLocaleTimeString()
		};

		const isNewChat = activeChatContent.id === LOCAL_CHAT_ID;
		setActiveChatContent(prev => {
			if (!prev) return null;
			return {
				...prev,
				name: isNewChat ? (currentInput.substring(0, 40).trim() || config.app.defaultUntitledChatName) : prev.name,
				conversation: [...prev.conversation, userTurn],
			};
		});
		setInputText("");
		setAttachedFiles([]);

		// Готовим formData 
		const formData = new FormData();
		formData.append("apiKey", apiKey);
		formData.append("prompt", currentInput);
		formData.append("model", model);
		formData.append("refinerModel", config.refinerModel);

		currentFiles.forEach(file => {
			formData.append("files", file, file.name);
		});
		
		// Добавляем файлы из истории (LocalDB или GDrive)
		let historyFilesToFetch: Promise<void>[] = [];
		if (rememberContext && originalConversation.length > 0) {
			const gdriveFileIds = new Set<string>();
			const localFileIds = new Set<string>();
			
			originalConversation.forEach(turn => { 
				if (turn.type === 'user' && turn.attachments) {
					turn.attachments.forEach(att => {
						if (att.fileId?.startsWith(config.storage.localFilePrefix)) {
							localFileIds.add(att.fileId);
						} else if (att.fileId && isUserLoggedIn) { // GDrive ID
							gdriveFileIds.add(att.fileId);
						}
					});
				}
			});
			
			// GDrive
			for (const fileId of gdriveFileIds) {
				if (deselectedFileIds.has(fileId)) continue;
				historyFilesToFetch.push(
					(async () => {
						try {
							const { blob, name } = await getFileWithMetadata(fileId);
							formData.append("files", new File([blob], name), name);
						} catch (fetchError) {
							console.error(`Failed to re-fetch GDrive file ${fileId}:`, fetchError);
						}
					})()
				);
			}
			
			// LocalDB
			for (const fileId of localFileIds) {
				if (deselectedFileIds.has(fileId)) continue;
				historyFilesToFetch.push(
					(async () => {
						try {
							const { blob, name } = await getLocalFile(fileId);
							formData.append("files", new File([blob], name), name);
						} catch (fetchError) {
							console.error(`Failed to re-fetch local file ${fileId}:`, fetchError);
						}
					})()
				);
			}
		}
		
		// Добавляем историю чата (текст)
		if (rememberContext && originalConversation.length > 0) {
			const historyForApi = originalConversation.map(turn => {
				if (turn.type === 'user') return { role: 'user', parts: [turn.prompt] };
				else {
					const modelParts = turn.parts.map(part => {
						switch (part.type) {
							case 'code': return `\`\`\`${part.language || ''}\n${part.content}\n\`\`\``;
							case 'list': return part.items.map(item => `- ${item}`).join('\n');
							case 'title': return `# ${part.content}`;
							case 'heading': return `## ${part.content}`;
							case 'subheading': return `### ${part.content}`;
							default: return (part as any).content || '';
						}
					}).filter(Boolean);
					return { role: 'model', parts: modelParts };
				}
			});
			const historyJson = JSON.stringify(historyForApi, null, 2);
			const historyFile = new File([new Blob([historyJson], { type: config.storage.gdriveJsonMimeType })], config.storage.chatHistoryFileName);
			formData.append("files", historyFile, config.storage.chatHistoryFileName);
		}

		let responseParts: ResponsePart[];
		let attachmentMetadata: { id: string, name: string }[] = [];

		try {
			// Задача 1: Запрос к Gemini
			const geminiPromise = (async () => {
				await Promise.all(historyFilesToFetch);
				
				const response = await fetch(`${config.backendUrl}/api/generate`, {
					method: "POST",
					headers: { 'ngrok-skip-browser-warning': 'true' },
					body: formData
				});

				if (!response.ok) {
					const errorText = await response.text();
					try { const errorJson = JSON.parse(errorText); throw new Error(errorJson.detail || "Server error"); }
					catch(e) { throw new Error(errorText || "Server error"); }
				}
				return response.json() as Promise<ResponsePart[]>;
			})();

			// Задача 2: Загрузка НОВЫХ файлов (GDrive ИЛИ LocalDB)
			const uploadPromise = (async () => {
				if (currentFiles.length === 0) return [];
				
				if (isUserLoggedIn) {
					const uploadPromises = currentFiles.map(file => uploadFile(file));
					return Promise.all(uploadPromises);
				} else {
					const maxBytes = config.localQuotaMB * 1024 * 1024;
					const currentUsage = await getLocalUsage();
					let newUsage = currentUsage;
					
					const uploadPromises: Promise<{ id: string, name: string }>[] = [];
					
					for (const file of currentFiles) {
						newUsage += file.size;
						if (newUsage > maxBytes) {
							throw new Error(`Local storage quota exceeded (${config.localQuotaMB} MB). Log in to save larger files.`);
						}
						uploadPromises.push(saveLocalFile(file));
					}
					setLocalUsageBytes(newUsage);
					return Promise.all(uploadPromises);
				}
			})();

			const [geminiResult, uploadResult] = await Promise.allSettled([
				geminiPromise,
				uploadPromise
			]);

			if (uploadResult.status === 'fulfilled') {
				attachmentMetadata = uploadResult.value;
			} else {
				setInputText(currentInput);
				setAttachedFiles(currentFiles);
				throw uploadResult.reason; 
			}

			if (geminiResult.status === 'fulfilled') {
				responseParts = geminiResult.value;
			} else {
				const message = geminiResult.reason instanceof Error ? geminiResult.reason.message : "An unknown error occurred.";
				responseParts = [{ type: 'code', language: 'error', content: `Request Error: ${message}` }];
				setError(`Request Error: ${message}`);
			}

			const aiTurn: ConversationTurn = {
				type: 'ai',
				parts: responseParts,
				timestamp: new Date().toLocaleTimeString()
			};
			
			userTurn.attachments = attachmentMetadata.map(file => ({
				name: file.name,
				fileId: file.id 
			}));
			
			const finalChatName = isNewChat
				? (currentInput.substring(0, 40).trim() || config.app.defaultUntitledChatName)
				: activeChatContent.name;
				
			const finalChatContent: ChatContent = {
				...activeChatContent,
				id: activeChatContent.id,
				name: finalChatName,
				conversation: [
					...originalConversation,
					userTurn,
					aiTurn
				]
			};
			
			setActiveChatContent(finalChatContent);
			
			setIsLoading(false);

			if (isUserLoggedIn) {
				try {
					const savedChat = await saveOrUpdateChat(finalChatContent);
					
					if (isNewChat) {
						const newChatItem: Chat = {
							id: savedChat.id, 
							name: savedChat.name, 
							createdTime: new Date().toISOString() 
						};
						skipNextFetch.current = true;
						setChats(prevChats => [newChatItem, ...prevChats]);
						
						setActiveChatContent(savedChat);
						setActiveChatId(savedChat.id);
					} else {
						setActiveChatContent(savedChat);
					}
					console.log("GDrive save complete (with or without API error).");

				} catch (saveError) {
					const message = saveError instanceof Error ?
						saveError.message : "An unknown error occurred.";
					console.error("Failed to save chat:", saveError);
					setError(prevError => (prevError ? prevError + "\n" : "") + `Could not save chat to GDrive: ${message}`);
				}
			}

		} catch (error) {
			const message = error instanceof Error ?
				error.message : "An unknown error occurred.";
			
			const errorTurn: ConversationTurn = {
				type: 'ai',
				parts: [{ type: 'code', language: 'error', content: `Critical Error: ${message}` }],
				timestamp: new Date().toLocaleTimeString()
			};
			
			setInputText(currentInput);
			setAttachedFiles(currentFiles);
			
			setActiveChatContent(prev => {
				if (!prev) return null;
				return { ...prev, conversation: [...originalConversation, errorTurn] };
			});
			setError(`Critical Error: ${message}`);
		
			setIsLoading(false);

		} finally {
			setIsLoading(false); // Выключение спиннера
		}
	};

    return (
        <>
            <FileManagementModal
                isOpen={isFileManagerOpen}
                onClose={() => setIsFileManagerOpen(false)}
                files={historicalFiles}
                deselectedIds={deselectedFileIds}
                onToggleFile={handleToggleDeselectedFile}
            />
            <WarningModal
                isOpen={warningModalOpen}
                onClose={handleWarningCancel}
                onSubmit={handleWarningConfirm}
                files={filesToWarn}
            />
            <RepoCloneModal isOpen={isRepoModalOpen} onClose={() => setIsRepoModalOpen(false)} onSubmit={handleCloneRepo} isCloning={isCloning} />
            <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
            <div className={`h-screen flex flex-col transition-colors duration-300 ${isDarkMode ? "bg-slate-900 text-slate-100" : "bg-gray-100 text-gray-900"}`}>
                <header className="border-b border-gray-700/30 dark:border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 bg-gray-100/60 dark:bg-slate-900/80 backdrop-blur-md z-30">
                    <div className="flex items-center gap-2">
                        <GemIcon />
                        <h1 className="text-xl font-semibold tracking-tight">{config.appTitle}</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors" aria-label="Toggle theme">
                            {isDarkMode ? '🌜' : '☀️'}
                        </button>
                        <button onClick={() => setShowHelp(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                            {config.helpButtonText}
                        </button>
                        <AuthDisplay user={user} onLogin={signIn} onLogout={signOut} isLoading={isAuthLoading} isReady={isInitialized} />
                    </div>
                </header>
                <main className="max-w-7xl mx-auto grid flex-1 grid-cols-1 lg:grid-cols-4 gap-6 p-6 min-h-0">
                    <aside className="lg:col-span-1">
                        <div className={`p-6 h-full rounded-xl shadow-sm border border-gray-700/30 dark:border-gray-700 ${isDarkMode ? "bg-slate-800/70" : "bg-white/70"} backdrop-blur-sm`}>
                            <h2 className="text-lg font-semibold mb-4">API Configuration</h2>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="api-key" className="block text-sm font-medium mb-1">Gemini API Key</label>
                                    <input id="api-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIzaSy..."
                                        className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isDarkMode ? "bg-slate-700/50 border-slate-600 focus:border-blue-500" : "bg-gray-50 border-gray-300 focus:border-blue-500"}`}
                                    />
                                </div>
                                <div>
									<CustomSelect
										label="Select Gemini Model"
										value={model}
										onChange={(id) => setModel(id)}
										options={config.models.map(m => ({ id: m.id, name: m.name }))}
									/>
								</div>
                                <div className="pt-2">
                                    <p className="text-xs text-gray-400 mb-2">This is a professional AI assistant for developers.</p>
                                    <p className="text-xs text-gray-400">Connect your Gemini API key and start programming with Google's most advanced models.</p>
                                </div>
                            </div>
                        </div>
                    </aside>
                    <div className={`lg:col-span-2 rounded-xl shadow-sm border border-gray-700/30 dark:border-gray-700 flex flex-col min-h-0 ${isDarkMode ? "bg-slate-800/70" : "bg-white/70"} backdrop-blur-sm relative`}>
                        <div ref={chatContainerRef} onScroll={handleScroll} className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-700 scrollbar-track-transparent">
                            {isContentLoading && !activeChatContent && (<div className="flex items-center justify-center h-full"><SpinnerIcon className="w-8 h-8 text-slate-400" /></div>)}
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
                                        <div className="flex flex-col items-end gap-2 w-full">
                                            <div className="user-bubble">
                                                {turn.prompt && (
                                                    <div className="whitespace-pre-wrap break-words">
                                                        {turn.prompt}
                                                    </div>
                                                )}
                                                {turn.attachments && turn.attachments.length > 0 && (
													<div className="mt-2 flex gap-2 overflow-x-auto border-t border-white/20 pt-2 pb-1 scrollbar-hide snap-x max-w-full">
														{turn.attachments.map((file, idx) => (
															<AttachmentChip key={idx} file={{ name: file.name } as File} />
														))}
													</div>
												)}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="ai-bubble">{turn.parts.map((part, i) => <ResponseBlock key={i} part={part} />)}</div>
                                    )}
                                    <span className="text-xs text-gray-500 dark:text-gray-400 px-2">{turn.timestamp}</span>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex items-start gap-3">
                                    <div className="ai-bubble opacity-80"><div className="flex items-center gap-2"><SpinnerIcon className="w-5 h-5" /> Gemini is thinking...</div></div>
                                </div>
                            )}
                            {error && <div className="text-red-500 bg-red-500/10 p-3 rounded-lg">{error}</div>}
                        </div>
						{isInputCollapsed && showScrollButton && (
							<button
								onClick={scrollToBottom}
								className="absolute bottom-[80px] right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-xl text-gray-700 dark:text-white hover:scale-105 transition-all z-10"
								title="Scroll to latest message"
							>
								 <ChevronDownIcon className="w-5 h-5" /> 
							</button>
						)}
						<div 
							onClick={() => isInputCollapsed && setIsInputCollapsed(false)}
							className={`relative flex-shrink-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
								isInputCollapsed 
									? "w-12 h-6 mx-auto mb-4 mt-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl hover:scale-105 cursor-pointer rounded-full shadow-2xl border border-white/20 dark:border-white/10 z-50" 
									: "w-full mx-0 mb-0 p-4 bg-gray-100/60 dark:bg-slate-900/80 border-t border-gray-200 dark:border-gray-700/50 rounded-b-xl z-50"
							}`}
						>
                            {/* Кнопка-переключатель */}
                            <div className={`transition-all duration-300 z-30 ${
                                isInputCollapsed 
                                    ? "w-full h-full flex items-center justify-center rotate-180" // Центр таблетки
                                    : "absolute -top-3 left-1/2 -translate-x-1/2 rotate-0" // Язычок сверху
                                }`}>
								<button
									onClick={(e) => { e.stopPropagation(); setIsInputCollapsed(!isInputCollapsed); }}
									className={`flex items-center justify-center transition-colors ${
                                        isInputCollapsed
                                            ? "w-full h-full bg-transparent text-gray-500 dark:text-slate-200" // Прозрачная
                                            : "w-8 h-6 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full shadow-sm text-gray-400 hover:text-blue-500 dark:hover:text-blue-400" // Язычок
                                    }`}
								>
									 <ChevronDownIcon className={isInputCollapsed ? "w-3.5 h-3.5" : "w-4 h-4"} />
								</button>
							</div>
					
							<div 
								className={`input-area-container transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
									isInputCollapsed 
										? "opacity-0 scale-95 pointer-events-none h-0 overflow-hidden translate-y-4" 
										: "opacity-100 scale-100 h-auto translate-y-0"
								}`}
								onDragEnter={handleDragEnter}
								onDragLeave={handleDragLeave}
								onDragOver={handleDragOver}
								onDrop={handleDrop}
							>
								{isDragging && (
									<div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-blue-500/10 dark:bg-blue-500/20 backdrop-blur-sm rounded-xl border-2 border-blue-500 border-dashed animate-in fade-in duration-200">
										<div className="bg-white dark:bg-slate-800 p-4 rounded-full shadow-lg mb-2">
											<svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
												<path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
											</svg>
										</div>
										<p className="text-lg font-semibold text-blue-600 dark:text-blue-400">Drop to upload</p>
										<p className="text-sm text-gray-500 dark:text-gray-300">Folders will be automatically zipped</p>
									</div>
								)}
                                <textarea
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                                    onPaste={handlePaste}
                                    placeholder="Ask Gemini something..."
                                    rows={3}
                                    className="input-textarea"
                                />
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="file-upload"
                                    accept={ACCEPTED_FILE_TYPES}
                                />
                                {attachedFiles.length > 0 && (
                                    <div className="px-3 pt-3 pb-2 flex gap-3 overflow-x-auto border-t border-gray-200 dark:border-gray-700/50 scrollbar-hide snap-x">
										{attachedFiles.map((file, index) => {
											if (file.type.startsWith("image/")) {
												const previewUrl = URL.createObjectURL(file);
												return (
													<div key={index} className="flex-shrink-0 relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-300 dark:border-slate-600 shadow-sm bg-gray-100 dark:bg-slate-800">
														<img src={previewUrl} alt={file.name} className="w-full h-full object-cover opacity-90" />
														<div
															className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]"
															onLoad={() => URL.revokeObjectURL(previewUrl)}
														>
															 <button
																onClick={() => removeFile(index)}
																className="p-1.5 rounded-md bg-white/10 text-white hover:bg-red-500 transition-colors backdrop-blur-md border border-white/20"
																aria-label={`Remove file ${file.name}`}
															>
																<TrashIcon className="w-4 h-4" />
															</button>
														</div>
													</div>
												);
											}
											return (
												<AttachmentChip
													key={`${file.name}-${index}`}
													file={file}
													onRemove={() => removeFile(index)}
												/>
											);
										})}
									</div>
                                )}
                                <div className="flex items-center justify-between p-2">
									<div className="flex items-center gap-2 relative" ref={attachMenuRef}>
									
										{/* Кнопка-триггер "+" */}
										<button
											onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
											className={`p-2 rounded-full transition-all duration-200 ease-out ${
												isAttachMenuOpen 
													? "bg-gray-200 text-gray-900 rotate-45 dark:bg-slate-600 dark:text-white" 
													: "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-700/50 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
											}`}
											aria-label="Add attachment"
										>
											<PlusIcon className="w-5 h-5" />
										</button>

										{isAttachMenuOpen && (
											<div className="absolute bottom-full left-0 mb-4 w-64 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600/50 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-100 origin-bottom-left">
												<div className="py-1">
													{/* Вариант 1: Файл */}
													<button
														onClick={() => { handleUploadFileClick(); setIsAttachMenuOpen(false); }}
														className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors group"
													>
														<div className="p-1.5 rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 group-hover:scale-110 transition-transform">
															<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
																<path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" />
															</svg>
														</div>
														<div>
															<span className="block text-sm font-semibold text-gray-700 dark:text-slate-200">Upload Files</span>
															<span className="block text-xs text-gray-500 dark:text-slate-400">PDF, Images, Code...</span>
														</div>
													</button>

													{/* Вариант 2: Папка */}
													<button
														onClick={() => { handleUploadFolderClick(); setIsAttachMenuOpen(false); }}
														className="w-full text-left px-4 py-3 hover:bg-yellow-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors group"
													>
														<div className="p-1.5 rounded-md bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400 group-hover:scale-110 transition-transform">
															<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
																<path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
															</svg>
														</div>
														<div>
															<span className="block text-sm font-semibold text-gray-700 dark:text-slate-200">Upload Folder</span>
															<span className="block text-xs text-gray-500 dark:text-slate-400">Add entire project context</span>
														</div>
													</button>

													<div className="h-px bg-gray-100 dark:bg-slate-700 mx-4 my-1"></div>

													{/* Вариант 3: GitHub */}
													<button
														onClick={() => { setIsRepoModalOpen(true); setIsAttachMenuOpen(false); }}
														className="w-full text-left px-4 py-3 hover:bg-purple-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors group"
													>
														<div className="p-1.5 rounded-md bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 group-hover:scale-110 transition-transform">
															<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
																 <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
															</svg>
														</div>
														<div>
															<span className="block text-sm font-semibold text-gray-700 dark:text-slate-200">Clone Repository</span>
															<span className="block text-xs text-gray-500 dark:text-slate-400">From public GitHub URL</span>
														</div>
													</button>
												</div>
											</div>
										)}
										
										<input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept={ACCEPTED_FILE_TYPES} />
										<input type="file" ref={folderInputRef} onChange={handleFolderChange} className="hidden" multiple {...{ webkitdirectory: "" } as any} />
										<div className="flex items-center gap-3 ml-auto mr-2">
											
											{/* 1. "Remember Context" */}
											<div className="flex items-center gap-2">
												<label htmlFor="remember-context-toggle" className="flex items-center gap-2 cursor-pointer select-none group">
													<span className="hidden sm:block text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
														Memory
													</span>
													<div className="relative">
														<input 
															type="checkbox" 
															id="remember-context-toggle" 
															checked={rememberContext} 
															onChange={() => setRememberContext(!rememberContext)} 
															className="sr-only peer" 
														/>
														<div className="block w-9 h-5 bg-gray-200 dark:bg-slate-700 rounded-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20 peer-checked:bg-blue-600 transition-colors"></div>
														<div className="absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform peer-checked:translate-x-4 shadow-sm"></div>
													</div>
												</label>

												{/* Подсказка (i) для Памяти */}
												<div className="relative group/tooltip flex items-center">
													<InfoIcon className="w-4 h-4 text-gray-400 hover:text-blue-500 transition-colors cursor-help" />
													<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 bg-slate-800/90 backdrop-blur-md text-white text-xs rounded-xl shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-[100] border border-white/10">
														{config.dialog.historyToggleWarning}
														<div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800/90"></div>
													</div>
												</div>
											</div>

											{/* Разделитель */}
											<div className="h-4 w-px bg-gray-300 dark:bg-slate-700 hidden sm:block"></div>

											{/* 2. Счетчик Токенов */}
											<div className="flex items-center gap-2">
												<div 
													className="flex items-center gap-1.5 text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700/50 px-2 py-1 rounded-md border border-transparent hover:border-gray-200 dark:hover:border-slate-600 transition-colors cursor-default"
												>
													{(() => {
														const totalTokenCount = baseTokenCount + deltaTokenCount;
														const isOverLimit = totalTokenCount > currentModelLimit;
														const showWarning = isOverLimit || tokenCountError;
														
														// Если есть ошибка или переполнение - красный текст
														const textColor = showWarning ? "text-red-500 font-bold" : "";

														return (
															<>
																{(isTokenCounting || isDeltaCounting) ? (
																	 <SpinnerIcon className="w-3 h-3 animate-spin" /> 
																) : (
																	 <span className={textColor}>
																		{tokenCountError ? "ERR" : totalTokenCount.toLocaleString()}
																	 </span>
																)}
																<span className="opacity-50">/</span>
																<span className="opacity-50">{(currentModelLimit / 1000).toFixed(0)}k</span>
															</>
														);
													})()}
												</div>

												{/* Подсказка (i) для Токенов (динамическая: показывает ошибку или инфо) */}
												<div className="relative group/tooltip flex items-center">
													{tokenCountError || (baseTokenCount + deltaTokenCount > currentModelLimit) ? (
															<span className="text-red-500 font-bold cursor-help text-xs">!</span>
													) : (
															<InfoIcon className="w-4 h-4 text-gray-400 hover:text-blue-500 transition-colors cursor-help" />
													)}
													
													<div className="absolute bottom-full right-0 mb-3 w-64 p-3 bg-slate-800/90 backdrop-blur-md text-white text-xs rounded-xl shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-[100] border border-white/10 text-center">
															{(() => {
																if (tokenCountError) return "Token counting failed. Check API key or network.";
																
																const totalTokens = baseTokenCount + deltaTokenCount;
																if (totalTokens > currentModelLimit) {
																	return (baseTextTokenCount < (currentModelLimit * 0.2)) 
																		? config.dialog.fileManagerWarning 
																		: config.dialog.tokenLimitWarning;
																}
																
																// Если всё хорошо - показываем инфо
																return config.dialog.tokenLimitInfo;
															})()}
															<div className="absolute right-1 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800/90"></div>
													</div>
												</div>
												
												{/* Кнопка менеджера файлов (появляется если память переполнена) */}
												{rememberContext && historicalFiles.length > 0 && (
													 <button 
														onClick={() => setIsFileManagerOpen(true)}
														className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 transition-colors"
														aria-label="Manage files"
														title="Manage Context Files"
													 >
														<FolderIcon className="w-4 h-4" />
													 </button>
												)}
											</div>
										</div>
									</div>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={
                                            (!inputText.trim() && attachedFiles.length === 0) ||
                                            isLoading ||
                                            isContentLoading ||
                                            isTokenCounting ||
                                            isDeltaCounting
                                        }
                                        className="input-submit-button"
                                        aria-label="Send message"
                                    >
                                        {isLoading ? (<SpinnerIcon />) : (<ArrowUpIcon />)}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <aside className="lg:col-span-1 flex flex-col min-h-0">
                        <div className={`p-4 h-full rounded-xl shadow-sm border border-gray-700/30 dark:border-gray-700 ${isDarkMode ? "bg-slate-800/70" : "bg-white/70"} backdrop-blur-sm flex flex-col`}>
                            {isAuthLoading ? (
                                <div className="flex-1 flex items-center justify-center"><SpinnerIcon className="w-8 h-8" /></div>
                            ) : user ? (
                                <>
                                    <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
                                        <h2 className="text-lg font-semibold">Chat History</h2>
                                        <button onClick={handleCreateNewChat} className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors" aria-label="New Chat"><PlusIcon /></button>
                                    </div>
                                    <div ref={chatListContainerRef} className="flex-1 overflow-y-auto min-h-0 pr-2 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                        {chats.length > 0 ? (
                                            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                                                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                                                    const chat = chats[virtualItem.index];
                                                    if (!chat) return null;
                                                    return (
                                                        <div key={chat.id} className="chat-item-wrapper" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualItem.size}px`, transform: `translateY(${virtualItem.start}px)`, paddingBottom: '8px' }}>
                                                            <div onClick={() => editingChatId !== chat.id && setActiveChatId(chat.id)} onDoubleClick={() => handleStartEditing(chat)} className={`group p-3 rounded-lg cursor-pointer transition-colors relative h-full flex flex-col justify-center ${activeChatId === chat.id ? "bg-blue-600/20" : "hover:bg-slate-700/30"}`}>
                                                                {editingChatId === chat.id ? (
                                                                    <form onSubmit={handleRenameChat}>
                                                                        <input ref={renameInputRef} type="text" value={editingChatName} onChange={(e) => setEditingChatName(e.target.value)} onBlur={() => handleRenameChat()} onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEditing(); }} className="rename-input" />
                                                                    </form>
                                                                ) : (
                                                                    <>
                                                                        <p className="font-medium truncate pr-16">{chat.name}</p>
                                                                        <p className="text-xs opacity-70 mt-1">{new Date(chat.createdTime).toLocaleString()}</p>
                                                                        <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                                                                            <button onClick={(e) => { e.stopPropagation(); handleStartEditing(chat); }} className="p-1 rounded-md hover:bg-slate-600/30 transition-opacity" aria-label="Rename chat"><EditIcon className="w-4 h-4 text-slate-400" /></button>
                                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }} className="p-1 rounded-md hover:bg-red-500/40 transition-opacity" aria-label="Delete chat"><TrashIcon className="w-4 h-4 text-red-400" /></button>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center text-sm text-gray-500 py-8">No chats yet.</div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-70">
                                    <GoogleIcon className="w-12 h-12 mb-4" />
                                    <h3 className="text-lg font-medium mb-1">Save your chats</h3>
                                    <p className="text-sm max-w-md">Sign in with your Google account to automatically save and sync your chat history with Google Drive.</p>
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