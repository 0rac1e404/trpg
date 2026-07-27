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
console.log("\n[1/2] Syncing markers from vault...");
try {
  execSync("node scripts/sync-markers.js", { stdio: "inherit" });
} catch (err) {
  console.error("sync-markers failed, but continuing.");
}

// 2. Build zoom-map-static.js and copy
console.log("\n[2/2] Building zoom-map-static.js...");
try {
  execSync("node scripts/sync-zoommap-build.js", { stdio: "inherit" });
} catch (err) {
  console.error("sync-zoommap-build failed, but continuing.");
}

console.log("\n=== Done ===");
