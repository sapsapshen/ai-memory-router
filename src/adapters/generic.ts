// src/adapters/generic.ts
import fs from 'node:fs';
import path from 'node:path';
import type { SourceAdapter, MemoryEntry } from '../types.js';
import { resolveHomeDir, computeFingerprint, detectImportance, nowISO } from '../utils.js';

export const genericAdapter: SourceAdapter = {
  toolId: 'generic',
  label: 'Generic Files',
  icon: '📄',
  defaultPaths: [],  // User provides paths at runtime

  scan(homeDir: string, customPaths?: string[]): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const paths = customPaths || [];

    for (const p of paths) {
      const resolvedPath = resolveHomeDir(p);
      if (!fs.existsSync(resolvedPath)) continue;

      const stat = fs.statSync(resolvedPath);

      if (stat.isFile() && (resolvedPath.endsWith('.md') || resolvedPath.endsWith('.txt'))) {
        try {
          const content = fs.readFileSync(resolvedPath, 'utf-8').trim();
          const entry: MemoryEntry = {
            id: '',
            title: path.basename(resolvedPath).replace(/\.(md|txt)$/, ''),
            type: 'project',
            content,
            sourceTool: 'generic',
            sourcePath: resolvedPath,
            importance: detectImportance(path.basename(resolvedPath), content),
            projectPath: null,
            createdAt: nowISO(),
            importedAt: nowISO(),
          };
          entry.id = computeFingerprint(entry);
          entries.push(entry);
        } catch { /* skip */ }
      } else if (stat.isDirectory()) {
        function walk(dir: string) {
          if (!fs.existsSync(dir)) return;
          for (const file of fs.readdirSync(dir)) {
            const filePath = path.join(dir, file);
            const fileStat = fs.statSync(filePath);
            if (fileStat.isDirectory()) {
              walk(filePath);
            } else if (file.endsWith('.md') || file.endsWith('.txt')) {
              try {
                const content = fs.readFileSync(filePath, 'utf-8').trim();
                const entry: MemoryEntry = {
                  id: '',
                  title: path.basename(filePath).replace(/\.(md|txt)$/, ''),
                  type: 'project',
                  content,
                  sourceTool: 'generic',
                  sourcePath: filePath,
                  importance: detectImportance(path.basename(filePath), content),
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
        walk(resolvedPath);
      }
    }

    return entries;
  },
};
