/**
 * NIKO: Guardian of Base — global leaderboard API (Cloudflare Worker).
 *
 * Endpoints:
 *   GET  /scores?key=<board>&limit=<n>   → top scores for a board
 *   POST /scores                          → submit a score
 *        body: { key, player, score, wave, address? }
 *
 * Boards use the same keys the game stores locally:
 *   "<mapId>:<difficulty>"  e.g. "vaultRun:guardian"   (campaign)
 *   "weekly:<isoWeek>"      e.g. "weekly:2026-W24"     (Weekly Trench)
 *
 * Storage: one KV entry per board holding the top 100 as JSON. KV writes are
 * last-write-wins, so two simultaneous submissions can race; that's accepted
 * for this scale — upgrade the board to a Durable Object if it ever matters.
 *
 * Anti-cheat (baseline, see README for the roadmap):
 *   - strict payload validation + plausibility cap (score vs. wave reached)
 *   - per-IP hourly rate limit
 *   - one entry per player name per board (best score wins)
 *   - weekly boards reject future week keys
 *   - EIP-191 signature check: a submission that claims a wallet `address` must
 *     include a `signature` proving that wallet signed the score (see eip191.js).
 *     Anonymous submissions (no address) are still accepted.
 */
import { buildScoreMessage, verifySignature } from './eip191.js';

const TOP_N = 100;
const RATE_LIMIT_PER_HOUR = 20;
const MAX_LIMIT = 100;

const BOARD_KEY_RE =
  /^(vaultRun|gauntlet|fudSpiral|doubleCross):(pup|guardian|alpha)$|^weekly:\d{4}-W\d{2}$/;
const PLAYER_RE = /^[A-Za-z0-9 _.\-…]{1,24}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SIGNATURE_RE = /^0x[0-9a-fA-F]{130}$/;

/** Generous upper bound on a legitimate score for the wave reached. */
function maxPlausibleScore(wave) {
  return wave * 3000;
}

/** Current ISO week key (UTC), mirrors src/data/weekly.ts in the game. */
function currentWeekKey() {
  const d = new Date();
  const day = d.getUTCDay() || 7;
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

async function getScores(url, env, cors) {
  const key = url.searchParams.get('key') ?? '';
  if (!BOARD_KEY_RE.test(key)) return json({ error: 'invalid board key' }, 400, cors);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || 10));
  const raw = await env.SCORES.get(`lb:${key}`);
  const board = raw ? JSON.parse(raw) : [];
  return json({ key, entries: board.slice(0, limit) }, 200, cors);
}

async function postScore(request, env, cors) {
  // Per-IP hourly rate limit (KV increments race under load; good enough).
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const bucket = `rl:${ip}:${Math.floor(Date.now() / 3600000)}`;
  const used = Number((await env.SCORES.get(bucket)) ?? 0);
  if (used >= RATE_LIMIT_PER_HOUR) return json({ error: 'rate limited' }, 429, cors);
  await env.SCORES.put(bucket, String(used + 1), { expirationTtl: 3700 });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400, cors);
  }
  const { key, player, score, wave, address, signature } = body ?? {};

  if (typeof key !== 'string' || !BOARD_KEY_RE.test(key)) {
    return json({ error: 'invalid board key' }, 400, cors);
  }
  if (typeof player !== 'string' || !PLAYER_RE.test(player)) {
    return json({ error: 'invalid player name' }, 400, cors);
  }
  if (!Number.isInteger(score) || score < 0 || !Number.isInteger(wave) || wave < 1 || wave > 500) {
    return json({ error: 'invalid score/wave' }, 400, cors);
  }
  if (score > maxPlausibleScore(wave)) {
    return json({ error: 'implausible score' }, 400, cors);
  }
  if (address !== undefined && (typeof address !== 'string' || !ADDRESS_RE.test(address))) {
    return json({ error: 'invalid address' }, 400, cors);
  }
  // A claimed wallet address must prove ownership with a valid EIP-191
  // signature over the canonical score message. No address → no signature
  // needed (anonymous Wolf submission).
  if (address !== undefined) {
    if (typeof signature !== 'string' || !SIGNATURE_RE.test(signature)) {
      return json({ error: 'missing signature' }, 400, cors);
    }
    const message = buildScoreMessage({ key, score, wave, address });
    if (!verifySignature(message, signature, address)) {
      return json({ error: 'bad signature' }, 401, cors);
    }
  }
  // Weekly boards: only the current (or past) week may receive scores.
  if (key.startsWith('weekly:') && key.slice(7) > currentWeekKey()) {
    return json({ error: 'future week' }, 400, cors);
  }

  const kvKey = `lb:${key}`;
  const raw = await env.SCORES.get(kvKey);
  /** @type {Array<{player: string, score: number, wave: number, address?: string, ts: number}>} */
  const board = raw ? JSON.parse(raw) : [];

  // One entry per player name; keep their best.
  const existing = board.findIndex((e) => e.player === player);
  const entry = { player, score, wave, ...(address ? { address } : {}), ts: Date.now() };
  if (existing >= 0) {
    if (board[existing].score >= score) {
      return json({ ok: true, improved: false }, 200, cors);
    }
    board.splice(existing, 1);
  }
  board.push(entry);
  board.sort((a, b) => b.score - a.score);
  board.length = Math.min(board.length, TOP_N);
  await env.SCORES.put(kvKey, JSON.stringify(board));

  const rank = board.findIndex((e) => e.player === player) + 1;
  return json({ ok: true, improved: true, rank: rank || null }, 200, cors);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    try {
      if (url.pathname === '/scores' && request.method === 'GET') {
        return await getScores(url, env, cors);
      }
      if (url.pathname === '/scores' && request.method === 'POST') {
        return await postScore(request, env, cors);
      }
      return json({ error: 'not found' }, 404, cors);
    } catch {
      return json({ error: 'server error' }, 500, cors);
    }
  },
};
