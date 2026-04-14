// src/server.ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ToolId } from './types.js';
import { sourceAdapters, targetAdapters } from './adapters/index.js';
import { scanAll } from './scanner.js';
import { writeToMemoryStore } from './writer.js';
import { readMemoryStore, readFullEntry } from './reader.js';
import { executeMigration } from './migrate.js';
import { readSkillsIndex } from './skills-scanner.js';
import { findAvailablePort } from './port.js';
import { log, info as logInfo, warn, error } from './logger.js';

const app = new Hono();
app.use(cors());

const publicDir = path.join(process.cwd(), 'public');

function copySkillDir(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copySkillDir(srcPath, destPath);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      if (entry.isSymbolicLink()) {
        try {
          const realPath = fs.realpathSync(srcPath);
          if (fs.statSync(realPath).isDirectory()) {
            copySkillDir(realPath, destPath);
          } else {
            fs.copyFileSync(realPath, destPath);
          }
        } catch { /* skip */ }
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

app.get('/', (c) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return c.html(fs.readFileSync(indexPath, 'utf-8'));
  }
  return c.text('index.html not found', 404);
});

// Serve static files directly
app.get('/styles.css', (c) => {
  const filePath = path.join(publicDir, 'styles.css');
  if (fs.existsSync(filePath)) {
    c.header('Content-Type', 'text/css');
    return c.body(fs.readFileSync(filePath, 'utf-8'));
  }
  return c.text('Not found', 404);
});

app.get('/app.js', (c) => {
  const filePath = path.join(publicDir, 'app.js');
  if (fs.existsSync(filePath)) {
    c.header('Content-Type', 'application/javascript');
    return c.body(fs.readFileSync(filePath, 'utf-8'));
  }
  return c.text('Not found', 404);
});

// GET /api/memories
app.get('/api/memories', (c) => {
  const metas = readMemoryStore();
  return c.json({
    count: metas.length,
    memories: metas,
    tools: sourceAdapters.map(a => ({ id: a.toolId, label: a.label, icon: a.icon })),
    targets: targetAdapters.map(a => ({ id: a.toolId, label: a.label })),
  });
});

// GET /api/memories/:id
app.get('/api/memories/:id', (c) => {
  const id = c.req.param('id');
  const metas = readMemoryStore();
  const meta = metas.find(m => m.id === id);
  if (!meta) return c.json({ error: 'Not found' }, 404);
  const entry = readFullEntry(meta.filePath);
  if (!entry) return c.json({ error: 'Could not read entry' }, 500);
  return c.json(entry);
});

// GET /api/skills
app.get('/api/skills', (c) => {
  const index = readSkillsIndex();
  return c.json({
    count: index.skills.length,
    skills: index.skills,
    scannedAt: index.scannedAt,
    targets: targetAdapters.map(a => ({ id: a.toolId, label: a.label })),
  });
});

// POST /api/migrate - migrate memories
app.post('/api/migrate', async (c) => {
  try {
    const body = await c.req.json();
    const { entries, targetTool } = body as { entries: string[]; targetTool: ToolId };

    // Validate entries
    if (!entries || !Array.isArray(entries)) {
      return c.json({ error: 'Invalid entries format', details: 'Expected an array of memory IDs' }, 400);
    }
    if (entries.length === 0) {
      return c.json({ error: 'No entries selected', details: 'Please select at least one memory to migrate' }, 400);
    }
    if (entries.some(id => typeof id !== 'string')) {
      return c.json({ error: 'Invalid entry ID', details: 'All entry IDs must be strings' }, 400);
    }

    // Validate target tool
    if (!targetTool || typeof targetTool !== 'string') {
      return c.json({ error: 'No target tool specified', details: 'Please specify a target tool for migration' }, 400);
    }
    const validTargets = targetAdapters.map(a => a.toolId);
    if (!validTargets.includes(targetTool)) {
      return c.json({ error: 'Invalid target tool', details: `Valid targets: ${validTargets.join(', ')}` }, 400);
    }

    const result = executeMigration(entries, targetTool);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, errors: [msg], backedUp: [], written: [] }, 500);
  }
});

