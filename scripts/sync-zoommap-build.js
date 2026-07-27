/**
 * Build zoom-map-static.js from the zoom-map project and copy to trpg.
 *
 * Usage:
 *   node scripts/sync-zoommap-build.js
 *
 * Config:
 *   ZOOM_MAP_PATH – path to zoom-map project root (default: E:/git/zoom-map/zoom-map)
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
  // 1. Build in zoom-map project
  console.log(`[sync-zoommap] Building in ${ZOOM_MAP_PATH}...`);
  try {
    execSync("npm run build:static", { cwd: ZOOM_MAP_PATH, stdio: "inherit" });
  } catch (err) {
    console.error("[sync-zoommap] Build failed. Make sure dependencies are installed.");
    process.exit(1);
  }

  // 2. Verify source exists
  if (!fs.existsSync(SRC_FILE)) {
    console.error(`[sync-zoommap] Build output not found: ${SRC_FILE}`);
    process.exit(1);
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
