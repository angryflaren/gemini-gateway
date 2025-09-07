export const config = {
  appTitle: "Gemini Gateway Studio",
  helpButtonText: "Need Help?",
  backendUrl: import.meta.env.VITE_BACKEND_URL || "https://moving-moray-merely.ngrok-free.app",
  refinerModel: "models/gemini-2.5-flash-lite-preview-06-17",

  google: {
    clientId: "205595350382-7a3mptfofbe1d0puirov0u1q5f5ma4oh.apps.googleusercontent.com",
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  },

  models: [
    { id: "gemini-2.5-pro", name: "gemini-2.5-pro", context_window: 1048576 },
    { id: "models/gemini-2.5-flash", name: "gemini-2.5-flash", context_window: 1048576 }
  ],

  dialog: {
    historyToggleLabel: "Remember past conversation",
    historyToggleWarning: "When enabled, recent conversation history is sent to provide context. The app automatically manages token limits to prevent errors.",
  },

  repoModal: {
    title: "Clone GitHub Repository",
    description: "Enter the URL of a public repository. The server will clone it and prepare it for analysis.",
    placeholder: "https://github.com/user/repo.git",
    cancelButton: "Cancel",
    submitButton: "Clone & Prepare",
    submitButtonCloning: "Cloning...",
  },

  helpModal: {
    title: "Help & Instructions",
    introduction: "Welcome to Gemini Gateway Studio! This is a powerful AI coding assistant, built on Google's latest and most advanced Gemini model.",
    
    apiKeyTitle: "Your Gemini API Key",
    apiKeySection: "To start, you need a Google Gemini API key. You can get your key from [Google AI Studio](https://aistudio.google.com/app/apikey). This tool works with both the free and the paid API keys.",

    filesTitle: "How to Use",
    filesSection: "You can give the AI context by uploading files, folders, or public GitHub repositories. The AI will use this information to understand your code and give you the best possible answer.",
    
    repoTitle: "Important: About Limits",
    repoSection: "This website does not limit you. All limits come from the Google Gemini API itself. If you provide too much context (many large files or big repositories), the API might not accept the request. For details, see the official Google AI rate limits: [https://ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)",

    contactTitle: "Contact & Feedback",
    contactSection: "If you find a bug, have an idea, or want to share your feedback, please email: [matthewzhv@outlook.com](mailto:matthewzhv@outlook.com)",
    
    closeButton: "Close",
  }
};
