// src/adapters/target-copilot.ts
import fs from 'node:fs';
import path from 'node:path';
import type { TargetAdapter, MemoryEntry, MigrationResult } from '../types.js';
import { resolveHomeDir, slugify, nowISO } from '../utils.js';

function backupFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const backupPath = `${filePath}.backup.${timestamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function copyDirRecursive(src: string, dest: string): string[] {
  const written: string[] = [];
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' && entry.isDirectory()) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      written.push(...copyDirRecursive(srcPath, destPath));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      if (entry.isSymbolicLink()) {
        try {
          const realPath = fs.realpathSync(srcPath);
          if (fs.statSync(realPath).isDirectory()) {
            written.push(...copyDirRecursive(realPath, destPath));
          } else {
            fs.copyFileSync(realPath, destPath);
          }
        } catch { /* skip */ }
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
      written.push(destPath);
    }
  }
  return written;
}

export const targetCopilot: TargetAdapter = {
  toolId: 'copilot',
  label: 'GitHub Copilot',
  defaultPath: '~/.copilot/',

  write(entries: MemoryEntry[], basePath: string): MigrationResult {
    const result: MigrationResult = { success: true, backedUp: [], written: [], errors: [] };
    const resolvedPath = resolveHomeDir(basePath || this.defaultPath);

    if (entries.length === 0) return result;

    try {
      for (const entry of entries) {
        const memDir = path.join(resolvedPath, 'memories', slugify(entry.sourceTool));
        fs.mkdirSync(memDir, { recursive: true });

        const filename = `${slugify(entry.title)}.md`;
        const filePath = path.join(memDir, filename);
        const backedUp = backupFile(filePath);
        if (backedUp) result.backedUp.push(backedUp);

        const content = [
          '---',
          `title: "${entry.title.replace(/"/g, '\\"')}"`,
          `source: ${entry.sourceTool}`,
          `sourcePath: "${entry.sourcePath.replace(/\\/g, '\\\\')}"`,
          `type: ${entry.type}`,
          `importance: ${entry.importance}`,
          `imported: ${nowISO()}`,
          '---',
          '',
          `# ${entry.title}`,
          '',
          entry.content,
          '',
        ].join('\n');

        fs.writeFileSync(filePath, content, 'utf-8');
        result.written.push(filePath);
      }
    } catch (err) {
      result.success = false;
      result.errors.push(`Failed to write Copilot memories: ${err}`);
    }

    return result;
  },

  writeSkillDirs(skillDirMap: Map<string, string>, basePath: string): MigrationResult {
    const result: MigrationResult = { success: true, backedUp: [], written: [], errors: [] };
    const resolvedPath = resolveHomeDir(basePath || this.defaultPath);
    for (const [skillName, sourceDir] of skillDirMap) {
      const targetDir = path.join(resolvedPath, 'skills', skillName);
      if (fs.existsSync(targetDir)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
        const backupDir = `${targetDir}.backup.${timestamp}`;
        try {
          fs.cpSync(targetDir, backupDir, { recursive: true });
          result.backedUp.push(backupDir);
        } catch (err) {
          result.errors.push(`Failed to backup ${targetDir}: ${err}`);
          continue;
        }
      }
      try {
        const files = copyDirRecursive(sourceDir, targetDir);
        result.written.push(...files);
      } catch (err) {
        result.errors.push(`Failed to copy skill ${skillName}: ${err}`);
      }
    }
    result.success = result.errors.length === 0;
    return result;
  },
};
