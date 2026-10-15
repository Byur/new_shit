#!/usr/bin/env node
/**
 * Downloads the public-domain archival stills used by the Tacoma Narrows film.
 *
 * Usage: node scripts/fetch-tacoma-assets.mjs [--force]
 *
 * Every file here is public domain or CC0. The origin of all of them is the
 * Stillman Fires Collection print of Barney Elliott's 7 November 1940 colour
 * footage, held by the National Archives and mirrored on the Internet Archive
 * (https://archive.org/details/Pa2096Tacoma). Provenance and licence for each
 * file are recorded in docs/tacoma-narrows-bridge.md.
 *
 * The stills are committed to public/tacoma/ on purpose: the film needs them to
 * render, and this script is how they can be re-obtained. Do not point the
 * render at a remote URL.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..');
const DEST = path.join(PKG, 'public/tacoma');

const FORCE = process.argv.includes('--force');

/* The `?utm_*` parameters the Commons API appends are stripped by hand. */
const ASSETS = [
  {
    file: 'collapse-twist.png',
    // The clearest frame of the deck caught mid-twist, ~3:21 into the footage.
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Tacoma_Narrows_still.png',
    licence: 'Public Domain (Barney Elliott, 1940)',
    note: 'Deck at maximum torsional deflection. Hero image for the twist scenes.',
  },
  {
    file: 'torsion-stills.png',
    // A stacked comparison of the deck at the two extremes of the twist.
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Tacoma_bridge_torsional_instability.png',
    licence: 'CC0',
    note: 'Two frames showing opposite twist extremes.',
  },
  {
    file: 'collapsed-deck.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Tacoma_narrows_bridge_collapsed.jpg',
    licence: 'Public Domain (Barney Elliott, 1940)',
    note: 'The fallen deck in the Narrows after the collapse.',
  },
  {
    file: 'collapse-far.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Tacoma-narrows-bridge-collapse.jpg',
    licence: 'Public Domain',
    note: 'Wide view of the collapse, used for the "span by span" beat.',
  },
  {
    file: 'howard-clifford.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Howard_Clifford_running_off_the_Tacoma_Narrows_Bridge_during_collapse%2C_Tacoma%2C_Washington_%284861196144%29.jpg',
    licence: 'No known copyright restrictions (UW Digital Collections)',
    note: 'The last person off the bridge. Used for the human-cost beat.',
  },
];

fs.mkdirSync(DEST, {recursive: true});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * upload.wikimedia.org answers a burst of requests with 429 and a Retry-After
 * header. Backing off is the documented behaviour, so honour it rather than
 * hammering the mirror again.
 */
const get = async (asset) => {
  const attempts = 5;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(asset.url, {
      headers: {'user-agent': 'new_shit-remotion/1.0 (Tacoma Narrows explainer; asset fetch)'},
    });
    if (response.ok) return response;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === attempts) {
      throw new Error(`${asset.file}: HTTP ${response.status} from ${asset.url}`);
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * attempt;
    console.log(`retry  ${asset.file}  HTTP ${response.status}, waiting ${waitMs}ms`);
    await sleep(waitMs);
  }
  throw new Error('unreachable');
};

let downloaded = 0;
let skipped = 0;

for (const asset of ASSETS) {
  const target = path.join(DEST, asset.file);
  if (fs.existsSync(target) && !FORCE) {
    console.log(`skip   ${asset.file} (already present)`);
    skipped++;
    continue;
  }
  const response = await get(asset);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) {
    throw new Error(`${asset.file}: suspiciously small (${bytes.length} bytes)`);
  }
  fs.writeFileSync(target, bytes);
  console.log(`fetch  ${asset.file}  ${(bytes.length / 1024).toFixed(0)} KB  ${asset.licence}`);
  downloaded++;
  await sleep(1200);
}

console.log(`\n${downloaded} downloaded, ${skipped} already present -> public/tacoma/`);
