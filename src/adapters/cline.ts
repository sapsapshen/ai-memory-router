// src/adapters/cline.ts
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

export const clineAdapter: SourceAdapter = {
  toolId: 'cline',
  label: 'Cline',
  icon: '🤖',
  defaultPaths: ['~/.cline/'],

  scan(homeDir: string): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const basePath = resolveHomeDir(this.defaultPaths[0]);

    if (!fs.existsSync(basePath)) return entries;

    // 1. Read globalState.json
    const globalStatePath = path.join(basePath, 'data', 'globalState.json');
    if (fs.existsSync(globalStatePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(globalStatePath, 'utf-8'));
        if (state.customInstructions) {
          const entry: MemoryEntry = {
            id: '',
            title: 'Custom Instructions',
            type: 'feedback',
            content: state.customInstructions,
            sourceTool: 'cline',
            sourcePath: globalStatePath,
            importance: 'high',
            projectPath: null,
            createdAt: nowISO(),
            importedAt: nowISO(),
          };
          entry.id = computeFingerprint(entry);
          entries.push(entry);
        }
        if (state.apiProvider || state.model) {
          const entry: MemoryEntry = {
            id: '',
            title: 'Model Preferences',
            type: 'user',
            content: JSON.stringify({ apiProvider: state.apiProvider, model: state.model }, null, 2),
            sourceTool: 'cline',
            sourcePath: globalStatePath,
            importance: 'medium',
            projectPath: null,
            createdAt: nowISO(),
            importedAt: nowISO(),
          };
          entry.id = computeFingerprint(entry);
          entries.push(entry);
        }
      } catch { /* skip */ }
    }

    // 2. Read rules directory
    const rulesDir = path.join(basePath, 'rules');
    if (fs.existsSync(rulesDir)) {
      for (const file of fs.readdirSync(rulesDir)) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(rulesDir, file);
        if (!fs.statSync(filePath).isFile()) continue;

        try {
          const content = fs.readFileSync(filePath, 'utf-8').trim();
          const title = path.basename(file, '.md');
          const entry: MemoryEntry = {
            id: '',
            title,
            type: 'feedback',
            content,
            sourceTool: 'cline',
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

      // Follow symlinks to real skill directory
      let realPath = skillPath;
      try {
        realPath = fs.realpathSync(skillPath);
      } catch { continue; }

      if (!fs.existsSync(realPath)) continue;
      if (!fs.statSync(realPath).isDirectory()) continue;

      const skillMd = path.join(realPath, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      skills.push({
        id: `cline::${skillName}`,
        sourceTool: 'cline',
        name: skillName,
        description: extractDescription(realPath),
        dirPath: realPath,  // Use resolved path for copying
        size: getDirSize(realPath),
        fileCount: countFiles(realPath),
        hasPackageJson: fs.existsSync(path.join(realPath, 'package.json')),
        hasRequirements: fs.existsSync(path.join(realPath, 'requirements.txt')),
      });
    }

    return skills;
  },
};
