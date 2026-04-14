// src/adapters/openclaw.ts
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { SourceAdapter, MemoryEntry, SkillInfo } from '../types.js';
import { resolveHomeDir, slugify, computeFingerprint, detectImportance, nowISO } from '../utils.js';

function extractSkillDescription(dirPath: string): string {
  const skillMd = path.join(dirPath, 'SKILL.md');
  try {
    if (fs.existsSync(skillMd)) {
      const content = fs.readFileSync(skillMd, 'utf-8').trim();
      for (const line of content.split('\n')) {
        const trimmed = line.replace(/^#+\s*/, '').trim();
        if (trimmed) return trimmed.slice(0, 200);
      }
    }
  } catch { /* skip */ }
  return '';
}

function getDirSize(dirPath: string): number {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += getDirSize(fullPath);
      } else if (entry.isFile()) {
        size += fs.statSync(fullPath).size;
      }
    }
  } catch { /* skip */ }
  return size;
}

function countFiles(dirPath: string): number {
  let count = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        count += countFiles(fullPath);
      } else if (entry.isFile()) {
        count++;
      }
    }
  } catch { /* skip */ }
  return count;
}

function scanSkillDirRecursively(dirPath: string, toolId: string, skills: SkillInfo[]) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '.git') continue;
    const skillPath = path.join(dirPath, entry.name);
    const skillMd = path.join(skillPath, 'SKILL.md');
    if (fs.existsSync(skillMd) && fs.statSync(skillPath).isDirectory()) {
      skills.push({
        id: `${toolId}::${entry.name}`,
        sourceTool: toolId as any,
        name: entry.name,
        description: extractSkillDescription(skillPath),
        dirPath: skillPath,
        size: getDirSize(skillPath),
        fileCount: countFiles(skillPath),
        hasPackageJson: fs.existsSync(path.join(skillPath, 'package.json')),
        hasRequirements: fs.existsSync(path.join(skillPath, 'requirements.txt')),
      });
    } else if (entry.isDirectory()) {
      // Recurse into subdirectories (e.g. ljg-skills/skills/)
      scanSkillDirRecursively(skillPath, toolId, skills);
    }
  }
}

function readSQLiteEntries(dbPath: string): MemoryEntry[] {
  const entries: MemoryEntry[] = [];

  try {
    const db = new Database(dbPath, { readonly: true });

    // Read from chunks table - contains the actual text content
    const rows = db.prepare(
      'SELECT path, source, start_line, end_line, text FROM chunks ORDER BY path, start_line'
    ).all() as Array<{ path: string; source: string; start_line: number; end_line: number; text: string }>;

    for (const row of rows) {
      const title = `${row.path} (lines ${row.start_line}-${row.end_line})`;
      const content = row.text.trim();
      if (!content) continue;

      const entry: MemoryEntry = {
        id: '',
        title: title.length > 100 ? title.slice(0, 97) + '...' : title,
        type: row.source === 'memory' ? 'project' : 'project',
        content,
        sourceTool: 'openclaw',
        sourcePath: row.path,
        importance: detectImportance(title, content),
        projectPath: null,
        createdAt: nowISO(),
        importedAt: nowISO(),
      };
      entry.id = computeFingerprint(entry);
      entries.push(entry);
    }

    db.close();
  } catch {
    // Skip unreadable databases
  }

  return entries;
}

function readMarkdownFile(filePath: string): MemoryEntry | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    if (!content) return null;

    const filename = path.basename(filePath, '.md');
    // Use first line or filename as title
    const firstLine = content.split('\n')[0].replace(/^#+\s*/, '').trim();
    const title = firstLine || filename;

    const entry: MemoryEntry = {
      id: '',
      title: title.length > 100 ? title.slice(0, 97) + '...' : title,
      type: filename === 'MEMORY' ? 'project' : filename === 'SOUL' ? 'user' : filename === 'IDENTITY' ? 'user' : 'project',
      content,
      sourceTool: 'openclaw',
      sourcePath: filePath,
      importance: detectImportance(title, content),
      projectPath: null,
      createdAt: nowISO(),
      importedAt: nowISO(),
    };
    entry.id = computeFingerprint(entry);
    return entry;
  } catch {
    return null;
  }
}

export const openclawAdapter: SourceAdapter = {
  toolId: 'openclaw',
  label: 'OpenClaw',
  icon: '🧠',
  defaultPaths: ['~/.openclaw/'],

  scan(homeDir: string): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const basePath = resolveHomeDir(this.defaultPaths[0]);

    if (!fs.existsSync(basePath)) return entries;

    // 1. Read SQLite memory databases
    const memoryDir = path.join(basePath, 'memory');
    if (fs.existsSync(memoryDir)) {
      for (const file of fs.readdirSync(memoryDir)) {
        if (file.endsWith('.sqlite') && !file.includes('-shm') && !file.includes('-wal')) {
          const dbPath = path.join(memoryDir, file);
          entries.push(...readSQLiteEntries(dbPath));
        }
      }
    }

    // 2. Read workspace markdown files
    const workspaceDir = path.join(basePath, 'workspace');
    if (fs.existsSync(workspaceDir)) {
      for (const file of fs.readdirSync(workspaceDir)) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(workspaceDir, file);
        if (!fs.statSync(filePath).isFile()) continue;

        const entry = readMarkdownFile(filePath);
        if (entry) entries.push(entry);
      }
    }

    // 3. Read workspace/memory/ markdown files
    const workspaceMemory = path.join(workspaceDir, 'memory');
    if (fs.existsSync(workspaceMemory)) {
      for (const file of fs.readdirSync(workspaceMemory)) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(workspaceMemory, file);
        if (!fs.statSync(filePath).isFile()) continue;

        const entry = readMarkdownFile(filePath);
        if (entry) entries.push(entry);
      }
    }

    return entries;
  },

  scanSkillDirs(homeDir: string): SkillInfo[] {
    const skills: SkillInfo[] = [];
    const basePath = resolveHomeDir(this.defaultPaths[0]);
    const skillsDir = path.join(basePath, 'workspace', 'skills');

    scanSkillDirRecursively(skillsDir, 'openclaw', skills);
    return skills;
  },
};
