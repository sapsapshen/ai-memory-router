// src/adapters/roo-code.ts
import fs from 'node:fs';
import path from 'node:path';
import type { SourceAdapter, MemoryEntry } from '../types.js';
import { resolveHomeDir, computeFingerprint, detectImportance, nowISO } from '../utils.js';

export const rooCodeAdapter: SourceAdapter = {
  toolId: 'roo-code',
  label: 'Roo Code',
  icon: '🦘',
  defaultPaths: ['~/.roo-code/'],

  scan(homeDir: string): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const basePath = resolveHomeDir(this.defaultPaths[0]);

    if (!fs.existsSync(basePath)) return entries;

    // Read data directory (similar to Cline)
    const dataDir = path.join(basePath, 'data');
    if (fs.existsSync(dataDir)) {
      for (const file of fs.readdirSync(dataDir)) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(dataDir, file);
        if (!fs.statSync(filePath).isFile()) continue;

        try {
          const content = fs.readFileSync(filePath, 'utf-8').trim();
          const entry: MemoryEntry = {
            id: '',
            title: path.basename(file, '.json'),
            type: 'user',
            content,
            sourceTool: 'roo-code',
            sourcePath: filePath,
            importance: 'medium',
            projectPath: null,
            createdAt: nowISO(),
            importedAt: nowISO(),
          };
          entry.id = computeFingerprint(entry);
          entries.push(entry);
        } catch { /* skip */ }
      }
    }

    // Read rules directory
    const rulesDir = path.join(basePath, 'rules');
    if (fs.existsSync(rulesDir)) {
      for (const file of fs.readdirSync(rulesDir)) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(rulesDir, file);
        if (!fs.statSync(filePath).isFile()) continue;

        try {
          const content = fs.readFileSync(filePath, 'utf-8').trim();
          const entry: MemoryEntry = {
            id: '',
            title: path.basename(file, '.md'),
            type: 'feedback',
            content,
            sourceTool: 'roo-code',
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

    return entries;
  },
};
