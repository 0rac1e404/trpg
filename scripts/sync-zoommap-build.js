/**
 * Build zoom-map-static.js from the zoom-map project and copy to trpg.
 *
 * Usage:
 *   node scripts/sync-zoommap-build.js
 *
 * Environment:
 *   ZOOM_MAP_PATH – path to zoom-map project root (default: E:/git/zoom-map/zoom-map)
 *
 * Gracefully skips when the zoom-map project is not available (e.g. Vercel build).
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ── Configuration ──────────────────────────────────────────────
const ZOOM_MAP_PATH = process.env.ZOOM_MAP_PATH || "E:/git/zoom-map/zoom-map";
const REPO_ROOT = path.resolve(__dirname, "..");
const DST_FILE = path.join(REPO_ROOT, "src", "site", "scripts", "zoom-map-static.js");
const SRC_FILE = path.join(ZOOM_MAP_PATH, "zoom-map-static.js");

// ── Main ───────────────────────────────────────────────────────

function buildAndCopy() {
  // 0. Check if destination already exists (for Vercel/CI envs)
  if (!fs.existsSync(ZOOM_MAP_PATH) || !fs.existsSync(path.join(ZOOM_MAP_PATH, "package.json"))) {
    if (fs.existsSync(DST_FILE)) {
      console.log("[sync-zoommap] Zoom Map project not available; using existing zoom-map-static.js in repo.");
    } else {
      console.warn("[sync-zoommap] Zoom Map project not available and no existing zoom-map-static.js found.");
    }
    return;
  }

  // 1. Build in zoom-map project
  console.log(`[sync-zoommap] Building in ${ZOOM_MAP_PATH}...`);
  try {
    execSync("npm run build:static", { cwd: ZOOM_MAP_PATH, stdio: "inherit" });
  } catch (err) {
    console.error("[sync-zoommap] Build failed. Make sure dependencies are installed.");
    return;
  }

  // 2. Verify source exists
  if (!fs.existsSync(SRC_FILE)) {
    console.error(`[sync-zoommap] Build output not found: ${SRC_FILE}`);
    return;
  }

  // 3. Compare and copy
  const srcStat = fs.statSync(SRC_FILE);
  const dstOld = fs.existsSync(DST_FILE) ? fs.statSync(DST_FILE) : null;

  if (!dstOld || srcStat.size !== dstOld.size || srcStat.mtimeMs > dstOld.mtimeMs) {
    fs.mkdirSync(path.dirname(DST_FILE), { recursive: true });
    fs.copyFileSync(SRC_FILE, DST_FILE);
    console.log(`[sync-zoommap] Copied: zoom-map-static.js (${(srcStat.size / 1024).toFixed(1)} KB)`);
  } else {
    console.log("[sync-zoommap] Already up to date.");
  }
}

buildAndCopy();
