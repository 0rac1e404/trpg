const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

// ============================================================
// Zoom Map data: stored in repo at <repoRoot>/zoom-map-data/
// To update: copy {vault}/ZoomMap/publish/* → zoom-map-data/
//   e.g. robocopy E:\TEST\ZoomMap\publish E:\git\trpg\zoom-map-data /E
// ============================================================
const ZM_DATA_DIR = path.resolve(__dirname, "..", "..", "zoom-map-data");

// ---- Build markers lookup: markersPath → JSON data ----

var _markersCache = null;

function buildMarkersLookup() {
  if (_markersCache !== null) return _markersCache;

  var lookup = {};
  var markersDir = path.join(ZM_DATA_DIR, "markers");
  if (!fs.existsSync(markersDir)) {
    _markersCache = lookup;
    return lookup;
  }

  var files = fs.readdirSync(markersDir);
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (!f.endsWith(".md")) continue;
    var fullPath = path.join(markersDir, f);
    try {
      var raw = fs.readFileSync(fullPath, "utf8");
      var parsed = matter(raw);
      var mp = parsed.data.zoommapMarkersPath;
      if (!mp) continue;

      // Extract JSON from ```json code block in body
      var jsonMatch = raw.match(/```json\s*\r?\n([\s\S]*?)\n```/);
      var jsonText = jsonMatch ? jsonMatch[1] : null;

      // Fallback: if content itself is JSON
      if (!jsonText && parsed.content.trim()) {
        jsonText = parsed.content.trim();
      }

      if (!jsonText) continue;

      // Validate it parses as JSON
      try {
        JSON.parse(jsonText);
      } catch (_e) {
        console.warn("[zoom-map] Invalid JSON in", fullPath);
        continue;
      }

      lookup[mp] = jsonText;
    } catch (err) {
      console.warn("[zoom-map] Error reading", fullPath, err.message);
    }
  }

  _markersCache = lookup;
  return lookup;
}

// ---- Encode path as safe DOM id (must match static-entry.ts safeDataId) ----

function safeDataId(str) {
  return (
    "zm-data-" +
    Buffer.from(str, "utf8")
      .toString("base64")
      .replace(/[+/=]/g, "_")
  );
}

// ---- Extract markers paths from raw markdown ----

function extractMarkersPaths(rawMd) {
  var zmRegex = /```zoommap\s*\r?\n([\s\S]*?)```/g;
  var m;
  var paths = [];

  while ((m = zmRegex.exec(rawMd)) !== null) {
    var yamlText = m[1];
    var mkMatch = yamlText.match(
      /^markers:\s*["']?([^\n\r"']+)["']?\s*$/m
    );
    if (mkMatch) {
      paths.push(mkMatch[1].trim());
    }
  }

  return paths;
}

// ============================================================
// Eleventy setup
// ============================================================

function userMarkdownSetup(md) {
  // The md parameter stands for the markdown-it instance used throughout the site generator.
  // Feel free to add any plugin you want here instead of /.eleventy.js
}

function userEleventySetup(eleventyConfig) {
  // ============================================================
  // Auto-inject zoom-map script + embedded marker data when dg-map: true
  // ============================================================
  eleventyConfig.addTransform(
    "zoom-map-data-inject",
    function (content, outputPath) {
      if (!outputPath || !outputPath.endsWith(".html")) return content;

      var inputPath = this.inputPath;
      if (!inputPath || !inputPath.endsWith(".md")) return content;

      var raw;
      try {
        raw = fs.readFileSync(inputPath, "utf8");
      } catch (_e) {
        return content;
      }

      // Auto-detect: if the page contains a zoommap code block, inject the script
      if (!raw.includes("```zoommap") && !raw.includes("``` zoommap")) return content;

      // Extract markers paths from zoommap code blocks
      var markersPaths = extractMarkersPaths(raw);
      if (markersPaths.length === 0) {
        // Still inject script even without markers (page may use other map formats)
        var scriptOnly =
          '\n<!-- Zoom Map runtime (no markers data needed) -->\n' +
          '<script src="/scripts/zoom-map-static.js" defer></script>\n';
        if (content.includes("</body>")) {
          return content.replace("</body>", scriptOnly + "</body>");
        }
        return content + scriptOnly;
      }

      // Build lookup and embed matching data
      var lookup = buildMarkersLookup();
      var dataScripts = [];
      var seen = new Set();

      for (var i = 0; i < markersPaths.length; i++) {
        var mp = markersPaths[i];
        if (seen.has(mp)) continue;
        seen.add(mp);

        var jsonData = lookup[mp];
        if (jsonData) {
          var id = safeDataId(mp);
          dataScripts.push(
            '<script type="application/json" id="' +
              id +
              '">' +
              jsonData +
              "</script>"
          );
          console.log("[zoom-map] Embedded markers data for:", mp);
        } else {
          console.warn(
            "[zoom-map] No markers data found for:",
            mp,
            "- available keys:",
            Object.keys(lookup)
          );
        }
      }

      // Always inject the runtime script + embedded data
      var injection =
        "\n<!-- Zoom Map (auto-injected via dg-map) -->\n" +
        '<script src="/scripts/zoom-map-static.js" defer></script>\n' +
        dataScripts.join("\n") +
        "\n";

      if (content.includes("</body>")) {
        return content.replace("</body>", injection + "</body>");
      }
      return content + injection;
    }
  );
}

exports.userMarkdownSetup = userMarkdownSetup;
exports.userEleventySetup = userEleventySetup;
