// src/adapters/index.ts
import type { SourceAdapter, TargetAdapter } from '../types.js';
import { hermesAdapter } from './hermes.js';
import { openclawAdapter } from './openclaw.js';
import { clineAdapter } from './cline.js';
import { codexAdapter } from './codex.js';
import { cursorAdapter } from './cursor.js';
import { copilotAdapter } from './copilot.js';
import { continueAdapter } from './continue.js';
import { rooCodeAdapter } from './roo-code.js';
import { aiderAdapter } from './aider.js';
import { windsurfAdapter } from './windsurf.js';
import { amazonQAdapter } from './amazon-q.js';
import { geminiAdapter } from './gemini.js';
import { augmentAdapter } from './augment.js';
import { globalSkillsAdapter } from './global-skills.js';
import { genericAdapter } from './generic.js';
import { targetClaudeCode } from './target-claude-code.js';
import { targetCline } from './target-cline.js';
import { targetRooCode } from './target-roo-code.js';
import { targetCursor } from './target-cursor.js';
import { targetCopilot } from './target-copilot.js';
import { targetContinue } from './target-continue.js';
import { targetOpenclaw } from './target-openclaw.js';
import { targetCodex } from './target-codex.js';
import { targetHermes } from './target-hermes.js';
import { targetAider } from './target-aider.js';
import { targetWindsurf } from './target-windsurf.js';
import { targetAmazonQ } from './target-amazon-q.js';
import { targetGemini } from './target-gemini.js';
import { targetAugment } from './target-augment.js';

export const sourceAdapters: SourceAdapter[] = [
  hermesAdapter,
  openclawAdapter,
  clineAdapter,
  codexAdapter,
  cursorAdapter,
  copilotAdapter,
  continueAdapter,
  rooCodeAdapter,
  aiderAdapter,
  windsurfAdapter,
  amazonQAdapter,
  geminiAdapter,
  augmentAdapter,
  globalSkillsAdapter,
  genericAdapter,
];

export const targetAdapters: TargetAdapter[] = [
  targetClaudeCode,
  targetCline,
  targetRooCode,
  targetCursor,
  targetCopilot,
  targetContinue,
  targetOpenclaw,
  targetCodex,
  targetHermes,
  targetAider,
  targetWindsurf,
  targetAmazonQ,
  targetGemini,
  targetAugment,
];
