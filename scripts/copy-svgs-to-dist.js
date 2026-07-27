/**
 * Post-build: copy excalidraw SVG files from src/site/notes into dist
 * (workaround for Eleventy passthroughCopy failing with spaces in filenames on Linux)
 */
const fs = require("fs");
const path = require("path");
const { globSync } = require("glob");

const notesDir = path.resolve(__dirname, "..", "src", "site", "notes");
const distDir = path.resolve(__dirname, "..", "dist");

const svgFiles = globSync("**/*.svg", { cwd: notesDir });

for (const rel of svgFiles) {
  const src = path.join(notesDir, rel);
  const dest = path.join(distDir, rel);
  const destParent = path.dirname(dest);

  if (!fs.existsSync(destParent)) {
    fs.mkdirSync(destParent, { recursive: true });
  }

  fs.copyFileSync(src, dest);
  const stat = fs.statSync(dest);
  console.log(`  [copy-svgs] ${rel} → ${dest} (${stat.size} bytes)`);
}

if (svgFiles.length === 0) {
  console.log("  [copy-svgs] No SVG files found in notes.");
}
