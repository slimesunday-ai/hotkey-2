// AI-seat defaults. The engine's numbers live in src/config.mjs; these are the seat layer's own.
// Adapted from hotkey mini's seats/defaults.mjs (commit 3438059). What changed:
// - the word limits, goods list and action ids of mini's reply are gone: this game's text limits are characters and
//   come from src/resolve.mjs, and the menu is the only list of moves;
// - `models` is the ai10 cast (data/seat-models-ai10.json), read by ai10Template();
// - a third API name, 'local', for the Mac's own model (free, no key): see ai.mjs;
// - the estimate's growth factor and the hard stop's headroom, for the dry run.
// Every number here is a starting guess with a reason beside it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAY_MAX, MESSAGE_MAX, CONFESSIONAL_MAX } from '../resolve.mjs';

export const SEAT_DEFAULTS = {
  // Reply cap in tokens, reasoning and reply together (mini round 3: 400 -> 2000). A full reply here is about 150
  // tokens, but a reasoning model thinks inside the same cap even at minimal.
  maxTokens: 2000,
  // One attempt's window in ms, then one retry on a transport error.
  timeoutMs: 60000,
  // Transport errors get this many retries.
  retries: 1,
  // AI seats called at once. The runner raises it to the number of AI seats: an hour waits for its slowest call anyway.
  concurrency: 4,
  // Thinking minimal. OpenRouter's `reasoning` field, sent as is.
  reasoning: { effort: 'minimal' },
  // Per-model overrides of `reasoning`, by OpenRouter id prefix. Anthropic through OpenRouter: thinking off. A Claude
  // seat that should think goes direct (api 'claude') at its own effort.
  reasoningByModel: { 'anthropic/': { enabled: false } },
  // JSON mode (`response_format: { type: 'json_object' }`), where the model supports it. OpenRouter drops the field
  // for providers that don't support it.
  jsonMode: true,
  // Per-model JSON-mode overrides, by OpenRouter id prefix (none known yet).
  jsonModeByModel: {},
  // The endpoint and the key file. The key file is read only for a live run, after maxCost and go are given.
  url: 'https://openrouter.ai/api/v1/chat/completions',
  keyFile: path.join(os.homedir(), '.config', 'openrouter', 'key'),
  // The fake transport's endpoint: never resolved, the fake answers in-process.
  fakeUrl: 'http://fake.invalid/v1/chat/completions',
  // Claude seats (api 'claude', the Messages API through ./anthropic.mjs): always thinking, adaptive, at the seat's
  // effort (the client's default is high).
  claude: {
    // max_tokens by effort; it caps thinking and the reply together (mini: 6000 cut Haiku off on 28 of 66 calls).
    maxTokensByEffort: { low: 16000, medium: 16000, high: 16000, xhigh: 32000, max: 64000 },
    // A thinking call's window by effort, then the same one retry as every seat.
    timeoutMsByEffort: { low: 180000, medium: 180000, high: 180000, xhigh: 360000, max: 600000 },
    // The Claude seats' fake endpoint in a --fake run (never resolved: ./fake-messages.mjs answers in-process).
    fakeUrl: 'http://fake.invalid/v1/messages',
  },
  // The Mac's own model (api 'local'): an OpenAI-style endpoint on this machine, no key, no cost. A plumbing check
  // only (SPEC section 17). Its window is long because one model answers ten seats.
  local: {
    url: 'http://127.0.0.1:8000/v1/chat/completions',
    timeoutMs: 300000,
    // The local server answers a few requests at a time; more only queue behind each other.
    concurrency: 2,
  },
  // The dry run plays hour 0, when prompts are at their smallest: nobody has spoken, offered or been robbed yet. The
  // season estimate multiplies the dry run's cost per call by this. Measured on a fake ai10 season (seed 1,
  // 2026-11-11): the part of the prompt that changes averaged 5,160 characters against 3,190 at hour 0 (1.6 times),
  // and the whole prompt 12,700 against 10,700 (1.2 times). The rulebook is cached and replies don't grow, so the
  // true factor sits between the two; 1.5 leans high, because real models talk more than the fake does.
  promptGrowth: 1.5,
  // The suggested --max-cost is the estimate plus this share (SPEC section 17: about 30% above it).
  headroom: 0.3,
};

// The APIs a seat can name: OpenRouter's chat completions, the Claude Messages API direct, or the Mac's own model.
export const APIS = ['openrouter', 'claude', 'local'];
// The APIs that bill: a run with a seat on one of these needs --max-cost and --go.
export const PAID_APIS = ['openrouter', 'claude'];

// The text limits of a reply, in characters (SPEC section 13). The prompt states them and the parser cuts to them.
export const LIMITS = { say: SAY_MAX, message: MESSAGE_MAX, confessional: CONFESSIONAL_MAX, journalLine: 200, ask: 160, persona: 300 };

// The value for a model from a { prefix: value } table, or the fallback.
export function byPrefix(table, model, fallback) {
  const hit = Object.keys(table || {}).sort().find(p => typeof model === 'string' && model.startsWith(p));
  return hit === undefined ? fallback : table[hit];
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const AI10_FILE = path.join(ROOT, 'data', 'seat-models-ai10.json');

/** The ai10 cast: ten seats, each { seat, model, api, effort?, persona }, from data/seat-models-ai10.json. */
export function ai10Template(file = AI10_FILE) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(data) ? data : data.seats;
}
