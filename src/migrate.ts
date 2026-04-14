// src/migrate.ts
import fs from 'node:fs';
import path from 'node:path';
import type { MemoryEntry, MigrationResult, ToolId } from './types.js';
import { targetAdapters } from './adapters/index.js';
import { readFullEntry } from './reader.js';
import { resolveHomeDir, nowISO } from './utils.js';
import { log, warn, error } from './logger.js';

export function executeMigration(entryIds: string[], targetTool: ToolId): MigrationResult {
  const result: MigrationResult = { success: true, backedUp: [], written: [], errors: [] };

  const target = targetAdapters.find(a => a.toolId === targetTool);
  if (!target) {
    result.success = false;
    result.errors.push(`No target adapter found for tool: ${targetTool}`);
    return result;
  }

  const entries: MemoryEntry[] = [];
  for (const id of entryIds) {
    const entry = findEntryById(id);
    if (entry) entries.push(entry);
  }

  if (entries.length === 0) {
    result.success = false;
    result.errors.push('No matching entries found');
    return result;
  }

  const basePath = resolveHomeDir(target.defaultPath);
  fs.mkdirSync(basePath, { recursive: true });

  // Backup existing subdirectories that might be overwritten
  backupExistingDirs(basePath, target.toolId, result);

  try {
    const writeResult = target.write(entries, basePath);
    result.backedUp.push(...writeResult.backedUp);
    result.written.push(...writeResult.written);
    result.errors.push(...writeResult.errors);
    result.success = writeResult.success;
  } catch (err) {
    const msg = `Migration failed: ${err instanceof Error ? err.message : String(err)}`;
    error(msg);
    result.success = false;
    result.errors.push(msg);
  }

  return result;
}

function findEntryById(id: string): MemoryEntry | null {
  const memoryStore = path.join(process.cwd(), 'memory-store');
  // Search all memory types including sessions
  const types = ['user', 'feedback', 'reference', 'session'] as const;

  for (const type of types) {
    const typeDir = path.join(memoryStore, type === 'session' ? 'sessions' : type);
    if (!fs.existsSync(typeDir)) continue;
    const found = searchDirForId(typeDir, id);
    if (found) return found;
  }

  // Search project memories - can be direct files or in subdirectories
  const projectDir = path.join(memoryStore, 'project');
  if (fs.existsSync(projectDir)) {
    // First check for direct .md files in project/
    const directFound = searchDirForId(projectDir, id);
    if (directFound) return directFound;

    // Then check subdirectories for nested projects
    for (const sub of fs.readdirSync(projectDir)) {
      const subPath = path.join(projectDir, sub);
      if (fs.statSync(subPath).isDirectory()) {
        const found = searchDirForId(subPath, id);
        if (found) return found;
      }
    }
  }

  return null;
}

function searchDirForId(dir: string, id: string): MemoryEntry | null {
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(dir, file);
    if (!fs.statSync(filePath).isFile()) continue;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes(`fingerprint: ${id}`) || content.includes(`fingerprint:"${id}"`)) {
        return readFullEntry(filePath);
      }
    } catch { /* skip */ }
  }
  return null;
}

function backupExistingDirs(basePath: string, toolId: string, result: MigrationResult) {
  const dirsToBackup = getDirsToBackup(toolId, basePath);
  for (const dir of dirsToBackup) {
    if (fs.existsSync(dir)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
      const backupDir = `${dir}.backup.${timestamp}`;
      try {
        fs.cpSync(dir, backupDir, { recursive: true });
        result.backedUp.push(backupDir);
        log(`Backed up: ${dir} -> ${backupDir}`);
      } catch (err) {
        const msg = `Failed to backup ${dir}: ${err instanceof Error ? err.message : String(err)}`;
        warn(msg);
        result.errors.push(msg);
      }
    }
  }
}

function getDirsToBackup(toolId: string, basePath: string): string[] {
  const dirs: string[] = [];

  switch (toolId) {
    case 'claude-code':
      dirs.push(path.join(basePath, 'memories'));
      break;
    case 'cline':
      dirs.push(path.join(basePath, 'rules'));
      break;
    case 'roo-code':
      dirs.push(path.join(basePath, 'rules'));
      break;
    case 'cursor':
      dirs.push(path.join(basePath, 'rules'));
      break;
    case 'copilot':
      dirs.push(path.join(basePath, 'memories'));
      dirs.push(path.join(basePath, 'skills'));
      break;
    case 'hermes':
      dirs.push(path.join(basePath, 'memories'));
      break;
    case 'codex':
      dirs.push(path.join(basePath, 'memories'));
      break;
    case 'openclaw':
      dirs.push(path.join(basePath, 'workspace', 'memory', 'migrated'));
      break;
    case 'continue':
      dirs.push(path.join(basePath, 'memories'));
      break;
    case 'aider':
      dirs.push(path.join(basePath, 'memories'));
      break;
    case 'windsurf':
      dirs.push(path.join(basePath, 'memories'));
      break;
    case 'amazon-q':
      dirs.push(path.join(basePath, 'memories'));
      break;
    case 'gemini':
      dirs.push(path.join(basePath, 'memories'));
      break;
    case 'augment':
      dirs.push(path.join(basePath, 'memories'));
      break;
    default:
      if (fs.existsSync(basePath)) {
        dirs.push(basePath);
      }
  }

  return dirs;
}
