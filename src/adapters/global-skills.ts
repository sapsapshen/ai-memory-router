// src/adapters/global-skills.ts
import fs from 'node:fs';
import path from 'node:path';
import type { SourceAdapter, MemoryEntry, SkillInfo } from '../types.js';
import { resolveHomeDir } from '../utils.js';

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

function scanSkillDirRecursively(dirPath: string, skills: SkillInfo[]) {
  if (!fs.existsSync(dirPath)) return;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '.git') continue;
      const skillPath = path.join(dirPath, entry.name);
      const skillMd = path.join(skillPath, 'SKILL.md');
      if (fs.existsSync(skillMd)) {
        skills.push({
          id: `global::${entry.name}`,
          sourceTool: 'global',
          name: entry.name,
          description: extractDescription(skillPath),
          dirPath: skillPath,
          size: getDirSize(skillPath),
          fileCount: countFiles(skillPath),
          hasPackageJson: fs.existsSync(path.join(skillPath, 'package.json')),
          hasRequirements: fs.existsSync(path.join(skillPath, 'requirements.txt')),
        });
      } else {
        scanSkillDirRecursively(skillPath, skills);
      }
    }
  } catch { /* skip */ }
}

export const globalSkillsAdapter: SourceAdapter = {
  toolId: 'global',
  label: 'Global Skills',
  icon: '🌐',
  defaultPaths: ['~/.claude/skills/'],

  scan(homeDir: string): MemoryEntry[] {
    // Global skills don't produce memory entries, only skill entries
    return [];
  },

  scanSkillDirs(homeDir: string): SkillInfo[] {
    const skills: SkillInfo[] = [];
    const basePath = resolveHomeDir(this.defaultPaths[0]);
    scanSkillDirRecursively(basePath, skills);
    return skills;
  },
};
