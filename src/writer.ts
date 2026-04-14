// src/writer.ts
import fs from 'node:fs';
import path from 'node:path';
import type { MemoryEntry, MemoryType } from './types.js';
import { slugify, computeFingerprint, nowISO } from './utils.js';
import { debug, warn } from './logger.js';

const MEMORY_STORE = path.join(process.cwd(), 'memory-store');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function typeToDir(type: MemoryType): string {
  // Map type to directory name (session -> sessions)
  if (type === 'session') return 'sessions';
  return type;
}

function getTypeDir(type: MemoryType, projectPath: string | null): string {
  const base = path.join(MEMORY_STORE, typeToDir(type));
  if (type === 'project' && projectPath) {
    const slug = slugify(path.basename(projectPath));
    return path.join(base, slug);
  }
  return base;
}

function escapeYamlValue(val: string | null): string {
  if (val === null || val === undefined) return 'null';
  // If value contains special chars, wrap in double quotes and escape
  if (/[:#\[\]{}|>&*?@%'"\\,\n\r]/.test(val) || val.startsWith(' ') || val.endsWith(' ')) {
    return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return val;
}

function buildFrontmatter(entry: MemoryEntry): string {
  return [
    '---',
    `title: ${escapeYamlValue(entry.title)}`,
    `type: ${entry.type}`,
    `source: ${entry.sourceTool}`,
    `sourcePath: ${escapeYamlValue(entry.sourcePath)}`,
    `importance: ${entry.importance}`,
    `project: ${escapeYamlValue(entry.projectPath)}`,
    `created: ${entry.createdAt}`,
    `imported: ${entry.importedAt}`,
    `fingerprint: ${entry.id}`,
    '---',
  ].join('\n');
}

export function writeToMemoryStore(entries: MemoryEntry[]): { written: number; skipped: number } {
  let written = 0;
  let skipped = 0;

  // Ensure base directories exist
  for (const type of ['user', 'project', 'feedback', 'reference', 'sessions', 'skill'] as const) {
    ensureDir(path.join(MEMORY_STORE, type));
  }

  for (const entry of entries) {
    const dir = getTypeDir(entry.type, entry.projectPath);
    ensureDir(dir);

    const filename = `${slugify(entry.title)}.md`;
    const filePath = path.join(dir, filename);

    // Check if file exists with same fingerprint (dedup)
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const fpMatch = content.match(/fingerprint:\s*(.+)/);
        if (fpMatch && fpMatch[1].trim() === entry.id) {
          debug(`Skipping duplicate: ${filePath}`);
          skipped++;
          continue;
        }
      } catch (err) {
        warn(`Could not read ${filePath} for dedup check: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const frontmatter = buildFrontmatter(entry);
    const fileContent = frontmatter + '\n\n' + entry.content + '\n';
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    written++;
  }

  return { written, skipped };
}
