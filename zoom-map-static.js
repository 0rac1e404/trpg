"use strict";
(() => {
  // src/static-render.ts
  var NS = "http://www.w3.org/2000/svg";
  var _pageIndexCache = void 0;
  function getPageNameIndex() {
    if (_pageIndexCache !== void 0) return _pageIndexCache;
    try {
      const el2 = document.getElementById("zm-data-zm-page-index");
      if (el2 && el2.textContent) {
        _pageIndexCache = JSON.parse(el2.textContent);
        return _pageIndexCache;
      }
    } catch (_e) {
    }
    _pageIndexCache = null;
    return null;
  }
  function normalizeLink(link) {
    if (!link) return link;
    if (link.startsWith("http://") || link.startsWith("https://") || link.startsWith("#")) return link;
    let p = link.replace(/\.md$/i, "");
    if (!p.includes("/")) {
      const index = getPageNameIndex();
      if (index && index[p]) {
        return index[p];
      }
    }
    if (!p.startsWith("/")) p = "/" + p;
    if (!p.endsWith("/") && !/\.[a-zA-Z0-9]+$/.test(p)) p += "/";
    if (!p.includes("/", 1)) {
      const bare = p.replace(/^\/|\/$/g, "");
      const index = getPageNameIndex();
      if (index && index[bare]) {
        return index[bare];
      }
    }
    return p;
  }
  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
  var pagePreviewCache = /* @__PURE__ */ new Map();
  function sanitizeHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    for (const el2 of div.querySelectorAll("script, style, iframe, object, embed, link, svg")) el2.remove();
    for (const el2 of div.querySelectorAll("*")) {
      for (const attr of [...el2.attributes]) {
        if (attr.name.startsWith("on")) el2.removeAttribute(attr.name);
        if (attr.name === "href" && /^javascript:/i.test(attr.value)) el2.removeAttribute(attr.name);
      }
    }
    return div.innerHTML;
  }
  function truncateHtml(html, maxChars) {
    const div = document.createElement("div");
    div.innerHTML = html;
    let count = 0;
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent || "";
      const remaining = maxChars - count;
      if (remaining <= 0) {
        node.textContent = "";
        const next = walker.nextNode();
        if (next) {
          let parent = next;
          while (parent && parent !== div) {
            let sibling = parent.nextSibling;
            while (sibling) {
              const s = sibling;
              sibling = sibling.nextSibling;
              s.remove();
            }
            parent = parent.parentNode;
          }
          next.textContent = "";
        }
        return div.innerHTML;
      }
      if (count + text.length > remaining) {
        node.textContent = text.slice(0, remaining) + "\u2026";
        let parent = node;
        while (parent && parent !== div) {
          let sibling = parent.nextSibling;
          while (sibling) {
            const s = sibling;
            sibling = sibling.nextSibling;
            s.remove();
          }
          parent = parent.parentNode;
        }
        return div.innerHTML;
      }
      count += text.length;
      node = walker.nextNode();
    }
    return div.innerHTML;
  }
  async function fetchPagePreview(url) {
    if (pagePreviewCache.has(url)) return pagePreviewCache.get(url);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const html = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const contentEl = doc.querySelector(".content") || doc.querySelector("article") || doc.querySelector("main");
      if (!contentEl) {
        pagePreviewCache.set(url, "");
        return "";
      }
      const clone = contentEl.cloneNode(true);
      for (const h of clone.querySelectorAll("h1, h2")) h.remove();
      for (const el2 of clone.querySelectorAll("nav, aside, footer, header, .backlinks, .graph, .toc, .search-container, .breadcrumbs, .markdown-embed-title")) el2.remove();
      const sanitized = sanitizeHtml(clone.innerHTML);
      const truncated = truncateHtml(sanitized, 500);
      pagePreviewCache.set(url, truncated);
      return truncated;
    } catch (_err) {
      pagePreviewCache.set(url, "");
      return "";
    }
  }
  var globalActiveTip = null;
  function buildTooltipContent(m, previewHtml) {
    const hasTooltip = !!m.tooltip;
    let html = "";
    if (hasTooltip) {
      html += `<div class="zm-st-tooltip-title">${escapeHtml(m.tooltip)}</div>`;
    }
    if (previewHtml !== void 0) {
      if (previewHtml) {
        html += `<div class="zm-st-preview-html">${previewHtml}</div>`;
      }
    } else {
      html += `<div class="zm-st-preview-loading">Loading preview\u2026</div>`;
    }
    return html || `<div class="zm-st-tooltip-title">${escapeHtml(m.name || "")}</div>`;
  }
  function el(tag, parent, attrs, cls) {
    const e = parent.ownerDocument.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent.appendChild(e);
    return e;
  }
  function createSvgEl(tag, parent, attrs) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent.appendChild(e);
    return e;
  }
  function svgEl(tag, parent, attrs) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent.appendChild(e);
    return e;
  }
  var previewCssInjected = false;
  function injectPreviewCss() {
    if (previewCssInjected) return;
    previewCssInjected = true;
    const style = document.createElement("style");
    style.id = "zm-st-preview-css";
    style.textContent = `
/* Zoom Map static \u2013 tooltip hover preview (matches Digital Garden #tooltip-wrapper) */
.zm-st-tooltip {
  background: var(--background-primary);
  padding: 1em;
  border-radius: 4px;
  overflow: hidden;
  position: fixed;
  max-width: 400px;
  height: auto;
  max-height: 300px;
  font-size: 0.8em;
  box-shadow: 0 5px 10px rgba(0,0,0,0.1);
  z-index: 99999;
  pointer-events: auto;
  overflow-y: auto;
  color: var(--text-normal);
  line-height: 1.5;
  opacity: 0;
  transition: opacity 100ms;
  unicode-bidi: plaintext;
}

.zm-st-tooltip.zm-st-tooltip-visible {
  opacity: 1;
}

.zm-st-tooltip .zm-st-tooltip-title {
  font-weight: 600;
  margin-bottom: 0.5em;
  unicode-bidi: plaintext;
  font-size: 1.05em;
  color: var(--text-accent);
}

.zm-st-tooltip .zm-st-preview-html {
  /* Inherits site theme typography \u2014 same classes as the actual page */
}

.zm-st-tooltip .zm-st-preview-html p {
  margin: 0.5em 0;
  line-height: 1.55;
}
.zm-st-tooltip .zm-st-preview-html p:last-child {
  margin-bottom: 0;
}
.zm-st-tooltip .zm-st-preview-html strong,
.zm-st-tooltip .zm-st-preview-html b {
  color: var(--text-normal);
  font-weight: 600;
}
.zm-st-tooltip .zm-st-preview-html em,
.zm-st-tooltip .zm-st-preview-html i {
  opacity: 0.85;
}
.zm-st-tooltip .zm-st-preview-html a {
  color: var(--text-accent);
}
.zm-st-tooltip .zm-st-preview-html h3,
.zm-st-tooltip .zm-st-preview-html h4,
.zm-st-tooltip .zm-st-preview-html h5,
.zm-st-tooltip .zm-st-preview-html h6 {
  font-size: 0.95em;
  font-weight: 600;
  margin: 0.6em 0 0.25em;
}
.zm-st-tooltip .zm-st-preview-html ul,
.zm-st-tooltip .zm-st-preview-html ol {
  padding-left: 1.5em;
  margin: 0.4em 0;
}
.zm-st-tooltip .zm-st-preview-html li {
  margin-bottom: 2px;
}
.zm-st-tooltip .zm-st-preview-html blockquote {
  border-left: 3px solid var(--background-modifier-border, rgba(255,255,255,0.22));
  padding-left: 10px;
  margin: 6px 0;
  opacity: 0.85;
}
.zm-st-tooltip .zm-st-preview-html hr {
  border-color: var(--background-modifier-border, rgba(255,255,255,0.12));
  margin: 6px 0;
}
.zm-st-tooltip .zm-st-preview-html del,
.zm-st-tooltip .zm-st-preview-html s {
  opacity: 0.6;
}
.zm-st-tooltip .zm-st-preview-html mark {
  background: var(--text-highlight-bg, rgba(255,200,80,0.25));
  padding: 0 2px;
  border-radius: 2px;
}
.zm-st-tooltip .zm-st-preview-html code {
  background: var(--background-secondary);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.9em;
}
.zm-st-tooltip .zm-st-preview-html pre {
  background: var(--background-secondary);
  padding: 0.6em;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.85em;
}
.zm-st-tooltip .zm-st-preview-html table {
  font-size: 0.85em;
  border-collapse: collapse;
}
.zm-st-tooltip .zm-st-preview-html th,
.zm-st-tooltip .zm-st-preview-html td {
  border: 1px solid var(--background-modifier-border, rgba(255,255,255,0.15));
  padding: 3px 6px;
}

.zm-st-preview-loading {
  font-size: 0.85em;
  opacity: 0.55;
  color: var(--text-muted);
}
`;
    document.head.appendChild(style);
  }
  var StaticMap = class {
    /* ---- lifecycle ---- */
    constructor(container) {
      this.markers = [];
      this.iconMap = /* @__PURE__ */ new Map();
      this.overlays = [];
      this.clsPfx = "zm-st";
      /* state */
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
      this.imgW = 0;
      this.imgH = 0;
      this.ready = false;
      this.imgLoaded = false;
      /* grid */
      this.gridSvg = null;
      this.gridStaticLayer = null;
      /* interaction state */
      this.dragging = false;
      this.dragStart = { x: 0, y: 0 };
      this.dragTx0 = 0;
      this.dragTy0 = 0;
      this.lastPinchDist = 0;
      this.lastPinchScale = 1;
      /* marker hover / popover */
      this.activePopover = null;
      this.activeMarkerEl = null;
      /* ---- tooltip with page-content preview ---- */
      this.tooltipEl = null;
      this.tooltipHost = null;
      /** Unique id per marker so we can discard stale async preview responses */
      this.tooltipMarkerId = "";
      this.tooltipTimer = null;
      this.tooltipPreviewFetched = false;
      this.handleResize = () => {
        if (!this.ready) return;
        if (this.cfg.responsive) {
          const z = this.calcFitScale();
          this.scale = z;
          const vw = this.viewport.clientWidth || 1;
          const vh = this.viewport.clientHeight || 1;
          this.tx = vw / 2 - this.imgW / 2 * this.scale;
          this.ty = vh / 2 - this.imgH / 2 * this.scale;
          this.applyTransform();
          this.renderMarkers();
        }
      };
      this.onPointerDown = (e) => {
        if (e.button !== 0) return;
        this.dragging = true;
        this.dragStart = this.getEventPos(e);
        this.dragTx0 = this.tx;
        this.dragTy0 = this.ty;
        this.viewport.style.cursor = "grabbing";
        this.closePopover();
      };
      this.onPointerMove = (e) => {
        if (!this.dragging) return;
        const p = this.getEventPos(e);
        this.tx = this.dragTx0 + (p.x - this.dragStart.x);
        this.ty = this.dragTy0 + (p.y - this.dragStart.y);
        this.applyTransform();
        if (this.tooltipEl) {
          const r = this.viewport.getBoundingClientRect();
          this.tooltipEl.style.left = `${r.left + p.x}px`;
          this.tooltipEl.style.top = `${r.top + p.y - 30}px`;
        }
      };
      this.onPointerUp = () => {
        this.dragging = false;
        this.viewport.style.cursor = "grab";
      };
      /* ---- touch ---- */
      this.activeTouches = /* @__PURE__ */ new Map();
      this.onTouchStart = (e) => {
        if (e.touches.length === 1) {
          e.preventDefault();
          const t = e.touches[0];
          const r = this.viewport.getBoundingClientRect();
          const p = { x: t.clientX - r.left, y: t.clientY - r.top };
          this.activeTouches.set(t.identifier, p);
          this.dragging = true;
          this.dragStart = p;
          this.dragTx0 = this.tx;
          this.dragTy0 = this.ty;
        } else if (e.touches.length === 2) {
          e.preventDefault();
          this.dragging = false;
          const t0 = e.touches[0];
          const t1 = e.touches[1];
          const dx = t1.clientX - t0.clientX;
          const dy = t1.clientY - t0.clientY;
          this.lastPinchDist = Math.sqrt(dx * dx + dy * dy);
          this.lastPinchScale = this.scale;
        }
      };
      this.onTouchMove = (e) => {
        if (e.touches.length === 1 && this.dragging) {
          e.preventDefault();
          const t = e.touches[0];
          const r = this.viewport.getBoundingClientRect();
          const p = { x: t.clientX - r.left, y: t.clientY - r.top };
          this.tx = this.dragTx0 + (p.x - this.dragStart.x);
          this.ty = this.dragTy0 + (p.y - this.dragStart.y);
          this.applyTransform();
        } else if (e.touches.length === 2) {
          e.preventDefault();
          const t0 = e.touches[0];
          const t1 = e.touches[1];
          const dx = t1.clientX - t0.clientX;
          const dy = t1.clientY - t0.clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const cx = (t0.clientX + t1.clientX) / 2;
          const cy = (t0.clientY + t1.clientY) / 2;
          if (this.lastPinchDist > 0) {
            const factor = dist / this.lastPinchDist;
            this.zoomAt(
              factor,
              cx - this.viewport.getBoundingClientRect().left,
              cy - this.viewport.getBoundingClientRect().top
            );
            this.lastPinchDist = dist;
            this.lastPinchScale = this.scale;
          }
        }
      };
      this.onTouchEnd = (e) => {
        if (e.touches.length === 0) {
          this.dragging = false;
          this.activeTouches.clear();
        }
      };
      /* ---- wheel / dblclick ---- */
      this.onWheel = (e) => {
        e.preventDefault();
        const r = this.viewport.getBoundingClientRect();
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        this.zoomAt(factor, e.clientX - r.left, e.clientY - r.top);
      };
      this.onDblClick = (e) => {
        const r = this.viewport.getBoundingClientRect();
        this.zoomAt(1.5, e.clientX - r.left, e.clientY - r.top);
      };
      var _a;
      injectPreviewCss();
      this.container = container;
      container.classList.add("zm-static-root");
      this.cfg = this.loadConfig(container);
      this.markers = this.loadMarkers(container);
      this.imgW = this.cfg.imgW || 0;
      this.imgH = this.cfg.imgH || 0;
      for (const ip of this.cfg.iconProfiles) this.iconMap.set(ip.key, ip);
      this.overlays = (_a = this.cfg.overlays) != null ? _a : [];
      this.buildDom();
      this.attachEvents();
      void this.loadBaseImage().then(() => {
        this.ready = true;
        this.applyInitialView();
        this.renderMarkers();
        this.renderOverlays();
        this.renderGrid();
      });
      this.handleResize();
    }
    destroy() {
      this.closePopover();
    }
    /* ---- config loading ---- */
    loadConfig(container) {
      const dataCfg = container.getAttribute("data-zm-config");
      if (dataCfg) {
        try {
          return JSON.parse(dataCfg);
        } catch (e) {
        }
      }
      const script = container.querySelector("script.zm-config-json");
      if (script == null ? void 0 : script.textContent) {
        try {
          return JSON.parse(script.textContent);
        } catch (e) {
        }
      }
      return this.loadConfigFromAttrs(container);
    }
    loadConfigFromAttrs(container) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      const get = (key) => container.getAttribute(`data-zm-${key}`);
      const imageUrl = (_a = get("imageurl")) != null ? _a : "";
      const markersUrl = (_b = get("markersurl")) != null ? _b : void 0;
      const iconProfilesRaw = get("icons");
      const overlaysRaw = get("overlays");
      let iconProfiles = [];
      try {
        if (iconProfilesRaw) iconProfiles = JSON.parse(iconProfilesRaw);
      } catch (e) {
      }
      let overlays = [];
      try {
        if (overlaysRaw) overlays = JSON.parse(overlaysRaw);
      } catch (e) {
      }
      let initialCenter;
      const cx = get("initialcenterx");
      const cy = get("initialcentery");
      if (cx != null && cy != null) initialCenter = { x: parseFloat(cx), y: parseFloat(cy) };
      return {
        imageUrl,
        markersUrl,
        imgW: parseFloat((_c = get("imgw")) != null ? _c : "0") || 0,
        imgH: parseFloat((_d = get("imgh")) != null ? _d : "0") || 0,
        minZoom: parseFloat((_e = get("minzoom")) != null ? _e : "0.1"),
        maxZoom: parseFloat((_f = get("maxzoom")) != null ? _f : "10"),
        width: (_g = get("width")) != null ? _g : void 0,
        height: (_h = get("height")) != null ? _h : void 0,
        align: (_i = get("align")) != null ? _i : void 0,
        initialZoom: get("initialzoom") ? parseFloat(get("initialzoom")) : void 0,
        initialCenter,
        iconProfiles,
        overlays
      };
    }
    loadMarkers(container) {
      const dataMarkers = container.getAttribute("data-zm-markers");
      if (dataMarkers) {
        try {
          return JSON.parse(dataMarkers);
        } catch (e) {
        }
      }
      const script = container.querySelector("script.zm-markers-json");
      if (script == null ? void 0 : script.textContent) {
        try {
          return JSON.parse(script.textContent);
        } catch (e) {
        }
      }
      return [];
    }
    async fetchMarkers() {
      var _a;
      if (!this.cfg.markersUrl) return [];
      try {
        const resp = await fetch(this.cfg.markersUrl);
        if (!resp.ok) return [];
        const data = await resp.json();
        return (_a = data == null ? void 0 : data.markers) != null ? _a : [];
      } catch (e) {
        console.warn("ZoomMap static: failed to load markers from", this.cfg.markersUrl, e);
        return [];
      }
    }
    /* ---- DOM construction ---- */
    buildDom() {
      this.container.style.position = "relative";
      this.container.style.overflow = "hidden";
      if (this.cfg.width) this.container.style.width = this.cfg.width;
      if (this.cfg.height) this.container.style.height = this.cfg.height;
      this.viewport = el("div", this.container, {}, "zm-st-viewport");
      this.viewport.style.cssText = "position:absolute;inset:0;overflow:hidden;cursor:grab;";
      if (this.cfg.responsive) {
        const aspect = this.cfg.imgW / this.cfg.imgH;
        this.viewport.style.position = "relative";
        this.viewport.style.width = "100%";
        this.viewport.style.aspectRatio = String(aspect);
      }
      this.world = el("div", this.viewport, {}, "zm-st-world");
      this.world.style.cssText = "position:absolute;transform-origin:0 0;will-change:transform;";
      this.imgEl = el("img", this.world);
      this.imgEl.style.cssText = "position:absolute;top:0;left:0;display:block;pointer-events:none;user-select:none;";
      this.imgEl.draggable = false;
      this.overlaysEl = el("div", this.world, {}, "zm-st-overlays");
      this.overlaysEl.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;";
      this.markersEl = el("div", this.world, {}, "zm-st-markers");
      this.markersEl.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;";
      this.buildZoomHud();
    }
    buildZoomHud() {
      this.zoomHud = el("div", this.container, {}, "zm-st-zoomhud");
      this.zoomHud.style.cssText = "position:absolute;bottom:8px;right:8px;display:flex;align-items:center;gap:4px;background:rgba(0,0,0,0.6);color:#fff;border-radius:6px;padding:4px 8px;font-size:13px;font-family:sans-serif;z-index:100;user-select:none;";
      this.zoomOutBtn = el("button", this.zoomHud, {}, "zm-st-zoombtn");
      this.zoomOutBtn.textContent = "\u2212";
      this.zoomOutBtn.style.cssText = "background:none;border:1px solid rgba(255,255,255,0.3);color:#fff;border-radius:3px;width:24px;height:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;";
      this.zoomPercentEl = el("span", this.zoomHud);
      this.zoomPercentEl.style.cssText = "min-width:48px;text-align:center;";
      this.zoomInBtn = el("button", this.zoomHud, {}, "zm-st-zoombtn");
      this.zoomInBtn.textContent = "+";
      this.zoomInBtn.style.cssText = this.zoomOutBtn.style.cssText;
      this.zoomInBtn.onclick = () => this.zoomAt(1.3);
      this.zoomOutBtn.onclick = () => this.zoomAt(1 / 1.3);
      this.updateZoomHud();
    }
    /* ---- base image loading ---- */
    async loadBaseImage() {
      if (!this.cfg.imageUrl) return;
      return new Promise((resolve) => {
        this.imgEl.onload = () => {
          if (!this.imgW || !this.imgH) {
            this.imgW = this.imgEl.naturalWidth;
            this.imgH = this.imgEl.naturalHeight;
          }
          this.imgLoaded = true;
          this.world.style.width = `${this.imgW}px`;
          this.world.style.height = `${this.imgH}px`;
          resolve();
        };
        this.imgEl.onerror = () => resolve();
        this.imgEl.src = this.cfg.imageUrl;
      });
    }
    /* ---- initial view ---- */
    applyInitialView() {
      var _a, _b;
      if (this.cfg.initialViewRect) {
        this.fitToRect(this.cfg.initialViewRect);
      } else {
        let z = this.cfg.initialZoom;
        if (z == null) {
          z = this.calcFitScale();
        }
        const ic = this.cfg.initialCenter;
        let cx, cy;
        if (ic && ic.x <= 1 && ic.y <= 1 && ic.x >= 0 && ic.y >= 0) {
          cx = ic.x * this.imgW;
          cy = ic.y * this.imgH;
        } else {
          cx = (_a = ic == null ? void 0 : ic.x) != null ? _a : this.imgW / 2;
          cy = (_b = ic == null ? void 0 : ic.y) != null ? _b : this.imgH / 2;
        }
        this.setView(z, cx, cy);
      }
    }
    calcFitScale() {
      const vw = this.viewport.clientWidth || 1;
      const vh = this.viewport.clientHeight || 1;
      const s = Math.min(vw / (this.imgW || 1), vh / (this.imgH || 1));
      return Math.max(this.cfg.minZoom, Math.min(this.cfg.maxZoom, s));
    }
    fitToRect(r) {
      const rw = r.right - r.left;
      const rh = r.bottom - r.top;
      if (rw <= 0 || rh <= 0) return;
      const vw = this.viewport.clientWidth || 1;
      const vh = this.viewport.clientHeight || 1;
      const s = Math.min(vw / rw, vh / rh);
      const cx = r.left + rw / 2;
      const cy = r.top + rh / 2;
      this.setView(s, cx, cy);
    }
    fitToView() {
      const z = this.calcFitScale();
      this.setView(z, this.imgW / 2, this.imgH / 2);
    }
    /* ---- view control ---- */
    setView(scale, worldCx, worldCy) {
      this.scale = Math.max(this.cfg.minZoom, Math.min(this.cfg.maxZoom, scale));
      const vw = this.viewport.clientWidth || 1;
      const vh = this.viewport.clientHeight || 1;
      this.tx = vw / 2 - worldCx * this.scale;
      this.ty = vh / 2 - worldCy * this.scale;
      this.applyTransform();
    }
    zoomAt(factor, cx, cy) {
      const vw = this.viewport.clientWidth || 1;
      const vh = this.viewport.clientHeight || 1;
      const sx = cx != null ? cx : vw / 2;
      const sy = cy != null ? cy : vh / 2;
      const worldX = (sx - this.tx) / this.scale;
      const worldY = (sy - this.ty) / this.scale;
      const newScale = Math.max(
        this.cfg.minZoom,
        Math.min(this.cfg.maxZoom, this.scale * factor)
      );
      if (newScale === this.scale) return;
      this.tx = sx - worldX * newScale;
      this.ty = sy - worldY * newScale;
      this.scale = newScale;
      this.applyTransform();
      this.renderMarkers();
      this.updateZoomHud();
    }
    applyTransform() {
      this.world.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
      if (this.gridSvg) this.updateGridTransform();
    }
    /* ---- marker rendering ---- */
    renderMarkers() {
      var _a, _b, _c, _d, _e, _f;
      this.closePopover();
      while (this.markersEl.firstChild) this.markersEl.removeChild(this.markersEl.firstChild);
      const s = this.scale;
      for (const m of this.markers) {
        if (m.minZoom !== void 0 && s < m.minZoom) continue;
        if (m.maxZoom !== void 0 && s > m.maxZoom) continue;
        const icon = this.iconMap.get((_a = m.iconKey) != null ? _a : "__default__");
        if (!icon && !m.iconKey) {
          this.renderSimpleMarker(m);
          continue;
        }
        if (!icon) {
          this.renderSimpleMarker(m);
          continue;
        }
        const baseSize = typeof m.sizeOverride === "number" && m.sizeOverride > 0 ? m.sizeOverride : icon.size;
        const scaleMul = (_b = m.scale) != null ? _b : 1;
        const size = baseSize * scaleMul;
        const ax = icon.anchorX;
        const ay = icon.anchorY;
        const leftPx = m.x * this.imgW;
        const topPx = m.y * this.imgH;
        const host = el("div", this.markersEl, {}, "zm-st-marker");
        host.style.cssText = `position:absolute;left:${leftPx}px;top:${topPx}px;pointer-events:auto;z-index:10;`;
        const anchor = el("div", host);
        anchor.style.cssText = `transform:translate(${-ax}px, ${-ay}px);`;
        const img = el("img", anchor, {}, "zm-st-marker-icon");
        img.src = icon.url;
        img.style.width = `${size}px`;
        img.style.height = "auto";
        img.draggable = false;
        img.style.pointerEvents = "none";
        if (icon.rotationDeg) {
          host.style.transform = `rotate(${icon.rotationDeg}deg)`;
        }
        if (icon.shadowEnabled) {
          const sc = (_c = icon.shadowColor) != null ? _c : "rgba(0,0,0,0.35)";
          const blur = (_d = icon.shadowBlurPx) != null ? _d : 3;
          const sx = (_e = icon.shadowOffsetXPx) != null ? _e : 1;
          const sy = (_f = icon.shadowOffsetYPx) != null ? _f : 1;
          img.style.filter = `drop-shadow(${sx}px ${sy}px ${blur}px ${sc})`;
        }
        if (m.tooltip) {
          host.title = m.tooltip;
        }
        if (m.link) {
          host.style.cursor = "pointer";
          host.addEventListener("click", (e) => {
            e.stopPropagation();
            window.open(normalizeLink(m.link), "_self");
          });
        }
        if (m.tooltip || m.link) {
          host.addEventListener("mouseenter", () => this.showTooltip(host, m));
          host.addEventListener("mouseleave", () => this.hideTooltip());
        }
      }
    }
    renderSimpleMarker(m) {
      const dot = el("div", this.markersEl, {}, "zm-st-simple-marker");
      dot.style.cssText = `position:absolute;left:${m.x * this.imgW}px;top:${m.y * this.imgH}px;width:10px;height:10px;border-radius:50%;background:#e74c3c;border:2px solid #fff;transform:translate(-5px,-5px);pointer-events:auto;z-index:10;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.3);`;
      if (m.tooltip) dot.title = m.tooltip;
      if (m.link) {
        dot.addEventListener("click", (e) => {
          e.stopPropagation();
          window.open(normalizeLink(m.link), "_self");
        });
      }
      if (m.tooltip || m.link) {
        dot.addEventListener("mouseenter", () => this.showTooltip(dot, m));
        dot.addEventListener("mouseleave", () => this.hideTooltip());
      }
    }
    showTooltip(host, m) {
      if (this.tooltipTimer) {
        clearTimeout(this.tooltipTimer);
        this.tooltipTimer = null;
      }
      if (this.tooltipEl && this.tooltipMarkerId === (m.id || "")) {
        this.tooltipEl.style.opacity = "1";
        return;
      }
      this.disposeTooltip();
      const id = m.id || "marker-" + Math.random().toString(36).slice(2);
      this.tooltipMarkerId = id;
      this.tooltipHost = host;
      this.tooltipPreviewFetched = false;
      const tip = el("div", document.body, {}, "zm-st-tooltip");
      tip.innerHTML = buildTooltipContent(m);
      this.tooltipEl = tip;
      tip.addEventListener("mouseenter", () => {
        if (this.tooltipTimer) {
          clearTimeout(this.tooltipTimer);
          this.tooltipTimer = null;
        }
        if (this.tooltipEl) this.tooltipEl.style.opacity = "1";
      });
      tip.addEventListener("mouseleave", () => this.hideTooltip());
      if (globalActiveTip && globalActiveTip.tip !== tip) {
        globalActiveTip.tip.remove();
      }
      globalActiveTip = { tip, markerId: id };
      this.repositionTooltip(host);
      requestAnimationFrame(() => {
        if (this.tooltipEl === tip) this.tooltipEl.classList.add("zm-st-tooltip-visible");
      });
      if (m.link) {
        const url = normalizeLink(m.link);
        const capturedId = id;
        fetchPagePreview(url).then((previewHtml) => {
          if (this.tooltipMarkerId !== capturedId || !this.tooltipEl) return;
          this.tooltipPreviewFetched = true;
          this.tooltipEl.innerHTML = buildTooltipContent(m, previewHtml);
          this.repositionTooltip(host);
        });
      }
    }
    repositionTooltip(host) {
      if (!this.tooltipEl) return;
      const r = host.getClientRects()[host.getClientRects().length - 1] || host.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      const gap = 12;
      const edgePadding = 10;
      const spaceBelow = viewportHeight - r.bottom;
      const spaceAbove = r.top;
      const spaceRight = viewportWidth - r.right;
      const spaceLeft = r.left;
      const placeBelow = spaceBelow >= this.tooltipEl.offsetHeight + gap;
      const placeRight = spaceRight >= this.tooltipEl.offsetWidth + gap;
      let top;
      let left;
      if (placeBelow) {
        top = r.bottom + gap;
      } else {
        top = r.top - this.tooltipEl.offsetHeight - gap;
      }
      if (placeRight) {
        left = r.left;
      } else {
        left = r.right - this.tooltipEl.offsetWidth;
      }
      if (top < edgePadding) top = edgePadding;
      if (top + this.tooltipEl.offsetHeight + edgePadding > viewportHeight) {
        top = viewportHeight - this.tooltipEl.offsetHeight - edgePadding;
      }
      if (left < edgePadding) left = edgePadding;
      if (left + this.tooltipEl.offsetWidth + edgePadding > viewportWidth) {
        left = viewportWidth - this.tooltipEl.offsetWidth - edgePadding;
      }
      this.tooltipEl.style.left = `${left}px`;
      this.tooltipEl.style.top = `${top}px`;
    }
    hideTooltip() {
      if (this.tooltipTimer) clearTimeout(this.tooltipTimer);
      this.tooltipTimer = setTimeout(() => {
        this.disposeTooltip();
      }, 120);
    }
    disposeTooltip() {
      if (this.tooltipTimer) {
        clearTimeout(this.tooltipTimer);
        this.tooltipTimer = null;
      }
      if (this.tooltipEl) {
        this.tooltipEl.remove();
        this.tooltipEl = null;
      }
      if (globalActiveTip) {
        globalActiveTip = null;
      }
      this.tooltipMarkerId = "";
      this.tooltipHost = null;
      this.tooltipPreviewFetched = false;
    }
    /* ---- popover ---- */
    closePopover() {
      if (this.activePopover) {
        this.activePopover.remove();
        this.activePopover = null;
      }
      this.activeMarkerEl = null;
    }
    /* ---- overlays ---- */
    renderOverlays() {
      for (const o of this.overlays) {
        const elm = el("img", this.overlaysEl);
        elm.src = o.url;
        elm.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;object-fit:contain;";
        elm.draggable = false;
        if (!o.visible) elm.style.display = "none";
      }
    }
    /* ---- grid ---- */
    renderGrid() {
      var _a, _b, _c;
      if (!((_a = this.cfg.grid) == null ? void 0 : _a.visible)) return;
      this.gridSvg = svgEl("svg", this.world, {
        width: String(this.imgW),
        height: String(this.imgH)
      });
      this.gridSvg.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:50;";
      this.gridSvg.setAttribute("viewBox", `0 0 ${this.imgW} ${this.imgH}`);
      this.gridStaticLayer = createSvgEl("g", this.gridSvg);
      const g = this.cfg.grid;
      const color = (_b = g.color) != null ? _b : "rgba(128,128,128,0.35)";
      const lw = (_c = g.lineWidth) != null ? _c : 1;
      let d = "";
      if (g.kind === "square") {
        d = this.buildSquareGridPath(g.spacing, g.anchorX, g.anchorY);
      } else {
        d = this.buildHexGridPath(g.spacing, g.anchorX, g.anchorY);
      }
      const path = createSvgEl("path", this.gridStaticLayer, {
        d,
        stroke: color,
        "stroke-width": String(lw),
        fill: "none",
        "vector-effect": "non-scaling-stroke"
      });
      this.updateGridTransform();
    }
    buildSquareGridPath(spacing, ax, ay) {
      const step = Math.max(2, spacing);
      let d = "";
      const startX = ax + Math.floor((0 - ax) / step) * step;
      for (let x = startX; x <= this.imgW; x += step) d += `M${x},0 L${x},${this.imgH} `;
      const startY = ay + Math.floor((0 - ay) / step) * step;
      for (let y = startY; y <= this.imgH; y += step) d += `M0,${y} L${this.imgW},${y} `;
      return d.trim();
    }
    buildHexGridPath(spacing, ax, ay) {
      const hexW = Math.max(8, spacing);
      const r = hexW / 2;
      const hexH = Math.sqrt(3) * r;
      const dx = 1.5 * r;
      const dy = hexH;
      let d = "";
      const startCol = Math.floor((0 - ax) / dx);
      const startRow = Math.floor((0 - ay - r) / dy);
      for (let row = startRow; row * dy + r <= this.imgH + dy; row++) {
        const offset = row % 2 === 0 ? ax : ax + dx / 2;
        for (let col = startCol; col * dx + offset <= this.imgW + dx; col++) {
          const cx = col * dx + offset;
          const cy = r + row * dy;
          const pts = [];
          for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i - Math.PI / 6;
            pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
          }
          d += `M${pts.join(" L")} Z `;
        }
      }
      return d.trim();
    }
    updateGridTransform() {
      if (!this.gridSvg) return;
    }
    /* ---- zoom HUD ---- */
    updateZoomHud() {
      this.zoomPercentEl.textContent = `${Math.round(this.scale * 100)}%`;
    }
    /* ---- events ---- */
    attachEvents() {
      this.viewport.addEventListener("mousedown", this.onPointerDown);
      window.addEventListener("mousemove", this.onPointerMove);
      window.addEventListener("mouseup", this.onPointerUp);
      this.viewport.addEventListener("touchstart", this.onTouchStart, { passive: false });
      window.addEventListener("touchmove", this.onTouchMove, { passive: false });
      window.addEventListener("touchend", this.onTouchEnd);
      this.viewport.addEventListener("wheel", this.onWheel, { passive: false });
      this.viewport.addEventListener("dblclick", this.onDblClick);
      window.addEventListener("resize", this.handleResize);
    }
    getEventPos(e) {
      const r = this.viewport.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
  };

  // src/static-entry.ts
  var instances = [];
  function scan() {
    var _a;
    const containers = document.querySelectorAll(
      "[data-zm-config], .zm-static-root, .zoommap-container"
    );
    for (const c of containers) {
      if (c.classList.contains("zm-static-initialised") || c.hasAttribute("data-zm-inited")) continue;
      c.classList.add("zm-static-initialised");
      c.setAttribute("data-zm-inited", "1");
      const hasConfig = c.hasAttribute("data-zm-config") || c.querySelector("script.zm-config-json");
      if (!hasConfig) continue;
      const map = new StaticMap(c);
      instances.push(map);
    }
    const codeBlocks = document.querySelectorAll("pre code.language-zoommap");
    for (const cb of codeBlocks) {
      if (cb.hasAttribute("data-zm-handled")) continue;
      cb.setAttribute("data-zm-handled", "1");
      const preBlock = cb.parentElement;
      if (!preBlock) continue;
      const yamlText = (_a = cb.textContent) != null ? _a : "";
      const config = parseZoommapYaml(yamlText);
      if (!config) continue;
      const wrapper = document.createElement("div");
      wrapper.className = "zm-static-root zm-static-initialised";
      wrapper.setAttribute("data-zm-inited", "1");
      wrapper.setAttribute("data-zm-config", JSON.stringify(config));
      if (config.markersUrl) {
        const safeId = safeDataId(config.markersUrl);
        const embedded = document.getElementById(safeId);
        if (embedded && embedded.textContent) {
          try {
            const data = JSON.parse(embedded.textContent);
            if (data == null ? void 0 : data.markers) {
              wrapper.setAttribute("data-zm-markers", JSON.stringify(data.markers));
            }
          } catch (_e) {
          }
        }
      }
      preBlock.replaceWith(wrapper);
      const initMap = () => {
        const map = new StaticMap(wrapper);
        instances.push(map);
        if (!wrapper.hasAttribute("data-zm-markers") && config.markersUrl) {
          fetch(config.markersUrl).then((r) => r.ok ? r.json() : null).catch(() => null).then((data) => {
            if (data == null ? void 0 : data.markers) {
              const markers = data.markers;
              wrapper.setAttribute("data-zm-markers", JSON.stringify(markers));
              map.destroy();
              const newMap = new StaticMap(wrapper);
              instances = instances.filter((m) => m !== map);
              instances.push(newMap);
            }
          }).catch(() => {
          });
        }
      };
      if ("IntersectionObserver" in window) {
        const obs = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (e.isIntersecting) {
                obs.disconnect();
                initMap();
                break;
              }
            }
          },
          { threshold: 0.01 }
        );
        obs.observe(wrapper);
      } else {
        initMap();
      }
    }
  }
  function safeDataId(path) {
    const p = path.startsWith("/") ? path.slice(1) : path;
    return "zm-data-" + btoa(unescape(encodeURIComponent(p))).replace(/[+/=]/g, "_");
  }
  var DEFAULT_ICONS = [
    {
      key: "port",
      url: "/img/zoom-map-icons/anchor.svg",
      size: 24,
      anchorX: 12,
      anchorY: 12
    },
    {
      key: "pinRed",
      url: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20fill%3D%22%23d23c3c%22%20d%3D%22M12%202a7%207%200%200%200-7%207c0%205.25%207%2013%207%2013s7-7.75%207-13a7%207%200%200%200-7-7m0%209.5A2.5%202.5%200%201%201%2012%206.5a2.5%202.5%200%200%201%200%205Z%22%2F%3E%3C%2Fsvg%3E",
      size: 24,
      anchorX: 12,
      anchorY: 12
    },
    {
      key: "pinBlue",
      url: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20fill%3D%22%233c62d2%22%20d%3D%22M12%202a7%207%200%200%200-7%207c0%205.25%207%2013%207%2013s7-7.75%207-13a7%207%200%200%200-7-7m0%209.5A2.5%202.5%200%201%201%2012%206.5a2.5%202.5%200%200%201%200%205Z%22%2F%3E%3C%2Fsvg%3E",
      size: 24,
      anchorX: 12,
      anchorY: 12
    }
  ];
  function parseZoommapYaml(text) {
    var _a, _b, _c, _d;
    const cleanText = text.replace(/^>\s?/gm, "");
    const lines = cleanText.split("\n");
    const map = {};
    const imageBases = [];
    let inImageBases = false;
    let inView = false;
    let _viewZoom = "";
    let _viewCenterX = "";
    let _viewCenterY = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if (trimmed === "view:" || trimmed.startsWith("view:")) {
        inView = true;
        continue;
      }
      if (inView) {
        if (!trimmed.startsWith(" ")) {
          inView = false;
        } else {
          const sidx = trimmed.indexOf(":");
          if (sidx >= 0) {
            const k = trimmed.substring(0, sidx).trim();
            const v = trimmed.substring(sidx + 1).trim();
            if (k === "zoom") _viewZoom = v;
            else if (k === "centerX") _viewCenterX = v;
            else if (k === "centerY") _viewCenterY = v;
          }
          continue;
        }
      }
      if (trimmed.startsWith("imageBases:") || trimmed.startsWith("imagebases:")) {
        inImageBases = true;
        continue;
      }
      if (inImageBases) {
        const m = trimmed.match(/^- path:\s*(.+)$/i);
        if (m) {
          imageBases.push(m[1].trim());
          continue;
        }
        if (!trimmed.startsWith("-") && !trimmed.startsWith(" ") && trimmed.indexOf(":") > 0) {
          inImageBases = false;
        }
        if (!trimmed.startsWith(" ") && !trimmed.startsWith("-")) {
          inImageBases = false;
        }
      }
      if (inImageBases) continue;
      const idx = trimmed.indexOf(":");
      if (idx < 0) continue;
      const key = trimmed.substring(0, idx).trim();
      const value = trimmed.substring(idx + 1).trim();
      map[key] = value;
    }
    function normPath(p) {
      const t = p.trim();
      if (!t || t.startsWith("/") || t.startsWith("http://") || t.startsWith("https://") || t.startsWith("data:")) return t;
      return "/" + t;
    }
    const imageUrl = imageBases.length > 0 ? normPath(imageBases[0]) : map.image ? normPath(map.image) : void 0;
    if (!imageUrl || !map.markers) return null;
    const markersUrl = normPath(map.markers);
    const explicitW = parseFloat((_a = map.imgW) != null ? _a : "0") || void 0;
    const explicitH = parseFloat((_b = map.imgH) != null ? _b : "0") || void 0;
    const restBases = imageBases.length > 1 ? imageBases.slice(1).map((p, i) => ({
      path: normPath(p),
      url: normPath(p),
      name: `Base ${i + 2}`
    })) : void 0;
    const initialZoom = _viewZoom ? parseFloat(_viewZoom) : map.initialZoom ? parseFloat(map.initialZoom) : void 0;
    const hasViewCenter = _viewCenterX !== "" && _viewCenterY !== "";
    const initialCenter = hasViewCenter ? { x: parseFloat(_viewCenterX), y: parseFloat(_viewCenterY) } : void 0;
    return {
      imageUrl,
      markersUrl,
      minZoom: parseFloat((_c = map.minZoom) != null ? _c : "0.1"),
      maxZoom: parseFloat((_d = map.maxZoom) != null ? _d : "10"),
      imgW: explicitW,
      imgH: explicitH,
      width: map.width,
      height: map.height,
      align: map.align,
      initialZoom,
      initialCenter,
      iconProfiles: DEFAULT_ICONS,
      yamlBases: restBases
    };
  }
  function destroyAll() {
    for (const m of instances) m.destroy();
    instances = [];
  }
  var api = {
    create(el2, config, markers) {
      el2.classList.add("zm-static-root", "zm-static-initialised");
      el2.setAttribute("data-zm-inited", "1");
      el2.setAttribute("data-zm-config", JSON.stringify(config));
      if (markers && markers.length > 0) {
        el2.setAttribute("data-zm-markers", JSON.stringify(markers));
      }
      const map = new StaticMap(el2);
      instances.push(map);
      return map;
    },
    scan,
    destroyAll
  };
  window.ZoomMapStatic = api;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => scan());
  } else {
    scan();
  }
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL3N0YXRpYy1yZW5kZXIudHMiLCAic3JjL3N0YXRpYy1lbnRyeS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqICBzdGF0aWMtcmVuZGVyLnRzIFx1MjAxMyBSZWFkLW9ubHkgc3RhdGljIG1hcCByZW5kZXJlci5cclxuICogIE5vIE9ic2lkaWFuIGltcG9ydHMuIFB1cmUgYnJvd3NlciBET00gLyBDYW52YXMgQVBJcy5cclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG5pbXBvcnQgdHlwZSB7XHJcbiAgU3RQb2ludCxcclxuICBTdFJlY3QsXHJcbiAgU3RNYXBDb25maWcsXHJcbiAgU3RNYXJrZXIsXHJcbiAgU3RJY29uUHJvZmlsZSxcclxuICBTdEltYWdlT3ZlcmxheSxcclxuICBTdE1hcEVtYmVkLFxyXG59IGZyb20gXCIuL3N0YXRpYy1jb25maWdcIjtcclxuXHJcbi8qIC0tLS0gaGVscGVycyAtLS0tICovXHJcbmNvbnN0IE5TID0gXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiO1xyXG5cclxuLyoqIENhY2hlZCBwYWdlLW5hbWUgXHUyMTkyIHBlcm1hbGluayBpbmRleCAobG9hZGVkIGZyb20gZW1iZWRkZWQgPHNjcmlwdD4pICovXHJcbmxldCBfcGFnZUluZGV4Q2FjaGU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCBudWxsIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xyXG5cclxuZnVuY3Rpb24gZ2V0UGFnZU5hbWVJbmRleCgpOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgbnVsbCB7XHJcbiAgaWYgKF9wYWdlSW5kZXhDYWNoZSAhPT0gdW5kZWZpbmVkKSByZXR1cm4gX3BhZ2VJbmRleENhY2hlO1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiem0tZGF0YS16bS1wYWdlLWluZGV4XCIpO1xyXG4gICAgaWYgKGVsICYmIGVsLnRleHRDb250ZW50KSB7XHJcbiAgICAgIF9wYWdlSW5kZXhDYWNoZSA9IEpTT04ucGFyc2UoZWwudGV4dENvbnRlbnQpIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz47XHJcbiAgICAgIHJldHVybiBfcGFnZUluZGV4Q2FjaGU7XHJcbiAgICB9XHJcbiAgfSBjYXRjaCAoX2UpIHsgLyogaWdub3JlICovIH1cclxuICBfcGFnZUluZGV4Q2FjaGUgPSBudWxsO1xyXG4gIHJldHVybiBudWxsO1xyXG59XHJcblxyXG4vKiogQ29udmVydCBhIHZhdWx0L29ic2lkaWFuIHBhdGggdG8gYSBkZXBsb3llZCBzaXRlIFVSTCAqL1xyXG5mdW5jdGlvbiBub3JtYWxpemVMaW5rKGxpbms6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgaWYgKCFsaW5rKSByZXR1cm4gbGluaztcclxuICAvLyBBbHJlYWR5IGFic29sdXRlIFVSTCBvciBhbmNob3JcclxuICBpZiAobGluay5zdGFydHNXaXRoKFwiaHR0cDovL1wiKSB8fCBsaW5rLnN0YXJ0c1dpdGgoXCJodHRwczovL1wiKSB8fCBsaW5rLnN0YXJ0c1dpdGgoXCIjXCIpKSByZXR1cm4gbGluaztcclxuXHJcbiAgLy8gU3RyaXAgLm1kIGV4dGVuc2lvblxyXG4gIGxldCBwID0gbGluay5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIik7XHJcblxyXG4gIC8vIElmIHRoZSBsaW5rIGlzIGEgc2hvcnQgbmFtZSAobm8gc2xhc2hlcyksIHRyeSB0aGUgcGFnZS1uYW1lIGluZGV4XHJcbiAgaWYgKCFwLmluY2x1ZGVzKFwiL1wiKSkge1xyXG4gICAgY29uc3QgaW5kZXggPSBnZXRQYWdlTmFtZUluZGV4KCk7XHJcbiAgICBpZiAoaW5kZXggJiYgaW5kZXhbcF0pIHtcclxuICAgICAgcmV0dXJuIGluZGV4W3BdO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gRW5zdXJlIGxlYWRpbmcgXCIvXCJcclxuICBpZiAoIXAuc3RhcnRzV2l0aChcIi9cIikpIHAgPSBcIi9cIiArIHA7XHJcbiAgLy8gRW5zdXJlIHRyYWlsaW5nIFwiL1wiICh1bmxlc3MgaXQncyBhIGZpbGUgd2l0aCBleHRlbnNpb24pXHJcbiAgaWYgKCFwLmVuZHNXaXRoKFwiL1wiKSAmJiAhL1xcLlthLXpBLVowLTldKyQvLnRlc3QocCkpIHAgKz0gXCIvXCI7XHJcblxyXG4gIC8vIEFzIGEgZmluYWwgZmFsbGJhY2s6IHRyeSB0aGUgaW5kZXggYWdhaW4gd2l0aCB0aGUgbGVhZGluZyBcIi9cIiBzdHJpcHBlZFxyXG4gIC8vIChoYW5kbGVzIHRoZSBjYXNlIHdoZXJlIG5vcm1hbGl6ZUxpbmsgaXMgY2FsbGVkIHdpdGggXCIvXHU5OTk2XHU5MEZEXCIpXHJcbiAgaWYgKCFwLmluY2x1ZGVzKFwiL1wiLCAxKSkge1xyXG4gICAgY29uc3QgYmFyZSA9IHAucmVwbGFjZSgvXlxcL3xcXC8kL2csIFwiXCIpO1xyXG4gICAgY29uc3QgaW5kZXggPSBnZXRQYWdlTmFtZUluZGV4KCk7XHJcbiAgICBpZiAoaW5kZXggJiYgaW5kZXhbYmFyZV0pIHtcclxuICAgICAgcmV0dXJuIGluZGV4W2JhcmVdO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHA7XHJcbn1cclxuXHJcbi8qKiBFeHRyYWN0IGEgaHVtYW4tcmVhZGFibGUgcGFnZSBuYW1lIGZyb20gYSB2YXVsdCBwYXRoICovXHJcbmZ1bmN0aW9uIHBhZ2VOYW1lKGxpbms6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgaWYgKCFsaW5rKSByZXR1cm4gXCJcIjtcclxuICAvLyBUYWtlIHRoZSBsYXN0IHBhdGggc2VnbWVudCwgc3RyaXAgZXh0ZW5zaW9uXHJcbiAgY29uc3Qgc2VnbWVudHMgPSBsaW5rLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpLnNwbGl0KFwiL1wiKTtcclxuICBjb25zdCBsYXN0ID0gc2VnbWVudHNbc2VnbWVudHMubGVuZ3RoIC0gMV0gfHwgXCJcIjtcclxuICByZXR1cm4gbGFzdC5yZXBsYWNlKC9cXC5tZCQvaSwgXCJcIikgfHwgbGluaztcclxufVxyXG5cclxuZnVuY3Rpb24gZXNjYXBlSHRtbChzOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGNvbnN0IGQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIGQudGV4dENvbnRlbnQgPSBzO1xyXG4gIHJldHVybiBkLmlubmVySFRNTDtcclxufVxyXG5cclxuLyogLS0tLSBwYWdlIHByZXZpZXcgY2FjaGUgJiBmZXRjaGVyIChzaGFyZWQgYWNyb3NzIGFsbCBtYXAgaW5zdGFuY2VzKSAtLS0tICovXHJcblxyXG5jb25zdCBwYWdlUHJldmlld0NhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcclxuXHJcbi8qKlxyXG4gKiBTYW5pdGl6ZSBIVE1MOiByZW1vdmUgc2NyaXB0cywgc3R5bGVzLCBpZnJhbWVzLCBldmVudCBoYW5kbGVycywgZGFuZ2Vyb3VzIGhyZWZzLlxyXG4gKi9cclxuZnVuY3Rpb24gc2FuaXRpemVIdG1sKGh0bWw6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICBkaXYuaW5uZXJIVE1MID0gaHRtbDtcclxuXHJcbiAgZm9yIChjb25zdCBlbCBvZiBkaXYucXVlcnlTZWxlY3RvckFsbChcInNjcmlwdCwgc3R5bGUsIGlmcmFtZSwgb2JqZWN0LCBlbWJlZCwgbGluaywgc3ZnXCIpKSBlbC5yZW1vdmUoKTtcclxuICBmb3IgKGNvbnN0IGVsIG9mIGRpdi5xdWVyeVNlbGVjdG9yQWxsKFwiKlwiKSkge1xyXG4gICAgZm9yIChjb25zdCBhdHRyIG9mIFsuLi5lbC5hdHRyaWJ1dGVzXSkge1xyXG4gICAgICBpZiAoYXR0ci5uYW1lLnN0YXJ0c1dpdGgoXCJvblwiKSkgZWwucmVtb3ZlQXR0cmlidXRlKGF0dHIubmFtZSk7XHJcbiAgICAgIGlmIChhdHRyLm5hbWUgPT09IFwiaHJlZlwiICYmIC9eamF2YXNjcmlwdDovaS50ZXN0KGF0dHIudmFsdWUpKSBlbC5yZW1vdmVBdHRyaWJ1dGUoYXR0ci5uYW1lKTtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIGRpdi5pbm5lckhUTUw7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUcnVuY2F0ZSBIVE1MIHRvIGF0IG1vc3QgYG1heENoYXJzYCBjaGFyYWN0ZXJzIG9mIHZpc2libGUgdGV4dCBjb250ZW50LlxyXG4gKiBVc2VzIGEgVHJlZVdhbGtlciB0byBjb3VudCB0ZXh0IG5vZGVzIGFuZCByZW1vdmVzIHN1YnNlcXVlbnQgY29udGVudC5cclxuICovXHJcbmZ1bmN0aW9uIHRydW5jYXRlSHRtbChodG1sOiBzdHJpbmcsIG1heENoYXJzOiBudW1iZXIpOiBzdHJpbmcge1xyXG4gIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgZGl2LmlubmVySFRNTCA9IGh0bWw7XHJcblxyXG4gIGxldCBjb3VudCA9IDA7XHJcbiAgY29uc3Qgd2Fsa2VyID0gZG9jdW1lbnQuY3JlYXRlVHJlZVdhbGtlcihkaXYsIE5vZGVGaWx0ZXIuU0hPV19URVhUKTtcclxuICBsZXQgbm9kZSA9IHdhbGtlci5uZXh0Tm9kZSgpIGFzIFRleHQgfCBudWxsO1xyXG5cclxuICB3aGlsZSAobm9kZSkge1xyXG4gICAgY29uc3QgdGV4dCA9IG5vZGUudGV4dENvbnRlbnQgfHwgXCJcIjtcclxuICAgIGNvbnN0IHJlbWFpbmluZyA9IG1heENoYXJzIC0gY291bnQ7XHJcbiAgICBpZiAocmVtYWluaW5nIDw9IDApIHtcclxuICAgICAgbm9kZS50ZXh0Q29udGVudCA9IFwiXCI7XHJcbiAgICAgIGNvbnN0IG5leHQgPSB3YWxrZXIubmV4dE5vZGUoKSBhcyBUZXh0IHwgbnVsbDtcclxuICAgICAgaWYgKG5leHQpIHtcclxuICAgICAgICBsZXQgcGFyZW50OiBOb2RlIHwgbnVsbCA9IG5leHQ7XHJcbiAgICAgICAgd2hpbGUgKHBhcmVudCAmJiBwYXJlbnQgIT09IGRpdikge1xyXG4gICAgICAgICAgbGV0IHNpYmxpbmc6IENoaWxkTm9kZSB8IG51bGwgPSBwYXJlbnQubmV4dFNpYmxpbmc7XHJcbiAgICAgICAgICB3aGlsZSAoc2libGluZykgeyBjb25zdCBzID0gc2libGluZzsgc2libGluZyA9IHNpYmxpbmcubmV4dFNpYmxpbmc7IHMucmVtb3ZlKCk7IH1cclxuICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBuZXh0LnRleHRDb250ZW50ID0gXCJcIjtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gZGl2LmlubmVySFRNTDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoY291bnQgKyB0ZXh0Lmxlbmd0aCA+IHJlbWFpbmluZykge1xyXG4gICAgICBub2RlLnRleHRDb250ZW50ID0gdGV4dC5zbGljZSgwLCByZW1haW5pbmcpICsgXCJcdTIwMjZcIjtcclxuICAgICAgbGV0IHBhcmVudDogTm9kZSB8IG51bGwgPSBub2RlO1xyXG4gICAgICB3aGlsZSAocGFyZW50ICYmIHBhcmVudCAhPT0gZGl2KSB7XHJcbiAgICAgICAgbGV0IHNpYmxpbmc6IENoaWxkTm9kZSB8IG51bGwgPSBwYXJlbnQubmV4dFNpYmxpbmc7XHJcbiAgICAgICAgd2hpbGUgKHNpYmxpbmcpIHsgY29uc3QgcyA9IHNpYmxpbmc7IHNpYmxpbmcgPSBzaWJsaW5nLm5leHRTaWJsaW5nOyBzLnJlbW92ZSgpOyB9XHJcbiAgICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudE5vZGU7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGRpdi5pbm5lckhUTUw7XHJcbiAgICB9XHJcblxyXG4gICAgY291bnQgKz0gdGV4dC5sZW5ndGg7XHJcbiAgICBub2RlID0gd2Fsa2VyLm5leHROb2RlKCkgYXMgVGV4dCB8IG51bGw7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZGl2LmlubmVySFRNTDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEZldGNoIGEgcGFnZSBVUkwgYW5kIGV4dHJhY3QgY29udGVudCBib2R5IEhUTUwgZm9yIHRvb2x0aXAgcHJldmlldy5cclxuICogT25seSBleHRyYWN0cyBib2R5IHRleHQgKG5vIGgxL2gyIHRpdGxlcykuIENhY2hlcyByZXN1bHRzLlxyXG4gKi9cclxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hQYWdlUHJldmlldyh1cmw6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgaWYgKHBhZ2VQcmV2aWV3Q2FjaGUuaGFzKHVybCkpIHJldHVybiBwYWdlUHJldmlld0NhY2hlLmdldCh1cmwpITtcclxuXHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaCh1cmwpO1xyXG4gICAgaWYgKCFyZXNwLm9rKSB0aHJvdyBuZXcgRXJyb3IoXCJIVFRQIFwiICsgcmVzcC5zdGF0dXMpO1xyXG4gICAgY29uc3QgaHRtbCA9IGF3YWl0IHJlc3AudGV4dCgpO1xyXG4gICAgY29uc3QgcGFyc2VyID0gbmV3IERPTVBhcnNlcigpO1xyXG4gICAgY29uc3QgZG9jID0gcGFyc2VyLnBhcnNlRnJvbVN0cmluZyhodG1sLCBcInRleHQvaHRtbFwiKTtcclxuXHJcbiAgICAvLyAtLS0gY29udGVudCBib2R5OiAuY29udGVudCA+IGFydGljbGUgPiBtYWluIC0tLVxyXG4gICAgY29uc3QgY29udGVudEVsID0gZG9jLnF1ZXJ5U2VsZWN0b3IoXCIuY29udGVudFwiKSB8fCBkb2MucXVlcnlTZWxlY3RvcihcImFydGljbGVcIikgfHwgZG9jLnF1ZXJ5U2VsZWN0b3IoXCJtYWluXCIpO1xyXG4gICAgaWYgKCFjb250ZW50RWwpIHtcclxuICAgICAgcGFnZVByZXZpZXdDYWNoZS5zZXQodXJsLCBcIlwiKTtcclxuICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY2xvbmUgPSBjb250ZW50RWwuY2xvbmVOb2RlKHRydWUpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgLy8gUmVtb3ZlIHRpdGxlcyBcdTIwMTQgdG9vbHRpcCBhbHJlYWR5IHNob3dzIG1hcmtlciBsYWJlbCBhcyB0aXRsZVxyXG4gICAgZm9yIChjb25zdCBoIG9mIGNsb25lLnF1ZXJ5U2VsZWN0b3JBbGwoXCJoMSwgaDJcIikpIGgucmVtb3ZlKCk7XHJcbiAgICAvLyBSZW1vdmUgc2lkZSBlbGVtZW50c1xyXG4gICAgZm9yIChjb25zdCBlbCBvZiBjbG9uZS5xdWVyeVNlbGVjdG9yQWxsKFwibmF2LCBhc2lkZSwgZm9vdGVyLCBoZWFkZXIsIC5iYWNrbGlua3MsIC5ncmFwaCwgLnRvYywgLnNlYXJjaC1jb250YWluZXIsIC5icmVhZGNydW1icywgLm1hcmtkb3duLWVtYmVkLXRpdGxlXCIpKSBlbC5yZW1vdmUoKTtcclxuXHJcbiAgICBjb25zdCBzYW5pdGl6ZWQgPSBzYW5pdGl6ZUh0bWwoY2xvbmUuaW5uZXJIVE1MKTtcclxuICAgIGNvbnN0IHRydW5jYXRlZCA9IHRydW5jYXRlSHRtbChzYW5pdGl6ZWQsIDUwMCk7XHJcblxyXG4gICAgcGFnZVByZXZpZXdDYWNoZS5zZXQodXJsLCB0cnVuY2F0ZWQpO1xyXG4gICAgcmV0dXJuIHRydW5jYXRlZDtcclxuICB9IGNhdGNoIChfZXJyKSB7XHJcbiAgICBwYWdlUHJldmlld0NhY2hlLnNldCh1cmwsIFwiXCIpO1xyXG4gICAgcmV0dXJuIFwiXCI7XHJcbiAgfVxyXG59XHJcblxyXG4vLyBSZS1leHBvcnQgZm9yIG1vZHVsZSBjb25zdW1lcnNcclxuZnVuY3Rpb24gZ2V0UHJldmlld0NhY2hlKCkgeyByZXR1cm4gcGFnZVByZXZpZXdDYWNoZTsgfVxyXG5cclxuLyoqIEdsb2JhbCBoaWRlIGFsbCB0b29sdGlwcyAodXNlZCB3aGVuIG1vdXNlIGxlYXZlcyBtYXAgZW50aXJlbHkpICovXHJcbmxldCBnbG9iYWxBY3RpdmVUaXA6IFN0YXRpY01hcFRpcCB8IG51bGwgPSBudWxsO1xyXG5cclxuLyoqIEEgbGlnaHR3ZWlnaHQgc3RydWN0IHNvIHdlIGNhbiBndWFyZCBhZ2FpbnN0IHN0YWxlIGFzeW5jIHJlc3BvbnNlcyAqL1xyXG5pbnRlcmZhY2UgU3RhdGljTWFwVGlwIHtcclxuICB0aXA6IEhUTUxEaXZFbGVtZW50O1xyXG4gIG1hcmtlcklkOiBzdHJpbmc7XHJcbn1cclxuXHJcbi8qIC0tLS0gdG9vbHRpcCBjb250ZW50IGJ1aWxkZXIgLS0tLSAqL1xyXG5cclxuZnVuY3Rpb24gYnVpbGRUb29sdGlwQ29udGVudChtOiBTdE1hcmtlciwgcHJldmlld0h0bWw/OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGNvbnN0IGhhc1Rvb2x0aXAgPSAhIW0udG9vbHRpcDtcclxuICBsZXQgaHRtbCA9IFwiXCI7XHJcblxyXG4gIC8vIFRvb2x0aXAgbGFiZWwgKG1hcmtlciBuYW1lKSBcdTIwMTMgbGlrZSBERydzIHRpdGxlIGxpbmVcclxuICBpZiAoaGFzVG9vbHRpcCkge1xyXG4gICAgaHRtbCArPSBgPGRpdiBjbGFzcz1cInptLXN0LXRvb2x0aXAtdGl0bGVcIj4ke2VzY2FwZUh0bWwobS50b29sdGlwISl9PC9kaXY+YDtcclxuICB9XHJcblxyXG4gIC8vIFBhZ2UgcHJldmlldyBjb250ZW50IFx1MjAxMyBtYXRjaGVzIERHJ3MgPGRpdiBzdHlsZT1cImZvbnQtd2VpZ2h0OmJvbGRcIj4gKyBjb250ZW50RWwuaW5uZXJIVE1MXHJcbiAgaWYgKHByZXZpZXdIdG1sICE9PSB1bmRlZmluZWQpIHtcclxuICAgIGlmIChwcmV2aWV3SHRtbCkge1xyXG4gICAgICBodG1sICs9IGA8ZGl2IGNsYXNzPVwiem0tc3QtcHJldmlldy1odG1sXCI+JHtwcmV2aWV3SHRtbH08L2Rpdj5gO1xyXG4gICAgfVxyXG4gIH0gZWxzZSB7XHJcbiAgICBodG1sICs9IGA8ZGl2IGNsYXNzPVwiem0tc3QtcHJldmlldy1sb2FkaW5nXCI+TG9hZGluZyBwcmV2aWV3XHUyMDI2PC9kaXY+YDtcclxuICB9XHJcblxyXG4gIHJldHVybiBodG1sIHx8IGA8ZGl2IGNsYXNzPVwiem0tc3QtdG9vbHRpcC10aXRsZVwiPiR7ZXNjYXBlSHRtbChtLm5hbWUgfHwgXCJcIil9PC9kaXY+YDtcclxufVxyXG5cclxuZnVuY3Rpb24gZWw8SyBleHRlbmRzIGtleW9mIEhUTUxFbGVtZW50VGFnTmFtZU1hcD4oXHJcbiAgdGFnOiBLLFxyXG4gIHBhcmVudDogSFRNTEVsZW1lbnQsXHJcbiAgYXR0cnM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LFxyXG4gIGNscz86IHN0cmluZyxcclxuKTogSFRNTEVsZW1lbnRUYWdOYW1lTWFwW0tdIHtcclxuICBjb25zdCBlID0gcGFyZW50Lm93bmVyRG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpO1xyXG4gIGlmIChjbHMpIGUuY2xhc3NOYW1lID0gY2xzO1xyXG4gIGlmIChhdHRycykgZm9yIChjb25zdCBbaywgdl0gb2YgT2JqZWN0LmVudHJpZXMoYXR0cnMpKSBlLnNldEF0dHJpYnV0ZShrLCB2KTtcclxuICBwYXJlbnQuYXBwZW5kQ2hpbGQoZSk7XHJcbiAgcmV0dXJuIGU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZVN2Z0VsPEsgZXh0ZW5kcyBrZXlvZiBTVkdFbGVtZW50VGFnTmFtZU1hcD4oXHJcbiAgdGFnOiBLLFxyXG4gIHBhcmVudDogU1ZHRWxlbWVudCxcclxuICBhdHRycz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXHJcbik6IFNWR0VsZW1lbnRUYWdOYW1lTWFwW0tdIHtcclxuICBjb25zdCBlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKE5TLCB0YWcpO1xyXG4gIGlmIChhdHRycykgZm9yIChjb25zdCBbaywgdl0gb2YgT2JqZWN0LmVudHJpZXMoYXR0cnMpKSBlLnNldEF0dHJpYnV0ZShrLCB2KTtcclxuICBwYXJlbnQuYXBwZW5kQ2hpbGQoZSk7XHJcbiAgcmV0dXJuIGU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN2Z0VsPEsgZXh0ZW5kcyBrZXlvZiBTVkdFbGVtZW50VGFnTmFtZU1hcD4oXHJcbiAgdGFnOiBLLFxyXG4gIHBhcmVudDogSFRNTEVsZW1lbnQsXHJcbiAgYXR0cnM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LFxyXG4pOiBTVkdFbGVtZW50VGFnTmFtZU1hcFtLXSB7XHJcbiAgY29uc3QgZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhOUywgdGFnKTtcclxuICBpZiAoYXR0cnMpIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKGF0dHJzKSkgZS5zZXRBdHRyaWJ1dGUoaywgdik7XHJcbiAgcGFyZW50LmFwcGVuZENoaWxkKGUpO1xyXG4gIHJldHVybiBlO1xyXG59XHJcblxyXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8qIC0tLS0gcHJldmlldyBDU1MgaW5qZWN0aW9uIC0tLS0gKi9cclxuXHJcbmxldCBwcmV2aWV3Q3NzSW5qZWN0ZWQgPSBmYWxzZTtcclxuZnVuY3Rpb24gaW5qZWN0UHJldmlld0NzcygpOiB2b2lkIHtcclxuICBpZiAocHJldmlld0Nzc0luamVjdGVkKSByZXR1cm47XHJcbiAgcHJldmlld0Nzc0luamVjdGVkID0gdHJ1ZTtcclxuICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcclxuICBzdHlsZS5pZCA9IFwiem0tc3QtcHJldmlldy1jc3NcIjtcclxuICBzdHlsZS50ZXh0Q29udGVudCA9IGBcclxuLyogWm9vbSBNYXAgc3RhdGljIFx1MjAxMyB0b29sdGlwIGhvdmVyIHByZXZpZXcgKG1hdGNoZXMgRGlnaXRhbCBHYXJkZW4gI3Rvb2x0aXAtd3JhcHBlcikgKi9cclxuLnptLXN0LXRvb2x0aXAge1xyXG4gIGJhY2tncm91bmQ6IHZhcigtLWJhY2tncm91bmQtcHJpbWFyeSk7XHJcbiAgcGFkZGluZzogMWVtO1xyXG4gIGJvcmRlci1yYWRpdXM6IDRweDtcclxuICBvdmVyZmxvdzogaGlkZGVuO1xyXG4gIHBvc2l0aW9uOiBmaXhlZDtcclxuICBtYXgtd2lkdGg6IDQwMHB4O1xyXG4gIGhlaWdodDogYXV0bztcclxuICBtYXgtaGVpZ2h0OiAzMDBweDtcclxuICBmb250LXNpemU6IDAuOGVtO1xyXG4gIGJveC1zaGFkb3c6IDAgNXB4IDEwcHggcmdiYSgwLDAsMCwwLjEpO1xyXG4gIHotaW5kZXg6IDk5OTk5O1xyXG4gIHBvaW50ZXItZXZlbnRzOiBhdXRvO1xyXG4gIG92ZXJmbG93LXk6IGF1dG87XHJcbiAgY29sb3I6IHZhcigtLXRleHQtbm9ybWFsKTtcclxuICBsaW5lLWhlaWdodDogMS41O1xyXG4gIG9wYWNpdHk6IDA7XHJcbiAgdHJhbnNpdGlvbjogb3BhY2l0eSAxMDBtcztcclxuICB1bmljb2RlLWJpZGk6IHBsYWludGV4dDtcclxufVxyXG5cclxuLnptLXN0LXRvb2x0aXAuem0tc3QtdG9vbHRpcC12aXNpYmxlIHtcclxuICBvcGFjaXR5OiAxO1xyXG59XHJcblxyXG4uem0tc3QtdG9vbHRpcCAuem0tc3QtdG9vbHRpcC10aXRsZSB7XHJcbiAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICBtYXJnaW4tYm90dG9tOiAwLjVlbTtcclxuICB1bmljb2RlLWJpZGk6IHBsYWludGV4dDtcclxuICBmb250LXNpemU6IDEuMDVlbTtcclxuICBjb2xvcjogdmFyKC0tdGV4dC1hY2NlbnQpO1xyXG59XHJcblxyXG4uem0tc3QtdG9vbHRpcCAuem0tc3QtcHJldmlldy1odG1sIHtcclxuICAvKiBJbmhlcml0cyBzaXRlIHRoZW1lIHR5cG9ncmFwaHkgXHUyMDE0IHNhbWUgY2xhc3NlcyBhcyB0aGUgYWN0dWFsIHBhZ2UgKi9cclxufVxyXG5cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBwIHtcclxuICBtYXJnaW46IDAuNWVtIDA7XHJcbiAgbGluZS1oZWlnaHQ6IDEuNTU7XHJcbn1cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBwOmxhc3QtY2hpbGQge1xyXG4gIG1hcmdpbi1ib3R0b206IDA7XHJcbn1cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBzdHJvbmcsXHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgYiB7XHJcbiAgY29sb3I6IHZhcigtLXRleHQtbm9ybWFsKTtcclxuICBmb250LXdlaWdodDogNjAwO1xyXG59XHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgZW0sXHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgaSB7XHJcbiAgb3BhY2l0eTogMC44NTtcclxufVxyXG4uem0tc3QtdG9vbHRpcCAuem0tc3QtcHJldmlldy1odG1sIGEge1xyXG4gIGNvbG9yOiB2YXIoLS10ZXh0LWFjY2VudCk7XHJcbn1cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBoMyxcclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBoNCxcclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBoNSxcclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBoNiB7XHJcbiAgZm9udC1zaXplOiAwLjk1ZW07XHJcbiAgZm9udC13ZWlnaHQ6IDYwMDtcclxuICBtYXJnaW46IDAuNmVtIDAgMC4yNWVtO1xyXG59XHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgdWwsXHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgb2wge1xyXG4gIHBhZGRpbmctbGVmdDogMS41ZW07XHJcbiAgbWFyZ2luOiAwLjRlbSAwO1xyXG59XHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgbGkge1xyXG4gIG1hcmdpbi1ib3R0b206IDJweDtcclxufVxyXG4uem0tc3QtdG9vbHRpcCAuem0tc3QtcHJldmlldy1odG1sIGJsb2NrcXVvdGUge1xyXG4gIGJvcmRlci1sZWZ0OiAzcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIsIHJnYmEoMjU1LDI1NSwyNTUsMC4yMikpO1xyXG4gIHBhZGRpbmctbGVmdDogMTBweDtcclxuICBtYXJnaW46IDZweCAwO1xyXG4gIG9wYWNpdHk6IDAuODU7XHJcbn1cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBociB7XHJcbiAgYm9yZGVyLWNvbG9yOiB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlciwgcmdiYSgyNTUsMjU1LDI1NSwwLjEyKSk7XHJcbiAgbWFyZ2luOiA2cHggMDtcclxufVxyXG4uem0tc3QtdG9vbHRpcCAuem0tc3QtcHJldmlldy1odG1sIGRlbCxcclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBzIHtcclxuICBvcGFjaXR5OiAwLjY7XHJcbn1cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBtYXJrIHtcclxuICBiYWNrZ3JvdW5kOiB2YXIoLS10ZXh0LWhpZ2hsaWdodC1iZywgcmdiYSgyNTUsMjAwLDgwLDAuMjUpKTtcclxuICBwYWRkaW5nOiAwIDJweDtcclxuICBib3JkZXItcmFkaXVzOiAycHg7XHJcbn1cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBjb2RlIHtcclxuICBiYWNrZ3JvdW5kOiB2YXIoLS1iYWNrZ3JvdW5kLXNlY29uZGFyeSk7XHJcbiAgcGFkZGluZzogMnB4IDRweDtcclxuICBib3JkZXItcmFkaXVzOiAzcHg7XHJcbiAgZm9udC1zaXplOiAwLjllbTtcclxufVxyXG4uem0tc3QtdG9vbHRpcCAuem0tc3QtcHJldmlldy1odG1sIHByZSB7XHJcbiAgYmFja2dyb3VuZDogdmFyKC0tYmFja2dyb3VuZC1zZWNvbmRhcnkpO1xyXG4gIHBhZGRpbmc6IDAuNmVtO1xyXG4gIGJvcmRlci1yYWRpdXM6IDRweDtcclxuICBvdmVyZmxvdy14OiBhdXRvO1xyXG4gIGZvbnQtc2l6ZTogMC44NWVtO1xyXG59XHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgdGFibGUge1xyXG4gIGZvbnQtc2l6ZTogMC44NWVtO1xyXG4gIGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7XHJcbn1cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCB0aCxcclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCB0ZCB7XHJcbiAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIsIHJnYmEoMjU1LDI1NSwyNTUsMC4xNSkpO1xyXG4gIHBhZGRpbmc6IDNweCA2cHg7XHJcbn1cclxuXHJcbi56bS1zdC1wcmV2aWV3LWxvYWRpbmcge1xyXG4gIGZvbnQtc2l6ZTogMC44NWVtO1xyXG4gIG9wYWNpdHk6IDAuNTU7XHJcbiAgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQpO1xyXG59XHJcbmA7XHJcbiAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7XHJcbn1cclxuXHJcbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICogIFN0YXRpY01hcCBcdTIwMTMgb25lIHBlciBtYXAgY29udGFpbmVyXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cclxuXHJcbmV4cG9ydCBjbGFzcyBTdGF0aWNNYXAge1xyXG4gIC8qIGNvbmZpZyAmIGRhdGEgKHJlYWRvbmx5IGFmdGVyIGNvbnN0cnVjdGlvbikgKi9cclxuICBwcml2YXRlIGNmZzogU3RNYXBDb25maWc7XHJcbiAgcHJpdmF0ZSBtYXJrZXJzOiBTdE1hcmtlcltdID0gW107XHJcbiAgcHJpdmF0ZSBpY29uTWFwOiBNYXA8c3RyaW5nLCBTdEljb25Qcm9maWxlPiA9IG5ldyBNYXAoKTtcclxuICBwcml2YXRlIG92ZXJsYXlzOiBTdEltYWdlT3ZlcmxheVtdID0gW107XHJcblxyXG4gIC8qIERPTSByb290cyAqL1xyXG4gIHByaXZhdGUgY29udGFpbmVyOiBIVE1MRWxlbWVudDtcclxuICBwcml2YXRlIHZpZXdwb3J0ITogSFRNTERpdkVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSB3b3JsZCE6IEhUTUxEaXZFbGVtZW50O1xyXG4gIHByaXZhdGUgaW1nRWwhOiBIVE1MSW1hZ2VFbGVtZW50O1xyXG4gIHByaXZhdGUgY2xzUGZ4ID0gXCJ6bS1zdFwiO1xyXG5cclxuICAvKiBzdGF0ZSAqL1xyXG4gIHByaXZhdGUgc2NhbGUgPSAxO1xyXG4gIHByaXZhdGUgdHggPSAwO1xyXG4gIHByaXZhdGUgdHkgPSAwO1xyXG4gIHByaXZhdGUgaW1nVyA9IDA7XHJcbiAgcHJpdmF0ZSBpbWdIID0gMDtcclxuICBwcml2YXRlIHJlYWR5ID0gZmFsc2U7XHJcbiAgcHJpdmF0ZSBpbWdMb2FkZWQgPSBmYWxzZTtcclxuXHJcbiAgLyogZ3JpZCAqL1xyXG4gIHByaXZhdGUgZ3JpZFN2ZzogU1ZHU1ZHRWxlbWVudCB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgZ3JpZFN0YXRpY0xheWVyOiBTVkdHRWxlbWVudCB8IG51bGwgPSBudWxsO1xyXG5cclxuICAvKiBtYXJrZXJzIERPTSBjb250YWluZXJzICovXHJcbiAgcHJpdmF0ZSBtYXJrZXJzRWwhOiBIVE1MRGl2RWxlbWVudDtcclxuXHJcbiAgLyogb3ZlcmxheXMgRE9NICovXHJcbiAgcHJpdmF0ZSBvdmVybGF5c0VsITogSFRNTERpdkVsZW1lbnQ7XHJcblxyXG4gIC8qIHpvb20gSFVEICovXHJcbiAgcHJpdmF0ZSB6b29tSHVkITogSFRNTERpdkVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSB6b29tSW5CdG4hOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICBwcml2YXRlIHpvb21PdXRCdG4hOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICBwcml2YXRlIHpvb21QZXJjZW50RWwhOiBIVE1MU3BhbkVsZW1lbnQ7XHJcblxyXG4gIC8qIGludGVyYWN0aW9uIHN0YXRlICovXHJcbiAgcHJpdmF0ZSBkcmFnZ2luZyA9IGZhbHNlO1xyXG4gIHByaXZhdGUgZHJhZ1N0YXJ0OiBTdFBvaW50ID0geyB4OiAwLCB5OiAwIH07XHJcbiAgcHJpdmF0ZSBkcmFnVHgwID0gMDtcclxuICBwcml2YXRlIGRyYWdUeTAgPSAwO1xyXG4gIHByaXZhdGUgbGFzdFBpbmNoRGlzdCA9IDA7XHJcbiAgcHJpdmF0ZSBsYXN0UGluY2hTY2FsZSA9IDE7XHJcblxyXG4gIC8qIG1hcmtlciBob3ZlciAvIHBvcG92ZXIgKi9cclxuICBwcml2YXRlIGFjdGl2ZVBvcG92ZXI6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBhY3RpdmVNYXJrZXJFbDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcclxuXHJcbiAgLyogLS0tLSBsaWZlY3ljbGUgLS0tLSAqL1xyXG5cclxuICBjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XHJcbiAgICBpbmplY3RQcmV2aWV3Q3NzKCk7XHJcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcclxuICAgIGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKFwiem0tc3RhdGljLXJvb3RcIik7XHJcbiAgICAvLyBSZWFkIGNvbmZpZyBmcm9tIGRhdGEtYXR0cmlidXRlcyBvciBhbiBlbWJlZGRlZCBzY3JpcHQgYmxvY2tcclxuICAgIHRoaXMuY2ZnID0gdGhpcy5sb2FkQ29uZmlnKGNvbnRhaW5lcik7XHJcbiAgICB0aGlzLm1hcmtlcnMgPSB0aGlzLmxvYWRNYXJrZXJzKGNvbnRhaW5lcik7XHJcbiAgICB0aGlzLmltZ1cgPSB0aGlzLmNmZy5pbWdXIHx8IDA7XHJcbiAgICB0aGlzLmltZ0ggPSB0aGlzLmNmZy5pbWdIIHx8IDA7XHJcbiAgICBmb3IgKGNvbnN0IGlwIG9mIHRoaXMuY2ZnLmljb25Qcm9maWxlcykgdGhpcy5pY29uTWFwLnNldChpcC5rZXksIGlwKTtcclxuICAgIHRoaXMub3ZlcmxheXMgPSB0aGlzLmNmZy5vdmVybGF5cyA/PyBbXTtcclxuICAgIHRoaXMuYnVpbGREb20oKTtcclxuICAgIHRoaXMuYXR0YWNoRXZlbnRzKCk7XHJcbiAgICB2b2lkIHRoaXMubG9hZEJhc2VJbWFnZSgpLnRoZW4oKCkgPT4ge1xyXG4gICAgICB0aGlzLnJlYWR5ID0gdHJ1ZTtcclxuICAgICAgdGhpcy5hcHBseUluaXRpYWxWaWV3KCk7XHJcbiAgICAgIHRoaXMucmVuZGVyTWFya2VycygpO1xyXG4gICAgICB0aGlzLnJlbmRlck92ZXJsYXlzKCk7XHJcbiAgICAgIHRoaXMucmVuZGVyR3JpZCgpO1xyXG4gICAgfSk7XHJcbiAgICB0aGlzLmhhbmRsZVJlc2l6ZSgpO1xyXG4gIH1cclxuXHJcbiAgZGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuY2xvc2VQb3BvdmVyKCk7XHJcbiAgICAvLyBjb250YWluZXIgd2lsbCBiZSBjbGVhbmVkIHVwIGJ5IHBhcmVudFxyXG4gIH1cclxuXHJcbiAgLyogLS0tLSBjb25maWcgbG9hZGluZyAtLS0tICovXHJcblxyXG4gIHByaXZhdGUgbG9hZENvbmZpZyhjb250YWluZXI6IEhUTUxFbGVtZW50KTogU3RNYXBDb25maWcge1xyXG4gICAgLy8gRmlyc3QgdHJ5IGRhdGEtY29uZmlnIGF0dHJpYnV0ZSAoSlNPTilcclxuICAgIGNvbnN0IGRhdGFDZmcgPSBjb250YWluZXIuZ2V0QXR0cmlidXRlKFwiZGF0YS16bS1jb25maWdcIik7XHJcbiAgICBpZiAoZGF0YUNmZykge1xyXG4gICAgICB0cnkgeyByZXR1cm4gSlNPTi5wYXJzZShkYXRhQ2ZnKSBhcyBTdE1hcENvbmZpZzsgfSBjYXRjaCB7IC8qIGZhbGwgdGhyb3VnaCAqLyB9XHJcbiAgICB9XHJcbiAgICAvLyBUaGVuIHRyeSBlbWJlZGRlZCBzY3JpcHQgYmxvY2tcclxuICAgIGNvbnN0IHNjcmlwdCA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yPEhUTUxTY3JpcHRFbGVtZW50PihcInNjcmlwdC56bS1jb25maWctanNvblwiKTtcclxuICAgIGlmIChzY3JpcHQ/LnRleHRDb250ZW50KSB7XHJcbiAgICAgIHRyeSB7IHJldHVybiBKU09OLnBhcnNlKHNjcmlwdC50ZXh0Q29udGVudCkgYXMgU3RNYXBDb25maWc7IH0gY2F0Y2ggeyAvKiBmYWxsIHRocm91Z2ggKi8gfVxyXG4gICAgfVxyXG4gICAgLy8gRmFsbGJhY2s6IHRyeSByZWFkaW5nIGluZGl2aWR1YWwgZGF0YS0gYXR0cmlidXRlc1xyXG4gICAgcmV0dXJuIHRoaXMubG9hZENvbmZpZ0Zyb21BdHRycyhjb250YWluZXIpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBsb2FkQ29uZmlnRnJvbUF0dHJzKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBTdE1hcENvbmZpZyB7XHJcbiAgICBjb25zdCBnZXQgPSAoa2V5OiBzdHJpbmcpID0+IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoYGRhdGEtem0tJHtrZXl9YCk7XHJcbiAgICBjb25zdCBpbWFnZVVybCA9IGdldChcImltYWdldXJsXCIpID8/IFwiXCI7XHJcbiAgICBjb25zdCBtYXJrZXJzVXJsID0gZ2V0KFwibWFya2Vyc3VybFwiKSA/PyB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBpY29uUHJvZmlsZXNSYXcgPSBnZXQoXCJpY29uc1wiKTtcclxuICAgIGNvbnN0IG92ZXJsYXlzUmF3ID0gZ2V0KFwib3ZlcmxheXNcIik7XHJcblxyXG4gICAgbGV0IGljb25Qcm9maWxlczogU3RJY29uUHJvZmlsZVtdID0gW107XHJcbiAgICB0cnkgeyBpZiAoaWNvblByb2ZpbGVzUmF3KSBpY29uUHJvZmlsZXMgPSBKU09OLnBhcnNlKGljb25Qcm9maWxlc1Jhdyk7IH0gY2F0Y2ggeyAvKiBvayAqLyB9XHJcblxyXG4gICAgbGV0IG92ZXJsYXlzOiBTdEltYWdlT3ZlcmxheVtdID0gW107XHJcbiAgICB0cnkgeyBpZiAob3ZlcmxheXNSYXcpIG92ZXJsYXlzID0gSlNPTi5wYXJzZShvdmVybGF5c1Jhdyk7IH0gY2F0Y2ggeyAvKiBvayAqLyB9XHJcblxyXG4gICAgbGV0IGluaXRpYWxDZW50ZXI6IFN0UG9pbnQgfCB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBjeCA9IGdldChcImluaXRpYWxjZW50ZXJ4XCIpO1xyXG4gICAgY29uc3QgY3kgPSBnZXQoXCJpbml0aWFsY2VudGVyeVwiKTtcclxuICAgIGlmIChjeCAhPSBudWxsICYmIGN5ICE9IG51bGwpIGluaXRpYWxDZW50ZXIgPSB7IHg6IHBhcnNlRmxvYXQoY3gpLCB5OiBwYXJzZUZsb2F0KGN5KSB9O1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIGltYWdlVXJsLFxyXG4gICAgICBtYXJrZXJzVXJsLFxyXG4gICAgICBpbWdXOiBwYXJzZUZsb2F0KGdldChcImltZ3dcIikgPz8gXCIwXCIpIHx8IDAsXHJcbiAgICAgIGltZ0g6IHBhcnNlRmxvYXQoZ2V0KFwiaW1naFwiKSA/PyBcIjBcIikgfHwgMCxcclxuICAgICAgbWluWm9vbTogcGFyc2VGbG9hdChnZXQoXCJtaW56b29tXCIpID8/IFwiMC4xXCIpLFxyXG4gICAgICBtYXhab29tOiBwYXJzZUZsb2F0KGdldChcIm1heHpvb21cIikgPz8gXCIxMFwiKSxcclxuICAgICAgd2lkdGg6IGdldChcIndpZHRoXCIpID8/IHVuZGVmaW5lZCxcclxuICAgICAgaGVpZ2h0OiBnZXQoXCJoZWlnaHRcIikgPz8gdW5kZWZpbmVkLFxyXG4gICAgICBhbGlnbjogKGdldChcImFsaWduXCIpIGFzIFN0TWFwQ29uZmlnW1wiYWxpZ25cIl0pID8/IHVuZGVmaW5lZCxcclxuICAgICAgaW5pdGlhbFpvb206IGdldChcImluaXRpYWx6b29tXCIpID8gcGFyc2VGbG9hdChnZXQoXCJpbml0aWFsem9vbVwiKSEpIDogdW5kZWZpbmVkLFxyXG4gICAgICBpbml0aWFsQ2VudGVyLFxyXG4gICAgICBpY29uUHJvZmlsZXMsXHJcbiAgICAgIG92ZXJsYXlzLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbG9hZE1hcmtlcnMoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IFN0TWFya2VyW10ge1xyXG4gICAgLy8gVHJ5IGRhdGEtbWFya2VycyBhdHRyaWJ1dGVcclxuICAgIGNvbnN0IGRhdGFNYXJrZXJzID0gY29udGFpbmVyLmdldEF0dHJpYnV0ZShcImRhdGEtem0tbWFya2Vyc1wiKTtcclxuICAgIGlmIChkYXRhTWFya2Vycykge1xyXG4gICAgICB0cnkgeyByZXR1cm4gSlNPTi5wYXJzZShkYXRhTWFya2VycykgYXMgU3RNYXJrZXJbXTsgfSBjYXRjaCB7IC8qIGZhbGwgdGhyb3VnaCAqLyB9XHJcbiAgICB9XHJcbiAgICAvLyBUcnkgZW1iZWRkZWQgc2NyaXB0XHJcbiAgICBjb25zdCBzY3JpcHQgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcjxIVE1MU2NyaXB0RWxlbWVudD4oXCJzY3JpcHQuem0tbWFya2Vycy1qc29uXCIpO1xyXG4gICAgaWYgKHNjcmlwdD8udGV4dENvbnRlbnQpIHtcclxuICAgICAgdHJ5IHsgcmV0dXJuIEpTT04ucGFyc2Uoc2NyaXB0LnRleHRDb250ZW50KSBhcyBTdE1hcmtlcltdOyB9IGNhdGNoIHsgLyogZmFsbCB0aHJvdWdoICovIH1cclxuICAgIH1cclxuICAgIHJldHVybiBbXTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgZmV0Y2hNYXJrZXJzKCk6IFByb21pc2U8U3RNYXJrZXJbXT4ge1xyXG4gICAgaWYgKCF0aGlzLmNmZy5tYXJrZXJzVXJsKSByZXR1cm4gW107XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2godGhpcy5jZmcubWFya2Vyc1VybCk7XHJcbiAgICAgIGlmICghcmVzcC5vaykgcmV0dXJuIFtdO1xyXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcC5qc29uKCk7XHJcbiAgICAgIC8vIFRoZSBtYXJrZXJzIEpTT04gZm9ybWF0IGlzIHsgbWFya2VyczogWy4uLl0sIGxheWVyczogWy4uLl0sIC4uLiB9XHJcbiAgICAgIHJldHVybiAoZGF0YT8ubWFya2VycyA/PyBbXSkgYXMgU3RNYXJrZXJbXTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgY29uc29sZS53YXJuKFwiWm9vbU1hcCBzdGF0aWM6IGZhaWxlZCB0byBsb2FkIG1hcmtlcnMgZnJvbVwiLCB0aGlzLmNmZy5tYXJrZXJzVXJsLCBlKTtcclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyogLS0tLSBET00gY29uc3RydWN0aW9uIC0tLS0gKi9cclxuXHJcbiAgcHJpdmF0ZSBidWlsZERvbSgpOiB2b2lkIHtcclxuICAgIHRoaXMuY29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gXCJyZWxhdGl2ZVwiO1xyXG4gICAgdGhpcy5jb250YWluZXIuc3R5bGUub3ZlcmZsb3cgPSBcImhpZGRlblwiO1xyXG4gICAgaWYgKHRoaXMuY2ZnLndpZHRoKSB0aGlzLmNvbnRhaW5lci5zdHlsZS53aWR0aCA9IHRoaXMuY2ZnLndpZHRoO1xyXG4gICAgaWYgKHRoaXMuY2ZnLmhlaWdodCkgdGhpcy5jb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gdGhpcy5jZmcuaGVpZ2h0O1xyXG5cclxuICAgIC8vIHZpZXdwb3J0XHJcbiAgICB0aGlzLnZpZXdwb3J0ID0gZWwoXCJkaXZcIiwgdGhpcy5jb250YWluZXIsIHt9LCBcInptLXN0LXZpZXdwb3J0XCIpIGFzIEhUTUxEaXZFbGVtZW50O1xyXG4gICAgdGhpcy52aWV3cG9ydC5zdHlsZS5jc3NUZXh0ID0gXCJwb3NpdGlvbjphYnNvbHV0ZTtpbnNldDowO292ZXJmbG93OmhpZGRlbjtjdXJzb3I6Z3JhYjtcIjtcclxuICAgIGlmICh0aGlzLmNmZy5yZXNwb25zaXZlKSB7XHJcbiAgICAgIC8vIGFzcGVjdC1yYXRpbyBib3hcclxuICAgICAgY29uc3QgYXNwZWN0ID0gdGhpcy5jZmcuaW1nVyAvIHRoaXMuY2ZnLmltZ0g7XHJcbiAgICAgIHRoaXMudmlld3BvcnQuc3R5bGUucG9zaXRpb24gPSBcInJlbGF0aXZlXCI7XHJcbiAgICAgIHRoaXMudmlld3BvcnQuc3R5bGUud2lkdGggPSBcIjEwMCVcIjtcclxuICAgICAgdGhpcy52aWV3cG9ydC5zdHlsZS5hc3BlY3RSYXRpbyA9IFN0cmluZyhhc3BlY3QpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIHdvcmxkIChwYW5uYWJsZS96b29tYWJsZSBjb250YWluZXIpXHJcbiAgICB0aGlzLndvcmxkID0gZWwoXCJkaXZcIiwgdGhpcy52aWV3cG9ydCwge30sIFwiem0tc3Qtd29ybGRcIikgYXMgSFRNTERpdkVsZW1lbnQ7XHJcbiAgICB0aGlzLndvcmxkLnN0eWxlLmNzc1RleHQgPSBcInBvc2l0aW9uOmFic29sdXRlO3RyYW5zZm9ybS1vcmlnaW46MCAwO3dpbGwtY2hhbmdlOnRyYW5zZm9ybTtcIjtcclxuXHJcbiAgICAvLyBiYXNlIGltYWdlXHJcbiAgICB0aGlzLmltZ0VsID0gZWwoXCJpbWdcIiwgdGhpcy53b3JsZCkgYXMgSFRNTEltYWdlRWxlbWVudDtcclxuICAgIHRoaXMuaW1nRWwuc3R5bGUuY3NzVGV4dCA9IFwicG9zaXRpb246YWJzb2x1dGU7dG9wOjA7bGVmdDowO2Rpc3BsYXk6YmxvY2s7cG9pbnRlci1ldmVudHM6bm9uZTt1c2VyLXNlbGVjdDpub25lO1wiO1xyXG4gICAgdGhpcy5pbWdFbC5kcmFnZ2FibGUgPSBmYWxzZTtcclxuXHJcbiAgICAvLyBvdmVybGF5cyBjb250YWluZXJcclxuICAgIHRoaXMub3ZlcmxheXNFbCA9IGVsKFwiZGl2XCIsIHRoaXMud29ybGQsIHt9LCBcInptLXN0LW92ZXJsYXlzXCIpIGFzIEhUTUxEaXZFbGVtZW50O1xyXG4gICAgdGhpcy5vdmVybGF5c0VsLnN0eWxlLmNzc1RleHQgPSBcInBvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDt3aWR0aDoxMDAlO2hlaWdodDoxMDAlO3BvaW50ZXItZXZlbnRzOm5vbmU7XCI7XHJcblxyXG4gICAgLy8gbWFya2VycyBjb250YWluZXJcclxuICAgIHRoaXMubWFya2Vyc0VsID0gZWwoXCJkaXZcIiwgdGhpcy53b3JsZCwge30sIFwiem0tc3QtbWFya2Vyc1wiKSBhcyBIVE1MRGl2RWxlbWVudDtcclxuICAgIHRoaXMubWFya2Vyc0VsLnN0eWxlLmNzc1RleHQgPSBcInBvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDt3aWR0aDoxMDAlO2hlaWdodDoxMDAlO3BvaW50ZXItZXZlbnRzOm5vbmU7XCI7XHJcblxyXG4gICAgLy8gem9vbSBIVURcclxuICAgIHRoaXMuYnVpbGRab29tSHVkKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGJ1aWxkWm9vbUh1ZCgpOiB2b2lkIHtcclxuICAgIHRoaXMuem9vbUh1ZCA9IGVsKFwiZGl2XCIsIHRoaXMuY29udGFpbmVyLCB7fSwgXCJ6bS1zdC16b29taHVkXCIpIGFzIEhUTUxEaXZFbGVtZW50O1xyXG4gICAgdGhpcy56b29tSHVkLnN0eWxlLmNzc1RleHQgPVxyXG4gICAgICBcInBvc2l0aW9uOmFic29sdXRlO2JvdHRvbTo4cHg7cmlnaHQ6OHB4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjRweDtcIiArXHJcbiAgICAgIFwiYmFja2dyb3VuZDpyZ2JhKDAsMCwwLDAuNik7Y29sb3I6I2ZmZjtib3JkZXItcmFkaXVzOjZweDtwYWRkaW5nOjRweCA4cHg7XCIgK1xyXG4gICAgICBcImZvbnQtc2l6ZToxM3B4O2ZvbnQtZmFtaWx5OnNhbnMtc2VyaWY7ei1pbmRleDoxMDA7dXNlci1zZWxlY3Q6bm9uZTtcIjtcclxuXHJcbiAgICB0aGlzLnpvb21PdXRCdG4gPSBlbChcImJ1dHRvblwiLCB0aGlzLnpvb21IdWQsIHt9LCBcInptLXN0LXpvb21idG5cIikgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICB0aGlzLnpvb21PdXRCdG4udGV4dENvbnRlbnQgPSBcIlx1MjIxMlwiO1xyXG4gICAgdGhpcy56b29tT3V0QnRuLnN0eWxlLmNzc1RleHQgPVxyXG4gICAgICBcImJhY2tncm91bmQ6bm9uZTtib3JkZXI6MXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4zKTtjb2xvcjojZmZmO1wiICtcclxuICAgICAgXCJib3JkZXItcmFkaXVzOjNweDt3aWR0aDoyNHB4O2hlaWdodDoyNHB4O2N1cnNvcjpwb2ludGVyO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtcIjtcclxuXHJcbiAgICB0aGlzLnpvb21QZXJjZW50RWwgPSBlbChcInNwYW5cIiwgdGhpcy56b29tSHVkKSBhcyBIVE1MU3BhbkVsZW1lbnQ7XHJcbiAgICB0aGlzLnpvb21QZXJjZW50RWwuc3R5bGUuY3NzVGV4dCA9IFwibWluLXdpZHRoOjQ4cHg7dGV4dC1hbGlnbjpjZW50ZXI7XCI7XHJcblxyXG4gICAgdGhpcy56b29tSW5CdG4gPSBlbChcImJ1dHRvblwiLCB0aGlzLnpvb21IdWQsIHt9LCBcInptLXN0LXpvb21idG5cIikgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICB0aGlzLnpvb21JbkJ0bi50ZXh0Q29udGVudCA9IFwiK1wiO1xyXG4gICAgdGhpcy56b29tSW5CdG4uc3R5bGUuY3NzVGV4dCA9IHRoaXMuem9vbU91dEJ0bi5zdHlsZS5jc3NUZXh0O1xyXG5cclxuICAgIHRoaXMuem9vbUluQnRuLm9uY2xpY2sgPSAoKSA9PiB0aGlzLnpvb21BdCgxLjMpO1xyXG4gICAgdGhpcy56b29tT3V0QnRuLm9uY2xpY2sgPSAoKSA9PiB0aGlzLnpvb21BdCgxIC8gMS4zKTtcclxuICAgIHRoaXMudXBkYXRlWm9vbUh1ZCgpO1xyXG4gIH1cclxuXHJcbiAgLyogLS0tLSBiYXNlIGltYWdlIGxvYWRpbmcgLS0tLSAqL1xyXG5cclxuICBwcml2YXRlIGFzeW5jIGxvYWRCYXNlSW1hZ2UoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAoIXRoaXMuY2ZnLmltYWdlVXJsKSByZXR1cm47XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcclxuICAgICAgdGhpcy5pbWdFbC5vbmxvYWQgPSAoKSA9PiB7XHJcbiAgICAgICAgLy8gVXNlIG5hdHVyYWwgZGltZW5zaW9ucyB1bmxlc3MgY29uZmlnIGV4cGxpY2l0bHkgc3BlY2lmaWVkIHRoZW1cclxuICAgICAgICBpZiAoIXRoaXMuaW1nVyB8fCAhdGhpcy5pbWdIKSB7XHJcbiAgICAgICAgICB0aGlzLmltZ1cgPSB0aGlzLmltZ0VsLm5hdHVyYWxXaWR0aDtcclxuICAgICAgICAgIHRoaXMuaW1nSCA9IHRoaXMuaW1nRWwubmF0dXJhbEhlaWdodDtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5pbWdMb2FkZWQgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMud29ybGQuc3R5bGUud2lkdGggPSBgJHt0aGlzLmltZ1d9cHhgO1xyXG4gICAgICAgIHRoaXMud29ybGQuc3R5bGUuaGVpZ2h0ID0gYCR7dGhpcy5pbWdIfXB4YDtcclxuICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgIH07XHJcbiAgICAgIHRoaXMuaW1nRWwub25lcnJvciA9ICgpID0+IHJlc29sdmUoKTtcclxuICAgICAgdGhpcy5pbWdFbC5zcmMgPSB0aGlzLmNmZy5pbWFnZVVybDtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyogLS0tLSBpbml0aWFsIHZpZXcgLS0tLSAqL1xyXG5cclxuICBwcml2YXRlIGFwcGx5SW5pdGlhbFZpZXcoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5jZmcuaW5pdGlhbFZpZXdSZWN0KSB7XHJcbiAgICAgIHRoaXMuZml0VG9SZWN0KHRoaXMuY2ZnLmluaXRpYWxWaWV3UmVjdCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBsZXQgeiA9IHRoaXMuY2ZnLmluaXRpYWxab29tO1xyXG4gICAgICBpZiAoeiA9PSBudWxsKSB7XHJcbiAgICAgICAgeiA9IHRoaXMuY2FsY0ZpdFNjYWxlKCk7XHJcbiAgICAgIH1cclxuICAgICAgLy8gU3VwcG9ydCBub3JtYWxpemVkIGluaXRpYWwtY2VudGVyICgwLTEgcmFuZ2UsIGUuZy4gZnJvbSB6b29tbWFwIFlBTUwgdmlldy5jZW50ZXJYL1kpXHJcbiAgICAgIGNvbnN0IGljID0gdGhpcy5jZmcuaW5pdGlhbENlbnRlcjtcclxuICAgICAgbGV0IGN4OiBudW1iZXIsIGN5OiBudW1iZXI7XHJcbiAgICAgIGlmIChpYyAmJiBpYy54IDw9IDEgJiYgaWMueSA8PSAxICYmIGljLnggPj0gMCAmJiBpYy55ID49IDApIHtcclxuICAgICAgICAvLyBUcmVhdCBhcyBub3JtYWxpemVkIGZyYWN0aW9uIG9mIGltYWdlIGRpbWVuc2lvbnNcclxuICAgICAgICBjeCA9IGljLnggKiB0aGlzLmltZ1c7XHJcbiAgICAgICAgY3kgPSBpYy55ICogdGhpcy5pbWdIO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGN4ID0gaWM/LnggPz8gdGhpcy5pbWdXIC8gMjtcclxuICAgICAgICBjeSA9IGljPy55ID8/IHRoaXMuaW1nSCAvIDI7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5zZXRWaWV3KHosIGN4LCBjeSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNhbGNGaXRTY2FsZSgpOiBudW1iZXIge1xyXG4gICAgY29uc3QgdncgPSB0aGlzLnZpZXdwb3J0LmNsaWVudFdpZHRoIHx8IDE7XHJcbiAgICBjb25zdCB2aCA9IHRoaXMudmlld3BvcnQuY2xpZW50SGVpZ2h0IHx8IDE7XHJcbiAgICBjb25zdCBzID0gTWF0aC5taW4odncgLyAodGhpcy5pbWdXIHx8IDEpLCB2aCAvICh0aGlzLmltZ0ggfHwgMSkpO1xyXG4gICAgcmV0dXJuIE1hdGgubWF4KHRoaXMuY2ZnLm1pblpvb20sIE1hdGgubWluKHRoaXMuY2ZnLm1heFpvb20sIHMpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZml0VG9SZWN0KHI6IFN0UmVjdCk6IHZvaWQge1xyXG4gICAgY29uc3QgcncgPSByLnJpZ2h0IC0gci5sZWZ0O1xyXG4gICAgY29uc3QgcmggPSByLmJvdHRvbSAtIHIudG9wO1xyXG4gICAgaWYgKHJ3IDw9IDAgfHwgcmggPD0gMCkgcmV0dXJuO1xyXG4gICAgY29uc3QgdncgPSB0aGlzLnZpZXdwb3J0LmNsaWVudFdpZHRoIHx8IDE7XHJcbiAgICBjb25zdCB2aCA9IHRoaXMudmlld3BvcnQuY2xpZW50SGVpZ2h0IHx8IDE7XHJcbiAgICBjb25zdCBzID0gTWF0aC5taW4odncgLyBydywgdmggLyByaCk7XHJcbiAgICBjb25zdCBjeCA9IHIubGVmdCArIHJ3IC8gMjtcclxuICAgIGNvbnN0IGN5ID0gci50b3AgKyByaCAvIDI7XHJcbiAgICB0aGlzLnNldFZpZXcocywgY3gsIGN5KTtcclxuICB9XHJcblxyXG4gIGZpdFRvVmlldygpOiB2b2lkIHtcclxuICAgIGNvbnN0IHogPSB0aGlzLmNhbGNGaXRTY2FsZSgpO1xyXG4gICAgdGhpcy5zZXRWaWV3KHosIHRoaXMuaW1nVyAvIDIsIHRoaXMuaW1nSCAvIDIpO1xyXG4gIH1cclxuXHJcbiAgLyogLS0tLSB2aWV3IGNvbnRyb2wgLS0tLSAqL1xyXG5cclxuICBwcml2YXRlIHNldFZpZXcoc2NhbGU6IG51bWJlciwgd29ybGRDeDogbnVtYmVyLCB3b3JsZEN5OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMuc2NhbGUgPSBNYXRoLm1heCh0aGlzLmNmZy5taW5ab29tLCBNYXRoLm1pbih0aGlzLmNmZy5tYXhab29tLCBzY2FsZSkpO1xyXG4gICAgY29uc3QgdncgPSB0aGlzLnZpZXdwb3J0LmNsaWVudFdpZHRoIHx8IDE7XHJcbiAgICBjb25zdCB2aCA9IHRoaXMudmlld3BvcnQuY2xpZW50SGVpZ2h0IHx8IDE7XHJcbiAgICB0aGlzLnR4ID0gdncgLyAyIC0gd29ybGRDeCAqIHRoaXMuc2NhbGU7XHJcbiAgICB0aGlzLnR5ID0gdmggLyAyIC0gd29ybGRDeSAqIHRoaXMuc2NhbGU7XHJcbiAgICB0aGlzLmFwcGx5VHJhbnNmb3JtKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHpvb21BdChmYWN0b3I6IG51bWJlciwgY3g/OiBudW1iZXIsIGN5PzogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBjb25zdCB2dyA9IHRoaXMudmlld3BvcnQuY2xpZW50V2lkdGggfHwgMTtcclxuICAgIGNvbnN0IHZoID0gdGhpcy52aWV3cG9ydC5jbGllbnRIZWlnaHQgfHwgMTtcclxuICAgIGNvbnN0IHN4ID0gY3ggPz8gdncgLyAyO1xyXG4gICAgY29uc3Qgc3kgPSBjeSA/PyB2aCAvIDI7XHJcbiAgICBjb25zdCB3b3JsZFggPSAoc3ggLSB0aGlzLnR4KSAvIHRoaXMuc2NhbGU7XHJcbiAgICBjb25zdCB3b3JsZFkgPSAoc3kgLSB0aGlzLnR5KSAvIHRoaXMuc2NhbGU7XHJcbiAgICBjb25zdCBuZXdTY2FsZSA9IE1hdGgubWF4KFxyXG4gICAgICB0aGlzLmNmZy5taW5ab29tLFxyXG4gICAgICBNYXRoLm1pbih0aGlzLmNmZy5tYXhab29tLCB0aGlzLnNjYWxlICogZmFjdG9yKSxcclxuICAgICk7XHJcbiAgICBpZiAobmV3U2NhbGUgPT09IHRoaXMuc2NhbGUpIHJldHVybjtcclxuICAgIHRoaXMudHggPSBzeCAtIHdvcmxkWCAqIG5ld1NjYWxlO1xyXG4gICAgdGhpcy50eSA9IHN5IC0gd29ybGRZICogbmV3U2NhbGU7XHJcbiAgICB0aGlzLnNjYWxlID0gbmV3U2NhbGU7XHJcbiAgICB0aGlzLmFwcGx5VHJhbnNmb3JtKCk7XHJcbiAgICB0aGlzLnJlbmRlck1hcmtlcnMoKTtcclxuICAgIHRoaXMudXBkYXRlWm9vbUh1ZCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhcHBseVRyYW5zZm9ybSgpOiB2b2lkIHtcclxuICAgIHRoaXMud29ybGQuc3R5bGUudHJhbnNmb3JtID0gYHRyYW5zbGF0ZSgke3RoaXMudHh9cHgsICR7dGhpcy50eX1weCkgc2NhbGUoJHt0aGlzLnNjYWxlfSlgO1xyXG4gICAgaWYgKHRoaXMuZ3JpZFN2ZykgdGhpcy51cGRhdGVHcmlkVHJhbnNmb3JtKCk7XHJcbiAgfVxyXG5cclxuICAvKiAtLS0tIG1hcmtlciByZW5kZXJpbmcgLS0tLSAqL1xyXG5cclxuICBwcml2YXRlIHJlbmRlck1hcmtlcnMoKTogdm9pZCB7XHJcbiAgICB0aGlzLmNsb3NlUG9wb3ZlcigpO1xyXG4gICAgLy8gQ2xlYXJcclxuICAgIHdoaWxlICh0aGlzLm1hcmtlcnNFbC5maXJzdENoaWxkKSB0aGlzLm1hcmtlcnNFbC5yZW1vdmVDaGlsZCh0aGlzLm1hcmtlcnNFbC5maXJzdENoaWxkKTtcclxuXHJcbiAgICBjb25zdCBzID0gdGhpcy5zY2FsZTtcclxuICAgIGZvciAoY29uc3QgbSBvZiB0aGlzLm1hcmtlcnMpIHtcclxuICAgICAgLy8gem9vbSB2aXNpYmlsaXR5XHJcbiAgICAgIGlmIChtLm1pblpvb20gIT09IHVuZGVmaW5lZCAmJiBzIDwgbS5taW5ab29tKSBjb250aW51ZTtcclxuICAgICAgaWYgKG0ubWF4Wm9vbSAhPT0gdW5kZWZpbmVkICYmIHMgPiBtLm1heFpvb20pIGNvbnRpbnVlO1xyXG5cclxuICAgICAgY29uc3QgaWNvbiA9IHRoaXMuaWNvbk1hcC5nZXQobS5pY29uS2V5ID8/IFwiX19kZWZhdWx0X19cIik7XHJcbiAgICAgIGlmICghaWNvbiAmJiAhbS5pY29uS2V5KSB7XHJcbiAgICAgICAgLy8gSWYgbm8gaWNvbiBrZXkgYW5kIG5vIHByb2ZpbGUsIGNyZWF0ZSBhIHNpbXBsZSBkb3RcclxuICAgICAgICB0aGlzLnJlbmRlclNpbXBsZU1hcmtlcihtKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoIWljb24pIHtcclxuICAgICAgICAvLyBVbmtub3duIGljb24ga2V5IFx1MjAxMyByZW5kZXIgYXMgc2ltcGxlIG1hcmtlclxyXG4gICAgICAgIHRoaXMucmVuZGVyU2ltcGxlTWFya2VyKG0pO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBiYXNlU2l6ZSA9ICh0eXBlb2YgKG0gYXMgYW55KS5zaXplT3ZlcnJpZGUgPT09IFwibnVtYmVyXCIgJiYgKG0gYXMgYW55KS5zaXplT3ZlcnJpZGUgPiAwKSA/IChtIGFzIGFueSkuc2l6ZU92ZXJyaWRlIDogaWNvbi5zaXplO1xyXG4gICAgICBjb25zdCBzY2FsZU11bCA9IG0uc2NhbGUgPz8gMTtcclxuICAgICAgY29uc3Qgc2l6ZSA9IGJhc2VTaXplICogc2NhbGVNdWw7XHJcbiAgICAgIGNvbnN0IGF4ID0gaWNvbi5hbmNob3JYO1xyXG4gICAgICBjb25zdCBheSA9IGljb24uYW5jaG9yWTtcclxuXHJcbiAgICAgIGNvbnN0IGxlZnRQeCA9IG0ueCAqIHRoaXMuaW1nVztcclxuICAgICAgY29uc3QgdG9wUHggPSBtLnkgKiB0aGlzLmltZ0g7XHJcblxyXG4gICAgICBjb25zdCBob3N0ID0gZWwoXCJkaXZcIiwgdGhpcy5tYXJrZXJzRWwsIHt9LCBcInptLXN0LW1hcmtlclwiKSBhcyBIVE1MRGl2RWxlbWVudDtcclxuICAgICAgaG9zdC5zdHlsZS5jc3NUZXh0ID0gYHBvc2l0aW9uOmFic29sdXRlO2xlZnQ6JHtsZWZ0UHh9cHg7dG9wOiR7dG9wUHh9cHg7cG9pbnRlci1ldmVudHM6YXV0bzt6LWluZGV4OjEwO2A7XHJcblxyXG4gICAgICBjb25zdCBhbmNob3IgPSBlbChcImRpdlwiLCBob3N0KSBhcyBIVE1MRGl2RWxlbWVudDtcclxuICAgICAgYW5jaG9yLnN0eWxlLmNzc1RleHQgPSBgdHJhbnNmb3JtOnRyYW5zbGF0ZSgkey1heH1weCwgJHstYXl9cHgpO2A7XHJcblxyXG4gICAgICBjb25zdCBpbWcgPSBlbChcImltZ1wiLCBhbmNob3IsIHt9LCBcInptLXN0LW1hcmtlci1pY29uXCIpIGFzIEhUTUxJbWFnZUVsZW1lbnQ7XHJcbiAgICAgIGltZy5zcmMgPSBpY29uLnVybDtcclxuICAgICAgaW1nLnN0eWxlLndpZHRoID0gYCR7c2l6ZX1weGA7XHJcbiAgICAgIGltZy5zdHlsZS5oZWlnaHQgPSBcImF1dG9cIjtcclxuICAgICAgaW1nLmRyYWdnYWJsZSA9IGZhbHNlO1xyXG4gICAgICBpbWcuc3R5bGUucG9pbnRlckV2ZW50cyA9IFwibm9uZVwiO1xyXG5cclxuICAgICAgaWYgKGljb24ucm90YXRpb25EZWcpIHtcclxuICAgICAgICBob3N0LnN0eWxlLnRyYW5zZm9ybSA9IGByb3RhdGUoJHtpY29uLnJvdGF0aW9uRGVnfWRlZylgO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChpY29uLnNoYWRvd0VuYWJsZWQpIHtcclxuICAgICAgICBjb25zdCBzYyA9IGljb24uc2hhZG93Q29sb3IgPz8gXCJyZ2JhKDAsMCwwLDAuMzUpXCI7XHJcbiAgICAgICAgY29uc3QgYmx1ciA9IGljb24uc2hhZG93Qmx1clB4ID8/IDM7XHJcbiAgICAgICAgY29uc3Qgc3ggPSBpY29uLnNoYWRvd09mZnNldFhQeCA/PyAxO1xyXG4gICAgICAgIGNvbnN0IHN5ID0gaWNvbi5zaGFkb3dPZmZzZXRZUHggPz8gMTtcclxuICAgICAgICBpbWcuc3R5bGUuZmlsdGVyID0gYGRyb3Atc2hhZG93KCR7c3h9cHggJHtzeX1weCAke2JsdXJ9cHggJHtzY30pYDtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gdG9vbHRpcFxyXG4gICAgICBpZiAobS50b29sdGlwKSB7XHJcbiAgICAgICAgaG9zdC50aXRsZSA9IG0udG9vbHRpcDtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gY2xpY2s6IG9wZW4gbGlua1xyXG4gICAgICBpZiAobS5saW5rKSB7XHJcbiAgICAgICAgaG9zdC5zdHlsZS5jdXJzb3IgPSBcInBvaW50ZXJcIjtcclxuICAgICAgICBob3N0LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xyXG4gICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgIHdpbmRvdy5vcGVuKG5vcm1hbGl6ZUxpbmsobS5saW5rISksIFwiX3NlbGZcIik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIGhvdmVyIHBvcG92ZXIgXHUyMDEzIHNob3cgZm9yIHRvb2x0aXAgYW5kL29yIGxpbmtlZCBtYXJrZXJzXHJcbiAgICAgIGlmIChtLnRvb2x0aXAgfHwgbS5saW5rKSB7XHJcbiAgICAgICAgaG9zdC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VlbnRlclwiLCAoKSA9PiB0aGlzLnNob3dUb29sdGlwKGhvc3QsIG0pKTtcclxuICAgICAgICBob3N0LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWxlYXZlXCIsICgpID0+IHRoaXMuaGlkZVRvb2x0aXAoKSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyU2ltcGxlTWFya2VyKG06IE1hcmtlcik6IHZvaWQge1xyXG4gICAgY29uc3QgZG90ID0gZWwoXCJkaXZcIiwgdGhpcy5tYXJrZXJzRWwsIHt9LCBcInptLXN0LXNpbXBsZS1tYXJrZXJcIikgYXMgSFRNTERpdkVsZW1lbnQ7XHJcbiAgICBkb3Quc3R5bGUuY3NzVGV4dCA9XHJcbiAgICAgIGBwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OiR7bS54ICogdGhpcy5pbWdXfXB4O3RvcDoke20ueSAqIHRoaXMuaW1nSH1weDtgICtcclxuICAgICAgXCJ3aWR0aDoxMHB4O2hlaWdodDoxMHB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6I2U3NGMzYztib3JkZXI6MnB4IHNvbGlkICNmZmY7XCIgK1xyXG4gICAgICBcInRyYW5zZm9ybTp0cmFuc2xhdGUoLTVweCwtNXB4KTtwb2ludGVyLWV2ZW50czphdXRvO3otaW5kZXg6MTA7Y3Vyc29yOnBvaW50ZXI7Ym94LXNoYWRvdzowIDFweCAzcHggcmdiYSgwLDAsMCwwLjMpO1wiO1xyXG5cclxuICAgIGlmIChtLnRvb2x0aXApIGRvdC50aXRsZSA9IG0udG9vbHRpcDtcclxuICAgIGlmIChtLmxpbmspIHtcclxuICAgICAgZG90LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xyXG4gICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgd2luZG93Lm9wZW4obm9ybWFsaXplTGluayhtLmxpbmshKSwgXCJfc2VsZlwiKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICAvLyBob3ZlciBwcmV2aWV3IGZvciBzaW1wbGUgbWFya2VycyB0b29cclxuICAgIGlmIChtLnRvb2x0aXAgfHwgbS5saW5rKSB7XHJcbiAgICAgIGRvdC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VlbnRlclwiLCAoKSA9PiB0aGlzLnNob3dUb29sdGlwKGRvdCwgbSkpO1xyXG4gICAgICBkb3QuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbGVhdmVcIiwgKCkgPT4gdGhpcy5oaWRlVG9vbHRpcCgpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qIC0tLS0gdG9vbHRpcCB3aXRoIHBhZ2UtY29udGVudCBwcmV2aWV3IC0tLS0gKi9cclxuXHJcbiAgcHJpdmF0ZSB0b29sdGlwRWw6IEhUTUxEaXZFbGVtZW50IHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSB0b29sdGlwSG9zdDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcclxuICAvKiogVW5pcXVlIGlkIHBlciBtYXJrZXIgc28gd2UgY2FuIGRpc2NhcmQgc3RhbGUgYXN5bmMgcHJldmlldyByZXNwb25zZXMgKi9cclxuICBwcml2YXRlIHRvb2x0aXBNYXJrZXJJZCA9IFwiXCI7XHJcbiAgcHJpdmF0ZSB0b29sdGlwVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSB0b29sdGlwUHJldmlld0ZldGNoZWQgPSBmYWxzZTtcclxuXHJcbiAgcHJpdmF0ZSBzaG93VG9vbHRpcChob3N0OiBIVE1MRWxlbWVudCwgbTogU3RNYXJrZXIpOiB2b2lkIHtcclxuICAgIC8vIENsZWFyIGFueSBwZW5kaW5nIGhpZGVcclxuICAgIGlmICh0aGlzLnRvb2x0aXBUaW1lcikgeyBjbGVhclRpbWVvdXQodGhpcy50b29sdGlwVGltZXIpOyB0aGlzLnRvb2x0aXBUaW1lciA9IG51bGw7IH1cclxuXHJcbiAgICAvLyBJZiBhbHJlYWR5IHNob3dpbmcgZm9yIHRoZSAqc2FtZSogbWFya2VyLCBkbyBub3RoaW5nXHJcbiAgICBpZiAodGhpcy50b29sdGlwRWwgJiYgdGhpcy50b29sdGlwTWFya2VySWQgPT09IChtLmlkIHx8IFwiXCIpKSB7XHJcbiAgICAgIC8vIFN0aWxsIGVuc3VyZSB0b29sdGlwIGlzIHZpc2libGUgKGZhZGUgbWF5IGhhdmUgYmVlbiBpbnRlcnJ1cHRlZClcclxuICAgICAgdGhpcy50b29sdGlwRWwuc3R5bGUub3BhY2l0eSA9IFwiMVwiO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5kaXNwb3NlVG9vbHRpcCgpO1xyXG5cclxuICAgIGNvbnN0IGlkID0gbS5pZCB8fCBcIm1hcmtlci1cIiArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpO1xyXG4gICAgdGhpcy50b29sdGlwTWFya2VySWQgPSBpZDtcclxuICAgIHRoaXMudG9vbHRpcEhvc3QgPSBob3N0O1xyXG4gICAgdGhpcy50b29sdGlwUHJldmlld0ZldGNoZWQgPSBmYWxzZTtcclxuXHJcbiAgICBjb25zdCB0aXAgPSBlbChcImRpdlwiLCBkb2N1bWVudC5ib2R5LCB7fSwgXCJ6bS1zdC10b29sdGlwXCIpIGFzIEhUTUxEaXZFbGVtZW50O1xyXG4gICAgdGlwLmlubmVySFRNTCA9IGJ1aWxkVG9vbHRpcENvbnRlbnQobSk7XHJcbiAgICB0aGlzLnRvb2x0aXBFbCA9IHRpcDtcclxuXHJcbiAgICAvLyAtLS0gQWxsb3cgaG92ZXIgaW50byB0b29sdGlwIChtYXRjaGVzIERHIGJlaGF2aW9yKSAtLS1cclxuICAgIHRpcC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VlbnRlclwiLCAoKSA9PiB7XHJcbiAgICAgIGlmICh0aGlzLnRvb2x0aXBUaW1lcikgeyBjbGVhclRpbWVvdXQodGhpcy50b29sdGlwVGltZXIpOyB0aGlzLnRvb2x0aXBUaW1lciA9IG51bGw7IH1cclxuICAgICAgaWYgKHRoaXMudG9vbHRpcEVsKSB0aGlzLnRvb2x0aXBFbC5zdHlsZS5vcGFjaXR5ID0gXCIxXCI7XHJcbiAgICB9KTtcclxuICAgIHRpcC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VsZWF2ZVwiLCAoKSA9PiB0aGlzLmhpZGVUb29sdGlwKCkpO1xyXG5cclxuICAgIC8vIElmIGl0J3MgYSBnbG9iYWwgdGlwLCBjbGVhbiBpdCB1cFxyXG4gICAgaWYgKGdsb2JhbEFjdGl2ZVRpcCAmJiBnbG9iYWxBY3RpdmVUaXAudGlwICE9PSB0aXApIHtcclxuICAgICAgZ2xvYmFsQWN0aXZlVGlwLnRpcC5yZW1vdmUoKTtcclxuICAgIH1cclxuICAgIGdsb2JhbEFjdGl2ZVRpcCA9IHsgdGlwLCBtYXJrZXJJZDogaWQgfTtcclxuXHJcbiAgICB0aGlzLnJlcG9zaXRpb25Ub29sdGlwKGhvc3QpO1xyXG5cclxuICAgIC8vIEZhZGUgaW4gKG1hdGNoIERHJ3Mgb3BhY2l0eSB0cmFuc2l0aW9uKVxyXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcclxuICAgICAgaWYgKHRoaXMudG9vbHRpcEVsID09PSB0aXApIHRoaXMudG9vbHRpcEVsLmNsYXNzTGlzdC5hZGQoXCJ6bS1zdC10b29sdGlwLXZpc2libGVcIik7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTdGFydCBhc3luYyBwYWdlIHByZXZpZXcgZmV0Y2ggaWYgdGhlIG1hcmtlciBoYXMgYSBsaW5rXHJcbiAgICBpZiAobS5saW5rKSB7XHJcbiAgICAgIGNvbnN0IHVybCA9IG5vcm1hbGl6ZUxpbmsobS5saW5rISk7XHJcbiAgICAgIGNvbnN0IGNhcHR1cmVkSWQgPSBpZDtcclxuICAgICAgZmV0Y2hQYWdlUHJldmlldyh1cmwpLnRoZW4oKHByZXZpZXdIdG1sKSA9PiB7XHJcbiAgICAgICAgLy8gR3VhcmQ6IHN0aWxsIHRoZSBzYW1lIHRvb2x0aXA/XHJcbiAgICAgICAgaWYgKHRoaXMudG9vbHRpcE1hcmtlcklkICE9PSBjYXB0dXJlZElkIHx8ICF0aGlzLnRvb2x0aXBFbCkgcmV0dXJuO1xyXG4gICAgICAgIHRoaXMudG9vbHRpcFByZXZpZXdGZXRjaGVkID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLnRvb2x0aXBFbC5pbm5lckhUTUwgPSBidWlsZFRvb2x0aXBDb250ZW50KG0sIHByZXZpZXdIdG1sKTtcclxuICAgICAgICB0aGlzLnJlcG9zaXRpb25Ub29sdGlwKGhvc3QpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVwb3NpdGlvblRvb2x0aXAoaG9zdDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy50b29sdGlwRWwpIHJldHVybjtcclxuICAgIGNvbnN0IHIgPSBob3N0LmdldENsaWVudFJlY3RzKClbaG9zdC5nZXRDbGllbnRSZWN0cygpLmxlbmd0aCAtIDFdIHx8IGhvc3QuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICBjb25zdCB2aWV3cG9ydFdpZHRoID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoO1xyXG4gICAgY29uc3Qgdmlld3BvcnRIZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XHJcbiAgICBjb25zdCBnYXAgPSAxMjtcclxuICAgIGNvbnN0IGVkZ2VQYWRkaW5nID0gMTA7XHJcblxyXG4gICAgY29uc3Qgc3BhY2VCZWxvdyA9IHZpZXdwb3J0SGVpZ2h0IC0gKHIuYm90dG9tKTtcclxuICAgIGNvbnN0IHNwYWNlQWJvdmUgPSByLnRvcDtcclxuICAgIGNvbnN0IHNwYWNlUmlnaHQgPSB2aWV3cG9ydFdpZHRoIC0gKHIucmlnaHQpO1xyXG4gICAgY29uc3Qgc3BhY2VMZWZ0ID0gci5sZWZ0O1xyXG5cclxuICAgIC8vIFByZWZlciBlZGdlIGF3YXkgZnJvbSBwb2ludGVyIChsaWtlIERHKVxyXG4gICAgY29uc3QgcGxhY2VCZWxvdyA9IHNwYWNlQmVsb3cgPj0gdGhpcy50b29sdGlwRWwub2Zmc2V0SGVpZ2h0ICsgZ2FwO1xyXG4gICAgY29uc3QgcGxhY2VSaWdodCA9IHNwYWNlUmlnaHQgPj0gdGhpcy50b29sdGlwRWwub2Zmc2V0V2lkdGggKyBnYXA7XHJcblxyXG4gICAgbGV0IHRvcDogbnVtYmVyO1xyXG4gICAgbGV0IGxlZnQ6IG51bWJlcjtcclxuXHJcbiAgICBpZiAocGxhY2VCZWxvdykge1xyXG4gICAgICB0b3AgPSByLmJvdHRvbSArIGdhcDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRvcCA9IHIudG9wIC0gdGhpcy50b29sdGlwRWwub2Zmc2V0SGVpZ2h0IC0gZ2FwO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChwbGFjZVJpZ2h0KSB7XHJcbiAgICAgIGxlZnQgPSByLmxlZnQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBsZWZ0ID0gci5yaWdodCAtIHRoaXMudG9vbHRpcEVsLm9mZnNldFdpZHRoO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENsYW1wIHRvIHZpZXdwb3J0IGVkZ2VzXHJcbiAgICBpZiAodG9wIDwgZWRnZVBhZGRpbmcpIHRvcCA9IGVkZ2VQYWRkaW5nO1xyXG4gICAgaWYgKHRvcCArIHRoaXMudG9vbHRpcEVsLm9mZnNldEhlaWdodCArIGVkZ2VQYWRkaW5nID4gdmlld3BvcnRIZWlnaHQpIHtcclxuICAgICAgdG9wID0gdmlld3BvcnRIZWlnaHQgLSB0aGlzLnRvb2x0aXBFbC5vZmZzZXRIZWlnaHQgLSBlZGdlUGFkZGluZztcclxuICAgIH1cclxuICAgIGlmIChsZWZ0IDwgZWRnZVBhZGRpbmcpIGxlZnQgPSBlZGdlUGFkZGluZztcclxuICAgIGlmIChsZWZ0ICsgdGhpcy50b29sdGlwRWwub2Zmc2V0V2lkdGggKyBlZGdlUGFkZGluZyA+IHZpZXdwb3J0V2lkdGgpIHtcclxuICAgICAgbGVmdCA9IHZpZXdwb3J0V2lkdGggLSB0aGlzLnRvb2x0aXBFbC5vZmZzZXRXaWR0aCAtIGVkZ2VQYWRkaW5nO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMudG9vbHRpcEVsLnN0eWxlLmxlZnQgPSBgJHtsZWZ0fXB4YDtcclxuICAgIHRoaXMudG9vbHRpcEVsLnN0eWxlLnRvcCA9IGAke3RvcH1weGA7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhpZGVUb29sdGlwKCk6IHZvaWQge1xyXG4gICAgLy8gU21hbGwgZGVsYXkgc28gcmFwaWQgbW91c2Utb3V0L2luIGRvZXNuJ3QgZmxpY2tlciAoREcgdXNlcyAxMDBtcylcclxuICAgIGlmICh0aGlzLnRvb2x0aXBUaW1lcikgY2xlYXJUaW1lb3V0KHRoaXMudG9vbHRpcFRpbWVyKTtcclxuICAgIHRoaXMudG9vbHRpcFRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIHRoaXMuZGlzcG9zZVRvb2x0aXAoKTtcclxuICAgIH0sIDEyMCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGRpc3Bvc2VUb29sdGlwKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMudG9vbHRpcFRpbWVyKSB7IGNsZWFyVGltZW91dCh0aGlzLnRvb2x0aXBUaW1lcik7IHRoaXMudG9vbHRpcFRpbWVyID0gbnVsbDsgfVxyXG4gICAgaWYgKHRoaXMudG9vbHRpcEVsKSB7XHJcbiAgICAgIHRoaXMudG9vbHRpcEVsLnJlbW92ZSgpO1xyXG4gICAgICB0aGlzLnRvb2x0aXBFbCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBpZiAoZ2xvYmFsQWN0aXZlVGlwKSB7XHJcbiAgICAgIGdsb2JhbEFjdGl2ZVRpcCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICB0aGlzLnRvb2x0aXBNYXJrZXJJZCA9IFwiXCI7XHJcbiAgICB0aGlzLnRvb2x0aXBIb3N0ID0gbnVsbDtcclxuICAgIHRoaXMudG9vbHRpcFByZXZpZXdGZXRjaGVkID0gZmFsc2U7XHJcbiAgfVxyXG5cclxuICAvKiAtLS0tIHBvcG92ZXIgLS0tLSAqL1xyXG5cclxuICBwcml2YXRlIGNsb3NlUG9wb3ZlcigpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmFjdGl2ZVBvcG92ZXIpIHtcclxuICAgICAgdGhpcy5hY3RpdmVQb3BvdmVyLnJlbW92ZSgpO1xyXG4gICAgICB0aGlzLmFjdGl2ZVBvcG92ZXIgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgdGhpcy5hY3RpdmVNYXJrZXJFbCA9IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKiAtLS0tIG92ZXJsYXlzIC0tLS0gKi9cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXJPdmVybGF5cygpOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgbyBvZiB0aGlzLm92ZXJsYXlzKSB7XHJcbiAgICAgIGNvbnN0IGVsbSA9IGVsKFwiaW1nXCIsIHRoaXMub3ZlcmxheXNFbCkgYXMgSFRNTEltYWdlRWxlbWVudDtcclxuICAgICAgZWxtLnNyYyA9IG8udXJsO1xyXG4gICAgICBlbG0uc3R5bGUuY3NzVGV4dCA9XHJcbiAgICAgICAgXCJwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjA7d2lkdGg6MTAwJTtoZWlnaHQ6MTAwJTtwb2ludGVyLWV2ZW50czpub25lO29iamVjdC1maXQ6Y29udGFpbjtcIjtcclxuICAgICAgZWxtLmRyYWdnYWJsZSA9IGZhbHNlO1xyXG4gICAgICBpZiAoIW8udmlzaWJsZSkgZWxtLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qIC0tLS0gZ3JpZCAtLS0tICovXHJcblxyXG4gIHByaXZhdGUgcmVuZGVyR3JpZCgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5jZmcuZ3JpZD8udmlzaWJsZSkgcmV0dXJuO1xyXG5cclxuICAgIHRoaXMuZ3JpZFN2ZyA9IHN2Z0VsKFwic3ZnXCIsIHRoaXMud29ybGQsIHtcclxuICAgICAgd2lkdGg6IFN0cmluZyh0aGlzLmltZ1cpLFxyXG4gICAgICBoZWlnaHQ6IFN0cmluZyh0aGlzLmltZ0gpLFxyXG4gICAgfSkgYXMgU1ZHU1ZHRWxlbWVudDtcclxuICAgIHRoaXMuZ3JpZFN2Zy5zdHlsZS5jc3NUZXh0ID1cclxuICAgICAgXCJwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjA7cG9pbnRlci1ldmVudHM6bm9uZTt6LWluZGV4OjUwO1wiO1xyXG4gICAgdGhpcy5ncmlkU3ZnLnNldEF0dHJpYnV0ZShcInZpZXdCb3hcIiwgYDAgMCAke3RoaXMuaW1nV30gJHt0aGlzLmltZ0h9YCk7XHJcblxyXG4gICAgdGhpcy5ncmlkU3RhdGljTGF5ZXIgPSBjcmVhdGVTdmdFbChcImdcIiwgdGhpcy5ncmlkU3ZnKTtcclxuICAgIGNvbnN0IGcgPSB0aGlzLmNmZy5ncmlkO1xyXG4gICAgY29uc3QgY29sb3IgPSBnLmNvbG9yID8/IFwicmdiYSgxMjgsMTI4LDEyOCwwLjM1KVwiO1xyXG4gICAgY29uc3QgbHcgPSBnLmxpbmVXaWR0aCA/PyAxO1xyXG5cclxuICAgIGxldCBkID0gXCJcIjtcclxuICAgIGlmIChnLmtpbmQgPT09IFwic3F1YXJlXCIpIHtcclxuICAgICAgZCA9IHRoaXMuYnVpbGRTcXVhcmVHcmlkUGF0aChnLnNwYWNpbmcsIGcuYW5jaG9yWCwgZy5hbmNob3JZKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGQgPSB0aGlzLmJ1aWxkSGV4R3JpZFBhdGgoZy5zcGFjaW5nLCBnLmFuY2hvclgsIGcuYW5jaG9yWSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcGF0aCA9IGNyZWF0ZVN2Z0VsKFwicGF0aFwiLCB0aGlzLmdyaWRTdGF0aWNMYXllciwge1xyXG4gICAgICBkLFxyXG4gICAgICBzdHJva2U6IGNvbG9yLFxyXG4gICAgICBcInN0cm9rZS13aWR0aFwiOiBTdHJpbmcobHcpLFxyXG4gICAgICBmaWxsOiBcIm5vbmVcIixcclxuICAgICAgXCJ2ZWN0b3ItZWZmZWN0XCI6IFwibm9uLXNjYWxpbmctc3Ryb2tlXCIsXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnVwZGF0ZUdyaWRUcmFuc2Zvcm0oKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGRTcXVhcmVHcmlkUGF0aChzcGFjaW5nOiBudW1iZXIsIGF4OiBudW1iZXIsIGF5OiBudW1iZXIpOiBzdHJpbmcge1xyXG4gICAgY29uc3Qgc3RlcCA9IE1hdGgubWF4KDIsIHNwYWNpbmcpO1xyXG4gICAgbGV0IGQgPSBcIlwiO1xyXG4gICAgY29uc3Qgc3RhcnRYID0gYXggKyBNYXRoLmZsb29yKCgwIC0gYXgpIC8gc3RlcCkgKiBzdGVwO1xyXG4gICAgZm9yIChsZXQgeCA9IHN0YXJ0WDsgeCA8PSB0aGlzLmltZ1c7IHggKz0gc3RlcCkgZCArPSBgTSR7eH0sMCBMJHt4fSwke3RoaXMuaW1nSH0gYDtcclxuICAgIGNvbnN0IHN0YXJ0WSA9IGF5ICsgTWF0aC5mbG9vcigoMCAtIGF5KSAvIHN0ZXApICogc3RlcDtcclxuICAgIGZvciAobGV0IHkgPSBzdGFydFk7IHkgPD0gdGhpcy5pbWdIOyB5ICs9IHN0ZXApIGQgKz0gYE0wLCR7eX0gTCR7dGhpcy5pbWdXfSwke3l9IGA7XHJcbiAgICByZXR1cm4gZC50cmltKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGJ1aWxkSGV4R3JpZFBhdGgoc3BhY2luZzogbnVtYmVyLCBheDogbnVtYmVyLCBheTogbnVtYmVyKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IGhleFcgPSBNYXRoLm1heCg4LCBzcGFjaW5nKTtcclxuICAgIGNvbnN0IHIgPSBoZXhXIC8gMjtcclxuICAgIGNvbnN0IGhleEggPSBNYXRoLnNxcnQoMykgKiByO1xyXG4gICAgY29uc3QgZHggPSAxLjUgKiByO1xyXG4gICAgY29uc3QgZHkgPSBoZXhIO1xyXG4gICAgbGV0IGQgPSBcIlwiO1xyXG4gICAgY29uc3Qgc3RhcnRDb2wgPSBNYXRoLmZsb29yKCgwIC0gYXgpIC8gZHgpO1xyXG4gICAgY29uc3Qgc3RhcnRSb3cgPSBNYXRoLmZsb29yKCgwIC0gYXkgLSByKSAvIGR5KTtcclxuICAgIGZvciAobGV0IHJvdyA9IHN0YXJ0Um93OyByb3cgKiBkeSArIHIgPD0gdGhpcy5pbWdIICsgZHk7IHJvdysrKSB7XHJcbiAgICAgIGNvbnN0IG9mZnNldCA9IHJvdyAlIDIgPT09IDAgPyBheCA6IGF4ICsgZHggLyAyO1xyXG4gICAgICBmb3IgKGxldCBjb2wgPSBzdGFydENvbDsgY29sICogZHggKyBvZmZzZXQgPD0gdGhpcy5pbWdXICsgZHg7IGNvbCsrKSB7XHJcbiAgICAgICAgY29uc3QgY3ggPSBjb2wgKiBkeCArIG9mZnNldDtcclxuICAgICAgICBjb25zdCBjeSA9IHIgKyByb3cgKiBkeTtcclxuICAgICAgICBjb25zdCBwdHMgPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykge1xyXG4gICAgICAgICAgY29uc3QgYW5nbGUgPSAoTWF0aC5QSSAvIDMpICogaSAtIE1hdGguUEkgLyA2O1xyXG4gICAgICAgICAgcHRzLnB1c2goYCR7Y3ggKyByICogTWF0aC5jb3MoYW5nbGUpfSwke2N5ICsgciAqIE1hdGguc2luKGFuZ2xlKX1gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZCArPSBgTSR7cHRzLmpvaW4oXCIgTFwiKX0gWiBgO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZC50cmltKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHVwZGF0ZUdyaWRUcmFuc2Zvcm0oKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuZ3JpZFN2ZykgcmV0dXJuO1xyXG4gICAgLy8gR3JpZCBpcyBpbnNpZGUgXCJ3b3JsZFwiIHdoaWNoIGdldHMgdGhlIHRyYW5zZm9ybSwgc28gbm8gZXh0cmEgdHJhbnNmb3JtIG5lZWRlZC5cclxuICB9XHJcblxyXG4gIC8qIC0tLS0gem9vbSBIVUQgLS0tLSAqL1xyXG5cclxuICBwcml2YXRlIHVwZGF0ZVpvb21IdWQoKTogdm9pZCB7XHJcbiAgICB0aGlzLnpvb21QZXJjZW50RWwudGV4dENvbnRlbnQgPSBgJHtNYXRoLnJvdW5kKHRoaXMuc2NhbGUgKiAxMDApfSVgO1xyXG4gIH1cclxuXHJcbiAgLyogLS0tLSBldmVudHMgLS0tLSAqL1xyXG5cclxuICBwcml2YXRlIGF0dGFjaEV2ZW50cygpOiB2b2lkIHtcclxuICAgIC8vIE1vdXNlXHJcbiAgICB0aGlzLnZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgdGhpcy5vblBvaW50ZXJEb3duKTtcclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIHRoaXMub25Qb2ludGVyTW92ZSk7XHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgdGhpcy5vblBvaW50ZXJVcCk7XHJcblxyXG4gICAgLy8gVG91Y2hcclxuICAgIHRoaXMudmlld3BvcnQuYWRkRXZlbnRMaXN0ZW5lcihcInRvdWNoc3RhcnRcIiwgdGhpcy5vblRvdWNoU3RhcnQsIHsgcGFzc2l2ZTogZmFsc2UgfSk7XHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInRvdWNobW92ZVwiLCB0aGlzLm9uVG91Y2hNb3ZlLCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJ0b3VjaGVuZFwiLCB0aGlzLm9uVG91Y2hFbmQpO1xyXG5cclxuICAgIC8vIFdoZWVsICh6b29tKVxyXG4gICAgdGhpcy52aWV3cG9ydC5hZGRFdmVudExpc3RlbmVyKFwid2hlZWxcIiwgdGhpcy5vbldoZWVsLCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xyXG5cclxuICAgIC8vIERvdWJsZS1jbGljayB0byB6b29tIGluXHJcbiAgICB0aGlzLnZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoXCJkYmxjbGlja1wiLCB0aGlzLm9uRGJsQ2xpY2spO1xyXG5cclxuICAgIC8vIFJlc2l6ZVxyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgdGhpcy5oYW5kbGVSZXNpemUpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYW5kbGVSZXNpemUgPSAoKTogdm9pZCA9PiB7XHJcbiAgICBpZiAoIXRoaXMucmVhZHkpIHJldHVybjtcclxuICAgIGlmICh0aGlzLmNmZy5yZXNwb25zaXZlKSB7XHJcbiAgICAgIC8vIFJlY2FsY3VsYXRlIGZpdCBzY2FsZVxyXG4gICAgICBjb25zdCB6ID0gdGhpcy5jYWxjRml0U2NhbGUoKTtcclxuICAgICAgdGhpcy5zY2FsZSA9IHo7XHJcbiAgICAgIGNvbnN0IHZ3ID0gdGhpcy52aWV3cG9ydC5jbGllbnRXaWR0aCB8fCAxO1xyXG4gICAgICBjb25zdCB2aCA9IHRoaXMudmlld3BvcnQuY2xpZW50SGVpZ2h0IHx8IDE7XHJcbiAgICAgIHRoaXMudHggPSB2dyAvIDIgLSAodGhpcy5pbWdXIC8gMikgKiB0aGlzLnNjYWxlO1xyXG4gICAgICB0aGlzLnR5ID0gdmggLyAyIC0gKHRoaXMuaW1nSCAvIDIpICogdGhpcy5zY2FsZTtcclxuICAgICAgdGhpcy5hcHBseVRyYW5zZm9ybSgpO1xyXG4gICAgICB0aGlzLnJlbmRlck1hcmtlcnMoKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBwcml2YXRlIGdldEV2ZW50UG9zKGU6IE1vdXNlRXZlbnQpOiBTdFBvaW50IHtcclxuICAgIGNvbnN0IHIgPSB0aGlzLnZpZXdwb3J0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgcmV0dXJuIHsgeDogZS5jbGllbnRYIC0gci5sZWZ0LCB5OiBlLmNsaWVudFkgLSByLnRvcCB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBvblBvaW50ZXJEb3duID0gKGU6IE1vdXNlRXZlbnQpOiB2b2lkID0+IHtcclxuICAgIGlmIChlLmJ1dHRvbiAhPT0gMCkgcmV0dXJuO1xyXG4gICAgdGhpcy5kcmFnZ2luZyA9IHRydWU7XHJcbiAgICB0aGlzLmRyYWdTdGFydCA9IHRoaXMuZ2V0RXZlbnRQb3MoZSk7XHJcbiAgICB0aGlzLmRyYWdUeDAgPSB0aGlzLnR4O1xyXG4gICAgdGhpcy5kcmFnVHkwID0gdGhpcy50eTtcclxuICAgIHRoaXMudmlld3BvcnQuc3R5bGUuY3Vyc29yID0gXCJncmFiYmluZ1wiO1xyXG4gICAgdGhpcy5jbG9zZVBvcG92ZXIoKTtcclxuICB9O1xyXG5cclxuICBwcml2YXRlIG9uUG9pbnRlck1vdmUgPSAoZTogTW91c2VFdmVudCk6IHZvaWQgPT4ge1xyXG4gICAgaWYgKCF0aGlzLmRyYWdnaW5nKSByZXR1cm47XHJcbiAgICBjb25zdCBwID0gdGhpcy5nZXRFdmVudFBvcyhlKTtcclxuICAgIHRoaXMudHggPSB0aGlzLmRyYWdUeDAgKyAocC54IC0gdGhpcy5kcmFnU3RhcnQueCk7XHJcbiAgICB0aGlzLnR5ID0gdGhpcy5kcmFnVHkwICsgKHAueSAtIHRoaXMuZHJhZ1N0YXJ0LnkpO1xyXG4gICAgdGhpcy5hcHBseVRyYW5zZm9ybSgpO1xyXG4gICAgaWYgKHRoaXMudG9vbHRpcEVsKSB7XHJcbiAgICAgIC8vIHVwZGF0ZSB0b29sdGlwIHBvc2l0aW9uXHJcbiAgICAgIGNvbnN0IHIgPSB0aGlzLnZpZXdwb3J0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICB0aGlzLnRvb2x0aXBFbC5zdHlsZS5sZWZ0ID0gYCR7ci5sZWZ0ICsgcC54fXB4YDtcclxuICAgICAgdGhpcy50b29sdGlwRWwuc3R5bGUudG9wID0gYCR7ci50b3AgKyBwLnkgLSAzMH1weGA7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgcHJpdmF0ZSBvblBvaW50ZXJVcCA9ICgpOiB2b2lkID0+IHtcclxuICAgIHRoaXMuZHJhZ2dpbmcgPSBmYWxzZTtcclxuICAgIHRoaXMudmlld3BvcnQuc3R5bGUuY3Vyc29yID0gXCJncmFiXCI7XHJcbiAgfTtcclxuXHJcbiAgLyogLS0tLSB0b3VjaCAtLS0tICovXHJcblxyXG4gIHByaXZhdGUgYWN0aXZlVG91Y2hlczogTWFwPG51bWJlciwgU3RQb2ludD4gPSBuZXcgTWFwKCk7XHJcblxyXG4gIHByaXZhdGUgb25Ub3VjaFN0YXJ0ID0gKGU6IFRvdWNoRXZlbnQpOiB2b2lkID0+IHtcclxuICAgIGlmIChlLnRvdWNoZXMubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgY29uc3QgdCA9IGUudG91Y2hlc1swXTtcclxuICAgICAgY29uc3QgciA9IHRoaXMudmlld3BvcnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICAgIGNvbnN0IHA6IFN0UG9pbnQgPSB7IHg6IHQuY2xpZW50WCAtIHIubGVmdCwgeTogdC5jbGllbnRZIC0gci50b3AgfTtcclxuICAgICAgdGhpcy5hY3RpdmVUb3VjaGVzLnNldCh0LmlkZW50aWZpZXIsIHApO1xyXG4gICAgICB0aGlzLmRyYWdnaW5nID0gdHJ1ZTtcclxuICAgICAgdGhpcy5kcmFnU3RhcnQgPSBwO1xyXG4gICAgICB0aGlzLmRyYWdUeDAgPSB0aGlzLnR4O1xyXG4gICAgICB0aGlzLmRyYWdUeTAgPSB0aGlzLnR5O1xyXG4gICAgfSBlbHNlIGlmIChlLnRvdWNoZXMubGVuZ3RoID09PSAyKSB7XHJcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgdGhpcy5kcmFnZ2luZyA9IGZhbHNlO1xyXG4gICAgICBjb25zdCB0MCA9IGUudG91Y2hlc1swXTtcclxuICAgICAgY29uc3QgdDEgPSBlLnRvdWNoZXNbMV07XHJcbiAgICAgIGNvbnN0IGR4ID0gdDEuY2xpZW50WCAtIHQwLmNsaWVudFg7XHJcbiAgICAgIGNvbnN0IGR5ID0gdDEuY2xpZW50WSAtIHQwLmNsaWVudFk7XHJcbiAgICAgIHRoaXMubGFzdFBpbmNoRGlzdCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSk7XHJcbiAgICAgIHRoaXMubGFzdFBpbmNoU2NhbGUgPSB0aGlzLnNjYWxlO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIHByaXZhdGUgb25Ub3VjaE1vdmUgPSAoZTogVG91Y2hFdmVudCk6IHZvaWQgPT4ge1xyXG4gICAgaWYgKGUudG91Y2hlcy5sZW5ndGggPT09IDEgJiYgdGhpcy5kcmFnZ2luZykge1xyXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIGNvbnN0IHQgPSBlLnRvdWNoZXNbMF07XHJcbiAgICAgIGNvbnN0IHIgPSB0aGlzLnZpZXdwb3J0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICBjb25zdCBwOiBTdFBvaW50ID0geyB4OiB0LmNsaWVudFggLSByLmxlZnQsIHk6IHQuY2xpZW50WSAtIHIudG9wIH07XHJcbiAgICAgIHRoaXMudHggPSB0aGlzLmRyYWdUeDAgKyAocC54IC0gdGhpcy5kcmFnU3RhcnQueCk7XHJcbiAgICAgIHRoaXMudHkgPSB0aGlzLmRyYWdUeTAgKyAocC55IC0gdGhpcy5kcmFnU3RhcnQueSk7XHJcbiAgICAgIHRoaXMuYXBwbHlUcmFuc2Zvcm0oKTtcclxuICAgIH0gZWxzZSBpZiAoZS50b3VjaGVzLmxlbmd0aCA9PT0gMikge1xyXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIGNvbnN0IHQwID0gZS50b3VjaGVzWzBdO1xyXG4gICAgICBjb25zdCB0MSA9IGUudG91Y2hlc1sxXTtcclxuICAgICAgY29uc3QgZHggPSB0MS5jbGllbnRYIC0gdDAuY2xpZW50WDtcclxuICAgICAgY29uc3QgZHkgPSB0MS5jbGllbnRZIC0gdDAuY2xpZW50WTtcclxuICAgICAgY29uc3QgZGlzdCA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSk7XHJcbiAgICAgIGNvbnN0IGN4ID0gKHQwLmNsaWVudFggKyB0MS5jbGllbnRYKSAvIDI7XHJcbiAgICAgIGNvbnN0IGN5ID0gKHQwLmNsaWVudFkgKyB0MS5jbGllbnRZKSAvIDI7XHJcbiAgICAgIGlmICh0aGlzLmxhc3RQaW5jaERpc3QgPiAwKSB7XHJcbiAgICAgICAgY29uc3QgZmFjdG9yID0gZGlzdCAvIHRoaXMubGFzdFBpbmNoRGlzdDtcclxuICAgICAgICB0aGlzLnpvb21BdChmYWN0b3IsIGN4IC0gdGhpcy52aWV3cG9ydC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5sZWZ0LFxyXG4gICAgICAgICAgY3kgLSB0aGlzLnZpZXdwb3J0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcCk7XHJcbiAgICAgICAgdGhpcy5sYXN0UGluY2hEaXN0ID0gZGlzdDtcclxuICAgICAgICB0aGlzLmxhc3RQaW5jaFNjYWxlID0gdGhpcy5zY2FsZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIHByaXZhdGUgb25Ub3VjaEVuZCA9IChlOiBUb3VjaEV2ZW50KTogdm9pZCA9PiB7XHJcbiAgICBpZiAoZS50b3VjaGVzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICB0aGlzLmRyYWdnaW5nID0gZmFsc2U7XHJcbiAgICAgIHRoaXMuYWN0aXZlVG91Y2hlcy5jbGVhcigpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIC8qIC0tLS0gd2hlZWwgLyBkYmxjbGljayAtLS0tICovXHJcblxyXG4gIHByaXZhdGUgb25XaGVlbCA9IChlOiBXaGVlbEV2ZW50KTogdm9pZCA9PiB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBjb25zdCByID0gdGhpcy52aWV3cG9ydC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgIGNvbnN0IGZhY3RvciA9IGUuZGVsdGFZIDwgMCA/IDEuMDggOiAxIC8gMS4wODtcclxuICAgIHRoaXMuem9vbUF0KGZhY3RvciwgZS5jbGllbnRYIC0gci5sZWZ0LCBlLmNsaWVudFkgLSByLnRvcCk7XHJcbiAgfTtcclxuXHJcbiAgcHJpdmF0ZSBvbkRibENsaWNrID0gKGU6IE1vdXNlRXZlbnQpOiB2b2lkID0+IHtcclxuICAgIGNvbnN0IHIgPSB0aGlzLnZpZXdwb3J0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgdGhpcy56b29tQXQoMS41LCBlLmNsaWVudFggLSByLmxlZnQsIGUuY2xpZW50WSAtIHIudG9wKTtcclxuICB9O1xyXG59XHJcbiIsICIvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICogIHN0YXRpYy1lbnRyeS50cyBcdTIwMTMgU3RhdGljLXNpdGUgZW50cnkgcG9pbnQuXHJcbiAqXHJcbiAqICBJbmNsdWRlIHRoaXMgYnVuZGxlIHZpYSA8c2NyaXB0PiBpbiB5b3VyIERpZ2l0YWwgR2FyZGVuIHNpdGUuXHJcbiAqICBJdCBzY2FucyB0aGUgcGFnZSBmb3Igem9vbW1hcCBjb250YWluZXJzIGFuZCBpbml0aWFsaXNlcyB0aGVtLlxyXG4gKlxyXG4gKiAgVHdvIGNvbnRhaW5lciBmb3JtYXRzIGFyZSBzdXBwb3J0ZWQ6XHJcbiAqICBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcclxuICogIDEuIDxkaXYgY2xhc3M9XCJ6bS1zdGF0aWMtcm9vdFwiIGRhdGEtem0tY29uZmlnPVwiLi4uXCIgZGF0YS16bS1tYXJrZXJzPVwiLi4uXCI+PC9kaXY+XHJcbiAqICAyLiA8ZGl2IGNsYXNzPVwiem9vbW1hcC1jb250YWluZXJcIj5cclxuICogICAgICAgPHNjcmlwdCBjbGFzcz1cInptLWNvbmZpZy1qc29uXCIgdHlwZT1cImFwcGxpY2F0aW9uL2pzb25cIj57Li4ufTwvc2NyaXB0PlxyXG4gKiAgICAgICA8c2NyaXB0IGNsYXNzPVwiem0tbWFya2Vycy1qc29uXCIgdHlwZT1cImFwcGxpY2F0aW9uL2pzb25cIj5bLi4uXTwvc2NyaXB0PlxyXG4gKiAgICAgPC9kaXY+XHJcbiAqXHJcbiAqICBZb3UgY2FuIGFsc28gbWFudWFsbHkgY3JlYXRlIGEgbWFwOlxyXG4gKiAgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHJcbiAqICBjb25zdCBtID0gWm9vbU1hcFN0YXRpYy5jcmVhdGUoZWwsIGNvbmZpZywgbWFya2Vycyk7XHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuaW1wb3J0IHsgU3RhdGljTWFwIH0gZnJvbSBcIi4vc3RhdGljLXJlbmRlclwiO1xyXG5pbXBvcnQgdHlwZSB7IFN0TWFwQ29uZmlnLCBTdE1hcmtlciwgU3RQb2ludCB9IGZyb20gXCIuL3N0YXRpYy1jb25maWdcIjtcclxuXHJcbi8qIC0tLS0gZ2xvYmFscyAtLS0tICovXHJcblxyXG4vLyBFeHBvc2Ugb24gd2luZG93IGZvciBtYW51YWwgQVBJXHJcbmludGVyZmFjZSBab29tTWFwU3RhdGljQXBpIHtcclxuICAvKiogQ3JlYXRlIGEgbmV3IG1hcCBpbnN0YW5jZSBvbiBhbiBlbGVtZW50ICovXHJcbiAgY3JlYXRlKGVsOiBIVE1MRWxlbWVudCwgY29uZmlnOiBTdE1hcENvbmZpZywgbWFya2Vycz86IFN0TWFya2VyW10pOiBTdGF0aWNNYXA7XHJcbiAgLyoqIFNjYW4gdGhlIHBhZ2UgZm9yIGF1dG8taW5pdCBjb250YWluZXJzICovXHJcbiAgc2NhbigpOiB2b2lkO1xyXG4gIC8qKiBEZXN0cm95IGFsbCBpbnN0YW5jZXMgKi9cclxuICBkZXN0cm95QWxsKCk6IHZvaWQ7XHJcbn1cclxuXHJcbmxldCBpbnN0YW5jZXM6IFN0YXRpY01hcFtdID0gW107XHJcblxyXG5mdW5jdGlvbiBzY2FuKCk6IHZvaWQge1xyXG4gIC8vIEZpbmQgYWxsIGNvbnRhaW5lcnMgdGhhdCBoYXZlIGRhdGEtem0tY29uZmlnIG9yIC56bS1zdGF0aWMtcm9vdFxyXG4gIGNvbnN0IGNvbnRhaW5lcnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcclxuICAgIFwiW2RhdGEtem0tY29uZmlnXSwgLnptLXN0YXRpYy1yb290LCAuem9vbW1hcC1jb250YWluZXJcIixcclxuICApO1xyXG5cclxuICBmb3IgKGNvbnN0IGMgb2YgY29udGFpbmVycykge1xyXG4gICAgLy8gU2tpcCBpZiBhbHJlYWR5IGluaXRpYWxpc2VkXHJcbiAgICBpZiAoYy5jbGFzc0xpc3QuY29udGFpbnMoXCJ6bS1zdGF0aWMtaW5pdGlhbGlzZWRcIikgfHwgYy5oYXNBdHRyaWJ1dGUoXCJkYXRhLXptLWluaXRlZFwiKSkgY29udGludWU7XHJcbiAgICBjLmNsYXNzTGlzdC5hZGQoXCJ6bS1zdGF0aWMtaW5pdGlhbGlzZWRcIik7XHJcbiAgICBjLnNldEF0dHJpYnV0ZShcImRhdGEtem0taW5pdGVkXCIsIFwiMVwiKTtcclxuXHJcbiAgICAvLyBDaGVjayBpZiBpdCBoYXMgZW5vdWdoIGRhdGEgdG8gY3JlYXRlIGEgbWFwXHJcbiAgICBjb25zdCBoYXNDb25maWcgPSBjLmhhc0F0dHJpYnV0ZShcImRhdGEtem0tY29uZmlnXCIpIHx8IGMucXVlcnlTZWxlY3RvcihcInNjcmlwdC56bS1jb25maWctanNvblwiKTtcclxuICAgIGlmICghaGFzQ29uZmlnKSBjb250aW51ZTtcclxuXHJcbiAgICBjb25zdCBtYXAgPSBuZXcgU3RhdGljTWFwKGMpO1xyXG4gICAgaW5zdGFuY2VzLnB1c2gobWFwKTtcclxuICB9XHJcblxyXG4gIC8vIEFsc28gc2NhbiBmb3IgcmF3IDxwcmU+PGNvZGUgY2xhc3M9XCJsYW5ndWFnZS16b29tbWFwXCI+IGJsb2Nrc1xyXG4gIC8vIFRoZXNlIGFyZSBtYXJrZG93biBjb2RlIGJsb2NrcyB0aGF0IERpZ2l0YWwgR2FyZGVuIGxlZnQgYXMtaXNcclxuICBjb25zdCBjb2RlQmxvY2tzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCJwcmUgY29kZS5sYW5ndWFnZS16b29tbWFwXCIpO1xyXG4gIGZvciAoY29uc3QgY2Igb2YgY29kZUJsb2Nrcykge1xyXG4gICAgLy8gU2tpcCBpZiBhbHJlYWR5IGhhbmRsZWRcclxuICAgIGlmIChjYi5oYXNBdHRyaWJ1dGUoXCJkYXRhLXptLWhhbmRsZWRcIikpIGNvbnRpbnVlO1xyXG4gICAgY2Iuc2V0QXR0cmlidXRlKFwiZGF0YS16bS1oYW5kbGVkXCIsIFwiMVwiKTtcclxuXHJcbiAgICBjb25zdCBwcmVCbG9jayA9IGNiLnBhcmVudEVsZW1lbnQ7XHJcbiAgICBpZiAoIXByZUJsb2NrKSBjb250aW51ZTtcclxuXHJcbiAgICAvLyBQYXJzZSB0aGUgWUFNTCBjb25maWcgZnJvbSB0aGUgY29kZSBibG9jayB0ZXh0XHJcbiAgICBjb25zdCB5YW1sVGV4dCA9IGNiLnRleHRDb250ZW50ID8/IFwiXCI7XHJcbiAgICBjb25zdCBjb25maWcgPSBwYXJzZVpvb21tYXBZYW1sKHlhbWxUZXh0KTtcclxuICAgIGlmICghY29uZmlnKSBjb250aW51ZTtcclxuXHJcbiAgICAvLyBDcmVhdGUgYSB3cmFwcGVyIGFuZCByZXBsYWNlIHRoZSBwcmUgYmxvY2tcclxuICAgIGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgd3JhcHBlci5jbGFzc05hbWUgPSBcInptLXN0YXRpYy1yb290IHptLXN0YXRpYy1pbml0aWFsaXNlZFwiO1xyXG4gICAgd3JhcHBlci5zZXRBdHRyaWJ1dGUoXCJkYXRhLXptLWluaXRlZFwiLCBcIjFcIik7XHJcblxyXG4gICAgLy8gRW1iZWQgY29uZmlnIGFzIGRhdGEgYXR0cmlidXRlXHJcbiAgICB3cmFwcGVyLnNldEF0dHJpYnV0ZShcImRhdGEtem0tY29uZmlnXCIsIEpTT04uc3RyaW5naWZ5KGNvbmZpZykpO1xyXG5cclxuICAgIC8vIExvYWQgbWFya2VycyBmcm9tIGVtYmVkZGVkIDxzY3JpcHQ+IGRhdGEgQkVGT1JFIG1hcCBpbml0XHJcbiAgICBpZiAoY29uZmlnLm1hcmtlcnNVcmwpIHtcclxuICAgICAgY29uc3Qgc2FmZUlkID0gc2FmZURhdGFJZChjb25maWcubWFya2Vyc1VybCk7XHJcbiAgICAgIGNvbnN0IGVtYmVkZGVkID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoc2FmZUlkKTtcclxuICAgICAgaWYgKGVtYmVkZGVkICYmIGVtYmVkZGVkLnRleHRDb250ZW50KSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGVtYmVkZGVkLnRleHRDb250ZW50KTtcclxuICAgICAgICAgIGlmIChkYXRhPy5tYXJrZXJzKSB7XHJcbiAgICAgICAgICAgIHdyYXBwZXIuc2V0QXR0cmlidXRlKFwiZGF0YS16bS1tYXJrZXJzXCIsIEpTT04uc3RyaW5naWZ5KGRhdGEubWFya2VycykpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gY2F0Y2ggKF9lKSB7IC8qIGlnbm9yZSAqLyB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcmVCbG9jay5yZXBsYWNlV2l0aCh3cmFwcGVyKTtcclxuXHJcbiAgICAvLyBCdWlsZC1tYXAgaGVscGVyIChjYWxsZWQgd2hlbiBjb250YWluZXIgaXMgdmlzaWJsZSlcclxuICAgIGNvbnN0IGluaXRNYXAgPSAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IG1hcCA9IG5ldyBTdGF0aWNNYXAod3JhcHBlcik7XHJcbiAgICAgIGluc3RhbmNlcy5wdXNoKG1hcCk7XHJcblxyXG4gICAgICAvLyBJZiBtYXJrZXJzIHdlcmVuJ3QgcHJlLWxvYWRlZCwgdHJ5IEhUVFAgZmV0Y2hcclxuICAgICAgaWYgKCF3cmFwcGVyLmhhc0F0dHJpYnV0ZShcImRhdGEtem0tbWFya2Vyc1wiKSAmJiBjb25maWcubWFya2Vyc1VybCkge1xyXG4gICAgICAgIGZldGNoKGNvbmZpZy5tYXJrZXJzVXJsKVxyXG4gICAgICAgICAgLnRoZW4oKHIpID0+IChyLm9rID8gci5qc29uKCkgOiBudWxsKSlcclxuICAgICAgICAgIC5jYXRjaCgoKSA9PiBudWxsKVxyXG4gICAgICAgICAgLnRoZW4oKGRhdGEpID0+IHtcclxuICAgICAgICAgICAgaWYgKGRhdGE/Lm1hcmtlcnMpIHtcclxuICAgICAgICAgICAgICBjb25zdCBtYXJrZXJzID0gZGF0YS5tYXJrZXJzIGFzIFN0TWFya2VyW107XHJcbiAgICAgICAgICAgICAgd3JhcHBlci5zZXRBdHRyaWJ1dGUoXCJkYXRhLXptLW1hcmtlcnNcIiwgSlNPTi5zdHJpbmdpZnkobWFya2VycykpO1xyXG4gICAgICAgICAgICAgIC8vIFJlLWluaXQgd2l0aCBtYXJrZXJzXHJcbiAgICAgICAgICAgICAgbWFwLmRlc3Ryb3koKTtcclxuICAgICAgICAgICAgICBjb25zdCBuZXdNYXAgPSBuZXcgU3RhdGljTWFwKHdyYXBwZXIpO1xyXG4gICAgICAgICAgICAgIGluc3RhbmNlcyA9IGluc3RhbmNlcy5maWx0ZXIoKG0pID0+IG0gIT09IG1hcCk7XHJcbiAgICAgICAgICAgICAgaW5zdGFuY2VzLnB1c2gobmV3TWFwKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIC5jYXRjaCgoKSA9PiB7fSk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgLy8gRGVmZXIgaW5pdCB1bnRpbCB2aXNpYmxlIFx1MjAxNCBmaXhlcyBjb2xsYXBzZWQgY2FsbG91dCBzaXppbmdcclxuICAgIGlmIChcIkludGVyc2VjdGlvbk9ic2VydmVyXCIgaW4gd2luZG93KSB7XHJcbiAgICAgIGNvbnN0IG9icyA9IG5ldyBJbnRlcnNlY3Rpb25PYnNlcnZlcihcclxuICAgICAgICAoZW50cmllcykgPT4ge1xyXG4gICAgICAgICAgZm9yIChjb25zdCBlIG9mIGVudHJpZXMpIHtcclxuICAgICAgICAgICAgaWYgKGUuaXNJbnRlcnNlY3RpbmcpIHtcclxuICAgICAgICAgICAgICBvYnMuZGlzY29ubmVjdCgpO1xyXG4gICAgICAgICAgICAgIGluaXRNYXAoKTtcclxuICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgeyB0aHJlc2hvbGQ6IDAuMDEgfSxcclxuICAgICAgKTtcclxuICAgICAgb2JzLm9ic2VydmUod3JhcHBlcik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBpbml0TWFwKCk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG4vKiAtLS0tIHNpbXBsZSBZQU1MIHBhcnNlciBmb3Igem9vbW1hcCBjb2RlIGJsb2NrcyAtLS0tICovXHJcblxyXG4vKiogTWFrZSBhIHNhZmUgSFRNTCBlbGVtZW50IElEIGZyb20gYSBtYXJrZXJzIHBhdGggZm9yIGVtYmVkZGVkIGRhdGEgbG9va3VwICovXHJcbmZ1bmN0aW9uIHNhZmVEYXRhSWQocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAvLyBTdHJpcCBsZWFkaW5nIFwiL1wiIGZvciBjb25zaXN0ZW5jeSB3aXRoIHRoZSBzZXJ2ZXItZ2VuZXJhdGVkIElEICh1c2VyU2V0dXAuanMpXHJcbiAgY29uc3QgcCA9IHBhdGguc3RhcnRzV2l0aChcIi9cIikgPyBwYXRoLnNsaWNlKDEpIDogcGF0aDtcclxuICByZXR1cm4gXCJ6bS1kYXRhLVwiICsgYnRvYSh1bmVzY2FwZShlbmNvZGVVUklDb21wb25lbnQocCkpKVxyXG4gICAgLnJlcGxhY2UoL1srLz1dL2csIFwiX1wiKTtcclxufVxyXG5cclxuLyogLS0tLSBkZWZhdWx0IGljb24gcHJvZmlsZXMgLS0tLSAqL1xyXG5cclxuLyoqIEJ1aWx0LWluIGljb24gcHJvZmlsZXMgbWF0Y2hpbmcgdGhlIHBsdWdpbidzIGRlZmF1bHQgc2V0LlxyXG4gKiAgU2l0ZS1yZWxhdGl2ZSBVUkxzIGFyZSB1c2VkIGZvciBjdXN0b20gU1ZHIGZpbGVzIChzdG9yZWQgdW5kZXIgL2ltZy96b29tLW1hcC1pY29ucy8pLiAqL1xyXG5jb25zdCBERUZBVUxUX0lDT05TOiBTdEljb25Qcm9maWxlW10gPSBbXHJcbiAge1xyXG4gICAga2V5OiBcInBvcnRcIixcclxuICAgIHVybDogXCIvaW1nL3pvb20tbWFwLWljb25zL2FuY2hvci5zdmdcIixcclxuICAgIHNpemU6IDI0LFxyXG4gICAgYW5jaG9yWDogMTIsXHJcbiAgICBhbmNob3JZOiAxMixcclxuICB9LFxyXG4gIHtcclxuICAgIGtleTogXCJwaW5SZWRcIixcclxuICAgIHVybDogXCJkYXRhOmltYWdlL3N2Zyt4bWw7Y2hhcnNldD1VVEYtOCwlM0NzdmclMjB4bWxucyUzRCUyMmh0dHAlM0ElMkYlMkZ3d3cudzMub3JnJTJGMjAwMCUyRnN2ZyUyMiUyMHdpZHRoJTNEJTIyMjQlMjIlMjBoZWlnaHQlM0QlMjIyNCUyMiUyMHZpZXdCb3glM0QlMjIwJTIwMCUyMDI0JTIwMjQlMjIlM0UlM0NwYXRoJTIwZmlsbCUzRCUyMiUyM2QyM2MzYyUyMiUyMGQlM0QlMjJNMTIlMjAyYTclMjA3JTIwMCUyMDAlMjAwLTclMjA3YzAlMjA1LjI1JTIwNyUyMDEzJTIwNyUyMDEzczctNy43NSUyMDctMTNhNyUyMDclMjAwJTIwMCUyMDAtNy03bTAlMjA5LjVBMi41JTIwMi41JTIwMCUyMDElMjAxJTIwMTIlMjA2LjVhMi41JTIwMi41JTIwMCUyMDAlMjAxJTIwMCUyMDVaJTIyJTJGJTNFJTNDJTJGc3ZnJTNFXCIsXHJcbiAgICBzaXplOiAyNCxcclxuICAgIGFuY2hvclg6IDEyLFxyXG4gICAgYW5jaG9yWTogMTIsXHJcbiAgfSxcclxuICB7XHJcbiAgICBrZXk6IFwicGluQmx1ZVwiLFxyXG4gICAgdXJsOiBcImRhdGE6aW1hZ2Uvc3ZnK3htbDtjaGFyc2V0PVVURi04LCUzQ3N2ZyUyMHhtbG5zJTNEJTIyaHR0cCUzQSUyRiUyRnd3dy53My5vcmclMkYyMDAwJTJGc3ZnJTIyJTIwd2lkdGglM0QlMjIyNCUyMiUyMGhlaWdodCUzRCUyMjI0JTIyJTIwdmlld0JveCUzRCUyMjAlMjAwJTIwMjQlMjAyNCUyMiUzRSUzQ3BhdGglMjBmaWxsJTNEJTIyJTIzM2M2MmQyJTIyJTIwZCUzRCUyMk0xMiUyMDJhNyUyMDclMjAwJTIwMCUyMDAtNyUyMDdjMCUyMDUuMjUlMjA3JTIwMTMlMjA3JTIwMTNzNy03Ljc1JTIwNy0xM2E3JTIwNyUyMDAlMjAwJTIwMC03LTdtMCUyMDkuNUEyLjUlMjAyLjUlMjAwJTIwMSUyMDElMjAxMiUyMDYuNWEyLjUlMjAyLjUlMjAwJTIwMCUyMDElMjAwJTIwNVolMjIlMkYlM0UlM0MlMkZzdmclM0VcIixcclxuICAgIHNpemU6IDI0LFxyXG4gICAgYW5jaG9yWDogMTIsXHJcbiAgICBhbmNob3JZOiAxMixcclxuICB9LFxyXG5dO1xyXG5cclxuZnVuY3Rpb24gcGFyc2Vab29tbWFwWWFtbCh0ZXh0OiBzdHJpbmcpOiBTdE1hcENvbmZpZyB8IG51bGwge1xyXG4gIC8vIFN0cmlwIGNhbGxvdXQgcHJlZml4ZXMgKD4gb3IgPiApIHNvIGJsb2NrcyBpbnNpZGUgPlshTk9URV0gZXRjLiB3b3JrXHJcbiAgY29uc3QgY2xlYW5UZXh0ID0gdGV4dC5yZXBsYWNlKC9ePlxccz8vZ20sIFwiXCIpO1xyXG4gIGNvbnN0IGxpbmVzID0gY2xlYW5UZXh0LnNwbGl0KFwiXFxuXCIpO1xyXG4gIGNvbnN0IG1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xyXG4gIGNvbnN0IGltYWdlQmFzZXM6IHN0cmluZ1tdID0gW107XHJcblxyXG4gIGxldCBpbkltYWdlQmFzZXMgPSBmYWxzZTtcclxuICBsZXQgaW5WaWV3ID0gZmFsc2U7XHJcbiAgLy8gTmVzdGVkIHZpZXcgc3ViLWtleXNcclxuICBsZXQgX3ZpZXdab29tID0gXCJcIjtcclxuICBsZXQgX3ZpZXdDZW50ZXJYID0gXCJcIjtcclxuICBsZXQgX3ZpZXdDZW50ZXJZID0gXCJcIjtcclxuXHJcbiAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XHJcbiAgICBjb25zdCB0cmltbWVkID0gbGluZS50cmltKCk7XHJcbiAgICBpZiAoIXRyaW1tZWQgfHwgdHJpbW1lZC5zdGFydHNXaXRoKFwiI1wiKSkgY29udGludWU7XHJcblxyXG4gICAgLy8gRGV0ZWN0IHZpZXcgc2VjdGlvbiBzdGFydFxyXG4gICAgaWYgKHRyaW1tZWQgPT09IFwidmlldzpcIiB8fCB0cmltbWVkLnN0YXJ0c1dpdGgoXCJ2aWV3OlwiKSkge1xyXG4gICAgICBpblZpZXcgPSB0cnVlO1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoaW5WaWV3KSB7XHJcbiAgICAgIC8vIEV4aXQgdmlldyBzZWN0aW9uIG9uIGEgbm9uLWluZGVudGVkIGtleVxyXG4gICAgICBpZiAoIXRyaW1tZWQuc3RhcnRzV2l0aChcIiBcIikpIHtcclxuICAgICAgICBpblZpZXcgPSBmYWxzZTtcclxuICAgICAgICAvLyBmYWxsIHRocm91Z2ggdG8gcHJvY2VzcyB0aGlzIGxpbmUgbm9ybWFsbHlcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zdCBzaWR4ID0gdHJpbW1lZC5pbmRleE9mKFwiOlwiKTtcclxuICAgICAgICBpZiAoc2lkeCA+PSAwKSB7XHJcbiAgICAgICAgICBjb25zdCBrID0gdHJpbW1lZC5zdWJzdHJpbmcoMCwgc2lkeCkudHJpbSgpO1xyXG4gICAgICAgICAgY29uc3QgdiA9IHRyaW1tZWQuc3Vic3RyaW5nKHNpZHggKyAxKS50cmltKCk7XHJcbiAgICAgICAgICBpZiAoayA9PT0gXCJ6b29tXCIpIF92aWV3Wm9vbSA9IHY7XHJcbiAgICAgICAgICBlbHNlIGlmIChrID09PSBcImNlbnRlclhcIikgX3ZpZXdDZW50ZXJYID0gdjtcclxuICAgICAgICAgIGVsc2UgaWYgKGsgPT09IFwiY2VudGVyWVwiKSBfdmlld0NlbnRlclkgPSB2O1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIERldGVjdCBpbWFnZUJhc2VzIHNlY3Rpb24gc3RhcnRcclxuICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoXCJpbWFnZUJhc2VzOlwiKSB8fCB0cmltbWVkLnN0YXJ0c1dpdGgoXCJpbWFnZWJhc2VzOlwiKSkge1xyXG4gICAgICBpbkltYWdlQmFzZXMgPSB0cnVlO1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoaW5JbWFnZUJhc2VzKSB7XHJcbiAgICAgIC8vIENvbGxlY3QgXCItIHBhdGg6IHh4eFwiIGVudHJpZXNcclxuICAgICAgY29uc3QgbSA9IHRyaW1tZWQubWF0Y2goL14tIHBhdGg6XFxzKiguKykkL2kpO1xyXG4gICAgICBpZiAobSkge1xyXG4gICAgICAgIGltYWdlQmFzZXMucHVzaChtWzFdLnRyaW0oKSk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgICAgLy8gRXhpdCBzZWN0aW9uIG9uIG5vbi1pbmRlbnRlZCBub24tbGlzdCBsaW5lXHJcbiAgICAgIGlmICghdHJpbW1lZC5zdGFydHNXaXRoKFwiLVwiKSAmJiAhdHJpbW1lZC5zdGFydHNXaXRoKFwiIFwiKSAmJiB0cmltbWVkLmluZGV4T2YoXCI6XCIpID4gMCkge1xyXG4gICAgICAgIGluSW1hZ2VCYXNlcyA9IGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICAgIGlmICghdHJpbW1lZC5zdGFydHNXaXRoKFwiIFwiKSAmJiAhdHJpbW1lZC5zdGFydHNXaXRoKFwiLVwiKSkge1xyXG4gICAgICAgIGluSW1hZ2VCYXNlcyA9IGZhbHNlO1xyXG4gICAgICAgIC8vIFJlLXByb2Nlc3MgdGhpcyBsaW5lIGFzIGEgdG9wLWxldmVsIGtleVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGluSW1hZ2VCYXNlcykgY29udGludWU7XHJcblxyXG4gICAgY29uc3QgaWR4ID0gdHJpbW1lZC5pbmRleE9mKFwiOlwiKTtcclxuICAgIGlmIChpZHggPCAwKSBjb250aW51ZTtcclxuICAgIGNvbnN0IGtleSA9IHRyaW1tZWQuc3Vic3RyaW5nKDAsIGlkeCkudHJpbSgpO1xyXG4gICAgY29uc3QgdmFsdWUgPSB0cmltbWVkLnN1YnN0cmluZyhpZHggKyAxKS50cmltKCk7XHJcbiAgICBtYXBba2V5XSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLyoqIE5vcm1hbGlzZSBhIHBhdGg6IGlmIHJlbGF0aXZlIChubyBzY2hlbWUsIG5vdCBhYnNvbHV0ZSksIHByZXBlbmQgXCIvXCIgKi9cclxuICBmdW5jdGlvbiBub3JtUGF0aChwOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgdCA9IHAudHJpbSgpO1xyXG4gICAgaWYgKCF0IHx8IHQuc3RhcnRzV2l0aChcIi9cIikgfHwgdC5zdGFydHNXaXRoKFwiaHR0cDovL1wiKSB8fCB0LnN0YXJ0c1dpdGgoXCJodHRwczovL1wiKSB8fCB0LnN0YXJ0c1dpdGgoXCJkYXRhOlwiKSkgcmV0dXJuIHQ7XHJcbiAgICByZXR1cm4gXCIvXCIgKyB0O1xyXG4gIH1cclxuXHJcbiAgLy8gUmVzb2x2ZSBpbWFnZTogcHJlZmVyIGltYWdlQmFzZXNbMF0sIHRoZW4gaW1hZ2UsIHRoZW4gaW1hZ2VCYXNlcyBsZWdhY3lcclxuICBjb25zdCBpbWFnZVVybCA9IGltYWdlQmFzZXMubGVuZ3RoID4gMCA/IG5vcm1QYXRoKGltYWdlQmFzZXNbMF0pIDogbWFwLmltYWdlID8gbm9ybVBhdGgobWFwLmltYWdlKSA6IHVuZGVmaW5lZDtcclxuICBpZiAoIWltYWdlVXJsIHx8ICFtYXAubWFya2VycykgcmV0dXJuIG51bGw7XHJcbiAgY29uc3QgbWFya2Vyc1VybCA9IG5vcm1QYXRoKG1hcC5tYXJrZXJzKTtcclxuXHJcbiAgLy8gaW1nVyAvIGltZ0g6IGV4cGxpY2l0bHkgc3BlY2lmaWVkIHZhbHVlcyBvdmVycmlkZSBhdXRvLWRldGVjdDsgb3RoZXJ3aXNlIGxldCBsb2FkQmFzZUltYWdlIHVzZSBuYXR1cmFsIHNpemVcclxuICBjb25zdCBleHBsaWNpdFcgPSBwYXJzZUZsb2F0KG1hcC5pbWdXID8/IFwiMFwiKSB8fCB1bmRlZmluZWQ7XHJcbiAgY29uc3QgZXhwbGljaXRIID0gcGFyc2VGbG9hdChtYXAuaW1nSCA/PyBcIjBcIikgfHwgdW5kZWZpbmVkO1xyXG5cclxuICAvLyBCdWlsZCB5YW1sQmFzZXMgZnJvbSBpbWFnZUJhc2VzWzE6XSBpZiBtdWx0aXBsZSBiYXNlc1xyXG4gIGNvbnN0IHJlc3RCYXNlcyA9IGltYWdlQmFzZXMubGVuZ3RoID4gMVxyXG4gICAgPyBpbWFnZUJhc2VzLnNsaWNlKDEpLm1hcCgocCwgaSkgPT4gKHtcclxuICAgICAgICBwYXRoOiBub3JtUGF0aChwKSxcclxuICAgICAgICB1cmw6IG5vcm1QYXRoKHApLFxyXG4gICAgICAgIG5hbWU6IGBCYXNlICR7aSArIDJ9YCxcclxuICAgICAgfSkpXHJcbiAgICA6IHVuZGVmaW5lZDtcclxuXHJcbiAgLy8gaW5pdGlhbFpvb206IHByZWZlciB2aWV3Lnpvb20gb3ZlciB0b3AtbGV2ZWwgaW5pdGlhbFpvb21cclxuICBjb25zdCBpbml0aWFsWm9vbSA9IF92aWV3Wm9vbSA/IHBhcnNlRmxvYXQoX3ZpZXdab29tKSA6IChtYXAuaW5pdGlhbFpvb20gPyBwYXJzZUZsb2F0KG1hcC5pbml0aWFsWm9vbSkgOiB1bmRlZmluZWQpO1xyXG4gIC8vIGluaXRpYWxDZW50ZXI6IHByZWZlciB2aWV3LmNlbnRlclgvWSAobm9ybWFsaXplZCAwLTEpIG92ZXIgdG9wLWxldmVsXHJcbiAgY29uc3QgaGFzVmlld0NlbnRlciA9IF92aWV3Q2VudGVyWCAhPT0gXCJcIiAmJiBfdmlld0NlbnRlclkgIT09IFwiXCI7XHJcbiAgY29uc3QgaW5pdGlhbENlbnRlcjogU3RQb2ludCB8IHVuZGVmaW5lZCA9IGhhc1ZpZXdDZW50ZXJcclxuICAgID8geyB4OiBwYXJzZUZsb2F0KF92aWV3Q2VudGVyWCksIHk6IHBhcnNlRmxvYXQoX3ZpZXdDZW50ZXJZKSB9XHJcbiAgICA6IHVuZGVmaW5lZDtcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIGltYWdlVXJsLFxyXG4gICAgbWFya2Vyc1VybCxcclxuICAgIG1pblpvb206IHBhcnNlRmxvYXQobWFwLm1pblpvb20gPz8gXCIwLjFcIiksXHJcbiAgICBtYXhab29tOiBwYXJzZUZsb2F0KG1hcC5tYXhab29tID8/IFwiMTBcIiksXHJcbiAgICBpbWdXOiBleHBsaWNpdFcsXHJcbiAgICBpbWdIOiBleHBsaWNpdEgsXHJcbiAgICB3aWR0aDogbWFwLndpZHRoLFxyXG4gICAgaGVpZ2h0OiBtYXAuaGVpZ2h0LFxyXG4gICAgYWxpZ246IG1hcC5hbGlnbiBhcyBTdE1hcENvbmZpZ1tcImFsaWduXCJdLFxyXG4gICAgaW5pdGlhbFpvb20sXHJcbiAgICBpbml0aWFsQ2VudGVyLFxyXG4gICAgaWNvblByb2ZpbGVzOiBERUZBVUxUX0lDT05TLFxyXG4gICAgeWFtbEJhc2VzOiByZXN0QmFzZXMsXHJcbiAgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gZGVzdHJveUFsbCgpOiB2b2lkIHtcclxuICBmb3IgKGNvbnN0IG0gb2YgaW5zdGFuY2VzKSBtLmRlc3Ryb3koKTtcclxuICBpbnN0YW5jZXMgPSBbXTtcclxufVxyXG5cclxuLyogLS0tLSBleHBvc2UgQVBJIC0tLS0gKi9cclxuXHJcbmNvbnN0IGFwaTogWm9vbU1hcFN0YXRpY0FwaSA9IHtcclxuICBjcmVhdGUoZWw6IEhUTUxFbGVtZW50LCBjb25maWc6IFN0TWFwQ29uZmlnLCBtYXJrZXJzPzogU3RNYXJrZXJbXSk6IFN0YXRpY01hcCB7XHJcbiAgICAvLyBFbWJlZCBjb25maWdcclxuICAgIGVsLmNsYXNzTGlzdC5hZGQoXCJ6bS1zdGF0aWMtcm9vdFwiLCBcInptLXN0YXRpYy1pbml0aWFsaXNlZFwiKTtcclxuICAgIGVsLnNldEF0dHJpYnV0ZShcImRhdGEtem0taW5pdGVkXCIsIFwiMVwiKTtcclxuICAgIGVsLnNldEF0dHJpYnV0ZShcImRhdGEtem0tY29uZmlnXCIsIEpTT04uc3RyaW5naWZ5KGNvbmZpZykpO1xyXG4gICAgaWYgKG1hcmtlcnMgJiYgbWFya2Vycy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGVsLnNldEF0dHJpYnV0ZShcImRhdGEtem0tbWFya2Vyc1wiLCBKU09OLnN0cmluZ2lmeShtYXJrZXJzKSk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBtYXAgPSBuZXcgU3RhdGljTWFwKGVsKTtcclxuICAgIGluc3RhbmNlcy5wdXNoKG1hcCk7XHJcbiAgICByZXR1cm4gbWFwO1xyXG4gIH0sXHJcbiAgc2NhbixcclxuICBkZXN0cm95QWxsLFxyXG59O1xyXG5cclxuLy8gRXhwb3NlIGdsb2JhbGx5XHJcbih3aW5kb3cgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikuWm9vbU1hcFN0YXRpYyA9IGFwaTtcclxuXHJcbi8vIEF1dG8tc2NhbiBvbiBET00gcmVhZHlcclxuaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwibG9hZGluZ1wiKSB7XHJcbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4gc2NhbigpKTtcclxufSBlbHNlIHtcclxuICBzY2FuKCk7XHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjs7O0FBZ0JBLE1BQU0sS0FBSztBQUdYLE1BQUksa0JBQTZEO0FBRWpFLFdBQVMsbUJBQWtEO0FBQ3pELFFBQUksb0JBQW9CLE9BQVcsUUFBTztBQUMxQyxRQUFJO0FBQ0YsWUFBTUEsTUFBSyxTQUFTLGVBQWUsdUJBQXVCO0FBQzFELFVBQUlBLE9BQU1BLElBQUcsYUFBYTtBQUN4Qiww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
