// src/adapters/gemini.ts
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

export const geminiAdapter: SourceAdapter = {
  toolId: 'gemini',
  label: 'Gemini CLI',
  icon: '💎',
  defaultPaths: ['~/.gemini/'],

  scan(homeDir: string): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const basePath = resolveHomeDir(this.defaultPaths[0]);

    if (!fs.existsSync(basePath)) return entries;

    function walk(dir: string) {
      if (!fs.existsSync(dir)) return;
      for (const file of fs.readdirSync(dir)) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          walk(filePath);
        } else if (file.endsWith('.md') || file.endsWith('.json')) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8').trim();
            const entry: MemoryEntry = {
              id: '',
              title: file.replace(/\.(md|json)$/, ''),
              type: 'project',
              content,
              sourceTool: 'gemini',
              sourcePath: filePath,
              importance: detectImportance(file, content),
              projectPath: null,
              createdAt: nowISO(),
              importedAt: nowISO(),
            };
            entry.id = computeFingerprint(entry);
            entries.push(entry);
          } catch { /* skip */ }
        }
      }
    }

    walk(basePath);
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
        id: `gemini::${skillName}`,
        sourceTool: 'gemini',
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
