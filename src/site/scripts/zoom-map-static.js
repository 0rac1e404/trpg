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
    const index = getPageNameIndex();
    if (p.includes("/") && index) {
      const normalized = p.replace(/^\/+|\/+$/g, "");
      if (index[normalized]) {
        return index[normalized];
      }
    }
    const bare = p.replace(/^\/+|\/+$/g, "");
    const pageName = bare.includes("/") ? bare.split("/").pop() : bare;
    if (index && index[pageName]) {
      return index[pageName];
    }
    if (!p.startsWith("/")) p = "/" + p;
    if (!p.endsWith("/") && !/\.[a-zA-Z0-9]+$/.test(p)) p += "/";
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
