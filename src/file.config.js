// ============================================================================
// Секция 1: Игнорируемые папки
// ============================================================================
export const IGNORED_FOLDERS = new Set([
  // --- Version Control Systems ---
  '.git', '.svn', '.hg', 'CVS',

  // --- Dependencies & Packages ---
  'node_modules', 'bower_components', 'vendor', 'Pods', 'Carthage',
  'jspm_packages', 'packages', 'deps', 'third_party', 'externals',

  // --- Build & Compilation Output ---
  'build', 'dist', 'out', 'bin', 'obj', 'target', 'release', 'Release',
  'debug', 'Debug', 'public', 'www', 'build-dist', 'build_wasm',
  'generated', '__generated__',

  // --- Framework & Tooling Folders ---
  '.next', '.nuxt', '.svelte-kit', '.vercel', '.angular', '.expo',

  // --- Caching ---
  '.cache', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache',
  '.npm', '.yarn', '.pnpm-cache', '.vite-cache', '.parcel-cache',
  '.sass-cache', '.gradle', 'tmp', 'temp',

  // --- IDE & Editor Settings ---
  '.idea', '.vscode', '.vs', '.atom', '.sublime-project',
  '.sublime-workspace', 'nbproject', '.settings', 'xcuserdata',

  // --- Testing & Coverage Reports ---
  'coverage', 'htmlcov', 'test-results', 'cypress/videos',
  'cypress/screenshots', 'playwright-report', 'test-output',

  // --- Logs ---
  'log', 'logs', 'var/log',

  // --- Python Virtual Environments ---
  'venv', '.venv', 'env', 'ENV', 'virtualenv', '.virtualenv',

  // --- Mobile Builds ---
  'DerivedData', 'build/ios', 'build/android', 'ios/build',
  'android/build', 'android/app/build',

  // --- Cloud & Platform Specific ---
  '.serverless', '.aws-sam', '.terraform', '.elasticbeanstalk',

  // --- Git Hooks ---
  '.githooks',

  // --- C# / EF ---
  'Migrations',

  // --- Testing (Common) ---
  'test', 'tests', '__tests__', 'spec', 'specs', 'e2e', 'cypress',
  '__mocks__', 'mocks',

  // --- Documentation (Common) ---
  'doc', 'docs', 'Documentation',

  // --- Examples & Demos (Common) ---
  'example', 'examples', 'sample', 'samples', 'demo', 'demos',

  // --- UI Components (Storybook) ---
  '.storybook', 'stories',

  // --- Performance ---
  'bench', 'benchmarks',

  // --- Helper Scripts ---
  'scripts',
]);

// ============================================================================
// Секция 2: WARNING_PATTERNS
// Файлы, которые могут быть полезны, но часто слишком велики.
// Используется для показа предупреждения при *прямой загрузке* файла.
// ============================================================================
export const WARNING_PATTERNS = new Set([
  // --- Media Files (Large but readable by Gemini) ---
  '*.mp3', '*.wav', '*.flac', '*.aac', '*.ogg', '*.m4a', '*.aiff', // Audio
  '*.mp4', '*.mov', '*.avi', '*.mkv', '*.webm', '*.wmv', '*.flv', // Video
  '*.jpg', '*.jpeg', '*.png', '*.gif', '*.bmp', '*.tiff', '*.webp', // Images

  // --- Documents (Large but readable by Gemini) ---
  '*.pdf', '*.doc', '*.docx', '*.xls', '*.xlsx', '*.ppt', '*.pptx',

  // --- Dependency Lockfiles (Large text) ---
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock',
  'Gemfile.lock', 'Pipfile.lock', 'poetry.lock', 'go.sum', 'Cargo.lock',
  'project.lock.json', 'Podfile.lock',

  // --- Logs & Dumps (Large text) ---
  '*.log', 'npm-debug.log', 'yarn-debug.log', 'yarn-error.log',
  'pnpm-debug.log', 'lerna-debug.log', '*.pid', '*.seed', 'error.log',
  'debug.log', 'perf.log',

  // --- Assets & Icons (Also images) ---
  'favicon.ico', 'favicon.png', 'favicon.svg', 'apple-touch-icon.png',
  'logo.svg', 'logo.png', 'icon.svg', 'icon.png',
  'screenshot.png', 'screenshot.jpg',
]);


