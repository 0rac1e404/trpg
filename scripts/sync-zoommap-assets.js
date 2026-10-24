/**
 * Sync ZoomMap assets (map image + markers.json) from the Obsidian vault into
 * the repo, preserving the full vault-relative path.
 *
 * The published site serves these from the site root: the ZoomMap static
 * renderer turns a vault path like
 *   TRPG规则/测试中/自由之夏/5. 资源/康斯坦丁省.excalidraw.svg
 * into the URL
 *   /TRPG规则/测试中/自由之夏/5. 资源/康斯坦丁省.excalidraw.svg
 * (see normPath() in src/site/scripts/zoom-map-static.js). So the file must
 * land in the repo at exactly that path — relative to a directory that gets
 * passthrough-copied to the site root.
 *
 * Unlike sync-svgs.js (which reads paths out of zoom-map-data/markers/*.md),
 * this reads the ```zoommap blocks in the vault notes themselves — the same
 * paths the renderer will actually request — so a wrong path in a note is
 * reported instead of silently syncing a stale one.
 *
 * Usage:
 *   node scripts/sync-zoommap-assets.js
 *
 * On Vercel / CI (no vault) it skips silently; assets must be committed.
 */
const fs = require("fs");
const path = require("path");

const VAULT_PATH_DEFAULT = "E:/TEST";
const REPO_ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(REPO_ROOT, "zoom-map-data", "assets", "excalidraw");

// Directories never scanned for notes.
const SKIP_DIRS = new Set([
  ".obsidian",
  ".git",
  ".trash",
  "node_modules",
  "_html",
  "图片素材",
]);

/** Recursively collect .md files under dir. */
function collectNotes(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith("_")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collectNotes(full, out);
    else if (e.name.toLowerCase().endsWith(".md")) out.push(full);
  }
  return out;
}

/**
 * Pull asset paths out of every ```zoommap block in a note's text.
 * Blocks may be nested in blockquotes ("> " prefix), which is stripped first.
 */
function extractAssetPaths(text) {
  const found = [];
  // Match fences optionally inside a blockquote: lines may start with "> "
  const blockRe = /^\s*(?:>\s?)*```zoommap[^\n]*\n([\s\S]*?)^\s*(?:>\s?)*```/gm;
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    const body = m[1]
      .split("\n")
      .map((line) => line.replace(/^\s*(?:>\s?)+/, "").replace(/^\s+/, ""))
      .join("\n");
    for (const line of body.split("\n")) {
      // imageBases entries: "  - path: X"
      const p = line.match(/^\s*-\s*path:\s*(.+?)\s*$/);
      if (p) found.push(p[1]);
      // markers: "markers: X"
      const mk = line.match(/^\s*markers:\s*(.+?)\s*$/);
      if (mk) found.push(mk[1]);
    }
  }
  return found;
}

function main() {
  const vaultPath = process.env.VAULT_PATH || VAULT_PATH_DEFAULT;
  if (!fs.existsSync(vaultPath)) {
    console.log("[sync-zoommap-assets] Vault not found at", vaultPath, "- skipping.");
    return;
  }

  const notes = collectNotes(vaultPath);
  const wanted = new Set();

  for (const note of notes) {
    let text;
    try {
      text = fs.readFileSync(note, "utf8");
    } catch {
      continue;
    }
    if (!text.includes("```zoommap")) continue;
    for (const p of extractAssetPaths(text)) {
      // Vault paths use forward slashes; skip absolute/remote ones.
      if (/^[a-zA-Z]:[\\/]/.test(p) || /^https?:/i.test(p) || p.startsWith("/")) continue;
      wanted.add(p.replace(/\\/g, "/"));
    }
  }

  if (wanted.size === 0) {
    console.log("[sync-zoommap-assets] No zoommap blocks found in vault.");
    return;
  }

  let copied = 0;
  let skipped = 0;
  const missing = [];

  for (const rel of [...wanted].sort()) {
    const src = path.join(vaultPath, rel);
    if (!fs.existsSync(src)) {
      missing.push(rel);
      continue;
    }
    const dst = path.join(ASSETS_DIR, rel);
    const srcSize = fs.statSync(src).size;
    const dstSize = fs.existsSync(dst) ? fs.statSync(dst).size : -1;

    if (srcSize === dstSize) {
      skipped++;
      continue;
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    console.log("[sync-zoommap-assets] +", rel, `(${srcSize} bytes)`);
    copied++;
  }

  console.log(
    `[sync-zoommap-assets] Done: ${copied} copied, ${skipped} up to date, ${missing.length} missing.`
  );
  for (const rel of missing) {
    console.warn(`[sync-zoommap-assets] MISSING in vault: ${rel}`);
  }
}

main();
