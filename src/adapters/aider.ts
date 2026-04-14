// src/adapters/aider.ts
import fs from 'node:fs';
import path from 'node:path';
import type { SourceAdapter, MemoryEntry } from '../types.js';
import { resolveHomeDir, computeFingerprint, detectImportance, nowISO } from '../utils.js';

export const aiderAdapter: SourceAdapter = {
  toolId: 'aider',
  label: 'Aider',
  icon: '✏️',
  defaultPaths: ['~/.aider/'],

  scan(homeDir: string): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const basePath = resolveHomeDir(this.defaultPaths[0]);

    if (!fs.existsSync(basePath)) return entries;

    for (const file of fs.readdirSync(basePath)) {
      if (!file.endsWith('.md')) continue;
      const filePath = path.join(basePath, file);
      if (!fs.statSync(filePath).isFile()) continue;

      try {
        const content = fs.readFileSync(filePath, 'utf-8').trim();
        const entry: MemoryEntry = {
          id: '',
          title: path.basename(file, '.md'),
          type: 'project',
          content,
          sourceTool: 'aider',
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

    return entries;
  },
};
