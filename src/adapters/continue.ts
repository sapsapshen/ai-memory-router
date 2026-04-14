// src/adapters/continue.ts
import fs from 'node:fs';
import path from 'node:path';
import type { SourceAdapter, MemoryEntry, SkillInfo } from '../types.js';
import { resolveHomeDir, computeFingerprint, detectImportance, nowISO } from '../utils.js';

function extractDescription(dirPath: string): string {
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

export const continueAdapter: SourceAdapter = {
  toolId: 'continue',
  label: 'Continue',
  icon: '▶️',
  defaultPaths: ['~/.continue/'],

  scan(homeDir: string): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const basePath = resolveHomeDir(this.defaultPaths[0]);

    if (!fs.existsSync(basePath)) return entries;

    // 1. Read sessions
    const sessionsDir = path.join(basePath, 'sessions');
    if (fs.existsSync(sessionsDir)) {
      for (const file of fs.readdirSync(sessionsDir)) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(sessionsDir, file);
        if (!fs.statSync(filePath).isFile()) continue;

        try {
          const content = fs.readFileSync(filePath, 'utf-8').trim();
          const entry: MemoryEntry = {
            id: '',
            title: `Session — ${path.basename(file, '.json')}`,
            type: 'session',
            content,
            sourceTool: 'continue',
            sourcePath: filePath,
            importance: 'low',
            projectPath: null,
            createdAt: nowISO(),
            importedAt: nowISO(),
          };
          entry.id = computeFingerprint(entry);
          entries.push(entry);
        } catch { /* skip */ }
      }
    }

    // 2. Read globalContext.json
    const globalContext = path.join(basePath, 'index', 'globalContext.json');
    if (fs.existsSync(globalContext)) {
      try {
        const content = fs.readFileSync(globalContext, 'utf-8').trim();
        const entry: MemoryEntry = {
          id: '',
          title: 'Global Context',
          type: 'reference',
          content,
          sourceTool: 'continue',
          sourcePath: globalContext,
          importance: 'medium',
          projectPath: null,
          createdAt: nowISO(),
          importedAt: nowISO(),
        };
        entry.id = computeFingerprint(entry);
        entries.push(entry);
      } catch { /* skip */ }
    }

    // Skills handled by scanSkillDirs()
    return entries;
  },

  scanSkillDirs(homeDir: string): SkillInfo[] {
    const skills: SkillInfo[] = [];
    const basePath = resolveHomeDir(this.defaultPaths[0]);
    const skillsDir = path.join(basePath, 'skills');

    if (!fs.existsSync(skillsDir)) return skills;

    for (const skillName of fs.readdirSync(skillsDir)) {
      const skillPath = path.join(skillsDir, skillName);
      if (!fs.statSync(skillPath).isDirectory()) continue;

      const skillMd = path.join(skillPath, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      skills.push({
        id: `continue::${skillName}`,
        sourceTool: 'continue',
        name: skillName,
        description: extractDescription(skillPath),
        dirPath: skillPath,
        size: getDirSize(skillPath),
        fileCount: countFiles(skillPath),
        hasPackageJson: fs.existsSync(path.join(skillPath, 'package.json')),
        hasRequirements: fs.existsSync(path.join(skillPath, 'requirements.txt')),
      });
    }

    return skills;
  },
};
