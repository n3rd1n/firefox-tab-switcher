"use strict";

// Small fzf-style matcher: characters must appear in order.
// Bonus for consecutive matches and word starts, penalty for gaps.

function isBoundary(text, i) {
  if (i === 0) return true;
  const prev = text[i - 1];
  const cur = text[i];
  if (!/[\p{L}\p{N}]/u.test(prev)) return true;
  return prev === prev.toLowerCase() && cur !== cur.toLowerCase(); // camelCase
}

function scorePositions(text, pos) {
  let score = 0;
  for (let i = 0; i < pos.length; i++) {
    score += 1;
    if (isBoundary(text, pos[i])) score += 8;
    if (i > 0) {
      const gap = pos[i] - pos[i - 1] - 1;
      if (gap === 0) score += 6;
      else score -= Math.min(gap, 10) * 0.3;
    }
  }
  score -= Math.min(pos[0], 20) * 0.1;
  return score;
}

/** Returns {score, pos} or null. pattern must already be lowercase. */
function fuzzyMatch(pattern, text) {
  if (!pattern) return { score: 0, pos: [] };
  const lower = text.toLowerCase();
  let best = null;
  let tries = 0;
  for (
    let start = lower.indexOf(pattern[0]);
    start !== -1 && tries < 50;
    start = lower.indexOf(pattern[0], start + 1), tries++
  ) {
    const pos = [start];
    let ti = start + 1;
    for (let pi = 1; pi < pattern.length; pi++) {
      const idx = lower.indexOf(pattern[pi], ti);
      if (idx === -1) return best; // later starts can't match either
      pos.push(idx);
      ti = idx + 1;
    }
    const score = scorePositions(text, pos);
    if (!best || score > best.score) best = { score, pos };
  }
  return best;
}

/**
 * Searches title and URL. Multiple words (separated by spaces)
 * must all match somewhere. Returns null or
 * {score, titlePos: Set, urlPos: Set}.
 */
function matchTab(query, title, url) {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const result = { score: 0, titlePos: new Set(), urlPos: new Set() };
  for (const token of tokens) {
    const t = fuzzyMatch(token, title);
    const u = fuzzyMatch(token, url);
    const ts = t ? t.score * 1.5 : -Infinity; // title matches weigh more
    const us = u ? u.score : -Infinity;
    if (ts === -Infinity && us === -Infinity) return null;
    if (ts >= us) {
      result.score += ts;
      t.pos.forEach((p) => result.titlePos.add(p));
    } else {
      result.score += us;
      u.pos.forEach((p) => result.urlPos.add(p));
    }
  }
  return result;
}
