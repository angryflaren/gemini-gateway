// A centralized configuration for file and folder handling.
// This ensures consistency between the frontend (pre-zip filtering)
// and the backend (repo processing).

// ============================================================================
// SECTION 1: IGNORED FOLDERS
// Folders that are entirely skipped during processing.
// ============================================================================
export const IGNORED_FOLDERS = new Set([
  // --- Version Control Systems ---
  '.git', '.svn', '.hg', 'CVS',

  // --- Dependencies & Packages (Crucial Target) ---
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
]);

// ============================================================================
// SECTION 2: IGNORED FILES
// Specific files or patterns to be ignored.
// ============================================================================
export const IGNORED_FILES = new Set([
  // --- Executables, Libraries & Installers (Security Risk & Useless for Analysis) ---
  '*.exe', '*.msi', '*.bat', '*.cmd', '*.sh', '*.com', '*.pif', '*.scr',
  '*.jar', '*.dll', '*.so', '*.dylib', '*.app', '*.pkg', '*.dmg',
  '*.deb', '*.rpm', '*.msu',

  // --- Archives (Binary Containers) ---
  '*.zip', '*.rar', '*.7z', '*.tar', '*.gz', '*.bz2', '*.tgz',
  '*.iso', '*.img', '*.toast', '*.arj', '*.lzh',

  // --- Media Files (Too large/binary for analysis) ---
  '*.mp3', '*.wav', '*.flac', '*.aac', '*.ogg', '*.m4a', '*.aiff', // Audio
  '*.mp4', '*.mov', '*.avi', '*.mkv', '*.webm', '*.wmv', '*.flv', // Video
  '*.jpg', '*.jpeg', '*.png', '*.gif', '*.bmp', '*.tiff', '*.webp', // Images
  '*.pdf', '*.doc', '*.docx', '*.xls', '*.xlsx', '*.ppt', '*.pptx',

  // --- Fonts ---
  '*.ttf', '*.otf', '*.woff', '*.woff2', '*.eot',

  // --- Database Files (Binary or too large) ---
  '*.sqlite', '*.sqlite3', '*.db', '*.mdb', '*.accdb', '*.sql',
  '*.dump', '*.sdf',

  // --- System & OS-specific Files ---
  '.DS_Store', '._*', 'Thumbs.db', 'desktop.ini',
  '.Spotlight-V100', '.Trashes', 'NTUSER.DAT',

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

  // --- Dependency Lockfiles (Metadata, not source code) ---
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock',
  'Gemfile.lock', 'Pipfile.lock', 'poetry.lock', 'go.sum', 'Cargo.lock',
  'project.lock.json', 'Podfile.lock',

  // --- Logs & Dumps ---
  '*.log', 'npm-debug.log', 'yarn-debug.log', 'yarn-error.log',
  'pnpm-debug.log', 'lerna-debug.log', '*.pid', '*.seed', 'error.log',
  'debug.log', 'perf.log',

  // --- Local Environment Variables (Sensitive Info) ---
  // IMPORTANT: .env.example or .env.template are NOT ignored, which is correct.
  '.env', '.env.local', '.env.development', '.env.production', '.env.test',
  '.env.development.local', '.env.test.local', '.env.production.local', '.env.*.local',

  // --- Tooling & Build System Files (often config, not source) ---
  'gradlew', 'gradlew.bat', '*.tsbuildinfo', 'local.properties',

  // --- Project Metadata & Docs (Often irrelevant for AI code analysis) ---
  'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'UNLICENSE', 'COPYING',
  'CONTRIBUTING.md', 'CHANGELOG.md', 'HISTORY.md', 'NEWS.md', 'AUTHORS.md',
  'CODE_OF_CONDUCT.md', 'SECURITY.md', 'PULL_REQUEST_TEMPLATE.md',
  'ISSUE_TEMPLATE.md', 'FUNDING.yml', '.mailmap',
  'robots.txt', 'humans.txt',
  '.firebaserc',

  // --- Assets & Icons ---
  'favicon.ico', 'favicon.png', 'favicon.svg', 'apple-touch-icon.png',
  'logo.svg', 'logo.png', 'icon.svg', 'icon.png',
  'screenshot.png', 'screenshot.jpg',

  // --- Certificates & Keys ---
  '*.pem', '*.key',
]);


// ============================================================================
// SECTION 3: TEXT-BASED FILE EXTENSIONS
// An expanded list of extensions to be treated as text and merged.
// Everything not on this list will be treated as a binary file.
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
]);

export const BLOCKED_EXTENSIONS = new Set([
  // --- Executables & Installers (Security Risk) ---
  '.exe', '.msi', '.bat', '.cmd', '.sh', '.com', '.pif', '.scr',
  '.jar', '.dll', '.so', '.dylib', '.app', '.pkg', '.dmg',
  '.deb', '.rpm', '.msu',

  // --- Archives (User should use "Upload Folder" instead) ---
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.tgz',
  '.iso', '.img',

  // --- System & OS-specific Files (Useless for analysis) ---
  '.ds_store', '._', '.thumbs.db', '.desktop.ini',
  '.ntuser.dat',

  // --- Compiled Code & Binary Objects (Useless for analysis) ---
  '.o', '.obj', '.class', '.pyc', '.pyo', '.pyd', '.a', '.lib',
  '.egg', '.whl',

  // --- Database Files (Binary and often too large) ---
  '.sqlite', '.sqlite3', '.db', '.mdb', '.accdb', '.sdf',

  // --- Certificates & Keys (CRITICAL Security Risk) ---
  '.pem', '.key',
]);