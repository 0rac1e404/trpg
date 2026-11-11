/**
 * Master sync script: syncs markers from vault, builds zoom-map-static.js,
 * and copies everything into the trpg repo.
 *
 * Run this before building / deploying to make sure all Zoom Map data is
 * up to date.
 *
 * Usage:
 *   node scripts/sync-all.js
 */

const { execSync } = require("child_process");

console.log("=== Zoom Map Sync All ===");

// 1. Sync markers & library from Obsidian vault
console.log("\n[1/4] Syncing markers from vault...");
try {
  execSync("node scripts/sync-markers.js", { stdio: "inherit" });
} catch (err) {
  console.error("sync-markers failed, but continuing.");
}

// 1b. Sync SVGs referenced by the marker notes
console.log("\n[2/4] Syncing SVGs from vault...");
try {
  execSync("node scripts/sync-svgs.js", { stdio: "inherit" });
} catch (err) {
  console.error("sync-svgs failed, but continuing.");
}

// 1c. Sync map assets (SVG + markers.json) at their vault paths
console.log("\n[3/4] Syncing map assets from vault...");
try {
  execSync("node scripts/sync-zoommap-assets.js", { stdio: "inherit" });
} catch (err) {
  console.error("sync-zoommap-assets failed, but continuing.");
}

// 2. Build zoom-map-static.js and copy
console.log("\n[4/4] Building zoom-map-static.js...");
try {
  execSync("node scripts/sync-zoommap-build.js", { stdio: "inherit" });
} catch (err) {
  console.error("sync-zoommap-build failed, but continuing.");
}

console.log("\n=== Done ===");
