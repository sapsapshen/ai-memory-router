// src/reader.ts
import fs from 'node:fs';
import path from 'node:path';
import type { MemoryMeta, MemoryEntry, MemoryType, ToolId, MemoryImportance } from './types.js';
import { warn } from './logger.js';

const MEMORY_STORE = path.join(process.cwd(), 'memory-store');

function parseYamlFrontmatter(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return result;

  const yaml = match[1];
  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Remove YAML quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value === 'null') value = '';
    result[key] = value;
  }
  return result;
}

function getContentWithoutFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\s*\n?/);
  if (!match) return content;
  return content.slice(match[0].length).trim();
}

export function readMemoryStore(): MemoryMeta[] {
  const results: MemoryMeta[] = [];
  const types: MemoryType[] = ['user', 'project', 'feedback', 'reference', 'session' as MemoryType];

  for (const type of types) {
    // Writer uses 'sessions' dir for session type
    const dirName = type === 'session' ? 'sessions' : type;
    const typeDir = path.join(MEMORY_STORE, dirName);
    if (!fs.existsSync(typeDir)) continue;

    if (type === 'project') {
      // Project: read .md files directly from project/ directory,
      // and also recurse into any subdirectories for nested projects
      readMdFiles(typeDir, results, null);
      for (const subDir of fs.readdirSync(typeDir)) {
        const fullSubDir = path.join(typeDir, subDir);
        if (fs.statSync(fullSubDir).isDirectory()) {
          readMdFiles(fullSubDir, results, subDir);
        }
      }
    } else {
      readMdFiles(typeDir, results, null);
    }
  }

  return results;
}

function readMdFiles(dir: string, results: MemoryMeta[], projectSlug: string | null) {
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(dir, file);
    if (!fs.statSync(filePath).isFile()) continue;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = parseYamlFrontmatter(content);

      const meta: MemoryMeta = {
        id: data.fingerprint || file,
        title: data.title || file.replace('.md', ''),
        type: (data.type as MemoryType) || 'user',
        source: (data.source as ToolId) || 'generic',
        importance: (data.importance as MemoryImportance) || 'medium',
        sourcePath: data.sourcePath || '',
        projectPath: data.project || null,
        createdAt: data.created || '',
        importedAt: data.imported || '',
        filePath,
      };

      results.push(meta);
    } catch (err) {
      warn(`Could not parse ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export function readFullEntry(filePath: string): MemoryEntry | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = parseYamlFrontmatter(content);
    const body = getContentWithoutFrontmatter(content);

    return {
      id: data.fingerprint || filePath,
      title: data.title || path.basename(filePath, '.md'),
      type: (data.type as MemoryType) || 'user',
      content: body,
      sourceTool: (data.source as ToolId) || 'generic',
      sourcePath: data.sourcePath || '',
      importance: (data.importance as MemoryImportance) || 'medium',
      projectPath: data.project || null,
      createdAt: data.created || '',
      importedAt: data.imported || '',
    };
  } catch {
    return null;
  }
}
