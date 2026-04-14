// src/adapters/codex.ts
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
          description: extractDescription(skillPath),
          dirPath: skillPath,
          size: getDirSize(skillPath),
          fileCount: countFiles(skillPath),
          hasPackageJson: fs.existsSync(path.join(skillPath, 'package.json')),
          hasRequirements: fs.existsSync(path.join(skillPath, 'requirements.txt')),
        });
      } else {
        scanSkillDirRecursively(skillPath, toolId, skills);
      }
    }
  } catch { /* skip */ }
}

export const codexAdapter: SourceAdapter = {
  toolId: 'codex',
  label: 'Codex CLI',
  icon: '🔬',
  defaultPaths: ['~/.codex/'],

  scan(homeDir: string): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const basePath = resolveHomeDir(this.defaultPaths[0]);

    if (!fs.existsSync(basePath)) return entries;

    // 1. Read memories directory
    const memoriesDir = path.join(basePath, 'memories');
    if (fs.existsSync(memoriesDir)) {
      for (const file of fs.readdirSync(memoriesDir)) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(memoriesDir, file);
        if (!fs.statSync(filePath).isFile()) continue;

        try {
          const content = fs.readFileSync(filePath, 'utf-8').trim();
          const title = path.basename(file, '.md').toUpperCase();
          const entry: MemoryEntry = {
            id: '',
            title,
            type: file === 'USER.md' ? 'user' : 'project',
            content,
            sourceTool: 'codex',
            sourcePath: filePath,
            importance: detectImportance(title, content),
            projectPath: null,
            createdAt: nowISO(),
            importedAt: nowISO(),
          };
          entry.id = computeFingerprint(entry);
          entries.push(entry);
        } catch { /* skip */ }
      }
    }

    // 2. Read .codex-global-state.json
    const globalState = path.join(basePath, '.codex-global-state.json');
    if (fs.existsSync(globalState)) {
      try {
        const state = JSON.parse(fs.readFileSync(globalState, 'utf-8'));
        const entry: MemoryEntry = {
          id: '',
          title: 'Codex Global State',
          type: 'user',
          content: JSON.stringify(state, null, 2),
          sourceTool: 'codex',
          sourcePath: globalState,
          importance: 'medium',
          projectPath: null,
          createdAt: nowISO(),
          importedAt: nowISO(),
        };
        entry.id = computeFingerprint(entry);
        entries.push(entry);
      } catch { /* skip */ }
    }

    return entries;
  },

  scanSkillDirs(homeDir: string): SkillInfo[] {
    const skills: SkillInfo[] = [];
    const basePath = resolveHomeDir(this.defaultPaths[0]);
    const skillsDir = path.join(basePath, 'skills');
    scanSkillDirRecursively(skillsDir, 'codex', skills);
    return skills;
  },
};
