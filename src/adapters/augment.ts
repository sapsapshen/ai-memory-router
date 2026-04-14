// src/adapters/augment.ts
import fs from 'node:fs';
import path from 'node:path';
import type { SourceAdapter, MemoryEntry } from '../types.js';
import { resolveHomeDir, computeFingerprint, detectImportance, nowISO } from '../utils.js';

export const augmentAdapter: SourceAdapter = {
  toolId: 'augment',
  label: 'Augment Code',
  icon: '🔧',
  defaultPaths: ['~/.augment/'],

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
              sourceTool: 'augment',
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
};
