import React, { useState, useRef } from "react";
import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import JSZip from 'jszip';
import { config } from "./config";

// --- 1. ОБНОВЛЕНИЕ ТИПОВ ДАННЫХ ---
// Добавляем новые типы заголовков
interface TitlePart { type: 'title'; content: string; subtitle?: string; }
interface HeadingPart { type: 'heading'; content: string; }
interface SubheadingPart { type: 'subheading'; content: string; }
interface AnnotatedHeadingPart { type: 'annotated_heading'; content: string; tag: string; }
interface QuoteHeadingPart { type: 'quote_heading'; content: string; source?: string; }
// Стандартные типы
interface TextPart { type: 'text'; content: string; }
interface CodePart { type: 'code'; language: string; content: string; }
interface MathPart { type: 'math'; content: string; }
interface ListPart { type: 'list'; items: string[]; }

// Объединяем все в один тип
type ResponsePart =
  | TitlePart
  | HeadingPart
  | SubheadingPart
  | AnnotatedHeadingPart
  | QuoteHeadingPart
  | TextPart
  | CodePart
  | MathPart
  | ListPart;

// --- Вспомогательные компоненты ---
const GithubIcon = () => ( <svg viewBox="0 0 16 16" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path> </svg>);
const FolderIcon = () => ( <svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.9-2-2-2h-8l-2-2z"></path> </svg>);
const FileIcon = () => ( <svg viewBox="0 0 24 24" fill="currentColor" height="1em" width="1em" className="inline-block mr-2 flex-shrink-0"> <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"></path> </svg>);

const RepoCloneModal = ({ isOpen, onClose, onSubmit, isCloning }: { isOpen: boolean, onClose: () => void, onSubmit: (url: string) => void, isCloning: boolean }) => {
  const [url, setUrl] = useState("");
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">{config.repoModal.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{config.repoModal.description}</p>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={config.repoModal.placeholder} className="w-full px-4 py-2 border rounded-md outline-none focus:ring-2 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500"/>
        <div className="flex justify-end gap-4 mt-6">
          <button onClick={onClose} disabled={isCloning} className="px-4 py-2 text-sm rounded-md dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">{config.repoModal.cancelButton}</button>
          <button onClick={() => onSubmit(url)} disabled={isCloning || !url} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400">
            {isCloning ? config.repoModal.submitButtonCloning : config.repoModal.submitButton}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 2. ОБНОВЛЕНИЕ КОМПОНЕНТА ResponseBlock ---
const ResponseBlock = React.memo(({ part, isDarkMode }: { part: ResponsePart; isDarkMode: boolean }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  switch (part.type) {
    // --- НОВЫЕ БЛОКИ ДЛЯ ЗАГОЛОВКОВ ---
    case 'title':
        return (
            <div className="border-b-2 border-blue-500 dark:border-blue-400 pb-3 mb-4">
                {/* Убираем классы цвета, они теперь в CSS */}
                <h1 className="text-4xl font-bold break-words">{part.content}</h1>
                {/* Добавляем класс "subtitle" */}
                {part.subtitle && <p className="text-lg mt-1 subtitle">{part.subtitle}</p>}
            </div>
        );
    case 'heading':
      return <h2 className="text-2xl font-bold border-b dark:border-gray-600 pb-2 pt-4 break-words text-gray-800 dark:text-gray-100">{part.content}</h2>;
    case 'subheading':
        return <h3 className="text-xl font-semibold pt-3 break-words text-gray-800 dark:text-gray-200">{part.content}</h3>;
    case 'annotated_heading':
        return (
            <div className="flex items-center gap-3 pt-4">
                <h4 className="text-lg font-semibold break-words">{part.content}</h4>
                <span className="text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">{part.tag}</span>
            </div>
        );
    case 'quote_heading':
        return (
            <div className="my-4 border-l-4 border-sky-400 bg-sky-50 dark:bg-sky-900/20 dark:border-sky-500 p-4 rounded-r-lg">
                {/* Добавляем класс "quote-text" */}
                <p className="text-lg font-medium italic quote-text">{part.content}</p>
                {/* Добавляем класс "quote-cite" */}
                {part.source && <cite className="block text-right text-sm mt-2 not-italic quote-cite">— {part.source}</cite>}
            </div>
        );
    // --- СТАРЫЕ БЛОКИ ---
    case 'text':
      return <ReactMarkdown className="leading-relaxed break-words prose dark:prose-invert" remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{part.content}</ReactMarkdown>;
    case 'code':
      return (
        <div className="relative group my-4 overflow-x-auto rounded-md">
          <button onClick={() => handleCopy(part.content)} className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-800 bg-opacity-70 text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-10" aria-label="Copy code">
            {copied ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
          </button>
          <SyntaxHighlighter language={part.language} style={isDarkMode ? oneDark : oneLight} showLineNumbers customStyle={{ padding: '1rem', paddingTop: '1rem', margin: 0 }} wrapLongLines={false}>{part.content}</SyntaxHighlighter>
        </div>
      );
    case 'math':
      return <BlockMath math={part.content} />;
    case 'list':
      return (
        <ul className="list-disc pl-6 space-y-2 prose dark:prose-invert">
          {part.items.map((item, i) => (<li key={i}><ReactMarkdown>{item}</ReactMarkdown></li>))}
        </ul>
      );
    default:
      const unknownPart = part as any;
      return (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Unknown Block Type!</strong>
          <span className="block sm:inline"> An unknown block type '{unknownPart?.type}' was received from the AI.</span>
          <pre className="mt-2 text-xs">{JSON.stringify(unknownPart, null, 2)}</pre>
        </div>
      );
  }
});

const HelpModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">{config.helpModal.title}</h3>
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

// --- Основной компонент приложения (без изменений) ---
const App = () => {
  const [apiKey, setApiKey] = useState("");
  const [inputText, setInputText] = useState("");
  const [model, setModel] = useState(config.models[0].id);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [responseParts, setResponseParts] = useState<ResponsePart[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const removeFile = (indexToRemove: number) => {
    setAttachedFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) { alert("Please enter your API key."); return; }
    if (!inputText) { alert("Please enter a prompt."); return; }
    
    setIsLoading(true);
    setResponseParts([]);
    const formData = new FormData();
    formData.append("apiKey", apiKey);
    formData.append("prompt", inputText);
    formData.append("model", model);
	formData.append("refinerModel", config.refinerModel);

    attachedFiles.forEach(file => { formData.append("files", file); });

    try {
      const response = await fetch(`${config.backendUrl}/api/generate`, { method: "POST", body: formData });
      if (!response.ok) {
        let errorDetail = "An unknown server error occurred";
        try { const errorData = await response.json(); errorDetail = errorData.detail || JSON.stringify(errorData); }
        catch { errorDetail = await response.text(); }
        throw new Error(errorDetail);
      }
      const data = await response.json();
      setResponseParts(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      setResponseParts([{ type: 'code', language: 'error', content: `Request failed: ${message}` }]);
    } finally {
      setIsLoading(false);
    }
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
    setResponseParts([]);
    try {
      const response = await fetch(`${config.backendUrl}/api/clone_repo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      if (!response.ok) {
        const errorData = await response.json(); throw new Error(errorData.detail);
      }
      const data = await response.json();
      const repoFile = new File([data.processed_text], `${data.repo_name}_context.txt`, { type: "text/plain" });
      setAttachedFiles(prevFiles => [...prevFiles, repoFile]);
      setIsRepoModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      setResponseParts([{ type: 'code', language: 'error', content: `Clone failed: ${message}` }]);
    } finally {
      setIsCloning(false);
    }
  };

  const handleUploadFileClick = () => fileInputRef.current?.click();
  const handleUploadFolderClick = () => folderInputRef.current?.click();
  const handleHelpClick = () => setShowHelp(!showHelp);

  return (
    <>
      <RepoCloneModal isOpen={isRepoModalOpen} onClose={() => setIsRepoModalOpen(false)} onSubmit={handleCloneRepo} isCloning={isCloning} />
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-800'}`}>
        <header className={`px-6 py-4 flex justify-between items-center shadow-sm transition-colors ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}><h1 className="text-xl font-semibold">{config.appTitle}</h1><div className="flex items-center gap-2"><button onClick={handleHelpClick} className={`px-3 py-1 text-xs rounded-md transition-colors ${isDarkMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-100 hover:bg-blue-200'}`}>{config.helpButtonText}</button><button onClick={toggleTheme} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`} aria-label="Toggle theme">{isDarkMode ? '☀️' : '🌙'}</button></div></header>
        <main className="flex-grow max-w-4xl mx-auto w-full px-4 md:px-6 py-8 space-y-8">
          <section className={`p-5 rounded-xl shadow-md transition-colors ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}><label className="block text-sm font-medium mb-2">Gemini API Key</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter your Gemini API key" className={`w-full px-4 py-2 border rounded-md outline-none focus:ring-2 transition-colors ${isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-blue-500 text-white' : 'bg-white border-gray-300 focus:ring-blue-500'}`} /></section>
          <section className={`p-5 rounded-xl shadow-md transition-colors ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}><label className="block text-sm font-medium mb-2">Select Gemini Model</label><select value={model} onChange={(e) => setModel(e.target.value)} className={`w-full px-4 py-2 border rounded-md outline-none focus:ring-2 transition-colors ${isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-blue-500 text-white' : 'bg-white border-gray-300 focus:ring-blue-500'}`}>{config.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></section>
          <section className={`p-5 rounded-xl shadow-md transition-colors ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <label className="block text-sm font-medium mb-2">Your prompt</label>
            {attachedFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => {
                  const isRepo = file.name.startsWith('gh_repo:::');
                  const isFolder = file.name.endsWith('.zip');
                  let displayName: string = file.name;
                  let Icon = FileIcon;
                  if (isRepo) {
                    displayName = file.name.replace('gh_repo:::', '').replace(/---/g, '/');
                    Icon = GithubIcon;
                  } else if (isFolder) {
                    displayName = file.name.replace('.zip', '');
                    Icon = FolderIcon;
                  }
                  return (
                    <div key={`${file.name}-${index}`} className={`flex items-center gap-1 text-sm max-w-xs pl-2 pr-3 py-1 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                      <Icon />
                      <span className="truncate" title={displayName}>{displayName}</span>
                      <button onClick={() => removeFile(index)} className="text-red-500 hover:text-red-400 font-bold">×</button>
                    </div>
                  );
                })}
              </div>
            )}
            <textarea rows={6} value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type your request here..." className={`w-full px-4 py-2 border rounded-md resize-none outline-none focus:ring-2 transition-colors ${isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-blue-500 text-white' : 'bg-white border-gray-300 focus:ring-blue-500'}`}></textarea>
            <div className="mt-3 flex justify-between items-center">
              <div className="relative"><button onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`} aria-label="Attach file"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                {isAttachMenuOpen && (
                  <div className={`absolute bottom-full mb-2 w-64 rounded-md shadow-lg py-1 z-10 ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                    <button onClick={handleUploadFileClick} className={`block w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'}`}>Upload Files</button>
                    <button onClick={handleUploadFolderClick} className={`block w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'}`}>Upload Folder</button>
                    <button onClick={() => { setIsRepoModalOpen(true); setIsAttachMenuOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm ${isDarkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'}`}>GitHub Repository</button>
                  </div>)}
              </div>
              <button onClick={handleSubmit} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed">{isLoading ? `Generating...` : 'Send to Gemini'}</button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
            <input type="file" ref={folderInputRef} onChange={handleFolderChange} className="hidden" multiple webkitdirectory="" />
          </section>
          <section className={`p-5 rounded-xl shadow-md transition-colors ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}><label className="block text-sm font-medium mb-2">Gemini's Response</label><div className={`w-full p-4 border rounded-md min-h-[180px] transition-colors ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>{isLoading && (<span className={`p-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Gemini is thinking...</span>)}{!isLoading && responseParts.length > 0 ? ( <div className="space-y-4">{responseParts.map((part, index) => <ResponseBlock key={index} part={part} isDarkMode={isDarkMode} />)}</div>) : !isLoading && (<span className={`p-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Your Gemini-generated content will appear here.</span>)}</div></section>
        </main>
        <footer className={`px-6 py-4 text-center text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}><p>Powered by Gemini API</p></footer>
      </div>
    </>
  );
};

export default App;
