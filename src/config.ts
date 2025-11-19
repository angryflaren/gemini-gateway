export const config = {
  appTitle: "Gemini Gateway Studio", // Название приложения
  localQuotaMB: 30, // Лимит (в МБ) для IndexedDB для неавторизованных пользователей
  helpButtonText: "Need Help?", // Текст на кнопке помощи
  backendUrl: import.meta.env.VITE_BACKEND_URL || "https://moving-moray-merely.ngrok-free.app", // URL бэкенда
  refinerModel: "gemini-2.5-flash-lite",

  // --- Настройки Google API и аутентификации ---
  google: {
    clientId: "205595350382-7a3mptfofbe1d0puirov0u1q5f5ma4oh.apps.googleusercontent.com",
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
    gapiScriptUrl: "https://apis.google.com/js/api.js",
    gsiScriptUrl: "https://accounts.google.com/gsi/client",
    sessionStorageKey: "google-auth-token",
    userinfoEndpoint: "https://www.googleapis.com/oauth2/v3/userinfo",
  },

  // --- Список доступных моделей Gemini ---
  models: [
    { id: "gemini-2.5-pro", name: "gemini-2.5-pro ★", context_window: 115000 },
    { id: "gemini-2.5-flash-preview-09-2025", name: "gemini-2.5-flash-preview", context_window: 240000 },
    { id: "models/gemini-2.5-flash", name: "gemini-2.5-flash ★", context_window: 240000 },
    { id: "gemini-2.5-flash-lite", name: "gemini-2.5-flash-lite", context_window: 1000000},
    { id: "gemini-2.0-flash", name: "gemini-2.0-flash", context_window: 1000000 },
  ],

  // --- Тексты для диалоговых окон ---
  dialog: {
    historyToggleLabel: "Memory", // Текст переключателя
    historyToggleWarning: "When enabled, recent conversation history is sent to provide context. The app automatically manages token limits to prevent errors.", // Подсказка для переключателя истории
    tokenLimitWarning: "This file is very large. On a free tier key, you will likely get an error.", // Предупреждение о превышении лимита токенов
	tokenLimitInfo: "Current context usage. If you exceed the limit, the oldest messages will be automatically removed to free up space.", 
    fileManagerWarning: "Your context is too large, mostly due to files. Deselect files from your history below to reduce the token count." // Предупреждение для менеджера файлов (когда много файлов)
  },

  // --- Тексты для модального окна клонирования репозитория ---
  repoModal: {
    title: "Clone GitHub Repository",
    description: "Enter the URL of a public repository. The processed code will be added as context. If you are not signed in, the file will be saved to your browser's local storage and is subject to a size limit.", // описание
    placeholder: "https://github.com/user/repo",
    cancelButton: "Cancel",
    submitButton: "Clone & Prepare",
    submitButtonCloning: "Cloning...",
    maxCloneSizeMB: 60, // Лимит на размер репозитория (в МБ) (для авторизованных пользователей)
  },

  // --- Тексты для модального окна "Help" ---
  helpModal: {
    title: "Help & Instructions",
    introduction: "Welcome to Gemini Gateway Studio! This is a powerful AI coding assistant, built on Google's latest and most advanced Gemini model.",
    apiKeyTitle: "Your Gemini API Key",
    apiKeySection: "To start, you need a Google Gemini API key. You can get your key from [Google AI Studio](https://aistudio.google.com/app/apikey). This tool works with both the free and the paid API keys.", // Текст секции API
    filesTitle: "How to Use",
    filesSection: "You can give the AI context by uploading files, folders, or public GitHub repositories. The AI will use this information to understand your code and give you the best possible answer.", // Текст секции "Как использовать"
    repoTitle: "Important: About Limits",
    repoSection: "This website does not limit you. All limits come from the Google Gemini API itself. If you provide too much context (many large files or big repositories), the API might not accept the request. For details, see the official Google AI rate limits: [https://ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)", // Текст секции о лимитах
    contactTitle: "Contact & Feedback",
    contactSection: "If you find a bug, have an idea, or want to share your feedback, please email: [matthewzhv@outlook.com](mailto:matthewzhv@outlook.com)", // Текст секции контактов
    closeButton: "Close",
  },

  // --- Настройки приложения ---
  app: {
    acceptedFileTypes: ".py,.js,.ts,.tsx,.json,.html,.css,.md,.csv,.txt,.pdf,image/png,image/jpeg,image/gif,image/webp,.docx,.pptx,.xlsx", // Разрешенные типы файлов
    defaultNewChatName: "New Chat",
    defaultUntitledChatName: "Untitled Chat",
  },

  // --- Настройки хранилища ---
  storage: {
    // Google Drive
    gdriveAppFolder: "GeminiGatewayStudio_Chats", // Имя папки в Google Drive для хранения чатов
    gdriveFolderMimeType: "application/vnd.google-apps.folder", // MIME-тип папки Google Drive
    gdriveJsonMimeType: "application/json", // MIME-тип для файлов чата
    // IndexedDB (локальное хранилище)
    indexedDbName: "GeminiGatewayLocalFiles", // Имя базы данных IndexedDB
    indexedDbStoreName: "files", // Имя "таблицы" (хранилища) в IndexedDB
    // Идентификаторы
    localSessionId: "local-session", // ID для чата, который еще не сохранен в GDrive
    localFilePrefix: "local::", // Префикс для ID файлов, хранящихся в IndexedDB
    repoFilePrefix: "gh_repo:::", // Префикс для файлов, созданных из GitHub репозиториев
    repoFileSuffix: "_context.txt", // Суффикс для файлов репозиториев
    chatHistoryFileName: "chat_history.json", // Имя файла, в который пакуется история чата для API
    jsonFileSuffix: ".json", // Суффикс для .json файлов (используется для GDrive)
    defaultMimeType: "application/octet-stream", // MIME-тип по умолчанию для бинарных файлов
  },
};
