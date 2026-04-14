// src/types.ts

export type ToolId =
  | 'claude-code' | 'cline' | 'roo-code' | 'cursor' | 'copilot'
  | 'continue' | 'openclaw' | 'codex' | 'hermes'
  | 'aider' | 'windsurf' | 'amazon-q' | 'gemini' | 'augment'
  | 'global' | 'generic';

export type MemoryType = 'user' | 'project' | 'feedback' | 'reference' | 'session';

export type MemoryImportance = 'critical' | 'high' | 'medium' | 'low';

export interface MemoryEntry {
  id: string;                    // fingerprint
  title: string;
  type: MemoryType;
  content: string;               // pure Markdown (no frontmatter)
  sourceTool: ToolId;
  sourcePath: string;            // original file path on disk
  importance: MemoryImportance;
  projectPath: string | null;    // project-level memory path
  createdAt: string;             // original creation time (ISO)
  importedAt: string;            // imported into memory-store (ISO)
}

export interface SourceAdapter {
  toolId: ToolId;
  label: string;
  icon: string;
  defaultPaths: string[];
  scan(homeDir: string): MemoryEntry[];

  // Skills are directory structures, not text
  // Optional - not all tools support skills
  scanSkillDirs?(homeDir: string): SkillInfo[];
}

export interface TargetAdapter {
  toolId: ToolId;
  label: string;
  defaultPath: string;
  write(entries: MemoryEntry[], basePath: string): MigrationResult;

  // Skills are complete directories - copy with tool-specific placement
  // Optional - not all tools support skills
  // skillDirMap: { skillName -> skills-store/{sourceTool}/{skillName} directory path }
  writeSkillDirs?(skillDirMap: Map<string, string>, basePath: string): MigrationResult;
}

export interface MigrationResult {
  success: boolean;
  backedUp: string[];
  written: string[];
  errors: string[];
}

// Skills are directory structures, not text
export interface SkillInfo {
  id: string;              // sourceTool::skillName
  sourceTool: ToolId;
  name: string;            // directory name
  description: string;     // extracted from SKILL.md first line
  dirPath: string;         // full source directory path
  size: number;            // total bytes
  fileCount: number;       // number of files
  hasPackageJson: boolean; // has npm dependencies
  hasRequirements: boolean; // has python dependencies
}

export interface SkillDir {
  id: string;
  sourceDir: string;       // skills-store/ 中的目录路径
  name: string;
  sourceTool: ToolId;
}

export interface MemoryMeta {
  id: string;
  title: string;
  type: MemoryType;
  source: ToolId;
  importance: MemoryImportance;
  sourcePath: string;
  projectPath: string | null;
  createdAt: string;
  importedAt: string;
  filePath: string;  // path in memory-store
}

export interface ToolInfo {
  id: ToolId;
  label: string;
  icon: string;
  isSource: boolean;
  isTarget: boolean;
}
