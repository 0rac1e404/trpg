const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

// ============================================================
// Zoom Map: set your Obsidian vault root path
// Change this if your vault is NOT at E:/TEST
// ============================================================
const ZM_VAULT_PATH = "E:/TEST";

// FNV-1a 32-bit hash (same as TTRPG-Tools-Publish plugin)
function fnv1a32(input) {
  var h = 2166136261;
  for (var i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (Math.imul(h, 16777619) | 0) >>> 0;
  }
  return h.toString(16);
}

function normalizeForHash(str) {
  return String(str)
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    .toLowerCase();
}

function hashPathToId(p) {
  return fnv1a32(normalizeForHash(p));
}

// Read JSON from a vault data note (markdown with frontmatter + ```json block)
function readMapData(vaultRelPath) {
  var fullPath = path.join(ZM_VAULT_PATH, vaultRelPath);
  if (!fs.existsSync(fullPath)) return null;
  var raw = fs.readFileSync(fullPath, "utf8");

  // Try frontmatter.zoommapData (legacy format)
  var parsed = matter(raw);
  if (parsed.data.zoommapData) {
    var d = parsed.data.zoommapData;
    return typeof d === "string" ? d : JSON.stringify(d);
  }

  // Try ```json code block in body
  var m = raw.match(/```json\s*\n([\s\S]*?)\n```/);
  if (m) return m[1];

  // Fallback: body content minus frontmatter
  if (parsed.content.trim()) return parsed.content.trim();
  return null;
}

function userMarkdownSetup(md) {
  // The md parameter stands for the markdown-it instance used throughout the site generator.
  // Feel free to add any plugin you want here instead of /.eleventy.js
}

function userEleventySetup(eleventyConfig) {
  // ============================================================
  // Auto-inject zoom-map marker data when dg-map: true
  // ============================================================
  eleventyConfig.addTransform(
    "zoom-map-data-inject",
    function (content, outputPath) {
      if (!outputPath || !outputPath.endsWith(".html")) return content;

      var inputPath = this.inputPath;
      if (!inputPath || !inputPath.endsWith(".md")) return content;

      var raw;
      try { raw = fs.readFileSync(inputPath, "utf8"); }
      catch (_e) { return content; }

      var parsed = matter(raw);
      if (!parsed.data["dg-map"] && !parsed.data.dgMap) return content;

      // Find zoommap code blocks in source markdown
      var zmRegex = /```zoommap\s*\r?\n([\s\S]*?)```/g;
      var m;
      var markersSeen = new Set();
      var scripts = [];

      while ((m = zmRegex.exec(raw)) !== null) {
        var yamlText = m[1];
        var mkMatch = yamlText.match(
          /^markers:\s*["']?([^\n\r"']+)["']?\s*$/m
        );
        if (!mkMatch) continue;
        var markersPath = mkMatch[1].trim();
        if (markersSeen.has(markersPath)) continue;
        markersSeen.add(markersPath);

        var noteId =
          "ZoomMap/publish/markers/m-" + hashPathToId(markersPath);
        var jsonData = readMapData(noteId + ".md");
        if (jsonData) {
          var safeId = "zm-nd-" + noteId.replace(/[^a-zA-Z0-9]/g, "-");
          scripts.push(
            '<script type="application/json" id="' +
              safeId +
              '">' +
              jsonData +
              "</script>"
          );
        } else {
          console.warn(
            "[zoom-map] Data not found in vault:", noteId + ".md"
          );
        }
      }

      // Also inject library data
      var libJson = readMapData("ZoomMap/publish/library.md");
      if (libJson) {
        scripts.push(
          '<script type="application/json" id="zm-nd-ZoomMap-publish-library">' +
            libJson +
            "</script>"
        );
      }

      // Always inject the runtime script + any data when dg-map is true
      var injection =
        '\n<!-- Zoom Map runtime + data (auto-injected via dg-map) -->\n' +
        '<script src="/scripts/zoom-map-static.js" defer></script>\n' +
        scripts.join("\n") +
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