// POST /api/migrate-skills - migrate skills
app.post('/api/migrate-skills', async (c) => {
  try {
    const body = await c.req.json();
    const { skillIds, targetTool } = body as { skillIds: string[]; targetTool: ToolId };

    // Validate skillIds
    if (!skillIds || !Array.isArray(skillIds)) {
      return c.json({ error: 'Invalid skillIds format', details: 'Expected an array of skill IDs' }, 400);
    }
    if (skillIds.length === 0) {
      return c.json({ error: 'No skills selected', details: 'Please select at least one skill to migrate' }, 400);
    }
    if (skillIds.some(id => typeof id !== 'string')) {
      return c.json({ error: 'Invalid skill ID', details: 'All skill IDs must be strings' }, 400);
    }

    // Validate target tool
    if (!targetTool || typeof targetTool !== 'string') {
      return c.json({ error: 'No target tool specified', details: 'Please specify a target tool for migration' }, 400);
    }
    const validTargets = targetAdapters.map(a => a.toolId);
    if (!validTargets.includes(targetTool)) {
      return c.json({ error: 'Invalid target tool', details: `Valid targets: ${validTargets.join(', ')}` }, 400);
    }

    const target = targetAdapters.find(a => a.toolId === targetTool);
    if (!target) {
      return c.json({ error: `No target adapter for: ${targetTool}`, details: `Valid targets: ${validTargets.join(', ')}` }, 400);
    }

    // Build skillDirMap: skillName -> skills-store/{sourceTool}/{skillName} path
    const skillsIndex = readSkillsIndex();
    const skillDirMap = new Map<string, string>();
    const errors: string[] = [];

    for (const skillId of skillIds) {
      const skill = skillsIndex.skills.find(s => s.id === skillId);
      if (!skill) {
        errors.push(`Skill not found: ${skillId}`);
        continue;
      }
      const sourceDir = path.join(process.cwd(), 'skills-store', skill.sourceTool, skill.name);
      if (!fs.existsSync(sourceDir)) {
        errors.push(`Skill directory not found: ${sourceDir}`);
        continue;
      }
      skillDirMap.set(skill.name, sourceDir);
    }

    if (skillDirMap.size === 0) {
      return c.json({ success: false, errors, backedUp: [], written: [] }, 400);
    }

    // Ensure target base dir exists
    let resolvedBase = target.defaultPath;
    if (resolvedBase.startsWith('~')) {
      resolvedBase = path.join(os.homedir(), resolvedBase.slice(1));
    }
    fs.mkdirSync(resolvedBase, { recursive: true });

    // Use adapter's writeSkillDirs for tool-specific skill placement
    let result: { success: boolean; backedUp: string[]; written: string[]; errors: string[] } | null = null;
    if (target.writeSkillDirs) {
      result = target.writeSkillDirs(skillDirMap, resolvedBase);
    } else {
      // Fallback: direct copy to {basePath}/skills/{skillName}/
      result = { success: true, backedUp: [], written: [], errors: [...errors] };
      for (const [skillName, sourceDir] of skillDirMap) {
        const targetDir = path.join(resolvedBase, 'skills', skillName);
        if (fs.existsSync(targetDir)) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
          const backupDir = path.join(resolvedBase, `skills.backup.${timestamp}`);
          try {
            fs.cpSync(targetDir, backupDir, { recursive: true });
            result.backedUp.push(backupDir);
          } catch { /* skip */ }
        }
        try {
          copySkillDir(sourceDir, targetDir);
          result.written.push(targetDir);
        } catch (err) {
          result.errors.push(`Failed to copy skill ${skillName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    result.success = result.errors.length === 0;
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, errors: [msg], backedUp: [], written: [] }, 500);
  }
});

// POST /api/shutdown
app.post('/api/shutdown', (c) => {
  logInfo('Shutting down...');
  setTimeout(() => process.exit(0), 500);
  return c.json({ ok: true });
});

// Start server
async function main() {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';

  logInfo('AI Memory Router\n');
  logInfo('Scanning for AI tool memories...\n');

  // Step 1: Scan all source tools
  const { memories, skillsCount } = scanAll(homeDir);
  logInfo(`\nTotal memories found: ${memories.length}`);
  logInfo(`Total skills found: ${skillsCount}\n`);

  // Step 2: Write to memory-store
  logInfo('Writing to memory-store...');
  const { written, skipped } = writeToMemoryStore(memories);
  logInfo(`  Written: ${written}, Skipped (duplicate): ${skipped}\n`);

  // Step 3: Start HTTP server
  const port = await findAvailablePort(7890);

  serve({ fetch: app.fetch, port }, (serverInfo) => {
    log(`Memory Router running at http://localhost:${serverInfo.port}`);
    logInfo('Open http://localhost:' + serverInfo.port + ' in your browser\n');
  });
}

main().catch(err => {
  error(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) {
    error(`Stack trace:\n${err.stack}`);
  }
  process.exit(1);
});
