// src/skills-scanner.ts
import fs from 'node:fs';
import path from 'node:path';
import type { SkillInfo, ToolId } from './types.js';
import { sourceAdapters } from './adapters/index.js';
import { resolveHomeDir } from './utils.js';
import { log, warn } from './logger.js';

const SKILLS_STORE = path.join(process.cwd(), 'skills-store');
const INDEX_PATH = path.join(SKILLS_STORE, 'index.json');

export interface SkillsIndex {
  skills: SkillInfo[];
  scannedAt: string;
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

function hasFile(dirPath: string, filename: string): boolean {
  const filePath = path.join(dirPath, filename);
  try {
    return fs.existsSync(filePath);
  } catch { return false; }
}

function extractDescription(dirPath: string): string {
  const skillMd = path.join(dirPath, 'SKILL.md');
  try {
    if (fs.existsSync(skillMd)) {
      const content = fs.readFileSync(skillMd, 'utf-8').trim();
      // Get first non-empty, non-heading line
      for (const line of content.split('\n')) {
        const trimmed = line.replace(/^#+\s*/, '').trim();
        if (trimmed) return trimmed.slice(0, 200);
      }
    }
  } catch { /* skip */ }
  return '';
}

function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    // Skip .git directories
    if (entry.name === '.git' && entry.isDirectory()) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      // For symlinks, resolve and copy the target content
      if (entry.isSymbolicLink()) {
        try {
          const realPath = fs.realpathSync(srcPath);
          if (fs.statSync(realPath).isDirectory()) {
            copyDirRecursive(realPath, destPath);
          } else {
            fs.copyFileSync(realPath, destPath);
          }
        } catch {
          // If we can't resolve, skip
        }
      } else {
        try {
          fs.copyFileSync(srcPath, destPath);
        } catch { /* skip */ }
      }
    }
  }
}

export function scanSkills(homeDir: string): SkillsIndex {
  const skills: SkillInfo[] = [];

  for (const adapter of sourceAdapters) {
    if (!adapter.scanSkillDirs) continue;
    try {
      const skillInfos = adapter.scanSkillDirs(homeDir);
      for (const skill of skillInfos) {
        skills.push(skill);
      }
      if (skillInfos.length > 0) {
        log(`  ${adapter.icon} ${adapter.label}: ${skillInfos.length} skill(s) found`);
      }
    } catch (err) {
      warn(`${adapter.icon} ${adapter.label}: skill scan failed - ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Copy each skill to skills-store/
  for (const skill of skills) {
    const targetDir = path.join(SKILLS_STORE, skill.sourceTool, skill.name);
    try {
      copyDirRecursive(skill.dirPath, targetDir);
    } catch (err) {
      warn(`Failed to copy skill ${skill.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    skills,
    scannedAt: new Date().toISOString(),
  };
}

export function readSkillsIndex(): SkillsIndex {
  try {
    if (fs.existsSync(INDEX_PATH)) {
      return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
    }
  } catch { /* skip */ }
  return { skills: [], scannedAt: '' };
}

export function writeSkillsIndex(index: SkillsIndex) {
  fs.mkdirSync(SKILLS_STORE, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
}

export function copySkillToTarget(skillId: string, targetTool: ToolId, targetBasePath: string): { written: string[]; errors: string[] } {
  const index = readSkillsIndex();
  const skill = index.skills.find(s => s.id === skillId);
  if (!skill) {
    return { written: [], errors: [`Skill not found: ${skillId}`] };
  }

  const sourceDir = path.join(SKILLS_STORE, skill.sourceTool, skill.name);
  if (!fs.existsSync(sourceDir)) {
    return { written: [], errors: [`Skill directory not found: ${sourceDir}`] };
  }

  const targetDir = path.join(targetBasePath, 'skills', skill.name);
  try {
    copyDirRecursive(sourceDir, targetDir);
    return { written: [targetDir], errors: [] };
  } catch (err) {
    return { written: [], errors: [`Failed to copy skill: ${err}`] };
  }
}
