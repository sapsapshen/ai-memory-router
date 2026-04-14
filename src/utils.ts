// src/utils.ts
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { debug } from './logger.js';

export function resolveHomeDir(p: string): string {
  if (p.startsWith('~') || p.startsWith('%USERPROFILE%')) {
    const rest = p.replace(/^~/, '').replace(/^%USERPROFILE%/, '');
    return path.join(os.homedir(), rest);
  }
  return p;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'untitled';
}

export function computeFingerprint(entry: { type: string; title: string; content: string }): string {
  const raw = `${entry.type}::${entry.title}::${entry.content}`;
  return `sha256:${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)}`;
}

export function detectImportance(title: string, content: string): 'critical' | 'high' | 'medium' | 'low' {
  const lower = (title + ' ' + content).toLowerCase();
  if (/critical|铁律|must|never|always|禁止|必须/.test(lower)) return 'critical';
  if (/important|prefer|习惯|偏好|key|重要/.test(lower)) return 'high';
  if (/note|备注|info|参考/.test(lower)) return 'medium';
  return 'low';
}

export function generateId(entry: { type: string; title: string; content: string; sourceTool: string }): string {
  return computeFingerprint({ type: entry.type, title: entry.title, content: entry.content });
}

export function nowISO(): string {
  return new Date().toISOString();
}

// Helper functions for safe file operations with debug logging
export function safeGetDirSize(dirPath: string): number {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) size += safeGetDirSize(fullPath);
      else if (entry.isFile()) size += fs.statSync(fullPath).size;
    }
  } catch (err) {
    debug(`Error calculating dir size for ${dirPath}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return size;
}

export function safeCountFiles(dirPath: string): number {
  let count = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) count += safeCountFiles(fullPath);
      else if (entry.isFile()) count++;
    }
  } catch (err) {
    debug(`Error counting files for ${dirPath}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return count;
}
