/**
 * Auto-deploy ZoomMap data: sync vault data into the repo, commit, push.
 *
 * Invoked in the background by the TTRPG-Tools-Publish plugin after it has
 * synced zoom-map-data/ (see src/main.ts syncToTrpgRepo). Also safe to run
 * manually: exits quietly when there is nothing to deploy.
 *
 * What it does:
 *   1. Runs the full data sync from the vault (markers, SVGs, assets) -
 *      covering the steps the plugin itself does not do.
 *   2. Commits zoom-map-data changes if any.
 *   3. Pushes with retries (the git proxy / Clash may be down); failed
 *      pushes leave the commit local and the next trigger re-pushes it.
 *
 * Log: .cache/deploy-zoommap.log (gitignored).
 *
 * Usage: node scripts/deploy-zoommap.js
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const LOG = path.join(REPO, ".cache", "deploy-zoommap.log");
const LOCK = path.join(REPO, ".cache", "deploy-zoommap.lock");
const RETRIES = 3;
const RETRY_DELAY_MS = 15000;
const LOCK_MAX_AGE_MS = 120000;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try {
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    fs.appendFileSync(LOG, line + "\n");
  } catch { /* ignore */ }
  console.log(msg);
}

function run(cmd) {
  return execSync(cmd, {
    cwd: REPO,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120000,
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Prevent concurrent runs when markers.json changes fire in quick succession. */
function acquireLock() {
  try {
    const st = fs.statSync(LOCK);
    if (Date.now() - st.mtimeMs < LOCK_MAX_AGE_MS) return false;
  } catch { /* no lock */ }
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  fs.writeFileSync(LOCK, String(process.pid));
  return true;
}

function releaseLock() {
  try { fs.unlinkSync(LOCK); } catch { /* ignore */ }
}

async function main() {
  if (!acquireLock()) {
    log("another deploy is running - skipped");
    return;
  }
  try {
    // 1. Full sync from the vault (includes library.md / assets.md /
    //    markers.json which the plugin itself does not copy).
    for (const s of ["sync-markers.js", "sync-svgs.js", "sync-zoommap-assets.js"]) {
      try {
        run(`node scripts/${s}`);
      } catch (e) {
        log(`sync step failed (${s}): ${String(e.message || e).split("\n")[0].slice(0, 160)}`);
      }
    }

    // 2. Commit if zoom-map-data changed.
    run("git add -A -- zoom-map-data");
    const status = run("git status --porcelain -- zoom-map-data");
    if (status.trim()) {
      run(`git commit -m "sync: zoom-map data (auto deploy)"`);
      log("committed zoom-map-data changes");
    }

    // 3. Push (also carries commits left over from earlier failed pushes).
    try { run("git fetch origin"); } catch { /* offline is fine */ }
    const ahead = () => {
      try {
        return parseInt(run("git rev-list --count origin/main..main").trim(), 10) || 0;
      } catch { return 0; }
    };
    let pushed = false;
    for (let i = 1; i <= RETRIES && !pushed; i++) {
      try {
        run("git push origin main");
        pushed = true;
        log(`pushed (attempt ${i})`);
      } catch (e) {
        log(`push attempt ${i} failed: ${String(e.message || e).split("\n")[0].slice(0, 160)}`);
        if (i < RETRIES) await sleep(RETRY_DELAY_MS);
      }
    }
    if (pushed) {
      log("deploy ok");
    } else {
      log(`PUSH FAILED after ${RETRIES} attempts - ${ahead()} commit(s) waiting. ` +
        `Check that the proxy is running; the next trigger will retry.`);
    }
  } finally {
    releaseLock();
  }
}

main().catch((e) => {
  log(`deploy crashed: ${String(e.message || e).slice(0, 200)}`);
  releaseLock();
});