// ============================================================================
// Секция 3: Игнорируемые файлы
// Файлы, которые почти всегда бесполезны или небезопасны для анализа.
// Используется при *сканировании папок* (handleFolderChange).
// ============================================================================
export const IGNORED_FILES = new Set([
  // --- Executables, Libraries & Installers ---
  '*.exe', '*.msi', '*.bat', '*.cmd', '*.sh', '*.com', '*.pif', '*.scr',
  '*.jar', '*.dll', '*.so', '*.dylib', '*.app', '*.pkg', '*.dmg',
  '*.deb', '*.rpm', '*.msu',

  // --- Archives ---
  '*.zip', '*.rar', '*.7z', '*.tar', '*.gz', '*.bz2', '*.tgz',
  '*.iso', '*.img', '*.toast', '*.arj', '*.lzh',

  // --- Fonts ---
  '*.ttf', '*.otf', '*.woff', '*.woff2', '*.eot',

  // --- Database Files (Binary) ---
  '*.sqlite', '*.sqlite3', '*.db', '*.mdb', '*.accdb',
  '*.dump', '*.sdf',

  // --- System & OS-specific Files ---
  '.DS_Store', '._*', 'Thumbs.db', 'desktop.ini',
  '.Spotlight-V100', '.Trashes', 'NTUSER.DAT', 'Ink',

  // --- Compiled Code & Binary Objects ---
  '*.o', '*.obj', '*.class', '*.pyc', '*.pyo', '*.pyd', '*.a', '*.lib',
  '*.egg', '*.whl',

  // --- IDE & Editor Config Files ---
  '*.suo', '*.user', '*.iml', '*.code-workspace', '.project',
  '.classpath', '.buildpath', 'nbproject', '*.sln',
  '.idea/workspace.xml', '.idea/misc.xml',

  // --- Backups & Temp Files ---
  '*~', '*.swp', '*.swo', '*.bak', '*.bak2', '*.old',
  '*.tmp', '*.temp', '*.orig', '*.rej',

  // --- Tooling & Build System Files ---
  'gradlew', 'gradlew.bat', '*.tsbuildinfo', 'local.properties',

  // --- Project Metadata & Docs (non-code) ---
  'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'UNLICENSE', 'COPYING',
  'CONTRIBUTING.md', 'CHANGELOG.md', 'HISTORY.md', 'NEWS.md', 'AUTHORS.md',
  'CODE_OF_CONDUCT.md', 'SECURITY.md', 'PULL_REQUEST_TEMPLATE.md',
  'ISSUE_TEMPLATE.md', 'FUNDING.yml', '.gitmodules', '.gitkeep', '.mailmap',
  'robots.txt', 'humans.txt', '.firebaserc',

  // --- Certificates & Keys ---
  '*.pem', '*.key',
]);


// ============================================================================
// Секция 4: Текстовые файлы
// Будут обрабатываться как текстовые, и объединяться.
// ============================================================================
export const TEXT_EXTENSIONS = new Set([
  // Web Development
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.js', '.jsx', '.ts', '.tsx',
  '.vue', '.svelte', '.json', '.xml', '.svg',

  // Backend & Scripting
  '.py', '.rb', '.php', '.go', '.java', '.c', '.cpp', '.h', '.hpp', '.cs',
  '.rs', '.swift', '.kt', '.kts', '.sh', '.bat', '.ps1',

  // Configuration & Data
  '.yaml', '.yml', '.ini', '.cfg', '.toml', '.env.example', '.env.template',
  '.properties', '.conf', '.config',

  // Markup & Documentation
  '.md', '.txt', '.rst', '.adoc', '.text', 'README',

  // SQL & Database
  '.sql',

  // Infrastructure & DevOps
  '.dockerfile', 'Dockerfile', '.tf', '.hcl', '.tfvars',

  // Other common text formats
  '.csv', '.tsv', '.graphql', '.gql',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock',
  'Gemfile.lock', 'Pipfile.lock', 'poetry.lock', 'go.sum', 'Cargo.lock',
  'project.lock.json', 'Podfile.lock',
  '.log'
]);

// ============================================================================
// Секция 5: Заблокированные (для прямой загрузки)
// Эти файлы блокируются на уровне `handleFileChange` из-за рисков безопасности
// или потому что они 100% бинарные/бесполезные.
// ============================================================================
export const BLOCKED_EXTENSIONS = new Set([
  // --- Executables & Installers (Security Risk) ---
  '.exe', '.msi', '.bat', '.cmd', '.sh', '.com', '.pif', '.scr',
  '.jar', '.dll', '.so', '.dylib', '.app', '.pkg', '.dmg',
  '.deb', '.rpm', '.msu',

  // --- Archives (User should use "Upload Folder" instead) ---
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.tgz',
  '.iso', '.img',

  // --- System & OS-specific Files (Useless for analysis) ---
  '.ds_store', '._', '.thumbs_db', '.desktop_ini',
  '.ntuser_dat',

  // --- Compiled Code & Binary Objects (Useless for analysis) ---
  '.o', '.obj', '.class', '.pyc', '.pyo', '.pyd', '.a', '.lib',
  '.egg', '.whl',

  // --- Database Files (Binary and often too large) ---
  '.sqlite', '.sqlite3', '.db', '.mdb', '.accdb', '.sdf',
]);