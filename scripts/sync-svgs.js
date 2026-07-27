/**
 * Sync SVG files from Obsidian vault to the git repo.
 *
 * Reads all marker .md files in zoom-map-data/markers/, extracts referenced SVG
 * paths (image bases), then copies those SVGs from vault to two locations:
 *   1. src/site/notes/  – for local dev / fallback
 *   2. zoom-map-data/assets/excalidraw/  – DG-safe, committed to git
 *
 * The second location is NOT managed by the Digital Garden plugin, so it
 * survives DG's publish → delete cycle.
 *
 * Usage:
 *   node scripts/sync-svgs.js
 *
 * Config:
 *   Set VAULT_PATH env var, or edit VAULT_PATH_DEFAULT below.
 *   On Vercel / CI: skip silently (no vault available), SVGs should already be
 *   committed to the repo under zoom-map-data/assets/.
 */
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

// ── Configuration ──────────────────────────────────────────────
const VAULT_PATH_DEFAULT = "E:/TEST";
const REPO_ROOT = path.resolve(__dirname, "..");
const NOTES_DIR = path.join(REPO_ROOT, "src", "site", "notes");
const ASSETS_DIR = path.join(REPO_ROOT, "zoom-map-data", "assets", "excalidraw");

// ── Main ───────────────────────────────────────────────────────

function main() {
  const vaultPath = process.env.VAULT_PATH || VAULT_PATH_DEFAULT;

  if (!fs.existsSync(vaultPath)) {
    console.log("[sync-svgs] Vault not found at", vaultPath, "– skipping SVG sync.");
    return;
  }

  const markersDir = path.join(REPO_ROOT, "zoom-map-data", "markers");
  if (!fs.existsSync(markersDir)) {
    console.log("[sync-svgs] No zoom-map-data/markers directory – nothing to sync.");
    return;
  }

  const files = fs.readdirSync(markersDir).filter(f => f.endsWith(".md"));
  if (files.length === 0) {
    console.log("[sync-svgs] No marker files found.");
    return;
  }

  let copied = 0;
  let missing = 0;
  const seen = new Set();

  for (const f of files) {
    const raw = fs.readFileSync(path.join(markersDir, f), "utf8");
    const svgPaths = extractSvgPaths(raw);
    for (const svgRel of svgPaths) {
      if (seen.has(svgRel)) continue;
      seen.add(svgRel);

      const srcPath = path.join(vaultPath, svgRel);
      const dstPath = path.join(NOTES_DIR, svgRel);

      if (!fs.existsSync(srcPath)) {
        console.warn("[sync-svgs] Vault SVG missing:", svgRel);
        missing++;
        continue;
      }

      // Only copy if changed (compare sizes)
      const srcSize = fs.statSync(srcPath).size;
      let dstSize = -1;
      if (fs.existsSync(dstPath)) dstSize = fs.statSync(dstPath).size;

      if (srcSize !== dstSize) {
        fs.mkdirSync(path.dirname(dstPath), { recursive: true });
        fs.copyFileSync(srcPath, dstPath);
        console.log("[sync-svgs] notes:", svgRel, `(${srcSize} bytes)`);
        copied++;
      }

      // Also copy to zoom-map-data/assets/excalidraw/ (DG-safe location)
      const assetDst = path.join(ASSETS_DIR, svgRel);
      const assetSize = fs.existsSync(assetDst) ? fs.statSync(assetDst).size : -1;
      if (srcSize !== assetSize) {
        fs.mkdirSync(path.dirname(assetDst), { recursive: true });
        fs.copyFileSync(srcPath, assetDst);
        console.log("[sync-svgs] assets:", svgRel, `(${srcSize} bytes)`);
        copied++;
      }
    }
  }

  console.log(`[sync-svgs] Done: ${copied} SVG(s) copied, ${missing} missing in vault.`);
}

// ── Helpers ────────────────────────────────────────────────────

/**
 * Extract all SVG paths from a marker .md file.
 * Looks at: activeBase, bases[], overlays[] in the JSON code block.
 */
function extractSvgPaths(raw) {
  const paths = [];

  const jsonMatch = raw.match(/```json\s*\r?\n([\s\S]*?)\n```/);
  if (!jsonMatch) return paths;

  let data;
  try {
    data = JSON.parse(jsonMatch[1]);
  } catch (_e) {
    return paths;
  }

  // activeBase
  if (typeof data.activeBase === "string") paths.push(data.activeBase);

  // bases array
  if (Array.isArray(data.bases)) {
    for (const b of data.bases) {
      if (b && typeof b.path === "string") paths.push(b.path);
    }
  }

  // overlays array
  if (Array.isArray(data.overlays)) {
    for (const o of data.overlays) {
      if (o && typeof o.path === "string") paths.push(o.path);
    }
  }

  // Filter to only .svg files
  return paths.filter(p => p && p.toLowerCase().endsWith(".svg"));
}

main();
