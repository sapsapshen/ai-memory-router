// src/scanner.ts
import type { MemoryEntry } from './types.js';
import { sourceAdapters } from './adapters/index.js';
import { scanSkills, writeSkillsIndex } from './skills-scanner.js';
import { log, warn } from './logger.js';

export function scanAll(homeDir: string): { memories: MemoryEntry[]; skillsCount: number } {
  const allEntries: MemoryEntry[] = [];

  log('Scanning memories...');
  for (const adapter of sourceAdapters) {
    try {
      const entries = adapter.scan(homeDir);
      if (entries.length > 0) {
        log(`  ${adapter.icon} ${adapter.label}: ${entries.length} memories`);
        allEntries.push(...entries);
      }
    } catch (err) {
      warn(`${adapter.icon} ${adapter.label}: memory scan failed - ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Scan skills
  log('Scanning skills...');
  const skillsIndex = scanSkills(homeDir);
  writeSkillsIndex(skillsIndex);

  return { memories: allEntries, skillsCount: skillsIndex.skills.length };
}
