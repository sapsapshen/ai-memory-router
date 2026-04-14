// src/adapters/hermes.ts
import fs from 'node:fs';
import path from 'node:path';
import type { SourceAdapter, MemoryEntry, SkillInfo } from '../types.js';
import { resolveHomeDir, slugify, computeFingerprint, detectImportance, nowISO } from '../utils.js';

const SECTION_DELIMITER = '§';

const CATEGORY_TYPE_MAP: Record<string, MemoryEntry['type']> = {
  '基本信息': 'user',
  '用户偏好与习惯': 'user',
  '重要事件时间线': 'session',
  '任务执行铁律': 'feedback',
  '待解决问题': 'project',
  '系统状态': 'project',
};

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
      if (entry.isDirectory()) size += getDirSize(fullPath);
      else if (entry.isFile()) size += fs.statSync(fullPath).size;
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
      if (entry.isDirectory()) count += countFiles(fullPath);
      else if (entry.isFile()) count++;
    }
  } catch { /* skip */ }
  return count;
}

function scanSkillDirRecursively(dirPath: string, toolId: string, skills: SkillInfo[]) {
  if (!fs.existsSync(dirPath)) return;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '.git') continue;
      const skillPath = path.join(dirPath, entry.name);
      const skillMd = path.join(skillPath, 'SKILL.md');
      if (fs.existsSync(skillMd)) {
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
      } else {
        // Recurse into subdirectories (e.g. ljg-skills/skills/)
        scanSkillDirRecursively(skillPath, toolId, skills);
      }
    }
  } catch { /* skip */ }
}

function parseHermesSection(section: string, sourcePath: string, sourceTool: MemoryEntry['sourceTool']): MemoryEntry | null {
  const lines = section.split('\n').filter(Boolean);
  if (lines.length === 0) return null;

  const firstLine = lines[0].trim();
  // Pattern: "Category: **Key**: Value" or "Category: Value"
  const match = firstLine.match(/^([^\n:]+?)[:：]\s*(.+)$/);
  if (!match) {
    // If no colon pattern, use whole section as content with filename as title
    return {
      id: '',
      title: firstLine.slice(0, 80),
      type: 'project',
      content: section.trim(),
      sourceTool,
      sourcePath,
      importance: 'medium',
      projectPath: null,
      createdAt: nowISO(),
      importedAt: nowISO(),
    };
  }

  const category = match[1].trim().replace(/[⚠️📌✅]\s*/g, '');
  const content = match[2].trim().replace(/\*\*/g, '');

  // Check if content has sub-key: value pattern
  let title = content;
  const keyMatch = content.match(/\*\*([^*]+)\*\*[:：]\s*(.+)/);
  if (keyMatch) {
    title = keyMatch[1].trim();
  }

  if (title.length > 100) title = title.slice(0, 97) + '...';

  const type = CATEGORY_TYPE_MAP[category] ?? 'project';
  const importance = detectImportance(title, content);

  const entry: MemoryEntry = {
    id: '',
    title,
    type,
    content: content.replace(/\*\*/g, '').trim(),
    sourceTool,
    sourcePath,
    importance,
    projectPath: null,
    createdAt: nowISO(),
    importedAt: nowISO(),
  };
  entry.id = computeFingerprint(entry);
  return entry;
}

function parseHermesFile(filePath: string, sourceTool: MemoryEntry['sourceTool']): MemoryEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sections = content.split(SECTION_DELIMITER).map(s => s.trim()).filter(Boolean);
  const entries: MemoryEntry[] = [];

  for (const section of sections) {
    const entry = parseHermesSection(section, filePath, sourceTool);
    if (entry) entries.push(entry);
  }

  return entries;
}

export const hermesAdapter: SourceAdapter = {
  toolId: 'hermes',
  label: 'Hermes',
  icon: '🔮',
  defaultPaths: ['~/.hermes/memories/'],

  scan(homeDir: string): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const basePath = resolveHomeDir(this.defaultPaths[0]);

    if (!fs.existsSync(basePath)) return entries;

    for (const file of fs.readdirSync(basePath)) {
      if (!file.endsWith('.md')) continue;
      const filePath = path.join(basePath, file);
      if (!fs.statSync(filePath).isFile()) continue;

      try {
        entries.push(...parseHermesFile(filePath, 'hermes'));
      } catch {
        // Skip unreadable files
      }
    }

    return entries;
  },

  scanSkillDirs(homeDir: string): SkillInfo[] {
    const skills: SkillInfo[] = [];
    const basePath = resolveHomeDir(this.defaultPaths[0]).replace(/[\/\\]memories[\/\\]*$/, '');
    const skillsDir = path.join(basePath, 'skills');
    scanSkillDirRecursively(skillsDir, 'hermes', skills);
    return skills;
  },
};
