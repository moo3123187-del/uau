export type ScriptClass = 'Script' | 'LocalScript' | 'ModuleScript';

export interface ScriptFile {
  path: string; // e.g. "ServerScriptService/MainScript"
  name: string;
  parentPath: string;
  className: ScriptClass;
  code: string;
  readOnly?: boolean;
}

export interface SerializedInstance {
  id: string;
  name: string;
  className: string;
  properties: Record<string, unknown>;
  tags?: string[];
  attributes?: Record<string, unknown>;
  children?: SerializedInstance[];
}

export interface ConsoleEntry {
  id: string;
  timestamp: string;
  level: 'print' | 'warn' | 'error' | 'info';
  source: 'Server' | 'Client' | 'Studio' | 'Strict';
  scriptName: string;
  message: string;
  line?: number;
}

export interface NetworkLogEntry {
  id: string;
  timestamp: string;
  direction: 'Client -> Server' | 'Server -> Client' | 'Server -> AllClients';
  eventName: string;
  payloadSummary: string;
  status: 'Delivered' | 'Blocked' | 'RateLimited';
}

export interface DiagnosticItem {
  scriptPath: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface LessonVerificationResult {
  passed: boolean;
  summary: string;
  checks: {
    label: string;
    passed: boolean;
    detail?: string;
  }[];
}

export type DifficultyTier =
  | 'Absolute Zero'
  | 'Beginner'
  | 'Intermediate'
  | 'Advanced'
  | 'Expert'
  | 'Master';

export interface LessonDefinition {
  id: string;
  moduleId: string;
  moduleNumber: number;
  moduleTitle: string;
  lessonNumber: number;
  title: string;
  tier: DifficultyTier;
  xp: number;
  estimatedMinutes: number;
  summary: string;
  explanation: string[];
  beginnerTip?: string;
  proNote?: string;
  codeExample?: string;
  objectives: string[];
  hints: string[];
  initialHierarchy: SerializedInstance[];
  scripts: ScriptFile[];
  starterDataStore?: Record<string, Record<string, unknown>>;
  verify: (ctx: VerificationContext) => LessonVerificationResult;
}

export interface VerificationContext {
  logs: ConsoleEntry[];
  networkLogs: NetworkLogEntry[];
  dataStores: Record<string, Record<string, unknown>>;
  scripts: Record<string, string>;
  diagnostics: DiagnosticItem[];
  findInstance: (path: string) => RuntimeNodeSnapshot | null;
  getAllParts: () => RuntimeNodeSnapshot[];
  getGuiElements: () => RuntimeNodeSnapshot[];
  getTagged: (tag: string) => RuntimeNodeSnapshot[];
  hasRunPlay: boolean;
}

export interface RuntimeNodeSnapshot {
  id: string;
  name: string;
  className: string;
  path: string;
  properties: Record<string, unknown>;
  tags: string[];
  attributes: Record<string, unknown>;
  children: RuntimeNodeSnapshot[];
}

export interface SandboxTemplate {
  id: string;
  title: string;
  subtitle: string;
  hierarchy: SerializedInstance[];
  scripts: ScriptFile[];
  starterDataStore?: Record<string, Record<string, unknown>>;
}

export interface SavedSandboxProject {
  id: string;
  userId: string;
  title: string;
  templateId: string;
  scripts: Record<string, string>;
  dataStoreSnapshot: Record<string, unknown>;
  updatedAt?: string;
}

export interface LessonProgressRecord {
  lessonId: string;
  completed: boolean;
  scripts: Record<string, string>;
  attempts: number;
}

export interface StudioSettings {
  editorFontSize: number;
  uiTextScale: 'compact' | 'standard' | 'large';
  tabSize: 2 | 4;
  wordWrap: boolean;
  autoClosePairs: boolean;
  autoIndentBlocks: boolean;
  autocompleteEnabled: boolean;
  highlightActiveLine: boolean;
  cameraFov: number;
  cameraSpeed: number;
  showAxes: boolean;
  showBaseplateGrid: boolean;
  autoClearOutputOnPlay: boolean;
  soundEnabled: boolean;
}

export interface PanelLayout {
  guideWidth: number;
  inspectorWidth: number;
  consoleHeight: number;
  editorSplitPct: number;
  explorerSplitPct: number;
}
