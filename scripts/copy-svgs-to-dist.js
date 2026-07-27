/**
 * Post-build: copy excalidraw SVG files into dist.
 *
 * Source: zoom-map-data/assets/excalidraw/ (DG-safe, committed to git)
 * Dest:   dist/  (same relative path under dist)
 *
 * This bypasses Eleventy passthroughCopy which fails with spaces in filenames
 * on Linux, and is immune to Digital Garden's auto-delete of SVGs.
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const assetSrc = path.join(repoRoot, "zoom-map-data", "assets", "excalidraw");
const distDir = path.join(repoRoot, "dist");

if (!fs.existsSync(assetSrc)) {
  console.log("  [copy-svgs] No DG-safe SVG assets directory.");
  return;
}

// Recursively walk and copy
function walkAndCopy(srcBase, relPath) {
  const fullSrc = relPath ? path.join(srcBase, relPath) : srcBase;
  const entries = fs.readdirSync(fullSrc, { withFileTypes: true });

  for (const ent of entries) {
    const childRel = relPath ? path.join(relPath, ent.name) : ent.name;
    const childSrc = path.join(srcBase, childRel);

    if (ent.isDirectory()) {
      walkAndCopy(srcBase, childRel);
    } else if (ent.name.toLowerCase().endsWith(".svg")) {
      const dest = path.join(distDir, childRel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(childSrc, dest);
      const size = fs.statSync(dest).size;
      console.log(`  [copy-svgs] ${childRel} → dist (${size} bytes)`);
    }
  }
}

walkAndCopy(assetSrc, "");
console.log("  [copy-svgs] Done.");
