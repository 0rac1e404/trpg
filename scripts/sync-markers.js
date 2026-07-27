/**
 * Sync marker data from Obsidian vault to the Zoom Map data directory.
 *
 * Reads published marker .md files from {vault}/ZoomMap/publish/markers/
 * and copies them to zoom-map-data/markers/ with cleaned frontmatter.
 *
 * Also copies library.md (icon profiles / map registry).
 *
 * Usage:
 *   node scripts/sync-markers.js
 *
 * Environment:
 *   VAULT_PATH – path to Obsidian vault root (default: E:/TEST)
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

// ── Configuration ──────────────────────────────────────────────
const VAULT_PATH_DEFAULT = "E:/TEST";
const REPO_ROOT = path.resolve(__dirname, "..");
const PUBLISH_DIR = path.join(process.env.VAULT_PATH || VAULT_PATH_DEFAULT, "ZoomMap", "publish");
const MARKERS_SRC = path.join(PUBLISH_DIR, "markers");
const ASSETS_SRC = path.join(PUBLISH_DIR, "assets.md");
const LIBRARY_SRC = path.join(PUBLISH_DIR, "library.md");

// Target directories in the repo
const DATA_DIR = path.join(REPO_ROOT, "zoom-map-data");
const MARKERS_DST = path.join(DATA_DIR, "markers");
const ASSETS_DST = path.join(DATA_DIR, "assets.md");
const LIBRARY_DST = path.join(DATA_DIR, "library.md");
const ICONS_DST = path.join(DATA_DIR, "icons.json"); // icons.json if exists

// ── Main ───────────────────────────────────────────────────────

function main() {
  let changed = false;

  // 1. Sync marker files
  if (fs.existsSync(MARKERS_SRC)) {
    const files = fs.readdirSync(MARKERS_SRC).filter(f => f.startsWith("m-") && f.endsWith(".md"));
    console.log(`[sync-markers] Found ${files.length} marker file(s) in ${MARKERS_SRC}`);

    fs.mkdirSync(MARKERS_DST, { recursive: true });

    for (const f of files) {
      const src = path.join(MARKERS_SRC, f);
      const dst = path.join(MARKERS_DST, f);

      const raw = fs.readFileSync(src, "utf8");
      const parsed = matter(raw);

      // Extract only the fields we need from frontmatter (it may be JSON or YAML)
      const fm = parsed.data || {};

      // Build clean frontmatter
      const cleanFm = {};
      if (fm.zoommapMarkersPath) cleanFm["zoommapMarkersPath"] = fm.zoommapMarkersPath;
      if (fm.sourceFile) cleanFm["sourceFile"] = fm.sourceFile;

      // Reconstruct .md with clean YAML frontmatter
      const yamlHeader = Object.entries(cleanFm)
        .map(([k, v]) => `${k}: ${String(v).includes(":") || String(v).includes("\n") ? JSON.stringify(v) : v}`)
        .join("\n");

      const newContent = `---\n${yamlHeader}\n---\n\n${parsed.content || ""}`.trim();

      // Check if content changed
      const dstOld = fs.existsSync(dst) ? fs.readFileSync(dst, "utf8") : "";
      if (newContent !== dstOld) {
        fs.writeFileSync(dst, newContent, "utf8");
        console.log(`[sync-markers] Updated: ${f}`);
        changed = true;
      }
    }

    // Remove stale marker files that no longer exist in source
    // NOTE: disabled by default – uncomment if you want auto-cleanup
    /*
    const srcNames = new Set(files);
    if (fs.existsSync(MARKERS_DST)) {
      const dstFiles = fs.readdirSync(MARKERS_DST).filter(f => f.startsWith("m-") && f.endsWith(".md"));
      for (const f of dstFiles) {
        if (!srcNames.has(f)) {
          const rm = path.join(MARKERS_DST, f);
          fs.unlinkSync(rm);
          console.log(`[sync-markers] Removed stale: ${f}`);
          changed = true;
        }
      }
    }
    */
  } else {
    console.log(`[sync-markers] Source not found: ${MARKERS_SRC} (vault not available)`);
  }

  // 2. Sync library.md
  if (fs.existsSync(LIBRARY_SRC)) {
    const srcContent = fs.readFileSync(LIBRARY_SRC, "utf8");
    const dstOld = fs.existsSync(LIBRARY_DST) ? fs.readFileSync(LIBRARY_DST, "utf8") : "";
    if (srcContent !== dstOld) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(LIBRARY_DST, srcContent, "utf8");
      console.log("[sync-markers] Updated: library.md");
      changed = true;
    }
  }

  // 2.5 Sync assets.md (icon profiles)
  if (fs.existsSync(ASSETS_SRC)) {
    const srcContent = fs.readFileSync(ASSETS_SRC, "utf8");
    const dstOld = fs.existsSync(ASSETS_DST) ? fs.readFileSync(ASSETS_DST, "utf8") : "";
    if (srcContent !== dstOld) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(ASSETS_DST, srcContent, "utf8");
      console.log("[sync-markers] Updated: assets.md");
      changed = true;
    }
  }

  // 3. Sync icons.json if it exists
  const iconsSrc = path.join(PUBLISH_DIR, "icons.json");
  if (fs.existsSync(iconsSrc)) {
    const srcContent = fs.readFileSync(iconsSrc, "utf8");
    const dstOld = fs.existsSync(ICONS_DST) ? fs.readFileSync(ICONS_DST, "utf8") : "";
    if (srcContent !== dstOld) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(ICONS_DST, srcContent, "utf8");
      console.log("[sync-markers] Updated: icons.json");
      changed = true;
    }
  }

  if (changed) {
    console.log("[sync-markers] Done – data updated.");
  } else {
    console.log("[sync-markers] Done – no changes.");
  }
}

main();
