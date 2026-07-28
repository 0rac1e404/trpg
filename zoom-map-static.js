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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL3N0YXRpYy1yZW5kZXIudHMiLCAic3JjL3N0YXRpYy1lbnRyeS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqICBzdGF0aWMtcmVuZGVyLnRzIFx1MjAxMyBSZWFkLW9ubHkgc3RhdGljIG1hcCByZW5kZXJlci5cclxuICogIE5vIE9ic2lkaWFuIGltcG9ydHMuIFB1cmUgYnJvd3NlciBET00gLyBDYW52YXMgQVBJcy5cclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG5pbXBvcnQgdHlwZSB7XHJcbiAgU3RQb2ludCxcclxuICBTdFJlY3QsXHJcbiAgU3RNYXBDb25maWcsXHJcbiAgU3RNYXJrZXIsXHJcbiAgU3RJY29uUHJvZmlsZSxcclxuICBTdEltYWdlT3ZlcmxheSxcclxuICBTdE1hcEVtYmVkLFxyXG59IGZyb20gXCIuL3N0YXRpYy1jb25maWdcIjtcclxuXHJcbi8qIC0tLS0gaGVscGVycyAtLS0tICovXHJcbmNvbnN0IE5TID0gXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiO1xyXG5cclxuLyoqIENhY2hlZCBwYWdlLW5hbWUgXHUyMTkyIHBlcm1hbGluayBpbmRleCAobG9hZGVkIGZyb20gZW1iZWRkZWQgPHNjcmlwdD4pICovXHJcbmxldCBfcGFnZUluZGV4Q2FjaGU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCBudWxsIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xyXG5cclxuZnVuY3Rpb24gZ2V0UGFnZU5hbWVJbmRleCgpOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgbnVsbCB7XHJcbiAgaWYgKF9wYWdlSW5kZXhDYWNoZSAhPT0gdW5kZWZpbmVkKSByZXR1cm4gX3BhZ2VJbmRleENhY2hlO1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiem0tZGF0YS16bS1wYWdlLWluZGV4XCIpO1xyXG4gICAgaWYgKGVsICYmIGVsLnRleHRDb250ZW50KSB7XHJcbiAgICAgIF9wYWdlSW5kZXhDYWNoZSA9IEpTT04ucGFyc2UoZWwudGV4dENvbnRlbnQpIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz47XHJcbiAgICAgIHJldHVybiBfcGFnZUluZGV4Q2FjaGU7XHJcbiAgICB9XHJcbiAgfSBjYXRjaCAoX2UpIHsgLyogaWdub3JlICovIH1cclxuICBfcGFnZUluZGV4Q2FjaGUgPSBudWxsO1xyXG4gIHJldHVybiBudWxsO1xyXG59XHJcblxyXG4vKiogQ29udmVydCBhIHZhdWx0L29ic2lkaWFuIHBhdGggdG8gYSBkZXBsb3llZCBzaXRlIFVSTC5cclxuICogUmVzb2x1dGlvbiBvcmRlcjpcclxuICogMS4gRXhhY3QgZnVsbC1wYXRoIGluZGV4IGxvb2t1cCAgKGUuZy4gXCJUUlBHXHU4OUM0XHU1MjE5L1x1NEYyRlx1NzIzNVx1N0VBMlx1ODMzNi9cdTY2MUZcdTU2RkUvXHU5Njg1XHU3RUIzXCIgXHUyMTkyIHBlcm1hbGluaylcclxuICogMi4gUGFnZS1uYW1lIGluZGV4IGxvb2t1cCAgICAgICAgKGUuZy4gXCJcdTk5OTZcdTkwRkRcIiBcdTIxOTIgcGVybWFsaW5rKVxyXG4gKiAzLiBQYXRoIG5vcm1hbGl6YXRpb24gZmFsbGJhY2sgICAoZS5nLiBcIi92YXVsdC9wYXRoL1wiIFx1MjE5MiBcIi92YXVsdC9wYXRoL1wiKVxyXG4gKi9cclxuZnVuY3Rpb24gbm9ybWFsaXplTGluayhsaW5rOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGlmICghbGluaykgcmV0dXJuIGxpbms7XHJcbiAgLy8gQWxyZWFkeSBhYnNvbHV0ZSBVUkwgb3IgYW5jaG9yXHJcbiAgaWYgKGxpbmsuc3RhcnRzV2l0aChcImh0dHA6Ly9cIikgfHwgbGluay5zdGFydHNXaXRoKFwiaHR0cHM6Ly9cIikgfHwgbGluay5zdGFydHNXaXRoKFwiI1wiKSkgcmV0dXJuIGxpbms7XHJcblxyXG4gIC8vIFN0cmlwIC5tZCBleHRlbnNpb25cclxuICBsZXQgcCA9IGxpbmsucmVwbGFjZSgvXFwubWQkL2ksIFwiXCIpO1xyXG5cclxuICBjb25zdCBpbmRleCA9IGdldFBhZ2VOYW1lSW5kZXgoKTtcclxuXHJcbiAgLy8gLS0tIFN0YWdlIDE6IGV4YWN0IGZ1bGwtcGF0aCBpbmRleCBsb29rdXAgLS0tXHJcbiAgaWYgKHAuaW5jbHVkZXMoXCIvXCIpICYmIGluZGV4KSB7XHJcbiAgICAvLyBOb3JtYWxpemUgdGhlIGlucHV0IHBhdGg6IHJlbW92ZSBsZWFkaW5nL3RyYWlsaW5nIHNsYXNoZXMgZm9yIG1hdGNoaW5nXHJcbiAgICBjb25zdCBub3JtYWxpemVkID0gcC5yZXBsYWNlKC9eXFwvK3xcXC8rJC9nLCBcIlwiKTtcclxuICAgIGlmIChpbmRleFtub3JtYWxpemVkXSkge1xyXG4gICAgICByZXR1cm4gaW5kZXhbbm9ybWFsaXplZF07XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyAtLS0gU3RhZ2UgMjogcGFnZS1uYW1lIGluZGV4IGxvb2t1cCAtLS1cclxuICAvLyBGb3IgXCJcdTk5OTZcdTkwRkRcIiBcdTIxOTIgdXNlIHRoZSB3aG9sZSBzdHJpbmcgYXMgcGFnZSBuYW1lXHJcbiAgLy8gRm9yIFwiVFJQR1x1ODlDNFx1NTIxOS9cdTRGMkZcdTcyMzVcdTdFQTJcdTgzMzYvXHU2NjFGXHU1NkZFL1x1OTY4NVx1N0VCM1wiIFx1MjE5MiB1c2UgdGhlIGxhc3Qgc2VnbWVudCBcIlx1OTY4NVx1N0VCM1wiXHJcbiAgY29uc3QgYmFyZSA9IHAucmVwbGFjZSgvXlxcLyt8XFwvKyQvZywgXCJcIik7XHJcbiAgY29uc3QgcGFnZU5hbWUgPSBiYXJlLmluY2x1ZGVzKFwiL1wiKSA/IGJhcmUuc3BsaXQoXCIvXCIpLnBvcCgpISA6IGJhcmU7XHJcbiAgaWYgKGluZGV4ICYmIGluZGV4W3BhZ2VOYW1lXSkge1xyXG4gICAgcmV0dXJuIGluZGV4W3BhZ2VOYW1lXTtcclxuICB9XHJcblxyXG4gIC8vIC0tLSBTdGFnZSAzOiBwYXRoIG5vcm1hbGl6YXRpb24gZmFsbGJhY2sgLS0tXHJcbiAgLy8gRW5zdXJlIGxlYWRpbmcgXCIvXCJcclxuICBpZiAoIXAuc3RhcnRzV2l0aChcIi9cIikpIHAgPSBcIi9cIiArIHA7XHJcbiAgLy8gRW5zdXJlIHRyYWlsaW5nIFwiL1wiICh1bmxlc3MgaXQncyBhIGZpbGUgd2l0aCBleHRlbnNpb24pXHJcbiAgaWYgKCFwLmVuZHNXaXRoKFwiL1wiKSAmJiAhL1xcLlthLXpBLVowLTldKyQvLnRlc3QocCkpIHAgKz0gXCIvXCI7XHJcblxyXG4gIHJldHVybiBwO1xyXG59XHJcblxyXG4vKiogRXh0cmFjdCBhIGh1bWFuLXJlYWRhYmxlIHBhZ2UgbmFtZSBmcm9tIGEgdmF1bHQgcGF0aCAqL1xyXG5mdW5jdGlvbiBwYWdlTmFtZShsaW5rOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGlmICghbGluaykgcmV0dXJuIFwiXCI7XHJcbiAgLy8gVGFrZSB0aGUgbGFzdCBwYXRoIHNlZ21lbnQsIHN0cmlwIGV4dGVuc2lvblxyXG4gIGNvbnN0IHNlZ21lbnRzID0gbGluay5yZXBsYWNlKC9cXFxcL2csIFwiL1wiKS5zcGxpdChcIi9cIik7XHJcbiAgY29uc3QgbGFzdCA9IHNlZ21lbnRzW3NlZ21lbnRzLmxlbmd0aCAtIDFdIHx8IFwiXCI7XHJcbiAgcmV0dXJuIGxhc3QucmVwbGFjZSgvXFwubWQkL2ksIFwiXCIpIHx8IGxpbms7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVzY2FwZUh0bWwoczogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCBkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICBkLnRleHRDb250ZW50ID0gcztcclxuICByZXR1cm4gZC5pbm5lckhUTUw7XHJcbn1cclxuXHJcbi8qIC0tLS0gcGFnZSBwcmV2aWV3IGNhY2hlICYgZmV0Y2hlciAoc2hhcmVkIGFjcm9zcyBhbGwgbWFwIGluc3RhbmNlcykgLS0tLSAqL1xyXG5cclxuY29uc3QgcGFnZVByZXZpZXdDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XHJcblxyXG4vKipcclxuICogU2FuaXRpemUgSFRNTDogcmVtb3ZlIHNjcmlwdHMsIHN0eWxlcywgaWZyYW1lcywgZXZlbnQgaGFuZGxlcnMsIGRhbmdlcm91cyBocmVmcy5cclxuICovXHJcbmZ1bmN0aW9uIHNhbml0aXplSHRtbChodG1sOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgZGl2LmlubmVySFRNTCA9IGh0bWw7XHJcblxyXG4gIGZvciAoY29uc3QgZWwgb2YgZGl2LnF1ZXJ5U2VsZWN0b3JBbGwoXCJzY3JpcHQsIHN0eWxlLCBpZnJhbWUsIG9iamVjdCwgZW1iZWQsIGxpbmssIHN2Z1wiKSkgZWwucmVtb3ZlKCk7XHJcbiAgZm9yIChjb25zdCBlbCBvZiBkaXYucXVlcnlTZWxlY3RvckFsbChcIipcIikpIHtcclxuICAgIGZvciAoY29uc3QgYXR0ciBvZiBbLi4uZWwuYXR0cmlidXRlc10pIHtcclxuICAgICAgaWYgKGF0dHIubmFtZS5zdGFydHNXaXRoKFwib25cIikpIGVsLnJlbW92ZUF0dHJpYnV0ZShhdHRyLm5hbWUpO1xyXG4gICAgICBpZiAoYXR0ci5uYW1lID09PSBcImhyZWZcIiAmJiAvXmphdmFzY3JpcHQ6L2kudGVzdChhdHRyLnZhbHVlKSkgZWwucmVtb3ZlQXR0cmlidXRlKGF0dHIubmFtZSk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBkaXYuaW5uZXJIVE1MO1xyXG59XHJcblxyXG4vKipcclxuICogVHJ1bmNhdGUgSFRNTCB0byBhdCBtb3N0IGBtYXhDaGFyc2AgY2hhcmFjdGVycyBvZiB2aXNpYmxlIHRleHQgY29udGVudC5cclxuICogVXNlcyBhIFRyZWVXYWxrZXIgdG8gY291bnQgdGV4dCBub2RlcyBhbmQgcmVtb3ZlcyBzdWJzZXF1ZW50IGNvbnRlbnQuXHJcbiAqL1xyXG5mdW5jdGlvbiB0cnVuY2F0ZUh0bWwoaHRtbDogc3RyaW5nLCBtYXhDaGFyczogbnVtYmVyKTogc3RyaW5nIHtcclxuICBjb25zdCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gIGRpdi5pbm5lckhUTUwgPSBodG1sO1xyXG5cclxuICBsZXQgY291bnQgPSAwO1xyXG4gIGNvbnN0IHdhbGtlciA9IGRvY3VtZW50LmNyZWF0ZVRyZWVXYWxrZXIoZGl2LCBOb2RlRmlsdGVyLlNIT1dfVEVYVCk7XHJcbiAgbGV0IG5vZGUgPSB3YWxrZXIubmV4dE5vZGUoKSBhcyBUZXh0IHwgbnVsbDtcclxuXHJcbiAgd2hpbGUgKG5vZGUpIHtcclxuICAgIGNvbnN0IHRleHQgPSBub2RlLnRleHRDb250ZW50IHx8IFwiXCI7XHJcbiAgICBjb25zdCByZW1haW5pbmcgPSBtYXhDaGFycyAtIGNvdW50O1xyXG4gICAgaWYgKHJlbWFpbmluZyA8PSAwKSB7XHJcbiAgICAgIG5vZGUudGV4dENvbnRlbnQgPSBcIlwiO1xyXG4gICAgICBjb25zdCBuZXh0ID0gd2Fsa2VyLm5leHROb2RlKCkgYXMgVGV4dCB8IG51bGw7XHJcbiAgICAgIGlmIChuZXh0KSB7XHJcbiAgICAgICAgbGV0IHBhcmVudDogTm9kZSB8IG51bGwgPSBuZXh0O1xyXG4gICAgICAgIHdoaWxlIChwYXJlbnQgJiYgcGFyZW50ICE9PSBkaXYpIHtcclxuICAgICAgICAgIGxldCBzaWJsaW5nOiBDaGlsZE5vZGUgfCBudWxsID0gcGFyZW50Lm5leHRTaWJsaW5nO1xyXG4gICAgICAgICAgd2hpbGUgKHNpYmxpbmcpIHsgY29uc3QgcyA9IHNpYmxpbmc7IHNpYmxpbmcgPSBzaWJsaW5nLm5leHRTaWJsaW5nOyBzLnJlbW92ZSgpOyB9XHJcbiAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgbmV4dC50ZXh0Q29udGVudCA9IFwiXCI7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGRpdi5pbm5lckhUTUw7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGNvdW50ICsgdGV4dC5sZW5ndGggPiByZW1haW5pbmcpIHtcclxuICAgICAgbm9kZS50ZXh0Q29udGVudCA9IHRleHQuc2xpY2UoMCwgcmVtYWluaW5nKSArIFwiXHUyMDI2XCI7XHJcbiAgICAgIGxldCBwYXJlbnQ6IE5vZGUgfCBudWxsID0gbm9kZTtcclxuICAgICAgd2hpbGUgKHBhcmVudCAmJiBwYXJlbnQgIT09IGRpdikge1xyXG4gICAgICAgIGxldCBzaWJsaW5nOiBDaGlsZE5vZGUgfCBudWxsID0gcGFyZW50Lm5leHRTaWJsaW5nO1xyXG4gICAgICAgIHdoaWxlIChzaWJsaW5nKSB7IGNvbnN0IHMgPSBzaWJsaW5nOyBzaWJsaW5nID0gc2libGluZy5uZXh0U2libGluZzsgcy5yZW1vdmUoKTsgfVxyXG4gICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBkaXYuaW5uZXJIVE1MO1xyXG4gICAgfVxyXG5cclxuICAgIGNvdW50ICs9IHRleHQubGVuZ3RoO1xyXG4gICAgbm9kZSA9IHdhbGtlci5uZXh0Tm9kZSgpIGFzIFRleHQgfCBudWxsO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGRpdi5pbm5lckhUTUw7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBGZXRjaCBhIHBhZ2UgVVJMIGFuZCBleHRyYWN0IGNvbnRlbnQgYm9keSBIVE1MIGZvciB0b29sdGlwIHByZXZpZXcuXHJcbiAqIE9ubHkgZXh0cmFjdHMgYm9keSB0ZXh0IChubyBoMS9oMiB0aXRsZXMpLiBDYWNoZXMgcmVzdWx0cy5cclxuICovXHJcbmFzeW5jIGZ1bmN0aW9uIGZldGNoUGFnZVByZXZpZXcodXJsOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gIGlmIChwYWdlUHJldmlld0NhY2hlLmhhcyh1cmwpKSByZXR1cm4gcGFnZVByZXZpZXdDYWNoZS5nZXQodXJsKSE7XHJcblxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2godXJsKTtcclxuICAgIGlmICghcmVzcC5vaykgdGhyb3cgbmV3IEVycm9yKFwiSFRUUCBcIiArIHJlc3Auc3RhdHVzKTtcclxuICAgIGNvbnN0IGh0bWwgPSBhd2FpdCByZXNwLnRleHQoKTtcclxuICAgIGNvbnN0IHBhcnNlciA9IG5ldyBET01QYXJzZXIoKTtcclxuICAgIGNvbnN0IGRvYyA9IHBhcnNlci5wYXJzZUZyb21TdHJpbmcoaHRtbCwgXCJ0ZXh0L2h0bWxcIik7XHJcblxyXG4gICAgLy8gLS0tIGNvbnRlbnQgYm9keTogLmNvbnRlbnQgPiBhcnRpY2xlID4gbWFpbiAtLS1cclxuICAgIGNvbnN0IGNvbnRlbnRFbCA9IGRvYy5xdWVyeVNlbGVjdG9yKFwiLmNvbnRlbnRcIikgfHwgZG9jLnF1ZXJ5U2VsZWN0b3IoXCJhcnRpY2xlXCIpIHx8IGRvYy5xdWVyeVNlbGVjdG9yKFwibWFpblwiKTtcclxuICAgIGlmICghY29udGVudEVsKSB7XHJcbiAgICAgIHBhZ2VQcmV2aWV3Q2FjaGUuc2V0KHVybCwgXCJcIik7XHJcbiAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNsb25lID0gY29udGVudEVsLmNsb25lTm9kZSh0cnVlKSBhcyBIVE1MRWxlbWVudDtcclxuICAgIC8vIFJlbW92ZSB0aXRsZXMgXHUyMDE0IHRvb2x0aXAgYWxyZWFkeSBzaG93cyBtYXJrZXIgbGFiZWwgYXMgdGl0bGVcclxuICAgIGZvciAoY29uc3QgaCBvZiBjbG9uZS5xdWVyeVNlbGVjdG9yQWxsKFwiaDEsIGgyXCIpKSBoLnJlbW92ZSgpO1xyXG4gICAgLy8gUmVtb3ZlIHNpZGUgZWxlbWVudHNcclxuICAgIGZvciAoY29uc3QgZWwgb2YgY2xvbmUucXVlcnlTZWxlY3RvckFsbChcIm5hdiwgYXNpZGUsIGZvb3RlciwgaGVhZGVyLCAuYmFja2xpbmtzLCAuZ3JhcGgsIC50b2MsIC5zZWFyY2gtY29udGFpbmVyLCAuYnJlYWRjcnVtYnMsIC5tYXJrZG93bi1lbWJlZC10aXRsZVwiKSkgZWwucmVtb3ZlKCk7XHJcblxyXG4gICAgY29uc3Qgc2FuaXRpemVkID0gc2FuaXRpemVIdG1sKGNsb25lLmlubmVySFRNTCk7XHJcbiAgICBjb25zdCB0cnVuY2F0ZWQgPSB0cnVuY2F0ZUh0bWwoc2FuaXRpemVkLCA1MDApO1xyXG5cclxuICAgIHBhZ2VQcmV2aWV3Q2FjaGUuc2V0KHVybCwgdHJ1bmNhdGVkKTtcclxuICAgIHJldHVybiB0cnVuY2F0ZWQ7XHJcbiAgfSBjYXRjaCAoX2Vycikge1xyXG4gICAgcGFnZVByZXZpZXdDYWNoZS5zZXQodXJsLCBcIlwiKTtcclxuICAgIHJldHVybiBcIlwiO1xyXG4gIH1cclxufVxyXG5cclxuLy8gUmUtZXhwb3J0IGZvciBtb2R1bGUgY29uc3VtZXJzXHJcbmZ1bmN0aW9uIGdldFByZXZpZXdDYWNoZSgpIHsgcmV0dXJuIHBhZ2VQcmV2aWV3Q2FjaGU7IH1cclxuXHJcbi8qKiBHbG9iYWwgaGlkZSBhbGwgdG9vbHRpcHMgKHVzZWQgd2hlbiBtb3VzZSBsZWF2ZXMgbWFwIGVudGlyZWx5KSAqL1xyXG5sZXQgZ2xvYmFsQWN0aXZlVGlwOiBTdGF0aWNNYXBUaXAgfCBudWxsID0gbnVsbDtcclxuXHJcbi8qKiBBIGxpZ2h0d2VpZ2h0IHN0cnVjdCBzbyB3ZSBjYW4gZ3VhcmQgYWdhaW5zdCBzdGFsZSBhc3luYyByZXNwb25zZXMgKi9cclxuaW50ZXJmYWNlIFN0YXRpY01hcFRpcCB7XHJcbiAgdGlwOiBIVE1MRGl2RWxlbWVudDtcclxuICBtYXJrZXJJZDogc3RyaW5nO1xyXG59XHJcblxyXG4vKiAtLS0tIHRvb2x0aXAgY29udGVudCBidWlsZGVyIC0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIGJ1aWxkVG9vbHRpcENvbnRlbnQobTogU3RNYXJrZXIsIHByZXZpZXdIdG1sPzogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCBoYXNUb29sdGlwID0gISFtLnRvb2x0aXA7XHJcbiAgbGV0IGh0bWwgPSBcIlwiO1xyXG5cclxuICAvLyBUb29sdGlwIGxhYmVsIChtYXJrZXIgbmFtZSkgXHUyMDEzIGxpa2UgREcncyB0aXRsZSBsaW5lXHJcbiAgaWYgKGhhc1Rvb2x0aXApIHtcclxuICAgIGh0bWwgKz0gYDxkaXYgY2xhc3M9XCJ6bS1zdC10b29sdGlwLXRpdGxlXCI+JHtlc2NhcGVIdG1sKG0udG9vbHRpcCEpfTwvZGl2PmA7XHJcbiAgfVxyXG5cclxuICAvLyBQYWdlIHByZXZpZXcgY29udGVudCBcdTIwMTMgbWF0Y2hlcyBERydzIDxkaXYgc3R5bGU9XCJmb250LXdlaWdodDpib2xkXCI+ICsgY29udGVudEVsLmlubmVySFRNTFxyXG4gIGlmIChwcmV2aWV3SHRtbCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICBpZiAocHJldmlld0h0bWwpIHtcclxuICAgICAgaHRtbCArPSBgPGRpdiBjbGFzcz1cInptLXN0LXByZXZpZXctaHRtbFwiPiR7cHJldmlld0h0bWx9PC9kaXY+YDtcclxuICAgIH1cclxuICB9IGVsc2Uge1xyXG4gICAgaHRtbCArPSBgPGRpdiBjbGFzcz1cInptLXN0LXByZXZpZXctbG9hZGluZ1wiPkxvYWRpbmcgcHJldmlld1x1MjAyNjwvZGl2PmA7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gaHRtbCB8fCBgPGRpdiBjbGFzcz1cInptLXN0LXRvb2x0aXAtdGl0bGVcIj4ke2VzY2FwZUh0bWwobS5uYW1lIHx8IFwiXCIpfTwvZGl2PmA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVsPEsgZXh0ZW5kcyBrZXlvZiBIVE1MRWxlbWVudFRhZ05hbWVNYXA+KFxyXG4gIHRhZzogSyxcclxuICBwYXJlbnQ6IEhUTUxFbGVtZW50LFxyXG4gIGF0dHJzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcclxuICBjbHM/OiBzdHJpbmcsXHJcbik6IEhUTUxFbGVtZW50VGFnTmFtZU1hcFtLXSB7XHJcbiAgY29uc3QgZSA9IHBhcmVudC5vd25lckRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKTtcclxuICBpZiAoY2xzKSBlLmNsYXNzTmFtZSA9IGNscztcclxuICBpZiAoYXR0cnMpIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKGF0dHJzKSkgZS5zZXRBdHRyaWJ1dGUoaywgdik7XHJcbiAgcGFyZW50LmFwcGVuZENoaWxkKGUpO1xyXG4gIHJldHVybiBlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVTdmdFbDxLIGV4dGVuZHMga2V5b2YgU1ZHRWxlbWVudFRhZ05hbWVNYXA+KFxyXG4gIHRhZzogSyxcclxuICBwYXJlbnQ6IFNWR0VsZW1lbnQsXHJcbiAgYXR0cnM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LFxyXG4pOiBTVkdFbGVtZW50VGFnTmFtZU1hcFtLXSB7XHJcbiAgY29uc3QgZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhOUywgdGFnKTtcclxuICBpZiAoYXR0cnMpIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKGF0dHJzKSkgZS5zZXRBdHRyaWJ1dGUoaywgdik7XHJcbiAgcGFyZW50LmFwcGVuZENoaWxkKGUpO1xyXG4gIHJldHVybiBlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzdmdFbDxLIGV4dGVuZHMga2V5b2YgU1ZHRWxlbWVudFRhZ05hbWVNYXA+KFxyXG4gIHRhZzogSyxcclxuICBwYXJlbnQ6IEhUTUxFbGVtZW50LFxyXG4gIGF0dHJzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcclxuKTogU1ZHRWxlbWVudFRhZ05hbWVNYXBbS10ge1xyXG4gIGNvbnN0IGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoTlMsIHRhZyk7XHJcbiAgaWYgKGF0dHJzKSBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhhdHRycykpIGUuc2V0QXR0cmlidXRlKGssIHYpO1xyXG4gIHBhcmVudC5hcHBlbmRDaGlsZChlKTtcclxuICByZXR1cm4gZTtcclxufVxyXG5cclxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vKiAtLS0tIHByZXZpZXcgQ1NTIGluamVjdGlvbiAtLS0tICovXHJcblxyXG5sZXQgcHJldmlld0Nzc0luamVjdGVkID0gZmFsc2U7XHJcbmZ1bmN0aW9uIGluamVjdFByZXZpZXdDc3MoKTogdm9pZCB7XHJcbiAgaWYgKHByZXZpZXdDc3NJbmplY3RlZCkgcmV0dXJuO1xyXG4gIHByZXZpZXdDc3NJbmplY3RlZCA9IHRydWU7XHJcbiAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XHJcbiAgc3R5bGUuaWQgPSBcInptLXN0LXByZXZpZXctY3NzXCI7XHJcbiAgc3R5bGUudGV4dENvbnRlbnQgPSBgXHJcbi8qIFpvb20gTWFwIHN0YXRpYyBcdTIwMTMgdG9vbHRpcCBob3ZlciBwcmV2aWV3IChtYXRjaGVzIERpZ2l0YWwgR2FyZGVuICN0b29sdGlwLXdyYXBwZXIpICovXHJcbi56bS1zdC10b29sdGlwIHtcclxuICBiYWNrZ3JvdW5kOiB2YXIoLS1iYWNrZ3JvdW5kLXByaW1hcnkpO1xyXG4gIHBhZGRpbmc6IDFlbTtcclxuICBib3JkZXItcmFkaXVzOiA0cHg7XHJcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcclxuICBwb3NpdGlvbjogZml4ZWQ7XHJcbiAgbWF4LXdpZHRoOiA0MDBweDtcclxuICBoZWlnaHQ6IGF1dG87XHJcbiAgbWF4LWhlaWdodDogMzAwcHg7XHJcbiAgZm9udC1zaXplOiAwLjhlbTtcclxuICBib3gtc2hhZG93OiAwIDVweCAxMHB4IHJnYmEoMCwwLDAsMC4xKTtcclxuICB6LWluZGV4OiA5OTk5OTtcclxuICBwb2ludGVyLWV2ZW50czogYXV0bztcclxuICBvdmVyZmxvdy15OiBhdXRvO1xyXG4gIGNvbG9yOiB2YXIoLS10ZXh0LW5vcm1hbCk7XHJcbiAgbGluZS1oZWlnaHQ6IDEuNTtcclxuICBvcGFjaXR5OiAwO1xyXG4gIHRyYW5zaXRpb246IG9wYWNpdHkgMTAwbXM7XHJcbiAgdW5pY29kZS1iaWRpOiBwbGFpbnRleHQ7XHJcbn1cclxuXHJcbi56bS1zdC10b29sdGlwLnptLXN0LXRvb2x0aXAtdmlzaWJsZSB7XHJcbiAgb3BhY2l0eTogMTtcclxufVxyXG5cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXRvb2x0aXAtdGl0bGUge1xyXG4gIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgbWFyZ2luLWJvdHRvbTogMC41ZW07XHJcbiAgdW5pY29kZS1iaWRpOiBwbGFpbnRleHQ7XHJcbiAgZm9udC1zaXplOiAxLjA1ZW07XHJcbiAgY29sb3I6IHZhcigtLXRleHQtYWNjZW50KTtcclxufVxyXG5cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCB7XHJcbiAgLyogSW5oZXJpdHMgc2l0ZSB0aGVtZSB0eXBvZ3JhcGh5IFx1MjAxNCBzYW1lIGNsYXNzZXMgYXMgdGhlIGFjdHVhbCBwYWdlICovXHJcbn1cclxuXHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgcCB7XHJcbiAgbWFyZ2luOiAwLjVlbSAwO1xyXG4gIGxpbmUtaGVpZ2h0OiAxLjU1O1xyXG59XHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgcDpsYXN0LWNoaWxkIHtcclxuICBtYXJnaW4tYm90dG9tOiAwO1xyXG59XHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgc3Ryb25nLFxyXG4uem0tc3QtdG9vbHRpcCAuem0tc3QtcHJldmlldy1odG1sIGIge1xyXG4gIGNvbG9yOiB2YXIoLS10ZXh0LW5vcm1hbCk7XHJcbiAgZm9udC13ZWlnaHQ6IDYwMDtcclxufVxyXG4uem0tc3QtdG9vbHRpcCAuem0tc3QtcHJldmlldy1odG1sIGVtLFxyXG4uem0tc3QtdG9vbHRpcCAuem0tc3QtcHJldmlldy1odG1sIGkge1xyXG4gIG9wYWNpdHk6IDAuODU7XHJcbn1cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBhIHtcclxuICBjb2xvcjogdmFyKC0tdGV4dC1hY2NlbnQpO1xyXG59XHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgaDMsXHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgaDQsXHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgaDUsXHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgaDYge1xyXG4gIGZvbnQtc2l6ZTogMC45NWVtO1xyXG4gIGZvbnQtd2VpZ2h0OiA2MDA7XHJcbiAgbWFyZ2luOiAwLjZlbSAwIDAuMjVlbTtcclxufVxyXG4uem0tc3QtdG9vbHRpcCAuem0tc3QtcHJldmlldy1odG1sIHVsLFxyXG4uem0tc3QtdG9vbHRpcCAuem0tc3QtcHJldmlldy1odG1sIG9sIHtcclxuICBwYWRkaW5nLWxlZnQ6IDEuNWVtO1xyXG4gIG1hcmdpbjogMC40ZW0gMDtcclxufVxyXG4uem0tc3QtdG9vbHRpcCAuem0tc3QtcHJldmlldy1odG1sIGxpIHtcclxuICBtYXJnaW4tYm90dG9tOiAycHg7XHJcbn1cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBibG9ja3F1b3RlIHtcclxuICBib3JkZXItbGVmdDogM3B4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyLCByZ2JhKDI1NSwyNTUsMjU1LDAuMjIpKTtcclxuICBwYWRkaW5nLWxlZnQ6IDEwcHg7XHJcbiAgbWFyZ2luOiA2cHggMDtcclxuICBvcGFjaXR5OiAwLjg1O1xyXG59XHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgaHIge1xyXG4gIGJvcmRlci1jb2xvcjogdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIsIHJnYmEoMjU1LDI1NSwyNTUsMC4xMikpO1xyXG4gIG1hcmdpbjogNnB4IDA7XHJcbn1cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBkZWwsXHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgcyB7XHJcbiAgb3BhY2l0eTogMC42O1xyXG59XHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgbWFyayB7XHJcbiAgYmFja2dyb3VuZDogdmFyKC0tdGV4dC1oaWdobGlnaHQtYmcsIHJnYmEoMjU1LDIwMCw4MCwwLjI1KSk7XHJcbiAgcGFkZGluZzogMCAycHg7XHJcbiAgYm9yZGVyLXJhZGl1czogMnB4O1xyXG59XHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgY29kZSB7XHJcbiAgYmFja2dyb3VuZDogdmFyKC0tYmFja2dyb3VuZC1zZWNvbmRhcnkpO1xyXG4gIHBhZGRpbmc6IDJweCA0cHg7XHJcbiAgYm9yZGVyLXJhZGl1czogM3B4O1xyXG4gIGZvbnQtc2l6ZTogMC45ZW07XHJcbn1cclxuLnptLXN0LXRvb2x0aXAgLnptLXN0LXByZXZpZXctaHRtbCBwcmUge1xyXG4gIGJhY2tncm91bmQ6IHZhcigtLWJhY2tncm91bmQtc2Vjb25kYXJ5KTtcclxuICBwYWRkaW5nOiAwLjZlbTtcclxuICBib3JkZXItcmFkaXVzOiA0cHg7XHJcbiAgb3ZlcmZsb3cteDogYXV0bztcclxuICBmb250LXNpemU6IDAuODVlbTtcclxufVxyXG4uem0tc3QtdG9vbHRpcCAuem0tc3QtcHJldmlldy1odG1sIHRhYmxlIHtcclxuICBmb250LXNpemU6IDAuODVlbTtcclxuICBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlO1xyXG59XHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgdGgsXHJcbi56bS1zdC10b29sdGlwIC56bS1zdC1wcmV2aWV3LWh0bWwgdGQge1xyXG4gIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyLCByZ2JhKDI1NSwyNTUsMjU1LDAuMTUpKTtcclxuICBwYWRkaW5nOiAzcHggNnB4O1xyXG59XHJcblxyXG4uem0tc3QtcHJldmlldy1sb2FkaW5nIHtcclxuICBmb250LXNpemU6IDAuODVlbTtcclxuICBvcGFjaXR5OiAwLjU1O1xyXG4gIGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTtcclxufVxyXG5gO1xyXG4gIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xyXG59XHJcblxyXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqICBTdGF0aWNNYXAgXHUyMDEzIG9uZSBwZXIgbWFwIGNvbnRhaW5lclxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG5leHBvcnQgY2xhc3MgU3RhdGljTWFwIHtcclxuICAvKiBjb25maWcgJiBkYXRhIChyZWFkb25seSBhZnRlciBjb25zdHJ1Y3Rpb24pICovXHJcbiAgcHJpdmF0ZSBjZmc6IFN0TWFwQ29uZmlnO1xyXG4gIHByaXZhdGUgbWFya2VyczogU3RNYXJrZXJbXSA9IFtdO1xyXG4gIHByaXZhdGUgaWNvbk1hcDogTWFwPHN0cmluZywgU3RJY29uUHJvZmlsZT4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSBvdmVybGF5czogU3RJbWFnZU92ZXJsYXlbXSA9IFtdO1xyXG5cclxuICAvKiBET00gcm9vdHMgKi9cclxuICBwcml2YXRlIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSB2aWV3cG9ydCE6IEhUTUxEaXZFbGVtZW50O1xyXG4gIHByaXZhdGUgd29ybGQhOiBIVE1MRGl2RWxlbWVudDtcclxuICBwcml2YXRlIGltZ0VsITogSFRNTEltYWdlRWxlbWVudDtcclxuICBwcml2YXRlIGNsc1BmeCA9IFwiem0tc3RcIjtcclxuXHJcbiAgLyogc3RhdGUgKi9cclxuICBwcml2YXRlIHNjYWxlID0gMTtcclxuICBwcml2YXRlIHR4ID0gMDtcclxuICBwcml2YXRlIHR5ID0gMDtcclxuICBwcml2YXRlIGltZ1cgPSAwO1xyXG4gIHByaXZhdGUgaW1nSCA9IDA7XHJcbiAgcHJpdmF0ZSByZWFkeSA9IGZhbHNlO1xyXG4gIHByaXZhdGUgaW1nTG9hZGVkID0gZmFsc2U7XHJcblxyXG4gIC8qIGdyaWQgKi9cclxuICBwcml2YXRlIGdyaWRTdmc6IFNWR1NWR0VsZW1lbnQgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGdyaWRTdGF0aWNMYXllcjogU1ZHR0VsZW1lbnQgfCBudWxsID0gbnVsbDtcclxuXHJcbiAgLyogbWFya2VycyBET00gY29udGFpbmVycyAqL1xyXG4gIHByaXZhdGUgbWFya2Vyc0VsITogSFRNTERpdkVsZW1lbnQ7XHJcblxyXG4gIC8qIG92ZXJsYXlzIERPTSAqL1xyXG4gIHByaXZhdGUgb3ZlcmxheXNFbCE6IEhUTUxEaXZFbGVtZW50O1xyXG5cclxuICAvKiB6b29tIEhVRCAqL1xyXG4gIHByaXZhdGUgem9vbUh1ZCE6IEhUTUxEaXZFbGVtZW50O1xyXG4gIHByaXZhdGUgem9vbUluQnRuITogSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSB6b29tT3V0QnRuITogSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgcHJpdmF0ZSB6b29tUGVyY2VudEVsITogSFRNTFNwYW5FbGVtZW50O1xyXG5cclxuICAvKiBpbnRlcmFjdGlvbiBzdGF0ZSAqL1xyXG4gIHByaXZhdGUgZHJhZ2dpbmcgPSBmYWxzZTtcclxuICBwcml2YXRlIGRyYWdTdGFydDogU3RQb2ludCA9IHsgeDogMCwgeTogMCB9O1xyXG4gIHByaXZhdGUgZHJhZ1R4MCA9IDA7XHJcbiAgcHJpdmF0ZSBkcmFnVHkwID0gMDtcclxuICBwcml2YXRlIGxhc3RQaW5jaERpc3QgPSAwO1xyXG4gIHByaXZhdGUgbGFzdFBpbmNoU2NhbGUgPSAxO1xyXG5cclxuICAvKiBtYXJrZXIgaG92ZXIgLyBwb3BvdmVyICovXHJcbiAgcHJpdmF0ZSBhY3RpdmVQb3BvdmVyOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgYWN0aXZlTWFya2VyRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XHJcblxyXG4gIC8qIC0tLS0gbGlmZWN5Y2xlIC0tLS0gKi9cclxuXHJcbiAgY29uc3RydWN0b3IoY29udGFpbmVyOiBIVE1MRWxlbWVudCkge1xyXG4gICAgaW5qZWN0UHJldmlld0NzcygpO1xyXG4gICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XHJcbiAgICBjb250YWluZXIuY2xhc3NMaXN0LmFkZChcInptLXN0YXRpYy1yb290XCIpO1xyXG4gICAgLy8gUmVhZCBjb25maWcgZnJvbSBkYXRhLWF0dHJpYnV0ZXMgb3IgYW4gZW1iZWRkZWQgc2NyaXB0IGJsb2NrXHJcbiAgICB0aGlzLmNmZyA9IHRoaXMubG9hZENvbmZpZyhjb250YWluZXIpO1xyXG4gICAgdGhpcy5tYXJrZXJzID0gdGhpcy5sb2FkTWFya2Vycyhjb250YWluZXIpO1xyXG4gICAgdGhpcy5pbWdXID0gdGhpcy5jZmcuaW1nVyB8fCAwO1xyXG4gICAgdGhpcy5pbWdIID0gdGhpcy5jZmcuaW1nSCB8fCAwO1xyXG4gICAgZm9yIChjb25zdCBpcCBvZiB0aGlzLmNmZy5pY29uUHJvZmlsZXMpIHRoaXMuaWNvbk1hcC5zZXQoaXAua2V5LCBpcCk7XHJcbiAgICB0aGlzLm92ZXJsYXlzID0gdGhpcy5jZmcub3ZlcmxheXMgPz8gW107XHJcbiAgICB0aGlzLmJ1aWxkRG9tKCk7XHJcbiAgICB0aGlzLmF0dGFjaEV2ZW50cygpO1xyXG4gICAgdm9pZCB0aGlzLmxvYWRCYXNlSW1hZ2UoKS50aGVuKCgpID0+IHtcclxuICAgICAgdGhpcy5yZWFkeSA9IHRydWU7XHJcbiAgICAgIHRoaXMuYXBwbHlJbml0aWFsVmlldygpO1xyXG4gICAgICB0aGlzLnJlbmRlck1hcmtlcnMoKTtcclxuICAgICAgdGhpcy5yZW5kZXJPdmVybGF5cygpO1xyXG4gICAgICB0aGlzLnJlbmRlckdyaWQoKTtcclxuICAgIH0pO1xyXG4gICAgdGhpcy5oYW5kbGVSZXNpemUoKTtcclxuICB9XHJcblxyXG4gIGRlc3Ryb3koKTogdm9pZCB7XHJcbiAgICB0aGlzLmNsb3NlUG9wb3ZlcigpO1xyXG4gICAgLy8gY29udGFpbmVyIHdpbGwgYmUgY2xlYW5lZCB1cCBieSBwYXJlbnRcclxuICB9XHJcblxyXG4gIC8qIC0tLS0gY29uZmlnIGxvYWRpbmcgLS0tLSAqL1xyXG5cclxuICBwcml2YXRlIGxvYWRDb25maWcoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IFN0TWFwQ29uZmlnIHtcclxuICAgIC8vIEZpcnN0IHRyeSBkYXRhLWNvbmZpZyBhdHRyaWJ1dGUgKEpTT04pXHJcbiAgICBjb25zdCBkYXRhQ2ZnID0gY29udGFpbmVyLmdldEF0dHJpYnV0ZShcImRhdGEtem0tY29uZmlnXCIpO1xyXG4gICAgaWYgKGRhdGFDZmcpIHtcclxuICAgICAgdHJ5IHsgcmV0dXJuIEpTT04ucGFyc2UoZGF0YUNmZykgYXMgU3RNYXBDb25maWc7IH0gY2F0Y2ggeyAvKiBmYWxsIHRocm91Z2ggKi8gfVxyXG4gICAgfVxyXG4gICAgLy8gVGhlbiB0cnkgZW1iZWRkZWQgc2NyaXB0IGJsb2NrXHJcbiAgICBjb25zdCBzY3JpcHQgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcjxIVE1MU2NyaXB0RWxlbWVudD4oXCJzY3JpcHQuem0tY29uZmlnLWpzb25cIik7XHJcbiAgICBpZiAoc2NyaXB0Py50ZXh0Q29udGVudCkge1xyXG4gICAgICB0cnkgeyByZXR1cm4gSlNPTi5wYXJzZShzY3JpcHQudGV4dENvbnRlbnQpIGFzIFN0TWFwQ29uZmlnOyB9IGNhdGNoIHsgLyogZmFsbCB0aHJvdWdoICovIH1cclxuICAgIH1cclxuICAgIC8vIEZhbGxiYWNrOiB0cnkgcmVhZGluZyBpbmRpdmlkdWFsIGRhdGEtIGF0dHJpYnV0ZXNcclxuICAgIHJldHVybiB0aGlzLmxvYWRDb25maWdGcm9tQXR0cnMoY29udGFpbmVyKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbG9hZENvbmZpZ0Zyb21BdHRycyhjb250YWluZXI6IEhUTUxFbGVtZW50KTogU3RNYXBDb25maWcge1xyXG4gICAgY29uc3QgZ2V0ID0gKGtleTogc3RyaW5nKSA9PiBjb250YWluZXIuZ2V0QXR0cmlidXRlKGBkYXRhLXptLSR7a2V5fWApO1xyXG4gICAgY29uc3QgaW1hZ2VVcmwgPSBnZXQoXCJpbWFnZXVybFwiKSA/PyBcIlwiO1xyXG4gICAgY29uc3QgbWFya2Vyc1VybCA9IGdldChcIm1hcmtlcnN1cmxcIikgPz8gdW5kZWZpbmVkO1xyXG4gICAgY29uc3QgaWNvblByb2ZpbGVzUmF3ID0gZ2V0KFwiaWNvbnNcIik7XHJcbiAgICBjb25zdCBvdmVybGF5c1JhdyA9IGdldChcIm92ZXJsYXlzXCIpO1xyXG5cclxuICAgIGxldCBpY29uUHJvZmlsZXM6IFN0SWNvblByb2ZpbGVbXSA9IFtdO1xyXG4gICAgdHJ5IHsgaWYgKGljb25Qcm9maWxlc1JhdykgaWNvblByb2ZpbGVzID0gSlNPTi5wYXJzZShpY29uUHJvZmlsZXNSYXcpOyB9IGNhdGNoIHsgLyogb2sgKi8gfVxyXG5cclxuICAgIGxldCBvdmVybGF5czogU3RJbWFnZU92ZXJsYXlbXSA9IFtdO1xyXG4gICAgdHJ5IHsgaWYgKG92ZXJsYXlzUmF3KSBvdmVybGF5cyA9IEpTT04ucGFyc2Uob3ZlcmxheXNSYXcpOyB9IGNhdGNoIHsgLyogb2sgKi8gfVxyXG5cclxuICAgIGxldCBpbml0aWFsQ2VudGVyOiBTdFBvaW50IHwgdW5kZWZpbmVkO1xyXG4gICAgY29uc3QgY3ggPSBnZXQoXCJpbml0aWFsY2VudGVyeFwiKTtcclxuICAgIGNvbnN0IGN5ID0gZ2V0KFwiaW5pdGlhbGNlbnRlcnlcIik7XHJcbiAgICBpZiAoY3ggIT0gbnVsbCAmJiBjeSAhPSBudWxsKSBpbml0aWFsQ2VudGVyID0geyB4OiBwYXJzZUZsb2F0KGN4KSwgeTogcGFyc2VGbG9hdChjeSkgfTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBpbWFnZVVybCxcclxuICAgICAgbWFya2Vyc1VybCxcclxuICAgICAgaW1nVzogcGFyc2VGbG9hdChnZXQoXCJpbWd3XCIpID8/IFwiMFwiKSB8fCAwLFxyXG4gICAgICBpbWdIOiBwYXJzZUZsb2F0KGdldChcImltZ2hcIikgPz8gXCIwXCIpIHx8IDAsXHJcbiAgICAgIG1pblpvb206IHBhcnNlRmxvYXQoZ2V0KFwibWluem9vbVwiKSA/PyBcIjAuMVwiKSxcclxuICAgICAgbWF4Wm9vbTogcGFyc2VGbG9hdChnZXQoXCJtYXh6b29tXCIpID8/IFwiMTBcIiksXHJcbiAgICAgIHdpZHRoOiBnZXQoXCJ3aWR0aFwiKSA/PyB1bmRlZmluZWQsXHJcbiAgICAgIGhlaWdodDogZ2V0KFwiaGVpZ2h0XCIpID8/IHVuZGVmaW5lZCxcclxuICAgICAgYWxpZ246IChnZXQoXCJhbGlnblwiKSBhcyBTdE1hcENvbmZpZ1tcImFsaWduXCJdKSA/PyB1bmRlZmluZWQsXHJcbiAgICAgIGluaXRpYWxab29tOiBnZXQoXCJpbml0aWFsem9vbVwiKSA/IHBhcnNlRmxvYXQoZ2V0KFwiaW5pdGlhbHpvb21cIikhKSA6IHVuZGVmaW5lZCxcclxuICAgICAgaW5pdGlhbENlbnRlcixcclxuICAgICAgaWNvblByb2ZpbGVzLFxyXG4gICAgICBvdmVybGF5cyxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxvYWRNYXJrZXJzKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBTdE1hcmtlcltdIHtcclxuICAgIC8vIFRyeSBkYXRhLW1hcmtlcnMgYXR0cmlidXRlXHJcbiAgICBjb25zdCBkYXRhTWFya2VycyA9IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoXCJkYXRhLXptLW1hcmtlcnNcIik7XHJcbiAgICBpZiAoZGF0YU1hcmtlcnMpIHtcclxuICAgICAgdHJ5IHsgcmV0dXJuIEpTT04ucGFyc2UoZGF0YU1hcmtlcnMpIGFzIFN0TWFya2VyW107IH0gY2F0Y2ggeyAvKiBmYWxsIHRocm91Z2ggKi8gfVxyXG4gICAgfVxyXG4gICAgLy8gVHJ5IGVtYmVkZGVkIHNjcmlwdFxyXG4gICAgY29uc3Qgc2NyaXB0ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3I8SFRNTFNjcmlwdEVsZW1lbnQ+KFwic2NyaXB0LnptLW1hcmtlcnMtanNvblwiKTtcclxuICAgIGlmIChzY3JpcHQ/LnRleHRDb250ZW50KSB7XHJcbiAgICAgIHRyeSB7IHJldHVybiBKU09OLnBhcnNlKHNjcmlwdC50ZXh0Q29udGVudCkgYXMgU3RNYXJrZXJbXTsgfSBjYXRjaCB7IC8qIGZhbGwgdGhyb3VnaCAqLyB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gW107XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIGZldGNoTWFya2VycygpOiBQcm9taXNlPFN0TWFya2VyW10+IHtcclxuICAgIGlmICghdGhpcy5jZmcubWFya2Vyc1VybCkgcmV0dXJuIFtdO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGZldGNoKHRoaXMuY2ZnLm1hcmtlcnNVcmwpO1xyXG4gICAgICBpZiAoIXJlc3Aub2spIHJldHVybiBbXTtcclxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3AuanNvbigpO1xyXG4gICAgICAvLyBUaGUgbWFya2VycyBKU09OIGZvcm1hdCBpcyB7IG1hcmtlcnM6IFsuLi5dLCBsYXllcnM6IFsuLi5dLCAuLi4gfVxyXG4gICAgICByZXR1cm4gKGRhdGE/Lm1hcmtlcnMgPz8gW10pIGFzIFN0TWFya2VyW107XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybihcIlpvb21NYXAgc3RhdGljOiBmYWlsZWQgdG8gbG9hZCBtYXJrZXJzIGZyb21cIiwgdGhpcy5jZmcubWFya2Vyc1VybCwgZSk7XHJcbiAgICAgIHJldHVybiBbXTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qIC0tLS0gRE9NIGNvbnN0cnVjdGlvbiAtLS0tICovXHJcblxyXG4gIHByaXZhdGUgYnVpbGREb20oKTogdm9pZCB7XHJcbiAgICB0aGlzLmNvbnRhaW5lci5zdHlsZS5wb3NpdGlvbiA9IFwicmVsYXRpdmVcIjtcclxuICAgIHRoaXMuY29udGFpbmVyLnN0eWxlLm92ZXJmbG93ID0gXCJoaWRkZW5cIjtcclxuICAgIGlmICh0aGlzLmNmZy53aWR0aCkgdGhpcy5jb250YWluZXIuc3R5bGUud2lkdGggPSB0aGlzLmNmZy53aWR0aDtcclxuICAgIGlmICh0aGlzLmNmZy5oZWlnaHQpIHRoaXMuY29udGFpbmVyLnN0eWxlLmhlaWdodCA9IHRoaXMuY2ZnLmhlaWdodDtcclxuXHJcbiAgICAvLyB2aWV3cG9ydFxyXG4gICAgdGhpcy52aWV3cG9ydCA9IGVsKFwiZGl2XCIsIHRoaXMuY29udGFpbmVyLCB7fSwgXCJ6bS1zdC12aWV3cG9ydFwiKSBhcyBIVE1MRGl2RWxlbWVudDtcclxuICAgIHRoaXMudmlld3BvcnQuc3R5bGUuY3NzVGV4dCA9IFwicG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDtvdmVyZmxvdzpoaWRkZW47Y3Vyc29yOmdyYWI7XCI7XHJcbiAgICBpZiAodGhpcy5jZmcucmVzcG9uc2l2ZSkge1xyXG4gICAgICAvLyBhc3BlY3QtcmF0aW8gYm94XHJcbiAgICAgIGNvbnN0IGFzcGVjdCA9IHRoaXMuY2ZnLmltZ1cgLyB0aGlzLmNmZy5pbWdIO1xyXG4gICAgICB0aGlzLnZpZXdwb3J0LnN0eWxlLnBvc2l0aW9uID0gXCJyZWxhdGl2ZVwiO1xyXG4gICAgICB0aGlzLnZpZXdwb3J0LnN0eWxlLndpZHRoID0gXCIxMDAlXCI7XHJcbiAgICAgIHRoaXMudmlld3BvcnQuc3R5bGUuYXNwZWN0UmF0aW8gPSBTdHJpbmcoYXNwZWN0KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyB3b3JsZCAocGFubmFibGUvem9vbWFibGUgY29udGFpbmVyKVxyXG4gICAgdGhpcy53b3JsZCA9IGVsKFwiZGl2XCIsIHRoaXMudmlld3BvcnQsIHt9LCBcInptLXN0LXdvcmxkXCIpIGFzIEhUTUxEaXZFbGVtZW50O1xyXG4gICAgdGhpcy53b3JsZC5zdHlsZS5jc3NUZXh0ID0gXCJwb3NpdGlvbjphYnNvbHV0ZTt0cmFuc2Zvcm0tb3JpZ2luOjAgMDt3aWxsLWNoYW5nZTp0cmFuc2Zvcm07XCI7XHJcblxyXG4gICAgLy8gYmFzZSBpbWFnZVxyXG4gICAgdGhpcy5pbWdFbCA9IGVsKFwiaW1nXCIsIHRoaXMud29ybGQpIGFzIEhUTUxJbWFnZUVsZW1lbnQ7XHJcbiAgICB0aGlzLmltZ0VsLnN0eWxlLmNzc1RleHQgPSBcInBvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6MDtkaXNwbGF5OmJsb2NrO3BvaW50ZXItZXZlbnRzOm5vbmU7dXNlci1zZWxlY3Q6bm9uZTtcIjtcclxuICAgIHRoaXMuaW1nRWwuZHJhZ2dhYmxlID0gZmFsc2U7XHJcblxyXG4gICAgLy8gb3ZlcmxheXMgY29udGFpbmVyXHJcbiAgICB0aGlzLm92ZXJsYXlzRWwgPSBlbChcImRpdlwiLCB0aGlzLndvcmxkLCB7fSwgXCJ6bS1zdC1vdmVybGF5c1wiKSBhcyBIVE1MRGl2RWxlbWVudDtcclxuICAgIHRoaXMub3ZlcmxheXNFbC5zdHlsZS5jc3NUZXh0ID0gXCJwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjA7d2lkdGg6MTAwJTtoZWlnaHQ6MTAwJTtwb2ludGVyLWV2ZW50czpub25lO1wiO1xyXG5cclxuICAgIC8vIG1hcmtlcnMgY29udGFpbmVyXHJcbiAgICB0aGlzLm1hcmtlcnNFbCA9IGVsKFwiZGl2XCIsIHRoaXMud29ybGQsIHt9LCBcInptLXN0LW1hcmtlcnNcIikgYXMgSFRNTERpdkVsZW1lbnQ7XHJcbiAgICB0aGlzLm1hcmtlcnNFbC5zdHlsZS5jc3NUZXh0ID0gXCJwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjA7d2lkdGg6MTAwJTtoZWlnaHQ6MTAwJTtwb2ludGVyLWV2ZW50czpub25lO1wiO1xyXG5cclxuICAgIC8vIHpvb20gSFVEXHJcbiAgICB0aGlzLmJ1aWxkWm9vbUh1ZCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidWlsZFpvb21IdWQoKTogdm9pZCB7XHJcbiAgICB0aGlzLnpvb21IdWQgPSBlbChcImRpdlwiLCB0aGlzLmNvbnRhaW5lciwge30sIFwiem0tc3Qtem9vbWh1ZFwiKSBhcyBIVE1MRGl2RWxlbWVudDtcclxuICAgIHRoaXMuem9vbUh1ZC5zdHlsZS5jc3NUZXh0ID1cclxuICAgICAgXCJwb3NpdGlvbjphYnNvbHV0ZTtib3R0b206OHB4O3JpZ2h0OjhweDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo0cHg7XCIgK1xyXG4gICAgICBcImJhY2tncm91bmQ6cmdiYSgwLDAsMCwwLjYpO2NvbG9yOiNmZmY7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo0cHggOHB4O1wiICtcclxuICAgICAgXCJmb250LXNpemU6MTNweDtmb250LWZhbWlseTpzYW5zLXNlcmlmO3otaW5kZXg6MTAwO3VzZXItc2VsZWN0Om5vbmU7XCI7XHJcblxyXG4gICAgdGhpcy56b29tT3V0QnRuID0gZWwoXCJidXR0b25cIiwgdGhpcy56b29tSHVkLCB7fSwgXCJ6bS1zdC16b29tYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgdGhpcy56b29tT3V0QnRuLnRleHRDb250ZW50ID0gXCJcdTIyMTJcIjtcclxuICAgIHRoaXMuem9vbU91dEJ0bi5zdHlsZS5jc3NUZXh0ID1cclxuICAgICAgXCJiYWNrZ3JvdW5kOm5vbmU7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMyk7Y29sb3I6I2ZmZjtcIiArXHJcbiAgICAgIFwiYm9yZGVyLXJhZGl1czozcHg7d2lkdGg6MjRweDtoZWlnaHQ6MjRweDtjdXJzb3I6cG9pbnRlcjtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7XCI7XHJcblxyXG4gICAgdGhpcy56b29tUGVyY2VudEVsID0gZWwoXCJzcGFuXCIsIHRoaXMuem9vbUh1ZCkgYXMgSFRNTFNwYW5FbGVtZW50O1xyXG4gICAgdGhpcy56b29tUGVyY2VudEVsLnN0eWxlLmNzc1RleHQgPSBcIm1pbi13aWR0aDo0OHB4O3RleHQtYWxpZ246Y2VudGVyO1wiO1xyXG5cclxuICAgIHRoaXMuem9vbUluQnRuID0gZWwoXCJidXR0b25cIiwgdGhpcy56b29tSHVkLCB7fSwgXCJ6bS1zdC16b29tYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgdGhpcy56b29tSW5CdG4udGV4dENvbnRlbnQgPSBcIitcIjtcclxuICAgIHRoaXMuem9vbUluQnRuLnN0eWxlLmNzc1RleHQgPSB0aGlzLnpvb21PdXRCdG4uc3R5bGUuY3NzVGV4dDtcclxuXHJcbiAgICB0aGlzLnpvb21JbkJ0bi5vbmNsaWNrID0gKCkgPT4gdGhpcy56b29tQXQoMS4zKTtcclxuICAgIHRoaXMuem9vbU91dEJ0bi5vbmNsaWNrID0gKCkgPT4gdGhpcy56b29tQXQoMSAvIDEuMyk7XHJcbiAgICB0aGlzLnVwZGF0ZVpvb21IdWQoKTtcclxuICB9XHJcblxyXG4gIC8qIC0tLS0gYmFzZSBpbWFnZSBsb2FkaW5nIC0tLS0gKi9cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBsb2FkQmFzZUltYWdlKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKCF0aGlzLmNmZy5pbWFnZVVybCkgcmV0dXJuO1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XHJcbiAgICAgIHRoaXMuaW1nRWwub25sb2FkID0gKCkgPT4ge1xyXG4gICAgICAgIC8vIFVzZSBuYXR1cmFsIGRpbWVuc2lvbnMgdW5sZXNzIGNvbmZpZyBleHBsaWNpdGx5IHNwZWNpZmllZCB0aGVtXHJcbiAgICAgICAgaWYgKCF0aGlzLmltZ1cgfHwgIXRoaXMuaW1nSCkge1xyXG4gICAgICAgICAgdGhpcy5pbWdXID0gdGhpcy5pbWdFbC5uYXR1cmFsV2lkdGg7XHJcbiAgICAgICAgICB0aGlzLmltZ0ggPSB0aGlzLmltZ0VsLm5hdHVyYWxIZWlnaHQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuaW1nTG9hZGVkID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLndvcmxkLnN0eWxlLndpZHRoID0gYCR7dGhpcy5pbWdXfXB4YDtcclxuICAgICAgICB0aGlzLndvcmxkLnN0eWxlLmhlaWdodCA9IGAke3RoaXMuaW1nSH1weGA7XHJcbiAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICB9O1xyXG4gICAgICB0aGlzLmltZ0VsLm9uZXJyb3IgPSAoKSA9PiByZXNvbHZlKCk7XHJcbiAgICAgIHRoaXMuaW1nRWwuc3JjID0gdGhpcy5jZmcuaW1hZ2VVcmw7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qIC0tLS0gaW5pdGlhbCB2aWV3IC0tLS0gKi9cclxuXHJcbiAgcHJpdmF0ZSBhcHBseUluaXRpYWxWaWV3KCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuY2ZnLmluaXRpYWxWaWV3UmVjdCkge1xyXG4gICAgICB0aGlzLmZpdFRvUmVjdCh0aGlzLmNmZy5pbml0aWFsVmlld1JlY3QpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbGV0IHogPSB0aGlzLmNmZy5pbml0aWFsWm9vbTtcclxuICAgICAgaWYgKHogPT0gbnVsbCkge1xyXG4gICAgICAgIHogPSB0aGlzLmNhbGNGaXRTY2FsZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIFN1cHBvcnQgbm9ybWFsaXplZCBpbml0aWFsLWNlbnRlciAoMC0xIHJhbmdlLCBlLmcuIGZyb20gem9vbW1hcCBZQU1MIHZpZXcuY2VudGVyWC9ZKVxyXG4gICAgICBjb25zdCBpYyA9IHRoaXMuY2ZnLmluaXRpYWxDZW50ZXI7XHJcbiAgICAgIGxldCBjeDogbnVtYmVyLCBjeTogbnVtYmVyO1xyXG4gICAgICBpZiAoaWMgJiYgaWMueCA8PSAxICYmIGljLnkgPD0gMSAmJiBpYy54ID49IDAgJiYgaWMueSA+PSAwKSB7XHJcbiAgICAgICAgLy8gVHJlYXQgYXMgbm9ybWFsaXplZCBmcmFjdGlvbiBvZiBpbWFnZSBkaW1lbnNpb25zXHJcbiAgICAgICAgY3ggPSBpYy54ICogdGhpcy5pbWdXO1xyXG4gICAgICAgIGN5ID0gaWMueSAqIHRoaXMuaW1nSDtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjeCA9IGljPy54ID8/IHRoaXMuaW1nVyAvIDI7XHJcbiAgICAgICAgY3kgPSBpYz8ueSA/PyB0aGlzLmltZ0ggLyAyO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuc2V0Vmlldyh6LCBjeCwgY3kpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjYWxjRml0U2NhbGUoKTogbnVtYmVyIHtcclxuICAgIGNvbnN0IHZ3ID0gdGhpcy52aWV3cG9ydC5jbGllbnRXaWR0aCB8fCAxO1xyXG4gICAgY29uc3QgdmggPSB0aGlzLnZpZXdwb3J0LmNsaWVudEhlaWdodCB8fCAxO1xyXG4gICAgY29uc3QgcyA9IE1hdGgubWluKHZ3IC8gKHRoaXMuaW1nVyB8fCAxKSwgdmggLyAodGhpcy5pbWdIIHx8IDEpKTtcclxuICAgIHJldHVybiBNYXRoLm1heCh0aGlzLmNmZy5taW5ab29tLCBNYXRoLm1pbih0aGlzLmNmZy5tYXhab29tLCBzKSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGZpdFRvUmVjdChyOiBTdFJlY3QpOiB2b2lkIHtcclxuICAgIGNvbnN0IHJ3ID0gci5yaWdodCAtIHIubGVmdDtcclxuICAgIGNvbnN0IHJoID0gci5ib3R0b20gLSByLnRvcDtcclxuICAgIGlmIChydyA8PSAwIHx8IHJoIDw9IDApIHJldHVybjtcclxuICAgIGNvbnN0IHZ3ID0gdGhpcy52aWV3cG9ydC5jbGllbnRXaWR0aCB8fCAxO1xyXG4gICAgY29uc3QgdmggPSB0aGlzLnZpZXdwb3J0LmNsaWVudEhlaWdodCB8fCAxO1xyXG4gICAgY29uc3QgcyA9IE1hdGgubWluKHZ3IC8gcncsIHZoIC8gcmgpO1xyXG4gICAgY29uc3QgY3ggPSByLmxlZnQgKyBydyAvIDI7XHJcbiAgICBjb25zdCBjeSA9IHIudG9wICsgcmggLyAyO1xyXG4gICAgdGhpcy5zZXRWaWV3KHMsIGN4LCBjeSk7XHJcbiAgfVxyXG5cclxuICBmaXRUb1ZpZXcoKTogdm9pZCB7XHJcbiAgICBjb25zdCB6ID0gdGhpcy5jYWxjRml0U2NhbGUoKTtcclxuICAgIHRoaXMuc2V0Vmlldyh6LCB0aGlzLmltZ1cgLyAyLCB0aGlzLmltZ0ggLyAyKTtcclxuICB9XHJcblxyXG4gIC8qIC0tLS0gdmlldyBjb250cm9sIC0tLS0gKi9cclxuXHJcbiAgcHJpdmF0ZSBzZXRWaWV3KHNjYWxlOiBudW1iZXIsIHdvcmxkQ3g6IG51bWJlciwgd29ybGRDeTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICB0aGlzLnNjYWxlID0gTWF0aC5tYXgodGhpcy5jZmcubWluWm9vbSwgTWF0aC5taW4odGhpcy5jZmcubWF4Wm9vbSwgc2NhbGUpKTtcclxuICAgIGNvbnN0IHZ3ID0gdGhpcy52aWV3cG9ydC5jbGllbnRXaWR0aCB8fCAxO1xyXG4gICAgY29uc3QgdmggPSB0aGlzLnZpZXdwb3J0LmNsaWVudEhlaWdodCB8fCAxO1xyXG4gICAgdGhpcy50eCA9IHZ3IC8gMiAtIHdvcmxkQ3ggKiB0aGlzLnNjYWxlO1xyXG4gICAgdGhpcy50eSA9IHZoIC8gMiAtIHdvcmxkQ3kgKiB0aGlzLnNjYWxlO1xyXG4gICAgdGhpcy5hcHBseVRyYW5zZm9ybSgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB6b29tQXQoZmFjdG9yOiBudW1iZXIsIGN4PzogbnVtYmVyLCBjeT86IG51bWJlcik6IHZvaWQge1xyXG4gICAgY29uc3QgdncgPSB0aGlzLnZpZXdwb3J0LmNsaWVudFdpZHRoIHx8IDE7XHJcbiAgICBjb25zdCB2aCA9IHRoaXMudmlld3BvcnQuY2xpZW50SGVpZ2h0IHx8IDE7XHJcbiAgICBjb25zdCBzeCA9IGN4ID8/IHZ3IC8gMjtcclxuICAgIGNvbnN0IHN5ID0gY3kgPz8gdmggLyAyO1xyXG4gICAgY29uc3Qgd29ybGRYID0gKHN4IC0gdGhpcy50eCkgLyB0aGlzLnNjYWxlO1xyXG4gICAgY29uc3Qgd29ybGRZID0gKHN5IC0gdGhpcy50eSkgLyB0aGlzLnNjYWxlO1xyXG4gICAgY29uc3QgbmV3U2NhbGUgPSBNYXRoLm1heChcclxuICAgICAgdGhpcy5jZmcubWluWm9vbSxcclxuICAgICAgTWF0aC5taW4odGhpcy5jZmcubWF4Wm9vbSwgdGhpcy5zY2FsZSAqIGZhY3RvciksXHJcbiAgICApO1xyXG4gICAgaWYgKG5ld1NjYWxlID09PSB0aGlzLnNjYWxlKSByZXR1cm47XHJcbiAgICB0aGlzLnR4ID0gc3ggLSB3b3JsZFggKiBuZXdTY2FsZTtcclxuICAgIHRoaXMudHkgPSBzeSAtIHdvcmxkWSAqIG5ld1NjYWxlO1xyXG4gICAgdGhpcy5zY2FsZSA9IG5ld1NjYWxlO1xyXG4gICAgdGhpcy5hcHBseVRyYW5zZm9ybSgpO1xyXG4gICAgdGhpcy5yZW5kZXJNYXJrZXJzKCk7XHJcbiAgICB0aGlzLnVwZGF0ZVpvb21IdWQoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXBwbHlUcmFuc2Zvcm0oKTogdm9pZCB7XHJcbiAgICB0aGlzLndvcmxkLnN0eWxlLnRyYW5zZm9ybSA9IGB0cmFuc2xhdGUoJHt0aGlzLnR4fXB4LCAke3RoaXMudHl9cHgpIHNjYWxlKCR7dGhpcy5zY2FsZX0pYDtcclxuICAgIGlmICh0aGlzLmdyaWRTdmcpIHRoaXMudXBkYXRlR3JpZFRyYW5zZm9ybSgpO1xyXG4gIH1cclxuXHJcbiAgLyogLS0tLSBtYXJrZXIgcmVuZGVyaW5nIC0tLS0gKi9cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXJNYXJrZXJzKCk6IHZvaWQge1xyXG4gICAgdGhpcy5jbG9zZVBvcG92ZXIoKTtcclxuICAgIC8vIENsZWFyXHJcbiAgICB3aGlsZSAodGhpcy5tYXJrZXJzRWwuZmlyc3RDaGlsZCkgdGhpcy5tYXJrZXJzRWwucmVtb3ZlQ2hpbGQodGhpcy5tYXJrZXJzRWwuZmlyc3RDaGlsZCk7XHJcblxyXG4gICAgY29uc3QgcyA9IHRoaXMuc2NhbGU7XHJcbiAgICBmb3IgKGNvbnN0IG0gb2YgdGhpcy5tYXJrZXJzKSB7XHJcbiAgICAgIC8vIHpvb20gdmlzaWJpbGl0eVxyXG4gICAgICBpZiAobS5taW5ab29tICE9PSB1bmRlZmluZWQgJiYgcyA8IG0ubWluWm9vbSkgY29udGludWU7XHJcbiAgICAgIGlmIChtLm1heFpvb20gIT09IHVuZGVmaW5lZCAmJiBzID4gbS5tYXhab29tKSBjb250aW51ZTtcclxuXHJcbiAgICAgIGNvbnN0IGljb24gPSB0aGlzLmljb25NYXAuZ2V0KG0uaWNvbktleSA/PyBcIl9fZGVmYXVsdF9fXCIpO1xyXG4gICAgICBpZiAoIWljb24gJiYgIW0uaWNvbktleSkge1xyXG4gICAgICAgIC8vIElmIG5vIGljb24ga2V5IGFuZCBubyBwcm9maWxlLCBjcmVhdGUgYSBzaW1wbGUgZG90XHJcbiAgICAgICAgdGhpcy5yZW5kZXJTaW1wbGVNYXJrZXIobSk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKCFpY29uKSB7XHJcbiAgICAgICAgLy8gVW5rbm93biBpY29uIGtleSBcdTIwMTMgcmVuZGVyIGFzIHNpbXBsZSBtYXJrZXJcclxuICAgICAgICB0aGlzLnJlbmRlclNpbXBsZU1hcmtlcihtKTtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgYmFzZVNpemUgPSAodHlwZW9mIChtIGFzIGFueSkuc2l6ZU92ZXJyaWRlID09PSBcIm51bWJlclwiICYmIChtIGFzIGFueSkuc2l6ZU92ZXJyaWRlID4gMCkgPyAobSBhcyBhbnkpLnNpemVPdmVycmlkZSA6IGljb24uc2l6ZTtcclxuICAgICAgY29uc3Qgc2NhbGVNdWwgPSBtLnNjYWxlID8/IDE7XHJcbiAgICAgIGNvbnN0IHNpemUgPSBiYXNlU2l6ZSAqIHNjYWxlTXVsO1xyXG4gICAgICBjb25zdCBheCA9IGljb24uYW5jaG9yWDtcclxuICAgICAgY29uc3QgYXkgPSBpY29uLmFuY2hvclk7XHJcblxyXG4gICAgICBjb25zdCBsZWZ0UHggPSBtLnggKiB0aGlzLmltZ1c7XHJcbiAgICAgIGNvbnN0IHRvcFB4ID0gbS55ICogdGhpcy5pbWdIO1xyXG5cclxuICAgICAgY29uc3QgaG9zdCA9IGVsKFwiZGl2XCIsIHRoaXMubWFya2Vyc0VsLCB7fSwgXCJ6bS1zdC1tYXJrZXJcIikgYXMgSFRNTERpdkVsZW1lbnQ7XHJcbiAgICAgIGhvc3Quc3R5bGUuY3NzVGV4dCA9IGBwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OiR7bGVmdFB4fXB4O3RvcDoke3RvcFB4fXB4O3BvaW50ZXItZXZlbnRzOmF1dG87ei1pbmRleDoxMDtgO1xyXG5cclxuICAgICAgY29uc3QgYW5jaG9yID0gZWwoXCJkaXZcIiwgaG9zdCkgYXMgSFRNTERpdkVsZW1lbnQ7XHJcbiAgICAgIGFuY2hvci5zdHlsZS5jc3NUZXh0ID0gYHRyYW5zZm9ybTp0cmFuc2xhdGUoJHstYXh9cHgsICR7LWF5fXB4KTtgO1xyXG5cclxuICAgICAgY29uc3QgaW1nID0gZWwoXCJpbWdcIiwgYW5jaG9yLCB7fSwgXCJ6bS1zdC1tYXJrZXItaWNvblwiKSBhcyBIVE1MSW1hZ2VFbGVtZW50O1xyXG4gICAgICBpbWcuc3JjID0gaWNvbi51cmw7XHJcbiAgICAgIGltZy5zdHlsZS53aWR0aCA9IGAke3NpemV9cHhgO1xyXG4gICAgICBpbWcuc3R5bGUuaGVpZ2h0ID0gXCJhdXRvXCI7XHJcbiAgICAgIGltZy5kcmFnZ2FibGUgPSBmYWxzZTtcclxuICAgICAgaW1nLnN0eWxlLnBvaW50ZXJFdmVudHMgPSBcIm5vbmVcIjtcclxuXHJcbiAgICAgIGlmIChpY29uLnJvdGF0aW9uRGVnKSB7XHJcbiAgICAgICAgaG9zdC5zdHlsZS50cmFuc2Zvcm0gPSBgcm90YXRlKCR7aWNvbi5yb3RhdGlvbkRlZ31kZWcpYDtcclxuICAgICAgfVxyXG4gICAgICBpZiAoaWNvbi5zaGFkb3dFbmFibGVkKSB7XHJcbiAgICAgICAgY29uc3Qgc2MgPSBpY29uLnNoYWRvd0NvbG9yID8/IFwicmdiYSgwLDAsMCwwLjM1KVwiO1xyXG4gICAgICAgIGNvbnN0IGJsdXIgPSBpY29uLnNoYWRvd0JsdXJQeCA/PyAzO1xyXG4gICAgICAgIGNvbnN0IHN4ID0gaWNvbi5zaGFkb3dPZmZzZXRYUHggPz8gMTtcclxuICAgICAgICBjb25zdCBzeSA9IGljb24uc2hhZG93T2Zmc2V0WVB4ID8/IDE7XHJcbiAgICAgICAgaW1nLnN0eWxlLmZpbHRlciA9IGBkcm9wLXNoYWRvdygke3N4fXB4ICR7c3l9cHggJHtibHVyfXB4ICR7c2N9KWA7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIHRvb2x0aXBcclxuICAgICAgaWYgKG0udG9vbHRpcCkge1xyXG4gICAgICAgIGhvc3QudGl0bGUgPSBtLnRvb2x0aXA7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIGNsaWNrOiBvcGVuIGxpbmtcclxuICAgICAgaWYgKG0ubGluaykge1xyXG4gICAgICAgIGhvc3Quc3R5bGUuY3Vyc29yID0gXCJwb2ludGVyXCI7XHJcbiAgICAgICAgaG9zdC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcclxuICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgICB3aW5kb3cub3Blbihub3JtYWxpemVMaW5rKG0ubGluayEpLCBcIl9zZWxmXCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBob3ZlciBwb3BvdmVyIFx1MjAxMyBzaG93IGZvciB0b29sdGlwIGFuZC9vciBsaW5rZWQgbWFya2Vyc1xyXG4gICAgICBpZiAobS50b29sdGlwIHx8IG0ubGluaykge1xyXG4gICAgICAgIGhvc3QuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZW50ZXJcIiwgKCkgPT4gdGhpcy5zaG93VG9vbHRpcChob3N0LCBtKSk7XHJcbiAgICAgICAgaG9zdC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VsZWF2ZVwiLCAoKSA9PiB0aGlzLmhpZGVUb29sdGlwKCkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbmRlclNpbXBsZU1hcmtlcihtOiBNYXJrZXIpOiB2b2lkIHtcclxuICAgIGNvbnN0IGRvdCA9IGVsKFwiZGl2XCIsIHRoaXMubWFya2Vyc0VsLCB7fSwgXCJ6bS1zdC1zaW1wbGUtbWFya2VyXCIpIGFzIEhUTUxEaXZFbGVtZW50O1xyXG4gICAgZG90LnN0eWxlLmNzc1RleHQgPVxyXG4gICAgICBgcG9zaXRpb246YWJzb2x1dGU7bGVmdDoke20ueCAqIHRoaXMuaW1nV31weDt0b3A6JHttLnkgKiB0aGlzLmltZ0h9cHg7YCArXHJcbiAgICAgIFwid2lkdGg6MTBweDtoZWlnaHQ6MTBweDtib3JkZXItcmFkaXVzOjUwJTtiYWNrZ3JvdW5kOiNlNzRjM2M7Ym9yZGVyOjJweCBzb2xpZCAjZmZmO1wiICtcclxuICAgICAgXCJ0cmFuc2Zvcm06dHJhbnNsYXRlKC01cHgsLTVweCk7cG9pbnRlci1ldmVudHM6YXV0bzt6LWluZGV4OjEwO2N1cnNvcjpwb2ludGVyO2JveC1zaGFkb3c6MCAxcHggM3B4IHJnYmEoMCwwLDAsMC4zKTtcIjtcclxuXHJcbiAgICBpZiAobS50b29sdGlwKSBkb3QudGl0bGUgPSBtLnRvb2x0aXA7XHJcbiAgICBpZiAobS5saW5rKSB7XHJcbiAgICAgIGRvdC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcclxuICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIHdpbmRvdy5vcGVuKG5vcm1hbGl6ZUxpbmsobS5saW5rISksIFwiX3NlbGZcIik7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLy8gaG92ZXIgcHJldmlldyBmb3Igc2ltcGxlIG1hcmtlcnMgdG9vXHJcbiAgICBpZiAobS50b29sdGlwIHx8IG0ubGluaykge1xyXG4gICAgICBkb3QuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZW50ZXJcIiwgKCkgPT4gdGhpcy5zaG93VG9vbHRpcChkb3QsIG0pKTtcclxuICAgICAgZG90LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWxlYXZlXCIsICgpID0+IHRoaXMuaGlkZVRvb2x0aXAoKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKiAtLS0tIHRvb2x0aXAgd2l0aCBwYWdlLWNvbnRlbnQgcHJldmlldyAtLS0tICovXHJcblxyXG4gIHByaXZhdGUgdG9vbHRpcEVsOiBIVE1MRGl2RWxlbWVudCB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgdG9vbHRpcEhvc3Q6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XHJcbiAgLyoqIFVuaXF1ZSBpZCBwZXIgbWFya2VyIHNvIHdlIGNhbiBkaXNjYXJkIHN0YWxlIGFzeW5jIHByZXZpZXcgcmVzcG9uc2VzICovXHJcbiAgcHJpdmF0ZSB0b29sdGlwTWFya2VySWQgPSBcIlwiO1xyXG4gIHByaXZhdGUgdG9vbHRpcFRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgdG9vbHRpcFByZXZpZXdGZXRjaGVkID0gZmFsc2U7XHJcblxyXG4gIHByaXZhdGUgc2hvd1Rvb2x0aXAoaG9zdDogSFRNTEVsZW1lbnQsIG06IFN0TWFya2VyKTogdm9pZCB7XHJcbiAgICAvLyBDbGVhciBhbnkgcGVuZGluZyBoaWRlXHJcbiAgICBpZiAodGhpcy50b29sdGlwVGltZXIpIHsgY2xlYXJUaW1lb3V0KHRoaXMudG9vbHRpcFRpbWVyKTsgdGhpcy50b29sdGlwVGltZXIgPSBudWxsOyB9XHJcblxyXG4gICAgLy8gSWYgYWxyZWFkeSBzaG93aW5nIGZvciB0aGUgKnNhbWUqIG1hcmtlciwgZG8gbm90aGluZ1xyXG4gICAgaWYgKHRoaXMudG9vbHRpcEVsICYmIHRoaXMudG9vbHRpcE1hcmtlcklkID09PSAobS5pZCB8fCBcIlwiKSkge1xyXG4gICAgICAvLyBTdGlsbCBlbnN1cmUgdG9vbHRpcCBpcyB2aXNpYmxlIChmYWRlIG1heSBoYXZlIGJlZW4gaW50ZXJydXB0ZWQpXHJcbiAgICAgIHRoaXMudG9vbHRpcEVsLnN0eWxlLm9wYWNpdHkgPSBcIjFcIjtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZGlzcG9zZVRvb2x0aXAoKTtcclxuXHJcbiAgICBjb25zdCBpZCA9IG0uaWQgfHwgXCJtYXJrZXItXCIgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKTtcclxuICAgIHRoaXMudG9vbHRpcE1hcmtlcklkID0gaWQ7XHJcbiAgICB0aGlzLnRvb2x0aXBIb3N0ID0gaG9zdDtcclxuICAgIHRoaXMudG9vbHRpcFByZXZpZXdGZXRjaGVkID0gZmFsc2U7XHJcblxyXG4gICAgY29uc3QgdGlwID0gZWwoXCJkaXZcIiwgZG9jdW1lbnQuYm9keSwge30sIFwiem0tc3QtdG9vbHRpcFwiKSBhcyBIVE1MRGl2RWxlbWVudDtcclxuICAgIHRpcC5pbm5lckhUTUwgPSBidWlsZFRvb2x0aXBDb250ZW50KG0pO1xyXG4gICAgdGhpcy50b29sdGlwRWwgPSB0aXA7XHJcblxyXG4gICAgLy8gLS0tIEFsbG93IGhvdmVyIGludG8gdG9vbHRpcCAobWF0Y2hlcyBERyBiZWhhdmlvcikgLS0tXHJcbiAgICB0aXAuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZW50ZXJcIiwgKCkgPT4ge1xyXG4gICAgICBpZiAodGhpcy50b29sdGlwVGltZXIpIHsgY2xlYXJUaW1lb3V0KHRoaXMudG9vbHRpcFRpbWVyKTsgdGhpcy50b29sdGlwVGltZXIgPSBudWxsOyB9XHJcbiAgICAgIGlmICh0aGlzLnRvb2x0aXBFbCkgdGhpcy50b29sdGlwRWwuc3R5bGUub3BhY2l0eSA9IFwiMVwiO1xyXG4gICAgfSk7XHJcbiAgICB0aXAuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbGVhdmVcIiwgKCkgPT4gdGhpcy5oaWRlVG9vbHRpcCgpKTtcclxuXHJcbiAgICAvLyBJZiBpdCdzIGEgZ2xvYmFsIHRpcCwgY2xlYW4gaXQgdXBcclxuICAgIGlmIChnbG9iYWxBY3RpdmVUaXAgJiYgZ2xvYmFsQWN0aXZlVGlwLnRpcCAhPT0gdGlwKSB7XHJcbiAgICAgIGdsb2JhbEFjdGl2ZVRpcC50aXAucmVtb3ZlKCk7XHJcbiAgICB9XHJcbiAgICBnbG9iYWxBY3RpdmVUaXAgPSB7IHRpcCwgbWFya2VySWQ6IGlkIH07XHJcblxyXG4gICAgdGhpcy5yZXBvc2l0aW9uVG9vbHRpcChob3N0KTtcclxuXHJcbiAgICAvLyBGYWRlIGluIChtYXRjaCBERydzIG9wYWNpdHkgdHJhbnNpdGlvbilcclxuICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XHJcbiAgICAgIGlmICh0aGlzLnRvb2x0aXBFbCA9PT0gdGlwKSB0aGlzLnRvb2x0aXBFbC5jbGFzc0xpc3QuYWRkKFwiem0tc3QtdG9vbHRpcC12aXNpYmxlXCIpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU3RhcnQgYXN5bmMgcGFnZSBwcmV2aWV3IGZldGNoIGlmIHRoZSBtYXJrZXIgaGFzIGEgbGlua1xyXG4gICAgaWYgKG0ubGluaykge1xyXG4gICAgICBjb25zdCB1cmwgPSBub3JtYWxpemVMaW5rKG0ubGluayEpO1xyXG4gICAgICBjb25zdCBjYXB0dXJlZElkID0gaWQ7XHJcbiAgICAgIGZldGNoUGFnZVByZXZpZXcodXJsKS50aGVuKChwcmV2aWV3SHRtbCkgPT4ge1xyXG4gICAgICAgIC8vIEd1YXJkOiBzdGlsbCB0aGUgc2FtZSB0b29sdGlwP1xyXG4gICAgICAgIGlmICh0aGlzLnRvb2x0aXBNYXJrZXJJZCAhPT0gY2FwdHVyZWRJZCB8fCAhdGhpcy50b29sdGlwRWwpIHJldHVybjtcclxuICAgICAgICB0aGlzLnRvb2x0aXBQcmV2aWV3RmV0Y2hlZCA9IHRydWU7XHJcbiAgICAgICAgdGhpcy50b29sdGlwRWwuaW5uZXJIVE1MID0gYnVpbGRUb29sdGlwQ29udGVudChtLCBwcmV2aWV3SHRtbCk7XHJcbiAgICAgICAgdGhpcy5yZXBvc2l0aW9uVG9vbHRpcChob3N0KTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlcG9zaXRpb25Ub29sdGlwKGhvc3Q6IEhUTUxFbGVtZW50KTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMudG9vbHRpcEVsKSByZXR1cm47XHJcbiAgICBjb25zdCByID0gaG9zdC5nZXRDbGllbnRSZWN0cygpW2hvc3QuZ2V0Q2xpZW50UmVjdHMoKS5sZW5ndGggLSAxXSB8fCBob3N0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgY29uc3Qgdmlld3BvcnRXaWR0aCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aDtcclxuICAgIGNvbnN0IHZpZXdwb3J0SGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xyXG4gICAgY29uc3QgZ2FwID0gMTI7XHJcbiAgICBjb25zdCBlZGdlUGFkZGluZyA9IDEwO1xyXG5cclxuICAgIGNvbnN0IHNwYWNlQmVsb3cgPSB2aWV3cG9ydEhlaWdodCAtIChyLmJvdHRvbSk7XHJcbiAgICBjb25zdCBzcGFjZUFib3ZlID0gci50b3A7XHJcbiAgICBjb25zdCBzcGFjZVJpZ2h0ID0gdmlld3BvcnRXaWR0aCAtIChyLnJpZ2h0KTtcclxuICAgIGNvbnN0IHNwYWNlTGVmdCA9IHIubGVmdDtcclxuXHJcbiAgICAvLyBQcmVmZXIgZWRnZSBhd2F5IGZyb20gcG9pbnRlciAobGlrZSBERylcclxuICAgIGNvbnN0IHBsYWNlQmVsb3cgPSBzcGFjZUJlbG93ID49IHRoaXMudG9vbHRpcEVsLm9mZnNldEhlaWdodCArIGdhcDtcclxuICAgIGNvbnN0IHBsYWNlUmlnaHQgPSBzcGFjZVJpZ2h0ID49IHRoaXMudG9vbHRpcEVsLm9mZnNldFdpZHRoICsgZ2FwO1xyXG5cclxuICAgIGxldCB0b3A6IG51bWJlcjtcclxuICAgIGxldCBsZWZ0OiBudW1iZXI7XHJcblxyXG4gICAgaWYgKHBsYWNlQmVsb3cpIHtcclxuICAgICAgdG9wID0gci5ib3R0b20gKyBnYXA7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0b3AgPSByLnRvcCAtIHRoaXMudG9vbHRpcEVsLm9mZnNldEhlaWdodCAtIGdhcDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAocGxhY2VSaWdodCkge1xyXG4gICAgICBsZWZ0ID0gci5sZWZ0O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbGVmdCA9IHIucmlnaHQgLSB0aGlzLnRvb2x0aXBFbC5vZmZzZXRXaWR0aDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBDbGFtcCB0byB2aWV3cG9ydCBlZGdlc1xyXG4gICAgaWYgKHRvcCA8IGVkZ2VQYWRkaW5nKSB0b3AgPSBlZGdlUGFkZGluZztcclxuICAgIGlmICh0b3AgKyB0aGlzLnRvb2x0aXBFbC5vZmZzZXRIZWlnaHQgKyBlZGdlUGFkZGluZyA+IHZpZXdwb3J0SGVpZ2h0KSB7XHJcbiAgICAgIHRvcCA9IHZpZXdwb3J0SGVpZ2h0IC0gdGhpcy50b29sdGlwRWwub2Zmc2V0SGVpZ2h0IC0gZWRnZVBhZGRpbmc7XHJcbiAgICB9XHJcbiAgICBpZiAobGVmdCA8IGVkZ2VQYWRkaW5nKSBsZWZ0ID0gZWRnZVBhZGRpbmc7XHJcbiAgICBpZiAobGVmdCArIHRoaXMudG9vbHRpcEVsLm9mZnNldFdpZHRoICsgZWRnZVBhZGRpbmcgPiB2aWV3cG9ydFdpZHRoKSB7XHJcbiAgICAgIGxlZnQgPSB2aWV3cG9ydFdpZHRoIC0gdGhpcy50b29sdGlwRWwub2Zmc2V0V2lkdGggLSBlZGdlUGFkZGluZztcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnRvb2x0aXBFbC5zdHlsZS5sZWZ0ID0gYCR7bGVmdH1weGA7XHJcbiAgICB0aGlzLnRvb2x0aXBFbC5zdHlsZS50b3AgPSBgJHt0b3B9cHhgO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoaWRlVG9vbHRpcCgpOiB2b2lkIHtcclxuICAgIC8vIFNtYWxsIGRlbGF5IHNvIHJhcGlkIG1vdXNlLW91dC9pbiBkb2Vzbid0IGZsaWNrZXIgKERHIHVzZXMgMTAwbXMpXHJcbiAgICBpZiAodGhpcy50b29sdGlwVGltZXIpIGNsZWFyVGltZW91dCh0aGlzLnRvb2x0aXBUaW1lcik7XHJcbiAgICB0aGlzLnRvb2x0aXBUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICB0aGlzLmRpc3Bvc2VUb29sdGlwKCk7XHJcbiAgICB9LCAxMjApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBkaXNwb3NlVG9vbHRpcCgpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLnRvb2x0aXBUaW1lcikgeyBjbGVhclRpbWVvdXQodGhpcy50b29sdGlwVGltZXIpOyB0aGlzLnRvb2x0aXBUaW1lciA9IG51bGw7IH1cclxuICAgIGlmICh0aGlzLnRvb2x0aXBFbCkge1xyXG4gICAgICB0aGlzLnRvb2x0aXBFbC5yZW1vdmUoKTtcclxuICAgICAgdGhpcy50b29sdGlwRWwgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgaWYgKGdsb2JhbEFjdGl2ZVRpcCkge1xyXG4gICAgICBnbG9iYWxBY3RpdmVUaXAgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgdGhpcy50b29sdGlwTWFya2VySWQgPSBcIlwiO1xyXG4gICAgdGhpcy50b29sdGlwSG9zdCA9IG51bGw7XHJcbiAgICB0aGlzLnRvb2x0aXBQcmV2aWV3RmV0Y2hlZCA9IGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgLyogLS0tLSBwb3BvdmVyIC0tLS0gKi9cclxuXHJcbiAgcHJpdmF0ZSBjbG9zZVBvcG92ZXIoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5hY3RpdmVQb3BvdmVyKSB7XHJcbiAgICAgIHRoaXMuYWN0aXZlUG9wb3Zlci5yZW1vdmUoKTtcclxuICAgICAgdGhpcy5hY3RpdmVQb3BvdmVyID0gbnVsbDtcclxuICAgIH1cclxuICAgIHRoaXMuYWN0aXZlTWFya2VyRWwgPSBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyogLS0tLSBvdmVybGF5cyAtLS0tICovXHJcblxyXG4gIHByaXZhdGUgcmVuZGVyT3ZlcmxheXMoKTogdm9pZCB7XHJcbiAgICBmb3IgKGNvbnN0IG8gb2YgdGhpcy5vdmVybGF5cykge1xyXG4gICAgICBjb25zdCBlbG0gPSBlbChcImltZ1wiLCB0aGlzLm92ZXJsYXlzRWwpIGFzIEhUTUxJbWFnZUVsZW1lbnQ7XHJcbiAgICAgIGVsbS5zcmMgPSBvLnVybDtcclxuICAgICAgZWxtLnN0eWxlLmNzc1RleHQgPVxyXG4gICAgICAgIFwicG9zaXRpb246YWJzb2x1dGU7dG9wOjA7bGVmdDowO3dpZHRoOjEwMCU7aGVpZ2h0OjEwMCU7cG9pbnRlci1ldmVudHM6bm9uZTtvYmplY3QtZml0OmNvbnRhaW47XCI7XHJcbiAgICAgIGVsbS5kcmFnZ2FibGUgPSBmYWxzZTtcclxuICAgICAgaWYgKCFvLnZpc2libGUpIGVsbS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKiAtLS0tIGdyaWQgLS0tLSAqL1xyXG5cclxuICBwcml2YXRlIHJlbmRlckdyaWQoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuY2ZnLmdyaWQ/LnZpc2libGUpIHJldHVybjtcclxuXHJcbiAgICB0aGlzLmdyaWRTdmcgPSBzdmdFbChcInN2Z1wiLCB0aGlzLndvcmxkLCB7XHJcbiAgICAgIHdpZHRoOiBTdHJpbmcodGhpcy5pbWdXKSxcclxuICAgICAgaGVpZ2h0OiBTdHJpbmcodGhpcy5pbWdIKSxcclxuICAgIH0pIGFzIFNWR1NWR0VsZW1lbnQ7XHJcbiAgICB0aGlzLmdyaWRTdmcuc3R5bGUuY3NzVGV4dCA9XHJcbiAgICAgIFwicG9zaXRpb246YWJzb2x1dGU7dG9wOjA7bGVmdDowO3BvaW50ZXItZXZlbnRzOm5vbmU7ei1pbmRleDo1MDtcIjtcclxuICAgIHRoaXMuZ3JpZFN2Zy5zZXRBdHRyaWJ1dGUoXCJ2aWV3Qm94XCIsIGAwIDAgJHt0aGlzLmltZ1d9ICR7dGhpcy5pbWdIfWApO1xyXG5cclxuICAgIHRoaXMuZ3JpZFN0YXRpY0xheWVyID0gY3JlYXRlU3ZnRWwoXCJnXCIsIHRoaXMuZ3JpZFN2Zyk7XHJcbiAgICBjb25zdCBnID0gdGhpcy5jZmcuZ3JpZDtcclxuICAgIGNvbnN0IGNvbG9yID0gZy5jb2xvciA/PyBcInJnYmEoMTI4LDEyOCwxMjgsMC4zNSlcIjtcclxuICAgIGNvbnN0IGx3ID0gZy5saW5lV2lkdGggPz8gMTtcclxuXHJcbiAgICBsZXQgZCA9IFwiXCI7XHJcbiAgICBpZiAoZy5raW5kID09PSBcInNxdWFyZVwiKSB7XHJcbiAgICAgIGQgPSB0aGlzLmJ1aWxkU3F1YXJlR3JpZFBhdGgoZy5zcGFjaW5nLCBnLmFuY2hvclgsIGcuYW5jaG9yWSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBkID0gdGhpcy5idWlsZEhleEdyaWRQYXRoKGcuc3BhY2luZywgZy5hbmNob3JYLCBnLmFuY2hvclkpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHBhdGggPSBjcmVhdGVTdmdFbChcInBhdGhcIiwgdGhpcy5ncmlkU3RhdGljTGF5ZXIsIHtcclxuICAgICAgZCxcclxuICAgICAgc3Ryb2tlOiBjb2xvcixcclxuICAgICAgXCJzdHJva2Utd2lkdGhcIjogU3RyaW5nKGx3KSxcclxuICAgICAgZmlsbDogXCJub25lXCIsXHJcbiAgICAgIFwidmVjdG9yLWVmZmVjdFwiOiBcIm5vbi1zY2FsaW5nLXN0cm9rZVwiLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy51cGRhdGVHcmlkVHJhbnNmb3JtKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGJ1aWxkU3F1YXJlR3JpZFBhdGgoc3BhY2luZzogbnVtYmVyLCBheDogbnVtYmVyLCBheTogbnVtYmVyKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IHN0ZXAgPSBNYXRoLm1heCgyLCBzcGFjaW5nKTtcclxuICAgIGxldCBkID0gXCJcIjtcclxuICAgIGNvbnN0IHN0YXJ0WCA9IGF4ICsgTWF0aC5mbG9vcigoMCAtIGF4KSAvIHN0ZXApICogc3RlcDtcclxuICAgIGZvciAobGV0IHggPSBzdGFydFg7IHggPD0gdGhpcy5pbWdXOyB4ICs9IHN0ZXApIGQgKz0gYE0ke3h9LDAgTCR7eH0sJHt0aGlzLmltZ0h9IGA7XHJcbiAgICBjb25zdCBzdGFydFkgPSBheSArIE1hdGguZmxvb3IoKDAgLSBheSkgLyBzdGVwKSAqIHN0ZXA7XHJcbiAgICBmb3IgKGxldCB5ID0gc3RhcnRZOyB5IDw9IHRoaXMuaW1nSDsgeSArPSBzdGVwKSBkICs9IGBNMCwke3l9IEwke3RoaXMuaW1nV30sJHt5fSBgO1xyXG4gICAgcmV0dXJuIGQudHJpbSgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidWlsZEhleEdyaWRQYXRoKHNwYWNpbmc6IG51bWJlciwgYXg6IG51bWJlciwgYXk6IG51bWJlcik6IHN0cmluZyB7XHJcbiAgICBjb25zdCBoZXhXID0gTWF0aC5tYXgoOCwgc3BhY2luZyk7XHJcbiAgICBjb25zdCByID0gaGV4VyAvIDI7XHJcbiAgICBjb25zdCBoZXhIID0gTWF0aC5zcXJ0KDMpICogcjtcclxuICAgIGNvbnN0IGR4ID0gMS41ICogcjtcclxuICAgIGNvbnN0IGR5ID0gaGV4SDtcclxuICAgIGxldCBkID0gXCJcIjtcclxuICAgIGNvbnN0IHN0YXJ0Q29sID0gTWF0aC5mbG9vcigoMCAtIGF4KSAvIGR4KTtcclxuICAgIGNvbnN0IHN0YXJ0Um93ID0gTWF0aC5mbG9vcigoMCAtIGF5IC0gcikgLyBkeSk7XHJcbiAgICBmb3IgKGxldCByb3cgPSBzdGFydFJvdzsgcm93ICogZHkgKyByIDw9IHRoaXMuaW1nSCArIGR5OyByb3crKykge1xyXG4gICAgICBjb25zdCBvZmZzZXQgPSByb3cgJSAyID09PSAwID8gYXggOiBheCArIGR4IC8gMjtcclxuICAgICAgZm9yIChsZXQgY29sID0gc3RhcnRDb2w7IGNvbCAqIGR4ICsgb2Zmc2V0IDw9IHRoaXMuaW1nVyArIGR4OyBjb2wrKykge1xyXG4gICAgICAgIGNvbnN0IGN4ID0gY29sICogZHggKyBvZmZzZXQ7XHJcbiAgICAgICAgY29uc3QgY3kgPSByICsgcm93ICogZHk7XHJcbiAgICAgICAgY29uc3QgcHRzID0gW107XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA2OyBpKyspIHtcclxuICAgICAgICAgIGNvbnN0IGFuZ2xlID0gKE1hdGguUEkgLyAzKSAqIGkgLSBNYXRoLlBJIC8gNjtcclxuICAgICAgICAgIHB0cy5wdXNoKGAke2N4ICsgciAqIE1hdGguY29zKGFuZ2xlKX0sJHtjeSArIHIgKiBNYXRoLnNpbihhbmdsZSl9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGQgKz0gYE0ke3B0cy5qb2luKFwiIExcIil9IFogYDtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGQudHJpbSgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB1cGRhdGVHcmlkVHJhbnNmb3JtKCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmdyaWRTdmcpIHJldHVybjtcclxuICAgIC8vIEdyaWQgaXMgaW5zaWRlIFwid29ybGRcIiB3aGljaCBnZXRzIHRoZSB0cmFuc2Zvcm0sIHNvIG5vIGV4dHJhIHRyYW5zZm9ybSBuZWVkZWQuXHJcbiAgfVxyXG5cclxuICAvKiAtLS0tIHpvb20gSFVEIC0tLS0gKi9cclxuXHJcbiAgcHJpdmF0ZSB1cGRhdGVab29tSHVkKCk6IHZvaWQge1xyXG4gICAgdGhpcy56b29tUGVyY2VudEVsLnRleHRDb250ZW50ID0gYCR7TWF0aC5yb3VuZCh0aGlzLnNjYWxlICogMTAwKX0lYDtcclxuICB9XHJcblxyXG4gIC8qIC0tLS0gZXZlbnRzIC0tLS0gKi9cclxuXHJcbiAgcHJpdmF0ZSBhdHRhY2hFdmVudHMoKTogdm9pZCB7XHJcbiAgICAvLyBNb3VzZVxyXG4gICAgdGhpcy52aWV3cG9ydC5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIHRoaXMub25Qb2ludGVyRG93bik7XHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCB0aGlzLm9uUG9pbnRlck1vdmUpO1xyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsIHRoaXMub25Qb2ludGVyVXApO1xyXG5cclxuICAgIC8vIFRvdWNoXHJcbiAgICB0aGlzLnZpZXdwb3J0LmFkZEV2ZW50TGlzdGVuZXIoXCJ0b3VjaHN0YXJ0XCIsIHRoaXMub25Ub3VjaFN0YXJ0LCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJ0b3VjaG1vdmVcIiwgdGhpcy5vblRvdWNoTW92ZSwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwidG91Y2hlbmRcIiwgdGhpcy5vblRvdWNoRW5kKTtcclxuXHJcbiAgICAvLyBXaGVlbCAoem9vbSlcclxuICAgIHRoaXMudmlld3BvcnQuYWRkRXZlbnRMaXN0ZW5lcihcIndoZWVsXCIsIHRoaXMub25XaGVlbCwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcclxuXHJcbiAgICAvLyBEb3VibGUtY2xpY2sgdG8gem9vbSBpblxyXG4gICAgdGhpcy52aWV3cG9ydC5hZGRFdmVudExpc3RlbmVyKFwiZGJsY2xpY2tcIiwgdGhpcy5vbkRibENsaWNrKTtcclxuXHJcbiAgICAvLyBSZXNpemVcclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwicmVzaXplXCIsIHRoaXMuaGFuZGxlUmVzaXplKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlUmVzaXplID0gKCk6IHZvaWQgPT4ge1xyXG4gICAgaWYgKCF0aGlzLnJlYWR5KSByZXR1cm47XHJcbiAgICBpZiAodGhpcy5jZmcucmVzcG9uc2l2ZSkge1xyXG4gICAgICAvLyBSZWNhbGN1bGF0ZSBmaXQgc2NhbGVcclxuICAgICAgY29uc3QgeiA9IHRoaXMuY2FsY0ZpdFNjYWxlKCk7XHJcbiAgICAgIHRoaXMuc2NhbGUgPSB6O1xyXG4gICAgICBjb25zdCB2dyA9IHRoaXMudmlld3BvcnQuY2xpZW50V2lkdGggfHwgMTtcclxuICAgICAgY29uc3QgdmggPSB0aGlzLnZpZXdwb3J0LmNsaWVudEhlaWdodCB8fCAxO1xyXG4gICAgICB0aGlzLnR4ID0gdncgLyAyIC0gKHRoaXMuaW1nVyAvIDIpICogdGhpcy5zY2FsZTtcclxuICAgICAgdGhpcy50eSA9IHZoIC8gMiAtICh0aGlzLmltZ0ggLyAyKSAqIHRoaXMuc2NhbGU7XHJcbiAgICAgIHRoaXMuYXBwbHlUcmFuc2Zvcm0oKTtcclxuICAgICAgdGhpcy5yZW5kZXJNYXJrZXJzKCk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgcHJpdmF0ZSBnZXRFdmVudFBvcyhlOiBNb3VzZUV2ZW50KTogU3RQb2ludCB7XHJcbiAgICBjb25zdCByID0gdGhpcy52aWV3cG9ydC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgIHJldHVybiB7IHg6IGUuY2xpZW50WCAtIHIubGVmdCwgeTogZS5jbGllbnRZIC0gci50b3AgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgb25Qb2ludGVyRG93biA9IChlOiBNb3VzZUV2ZW50KTogdm9pZCA9PiB7XHJcbiAgICBpZiAoZS5idXR0b24gIT09IDApIHJldHVybjtcclxuICAgIHRoaXMuZHJhZ2dpbmcgPSB0cnVlO1xyXG4gICAgdGhpcy5kcmFnU3RhcnQgPSB0aGlzLmdldEV2ZW50UG9zKGUpO1xyXG4gICAgdGhpcy5kcmFnVHgwID0gdGhpcy50eDtcclxuICAgIHRoaXMuZHJhZ1R5MCA9IHRoaXMudHk7XHJcbiAgICB0aGlzLnZpZXdwb3J0LnN0eWxlLmN1cnNvciA9IFwiZ3JhYmJpbmdcIjtcclxuICAgIHRoaXMuY2xvc2VQb3BvdmVyKCk7XHJcbiAgfTtcclxuXHJcbiAgcHJpdmF0ZSBvblBvaW50ZXJNb3ZlID0gKGU6IE1vdXNlRXZlbnQpOiB2b2lkID0+IHtcclxuICAgIGlmICghdGhpcy5kcmFnZ2luZykgcmV0dXJuO1xyXG4gICAgY29uc3QgcCA9IHRoaXMuZ2V0RXZlbnRQb3MoZSk7XHJcbiAgICB0aGlzLnR4ID0gdGhpcy5kcmFnVHgwICsgKHAueCAtIHRoaXMuZHJhZ1N0YXJ0LngpO1xyXG4gICAgdGhpcy50eSA9IHRoaXMuZHJhZ1R5MCArIChwLnkgLSB0aGlzLmRyYWdTdGFydC55KTtcclxuICAgIHRoaXMuYXBwbHlUcmFuc2Zvcm0oKTtcclxuICAgIGlmICh0aGlzLnRvb2x0aXBFbCkge1xyXG4gICAgICAvLyB1cGRhdGUgdG9vbHRpcCBwb3NpdGlvblxyXG4gICAgICBjb25zdCByID0gdGhpcy52aWV3cG9ydC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgdGhpcy50b29sdGlwRWwuc3R5bGUubGVmdCA9IGAke3IubGVmdCArIHAueH1weGA7XHJcbiAgICAgIHRoaXMudG9vbHRpcEVsLnN0eWxlLnRvcCA9IGAke3IudG9wICsgcC55IC0gMzB9cHhgO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIHByaXZhdGUgb25Qb2ludGVyVXAgPSAoKTogdm9pZCA9PiB7XHJcbiAgICB0aGlzLmRyYWdnaW5nID0gZmFsc2U7XHJcbiAgICB0aGlzLnZpZXdwb3J0LnN0eWxlLmN1cnNvciA9IFwiZ3JhYlwiO1xyXG4gIH07XHJcblxyXG4gIC8qIC0tLS0gdG91Y2ggLS0tLSAqL1xyXG5cclxuICBwcml2YXRlIGFjdGl2ZVRvdWNoZXM6IE1hcDxudW1iZXIsIFN0UG9pbnQ+ID0gbmV3IE1hcCgpO1xyXG5cclxuICBwcml2YXRlIG9uVG91Y2hTdGFydCA9IChlOiBUb3VjaEV2ZW50KTogdm9pZCA9PiB7XHJcbiAgICBpZiAoZS50b3VjaGVzLmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIGNvbnN0IHQgPSBlLnRvdWNoZXNbMF07XHJcbiAgICAgIGNvbnN0IHIgPSB0aGlzLnZpZXdwb3J0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICBjb25zdCBwOiBTdFBvaW50ID0geyB4OiB0LmNsaWVudFggLSByLmxlZnQsIHk6IHQuY2xpZW50WSAtIHIudG9wIH07XHJcbiAgICAgIHRoaXMuYWN0aXZlVG91Y2hlcy5zZXQodC5pZGVudGlmaWVyLCBwKTtcclxuICAgICAgdGhpcy5kcmFnZ2luZyA9IHRydWU7XHJcbiAgICAgIHRoaXMuZHJhZ1N0YXJ0ID0gcDtcclxuICAgICAgdGhpcy5kcmFnVHgwID0gdGhpcy50eDtcclxuICAgICAgdGhpcy5kcmFnVHkwID0gdGhpcy50eTtcclxuICAgIH0gZWxzZSBpZiAoZS50b3VjaGVzLmxlbmd0aCA9PT0gMikge1xyXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIHRoaXMuZHJhZ2dpbmcgPSBmYWxzZTtcclxuICAgICAgY29uc3QgdDAgPSBlLnRvdWNoZXNbMF07XHJcbiAgICAgIGNvbnN0IHQxID0gZS50b3VjaGVzWzFdO1xyXG4gICAgICBjb25zdCBkeCA9IHQxLmNsaWVudFggLSB0MC5jbGllbnRYO1xyXG4gICAgICBjb25zdCBkeSA9IHQxLmNsaWVudFkgLSB0MC5jbGllbnRZO1xyXG4gICAgICB0aGlzLmxhc3RQaW5jaERpc3QgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xyXG4gICAgICB0aGlzLmxhc3RQaW5jaFNjYWxlID0gdGhpcy5zY2FsZTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBwcml2YXRlIG9uVG91Y2hNb3ZlID0gKGU6IFRvdWNoRXZlbnQpOiB2b2lkID0+IHtcclxuICAgIGlmIChlLnRvdWNoZXMubGVuZ3RoID09PSAxICYmIHRoaXMuZHJhZ2dpbmcpIHtcclxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICBjb25zdCB0ID0gZS50b3VjaGVzWzBdO1xyXG4gICAgICBjb25zdCByID0gdGhpcy52aWV3cG9ydC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgY29uc3QgcDogU3RQb2ludCA9IHsgeDogdC5jbGllbnRYIC0gci5sZWZ0LCB5OiB0LmNsaWVudFkgLSByLnRvcCB9O1xyXG4gICAgICB0aGlzLnR4ID0gdGhpcy5kcmFnVHgwICsgKHAueCAtIHRoaXMuZHJhZ1N0YXJ0LngpO1xyXG4gICAgICB0aGlzLnR5ID0gdGhpcy5kcmFnVHkwICsgKHAueSAtIHRoaXMuZHJhZ1N0YXJ0LnkpO1xyXG4gICAgICB0aGlzLmFwcGx5VHJhbnNmb3JtKCk7XHJcbiAgICB9IGVsc2UgaWYgKGUudG91Y2hlcy5sZW5ndGggPT09IDIpIHtcclxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICBjb25zdCB0MCA9IGUudG91Y2hlc1swXTtcclxuICAgICAgY29uc3QgdDEgPSBlLnRvdWNoZXNbMV07XHJcbiAgICAgIGNvbnN0IGR4ID0gdDEuY2xpZW50WCAtIHQwLmNsaWVudFg7XHJcbiAgICAgIGNvbnN0IGR5ID0gdDEuY2xpZW50WSAtIHQwLmNsaWVudFk7XHJcbiAgICAgIGNvbnN0IGRpc3QgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xyXG4gICAgICBjb25zdCBjeCA9ICh0MC5jbGllbnRYICsgdDEuY2xpZW50WCkgLyAyO1xyXG4gICAgICBjb25zdCBjeSA9ICh0MC5jbGllbnRZICsgdDEuY2xpZW50WSkgLyAyO1xyXG4gICAgICBpZiAodGhpcy5sYXN0UGluY2hEaXN0ID4gMCkge1xyXG4gICAgICAgIGNvbnN0IGZhY3RvciA9IGRpc3QgLyB0aGlzLmxhc3RQaW5jaERpc3Q7XHJcbiAgICAgICAgdGhpcy56b29tQXQoZmFjdG9yLCBjeCAtIHRoaXMudmlld3BvcnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkubGVmdCxcclxuICAgICAgICAgIGN5IC0gdGhpcy52aWV3cG9ydC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS50b3ApO1xyXG4gICAgICAgIHRoaXMubGFzdFBpbmNoRGlzdCA9IGRpc3Q7XHJcbiAgICAgICAgdGhpcy5sYXN0UGluY2hTY2FsZSA9IHRoaXMuc2NhbGU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG5cclxuICBwcml2YXRlIG9uVG91Y2hFbmQgPSAoZTogVG91Y2hFdmVudCk6IHZvaWQgPT4ge1xyXG4gICAgaWYgKGUudG91Y2hlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhpcy5kcmFnZ2luZyA9IGZhbHNlO1xyXG4gICAgICB0aGlzLmFjdGl2ZVRvdWNoZXMuY2xlYXIoKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICAvKiAtLS0tIHdoZWVsIC8gZGJsY2xpY2sgLS0tLSAqL1xyXG5cclxuICBwcml2YXRlIG9uV2hlZWwgPSAoZTogV2hlZWxFdmVudCk6IHZvaWQgPT4ge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgY29uc3QgciA9IHRoaXMudmlld3BvcnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgICBjb25zdCBmYWN0b3IgPSBlLmRlbHRhWSA8IDAgPyAxLjA4IDogMSAvIDEuMDg7XHJcbiAgICB0aGlzLnpvb21BdChmYWN0b3IsIGUuY2xpZW50WCAtIHIubGVmdCwgZS5jbGllbnRZIC0gci50b3ApO1xyXG4gIH07XHJcblxyXG4gIHByaXZhdGUgb25EYmxDbGljayA9IChlOiBNb3VzZUV2ZW50KTogdm9pZCA9PiB7XHJcbiAgICBjb25zdCByID0gdGhpcy52aWV3cG9ydC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgIHRoaXMuem9vbUF0KDEuNSwgZS5jbGllbnRYIC0gci5sZWZ0LCBlLmNsaWVudFkgLSByLnRvcCk7XHJcbiAgfTtcclxufVxyXG4iLCAiLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqICBzdGF0aWMtZW50cnkudHMgXHUyMDEzIFN0YXRpYy1zaXRlIGVudHJ5IHBvaW50LlxyXG4gKlxyXG4gKiAgSW5jbHVkZSB0aGlzIGJ1bmRsZSB2aWEgPHNjcmlwdD4gaW4geW91ciBEaWdpdGFsIEdhcmRlbiBzaXRlLlxyXG4gKiAgSXQgc2NhbnMgdGhlIHBhZ2UgZm9yIHpvb21tYXAgY29udGFpbmVycyBhbmQgaW5pdGlhbGlzZXMgdGhlbS5cclxuICpcclxuICogIFR3byBjb250YWluZXIgZm9ybWF0cyBhcmUgc3VwcG9ydGVkOlxyXG4gKiAgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHJcbiAqICAxLiA8ZGl2IGNsYXNzPVwiem0tc3RhdGljLXJvb3RcIiBkYXRhLXptLWNvbmZpZz1cIi4uLlwiIGRhdGEtem0tbWFya2Vycz1cIi4uLlwiPjwvZGl2PlxyXG4gKiAgMi4gPGRpdiBjbGFzcz1cInpvb21tYXAtY29udGFpbmVyXCI+XHJcbiAqICAgICAgIDxzY3JpcHQgY2xhc3M9XCJ6bS1jb25maWctanNvblwiIHR5cGU9XCJhcHBsaWNhdGlvbi9qc29uXCI+ey4uLn08L3NjcmlwdD5cclxuICogICAgICAgPHNjcmlwdCBjbGFzcz1cInptLW1hcmtlcnMtanNvblwiIHR5cGU9XCJhcHBsaWNhdGlvbi9qc29uXCI+Wy4uLl08L3NjcmlwdD5cclxuICogICAgIDwvZGl2PlxyXG4gKlxyXG4gKiAgWW91IGNhbiBhbHNvIG1hbnVhbGx5IGNyZWF0ZSBhIG1hcDpcclxuICogIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxyXG4gKiAgY29uc3QgbSA9IFpvb21NYXBTdGF0aWMuY3JlYXRlKGVsLCBjb25maWcsIG1hcmtlcnMpO1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cclxuXHJcbmltcG9ydCB7IFN0YXRpY01hcCB9IGZyb20gXCIuL3N0YXRpYy1yZW5kZXJcIjtcclxuaW1wb3J0IHR5cGUgeyBTdE1hcENvbmZpZywgU3RNYXJrZXIsIFN0UG9pbnQgfSBmcm9tIFwiLi9zdGF0aWMtY29uZmlnXCI7XHJcblxyXG4vKiAtLS0tIGdsb2JhbHMgLS0tLSAqL1xyXG5cclxuLy8gRXhwb3NlIG9uIHdpbmRvdyBmb3IgbWFudWFsIEFQSVxyXG5pbnRlcmZhY2UgWm9vbU1hcFN0YXRpY0FwaSB7XHJcbiAgLyoqIENyZWF0ZSBhIG5ldyBtYXAgaW5zdGFuY2Ugb24gYW4gZWxlbWVudCAqL1xyXG4gIGNyZWF0ZShlbDogSFRNTEVsZW1lbnQsIGNvbmZpZzogU3RNYXBDb25maWcsIG1hcmtlcnM/OiBTdE1hcmtlcltdKTogU3RhdGljTWFwO1xyXG4gIC8qKiBTY2FuIHRoZSBwYWdlIGZvciBhdXRvLWluaXQgY29udGFpbmVycyAqL1xyXG4gIHNjYW4oKTogdm9pZDtcclxuICAvKiogRGVzdHJveSBhbGwgaW5zdGFuY2VzICovXHJcbiAgZGVzdHJveUFsbCgpOiB2b2lkO1xyXG59XHJcblxyXG5sZXQgaW5zdGFuY2VzOiBTdGF0aWNNYXBbXSA9IFtdO1xyXG5cclxuZnVuY3Rpb24gc2NhbigpOiB2b2lkIHtcclxuICAvLyBGaW5kIGFsbCBjb250YWluZXJzIHRoYXQgaGF2ZSBkYXRhLXptLWNvbmZpZyBvciAuem0tc3RhdGljLXJvb3RcclxuICBjb25zdCBjb250YWluZXJzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXHJcbiAgICBcIltkYXRhLXptLWNvbmZpZ10sIC56bS1zdGF0aWMtcm9vdCwgLnpvb21tYXAtY29udGFpbmVyXCIsXHJcbiAgKTtcclxuXHJcbiAgZm9yIChjb25zdCBjIG9mIGNvbnRhaW5lcnMpIHtcclxuICAgIC8vIFNraXAgaWYgYWxyZWFkeSBpbml0aWFsaXNlZFxyXG4gICAgaWYgKGMuY2xhc3NMaXN0LmNvbnRhaW5zKFwiem0tc3RhdGljLWluaXRpYWxpc2VkXCIpIHx8IGMuaGFzQXR0cmlidXRlKFwiZGF0YS16bS1pbml0ZWRcIikpIGNvbnRpbnVlO1xyXG4gICAgYy5jbGFzc0xpc3QuYWRkKFwiem0tc3RhdGljLWluaXRpYWxpc2VkXCIpO1xyXG4gICAgYy5zZXRBdHRyaWJ1dGUoXCJkYXRhLXptLWluaXRlZFwiLCBcIjFcIik7XHJcblxyXG4gICAgLy8gQ2hlY2sgaWYgaXQgaGFzIGVub3VnaCBkYXRhIHRvIGNyZWF0ZSBhIG1hcFxyXG4gICAgY29uc3QgaGFzQ29uZmlnID0gYy5oYXNBdHRyaWJ1dGUoXCJkYXRhLXptLWNvbmZpZ1wiKSB8fCBjLnF1ZXJ5U2VsZWN0b3IoXCJzY3JpcHQuem0tY29uZmlnLWpzb25cIik7XHJcbiAgICBpZiAoIWhhc0NvbmZpZykgY29udGludWU7XHJcblxyXG4gICAgY29uc3QgbWFwID0gbmV3IFN0YXRpY01hcChjKTtcclxuICAgIGluc3RhbmNlcy5wdXNoKG1hcCk7XHJcbiAgfVxyXG5cclxuICAvLyBBbHNvIHNjYW4gZm9yIHJhdyA8cHJlPjxjb2RlIGNsYXNzPVwibGFuZ3VhZ2Utem9vbW1hcFwiPiBibG9ja3NcclxuICAvLyBUaGVzZSBhcmUgbWFya2Rvd24gY29kZSBibG9ja3MgdGhhdCBEaWdpdGFsIEdhcmRlbiBsZWZ0IGFzLWlzXHJcbiAgY29uc3QgY29kZUJsb2NrcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwicHJlIGNvZGUubGFuZ3VhZ2Utem9vbW1hcFwiKTtcclxuICBmb3IgKGNvbnN0IGNiIG9mIGNvZGVCbG9ja3MpIHtcclxuICAgIC8vIFNraXAgaWYgYWxyZWFkeSBoYW5kbGVkXHJcbiAgICBpZiAoY2IuaGFzQXR0cmlidXRlKFwiZGF0YS16bS1oYW5kbGVkXCIpKSBjb250aW51ZTtcclxuICAgIGNiLnNldEF0dHJpYnV0ZShcImRhdGEtem0taGFuZGxlZFwiLCBcIjFcIik7XHJcblxyXG4gICAgY29uc3QgcHJlQmxvY2sgPSBjYi5wYXJlbnRFbGVtZW50O1xyXG4gICAgaWYgKCFwcmVCbG9jaykgY29udGludWU7XHJcblxyXG4gICAgLy8gUGFyc2UgdGhlIFlBTUwgY29uZmlnIGZyb20gdGhlIGNvZGUgYmxvY2sgdGV4dFxyXG4gICAgY29uc3QgeWFtbFRleHQgPSBjYi50ZXh0Q29udGVudCA/PyBcIlwiO1xyXG4gICAgY29uc3QgY29uZmlnID0gcGFyc2Vab29tbWFwWWFtbCh5YW1sVGV4dCk7XHJcbiAgICBpZiAoIWNvbmZpZykgY29udGludWU7XHJcblxyXG4gICAgLy8gQ3JlYXRlIGEgd3JhcHBlciBhbmQgcmVwbGFjZSB0aGUgcHJlIGJsb2NrXHJcbiAgICBjb25zdCB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgIHdyYXBwZXIuY2xhc3NOYW1lID0gXCJ6bS1zdGF0aWMtcm9vdCB6bS1zdGF0aWMtaW5pdGlhbGlzZWRcIjtcclxuICAgIHdyYXBwZXIuc2V0QXR0cmlidXRlKFwiZGF0YS16bS1pbml0ZWRcIiwgXCIxXCIpO1xyXG5cclxuICAgIC8vIEVtYmVkIGNvbmZpZyBhcyBkYXRhIGF0dHJpYnV0ZVxyXG4gICAgd3JhcHBlci5zZXRBdHRyaWJ1dGUoXCJkYXRhLXptLWNvbmZpZ1wiLCBKU09OLnN0cmluZ2lmeShjb25maWcpKTtcclxuXHJcbiAgICAvLyBMb2FkIG1hcmtlcnMgZnJvbSBlbWJlZGRlZCA8c2NyaXB0PiBkYXRhIEJFRk9SRSBtYXAgaW5pdFxyXG4gICAgaWYgKGNvbmZpZy5tYXJrZXJzVXJsKSB7XHJcbiAgICAgIGNvbnN0IHNhZmVJZCA9IHNhZmVEYXRhSWQoY29uZmlnLm1hcmtlcnNVcmwpO1xyXG4gICAgICBjb25zdCBlbWJlZGRlZCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHNhZmVJZCk7XHJcbiAgICAgIGlmIChlbWJlZGRlZCAmJiBlbWJlZGRlZC50ZXh0Q29udGVudCkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShlbWJlZGRlZC50ZXh0Q29udGVudCk7XHJcbiAgICAgICAgICBpZiAoZGF0YT8ubWFya2Vycykge1xyXG4gICAgICAgICAgICB3cmFwcGVyLnNldEF0dHJpYnV0ZShcImRhdGEtem0tbWFya2Vyc1wiLCBKU09OLnN0cmluZ2lmeShkYXRhLm1hcmtlcnMpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGNhdGNoIChfZSkgeyAvKiBpZ25vcmUgKi8gfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJlQmxvY2sucmVwbGFjZVdpdGgod3JhcHBlcik7XHJcblxyXG4gICAgLy8gQnVpbGQtbWFwIGhlbHBlciAoY2FsbGVkIHdoZW4gY29udGFpbmVyIGlzIHZpc2libGUpXHJcbiAgICBjb25zdCBpbml0TWFwID0gKCkgPT4ge1xyXG4gICAgICBjb25zdCBtYXAgPSBuZXcgU3RhdGljTWFwKHdyYXBwZXIpO1xyXG4gICAgICBpbnN0YW5jZXMucHVzaChtYXApO1xyXG5cclxuICAgICAgLy8gSWYgbWFya2VycyB3ZXJlbid0IHByZS1sb2FkZWQsIHRyeSBIVFRQIGZldGNoXHJcbiAgICAgIGlmICghd3JhcHBlci5oYXNBdHRyaWJ1dGUoXCJkYXRhLXptLW1hcmtlcnNcIikgJiYgY29uZmlnLm1hcmtlcnNVcmwpIHtcclxuICAgICAgICBmZXRjaChjb25maWcubWFya2Vyc1VybClcclxuICAgICAgICAgIC50aGVuKChyKSA9PiAoci5vayA/IHIuanNvbigpIDogbnVsbCkpXHJcbiAgICAgICAgICAuY2F0Y2goKCkgPT4gbnVsbClcclxuICAgICAgICAgIC50aGVuKChkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChkYXRhPy5tYXJrZXJzKSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgbWFya2VycyA9IGRhdGEubWFya2VycyBhcyBTdE1hcmtlcltdO1xyXG4gICAgICAgICAgICAgIHdyYXBwZXIuc2V0QXR0cmlidXRlKFwiZGF0YS16bS1tYXJrZXJzXCIsIEpTT04uc3RyaW5naWZ5KG1hcmtlcnMpKTtcclxuICAgICAgICAgICAgICAvLyBSZS1pbml0IHdpdGggbWFya2Vyc1xyXG4gICAgICAgICAgICAgIG1hcC5kZXN0cm95KCk7XHJcbiAgICAgICAgICAgICAgY29uc3QgbmV3TWFwID0gbmV3IFN0YXRpY01hcCh3cmFwcGVyKTtcclxuICAgICAgICAgICAgICBpbnN0YW5jZXMgPSBpbnN0YW5jZXMuZmlsdGVyKChtKSA9PiBtICE9PSBtYXApO1xyXG4gICAgICAgICAgICAgIGluc3RhbmNlcy5wdXNoKG5ld01hcCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgICAuY2F0Y2goKCkgPT4ge30pO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIC8vIERlZmVyIGluaXQgdW50aWwgdmlzaWJsZSBcdTIwMTQgZml4ZXMgY29sbGFwc2VkIGNhbGxvdXQgc2l6aW5nXHJcbiAgICBpZiAoXCJJbnRlcnNlY3Rpb25PYnNlcnZlclwiIGluIHdpbmRvdykge1xyXG4gICAgICBjb25zdCBvYnMgPSBuZXcgSW50ZXJzZWN0aW9uT2JzZXJ2ZXIoXHJcbiAgICAgICAgKGVudHJpZXMpID0+IHtcclxuICAgICAgICAgIGZvciAoY29uc3QgZSBvZiBlbnRyaWVzKSB7XHJcbiAgICAgICAgICAgIGlmIChlLmlzSW50ZXJzZWN0aW5nKSB7XHJcbiAgICAgICAgICAgICAgb2JzLmRpc2Nvbm5lY3QoKTtcclxuICAgICAgICAgICAgICBpbml0TWFwKCk7XHJcbiAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHsgdGhyZXNob2xkOiAwLjAxIH0sXHJcbiAgICAgICk7XHJcbiAgICAgIG9icy5vYnNlcnZlKHdyYXBwZXIpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaW5pdE1hcCgpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuLyogLS0tLSBzaW1wbGUgWUFNTCBwYXJzZXIgZm9yIHpvb21tYXAgY29kZSBibG9ja3MgLS0tLSAqL1xyXG5cclxuLyoqIE1ha2UgYSBzYWZlIEhUTUwgZWxlbWVudCBJRCBmcm9tIGEgbWFya2VycyBwYXRoIGZvciBlbWJlZGRlZCBkYXRhIGxvb2t1cCAqL1xyXG5mdW5jdGlvbiBzYWZlRGF0YUlkKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgLy8gU3RyaXAgbGVhZGluZyBcIi9cIiBmb3IgY29uc2lzdGVuY3kgd2l0aCB0aGUgc2VydmVyLWdlbmVyYXRlZCBJRCAodXNlclNldHVwLmpzKVxyXG4gIGNvbnN0IHAgPSBwYXRoLnN0YXJ0c1dpdGgoXCIvXCIpID8gcGF0aC5zbGljZSgxKSA6IHBhdGg7XHJcbiAgcmV0dXJuIFwiem0tZGF0YS1cIiArIGJ0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHApKSlcclxuICAgIC5yZXBsYWNlKC9bKy89XS9nLCBcIl9cIik7XHJcbn1cclxuXHJcbi8qIC0tLS0gZGVmYXVsdCBpY29uIHByb2ZpbGVzIC0tLS0gKi9cclxuXHJcbi8qKiBCdWlsdC1pbiBpY29uIHByb2ZpbGVzIG1hdGNoaW5nIHRoZSBwbHVnaW4ncyBkZWZhdWx0IHNldC5cclxuICogIFNpdGUtcmVsYXRpdmUgVVJMcyBhcmUgdXNlZCBmb3IgY3VzdG9tIFNWRyBmaWxlcyAoc3RvcmVkIHVuZGVyIC9pbWcvem9vbS1tYXAtaWNvbnMvKS4gKi9cclxuY29uc3QgREVGQVVMVF9JQ09OUzogU3RJY29uUHJvZmlsZVtdID0gW1xyXG4gIHtcclxuICAgIGtleTogXCJwb3J0XCIsXHJcbiAgICB1cmw6IFwiL2ltZy96b29tLW1hcC1pY29ucy9hbmNob3Iuc3ZnXCIsXHJcbiAgICBzaXplOiAyNCxcclxuICAgIGFuY2hvclg6IDEyLFxyXG4gICAgYW5jaG9yWTogMTIsXHJcbiAgfSxcclxuICB7XHJcbiAgICBrZXk6IFwicGluUmVkXCIsXHJcbiAgICB1cmw6IFwiZGF0YTppbWFnZS9zdmcreG1sO2NoYXJzZXQ9VVRGLTgsJTNDc3ZnJTIweG1sbnMlM0QlMjJodHRwJTNBJTJGJTJGd3d3LnczLm9yZyUyRjIwMDAlMkZzdmclMjIlMjB3aWR0aCUzRCUyMjI0JTIyJTIwaGVpZ2h0JTNEJTIyMjQlMjIlMjB2aWV3Qm94JTNEJTIyMCUyMDAlMjAyNCUyMDI0JTIyJTNFJTNDcGF0aCUyMGZpbGwlM0QlMjIlMjNkMjNjM2MlMjIlMjBkJTNEJTIyTTEyJTIwMmE3JTIwNyUyMDAlMjAwJTIwMC03JTIwN2MwJTIwNS4yNSUyMDclMjAxMyUyMDclMjAxM3M3LTcuNzUlMjA3LTEzYTclMjA3JTIwMCUyMDAlMjAwLTctN20wJTIwOS41QTIuNSUyMDIuNSUyMDAlMjAxJTIwMSUyMDEyJTIwNi41YTIuNSUyMDIuNSUyMDAlMjAwJTIwMSUyMDAlMjA1WiUyMiUyRiUzRSUzQyUyRnN2ZyUzRVwiLFxyXG4gICAgc2l6ZTogMjQsXHJcbiAgICBhbmNob3JYOiAxMixcclxuICAgIGFuY2hvclk6IDEyLFxyXG4gIH0sXHJcbiAge1xyXG4gICAga2V5OiBcInBpbkJsdWVcIixcclxuICAgIHVybDogXCJkYXRhOmltYWdlL3N2Zyt4bWw7Y2hhcnNldD1VVEYtOCwlM0NzdmclMjB4bWxucyUzRCUyMmh0dHAlM0ElMkYlMkZ3d3cudzMub3JnJTJGMjAwMCUyRnN2ZyUyMiUyMHdpZHRoJTNEJTIyMjQlMjIlMjBoZWlnaHQlM0QlMjIyNCUyMiUyMHZpZXdCb3glM0QlMjIwJTIwMCUyMDI0JTIwMjQlMjIlM0UlM0NwYXRoJTIwZmlsbCUzRCUyMiUyMzNjNjJkMiUyMiUyMGQlM0QlMjJNMTIlMjAyYTclMjA3JTIwMCUyMDAlMjAwLTclMjA3YzAlMjA1LjI1JTIwNyUyMDEzJTIwNyUyMDEzczctNy43NSUyMDctMTNhNyUyMDclMjAwJTIwMCUyMDAtNy03bTAlMjA5LjVBMi41JTIwMi41JTIwMCUyMDElMjAxJTIwMTIlMjA2LjVhMi41JTIwMi41JTIwMCUyMDAlMjAxJTIwMCUyMDVaJTIyJTJGJTNFJTNDJTJGc3ZnJTNFXCIsXHJcbiAgICBzaXplOiAyNCxcclxuICAgIGFuY2hvclg6IDEyLFxyXG4gICAgYW5jaG9yWTogMTIsXHJcbiAgfSxcclxuXTtcclxuXHJcbmZ1bmN0aW9uIHBhcnNlWm9vbW1hcFlhbWwodGV4dDogc3RyaW5nKTogU3RNYXBDb25maWcgfCBudWxsIHtcclxuICAvLyBTdHJpcCBjYWxsb3V0IHByZWZpeGVzICg+IG9yID4gKSBzbyBibG9ja3MgaW5zaWRlID5bIU5PVEVdIGV0Yy4gd29ya1xyXG4gIGNvbnN0IGNsZWFuVGV4dCA9IHRleHQucmVwbGFjZSgvXj5cXHM/L2dtLCBcIlwiKTtcclxuICBjb25zdCBsaW5lcyA9IGNsZWFuVGV4dC5zcGxpdChcIlxcblwiKTtcclxuICBjb25zdCBtYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcclxuICBjb25zdCBpbWFnZUJhc2VzOiBzdHJpbmdbXSA9IFtdO1xyXG5cclxuICBsZXQgaW5JbWFnZUJhc2VzID0gZmFsc2U7XHJcbiAgbGV0IGluVmlldyA9IGZhbHNlO1xyXG4gIC8vIE5lc3RlZCB2aWV3IHN1Yi1rZXlzXHJcbiAgbGV0IF92aWV3Wm9vbSA9IFwiXCI7XHJcbiAgbGV0IF92aWV3Q2VudGVyWCA9IFwiXCI7XHJcbiAgbGV0IF92aWV3Q2VudGVyWSA9IFwiXCI7XHJcblxyXG4gIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xyXG4gICAgY29uc3QgdHJpbW1lZCA9IGxpbmUudHJpbSgpO1xyXG4gICAgaWYgKCF0cmltbWVkIHx8IHRyaW1tZWQuc3RhcnRzV2l0aChcIiNcIikpIGNvbnRpbnVlO1xyXG5cclxuICAgIC8vIERldGVjdCB2aWV3IHNlY3Rpb24gc3RhcnRcclxuICAgIGlmICh0cmltbWVkID09PSBcInZpZXc6XCIgfHwgdHJpbW1lZC5zdGFydHNXaXRoKFwidmlldzpcIikpIHtcclxuICAgICAgaW5WaWV3ID0gdHJ1ZTtcclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGluVmlldykge1xyXG4gICAgICAvLyBFeGl0IHZpZXcgc2VjdGlvbiBvbiBhIG5vbi1pbmRlbnRlZCBrZXlcclxuICAgICAgaWYgKCF0cmltbWVkLnN0YXJ0c1dpdGgoXCIgXCIpKSB7XHJcbiAgICAgICAgaW5WaWV3ID0gZmFsc2U7XHJcbiAgICAgICAgLy8gZmFsbCB0aHJvdWdoIHRvIHByb2Nlc3MgdGhpcyBsaW5lIG5vcm1hbGx5XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc3Qgc2lkeCA9IHRyaW1tZWQuaW5kZXhPZihcIjpcIik7XHJcbiAgICAgICAgaWYgKHNpZHggPj0gMCkge1xyXG4gICAgICAgICAgY29uc3QgayA9IHRyaW1tZWQuc3Vic3RyaW5nKDAsIHNpZHgpLnRyaW0oKTtcclxuICAgICAgICAgIGNvbnN0IHYgPSB0cmltbWVkLnN1YnN0cmluZyhzaWR4ICsgMSkudHJpbSgpO1xyXG4gICAgICAgICAgaWYgKGsgPT09IFwiem9vbVwiKSBfdmlld1pvb20gPSB2O1xyXG4gICAgICAgICAgZWxzZSBpZiAoayA9PT0gXCJjZW50ZXJYXCIpIF92aWV3Q2VudGVyWCA9IHY7XHJcbiAgICAgICAgICBlbHNlIGlmIChrID09PSBcImNlbnRlcllcIikgX3ZpZXdDZW50ZXJZID0gdjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBEZXRlY3QgaW1hZ2VCYXNlcyBzZWN0aW9uIHN0YXJ0XHJcbiAgICBpZiAodHJpbW1lZC5zdGFydHNXaXRoKFwiaW1hZ2VCYXNlczpcIikgfHwgdHJpbW1lZC5zdGFydHNXaXRoKFwiaW1hZ2ViYXNlczpcIikpIHtcclxuICAgICAgaW5JbWFnZUJhc2VzID0gdHJ1ZTtcclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGluSW1hZ2VCYXNlcykge1xyXG4gICAgICAvLyBDb2xsZWN0IFwiLSBwYXRoOiB4eHhcIiBlbnRyaWVzXHJcbiAgICAgIGNvbnN0IG0gPSB0cmltbWVkLm1hdGNoKC9eLSBwYXRoOlxccyooLispJC9pKTtcclxuICAgICAgaWYgKG0pIHtcclxuICAgICAgICBpbWFnZUJhc2VzLnB1c2gobVsxXS50cmltKCkpO1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIEV4aXQgc2VjdGlvbiBvbiBub24taW5kZW50ZWQgbm9uLWxpc3QgbGluZVxyXG4gICAgICBpZiAoIXRyaW1tZWQuc3RhcnRzV2l0aChcIi1cIikgJiYgIXRyaW1tZWQuc3RhcnRzV2l0aChcIiBcIikgJiYgdHJpbW1lZC5pbmRleE9mKFwiOlwiKSA+IDApIHtcclxuICAgICAgICBpbkltYWdlQmFzZXMgPSBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoIXRyaW1tZWQuc3RhcnRzV2l0aChcIiBcIikgJiYgIXRyaW1tZWQuc3RhcnRzV2l0aChcIi1cIikpIHtcclxuICAgICAgICBpbkltYWdlQmFzZXMgPSBmYWxzZTtcclxuICAgICAgICAvLyBSZS1wcm9jZXNzIHRoaXMgbGluZSBhcyBhIHRvcC1sZXZlbCBrZXlcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChpbkltYWdlQmFzZXMpIGNvbnRpbnVlO1xyXG5cclxuICAgIGNvbnN0IGlkeCA9IHRyaW1tZWQuaW5kZXhPZihcIjpcIik7XHJcbiAgICBpZiAoaWR4IDwgMCkgY29udGludWU7XHJcbiAgICBjb25zdCBrZXkgPSB0cmltbWVkLnN1YnN0cmluZygwLCBpZHgpLnRyaW0oKTtcclxuICAgIGNvbnN0IHZhbHVlID0gdHJpbW1lZC5zdWJzdHJpbmcoaWR4ICsgMSkudHJpbSgpO1xyXG4gICAgbWFwW2tleV0gPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIC8qKiBOb3JtYWxpc2UgYSBwYXRoOiBpZiByZWxhdGl2ZSAobm8gc2NoZW1lLCBub3QgYWJzb2x1dGUpLCBwcmVwZW5kIFwiL1wiICovXHJcbiAgZnVuY3Rpb24gbm9ybVBhdGgocDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IHQgPSBwLnRyaW0oKTtcclxuICAgIGlmICghdCB8fCB0LnN0YXJ0c1dpdGgoXCIvXCIpIHx8IHQuc3RhcnRzV2l0aChcImh0dHA6Ly9cIikgfHwgdC5zdGFydHNXaXRoKFwiaHR0cHM6Ly9cIikgfHwgdC5zdGFydHNXaXRoKFwiZGF0YTpcIikpIHJldHVybiB0O1xyXG4gICAgcmV0dXJuIFwiL1wiICsgdDtcclxuICB9XHJcblxyXG4gIC8vIFJlc29sdmUgaW1hZ2U6IHByZWZlciBpbWFnZUJhc2VzWzBdLCB0aGVuIGltYWdlLCB0aGVuIGltYWdlQmFzZXMgbGVnYWN5XHJcbiAgY29uc3QgaW1hZ2VVcmwgPSBpbWFnZUJhc2VzLmxlbmd0aCA+IDAgPyBub3JtUGF0aChpbWFnZUJhc2VzWzBdKSA6IG1hcC5pbWFnZSA/IG5vcm1QYXRoKG1hcC5pbWFnZSkgOiB1bmRlZmluZWQ7XHJcbiAgaWYgKCFpbWFnZVVybCB8fCAhbWFwLm1hcmtlcnMpIHJldHVybiBudWxsO1xyXG4gIGNvbnN0IG1hcmtlcnNVcmwgPSBub3JtUGF0aChtYXAubWFya2Vycyk7XHJcblxyXG4gIC8vIGltZ1cgLyBpbWdIOiBleHBsaWNpdGx5IHNwZWNpZmllZCB2YWx1ZXMgb3ZlcnJpZGUgYXV0by1kZXRlY3Q7IG90aGVyd2lzZSBsZXQgbG9hZEJhc2VJbWFnZSB1c2UgbmF0dXJhbCBzaXplXHJcbiAgY29uc3QgZXhwbGljaXRXID0gcGFyc2VGbG9hdChtYXAuaW1nVyA/PyBcIjBcIikgfHwgdW5kZWZpbmVkO1xyXG4gIGNvbnN0IGV4cGxpY2l0SCA9IHBhcnNlRmxvYXQobWFwLmltZ0ggPz8gXCIwXCIpIHx8IHVuZGVmaW5lZDtcclxuXHJcbiAgLy8gQnVpbGQgeWFtbEJhc2VzIGZyb20gaW1hZ2VCYXNlc1sxOl0gaWYgbXVsdGlwbGUgYmFzZXNcclxuICBjb25zdCByZXN0QmFzZXMgPSBpbWFnZUJhc2VzLmxlbmd0aCA+IDFcclxuICAgID8gaW1hZ2VCYXNlcy5zbGljZSgxKS5tYXAoKHAsIGkpID0+ICh7XHJcbiAgICAgICAgcGF0aDogbm9ybVBhdGgocCksXHJcbiAgICAgICAgdXJsOiBub3JtUGF0aChwKSxcclxuICAgICAgICBuYW1lOiBgQmFzZSAke2kgKyAyfWAsXHJcbiAgICAgIH0pKVxyXG4gICAgOiB1bmRlZmluZWQ7XHJcblxyXG4gIC8vIGluaXRpYWxab29tOiBwcmVmZXIgdmlldy56b29tIG92ZXIgdG9wLWxldmVsIGluaXRpYWxab29tXHJcbiAgY29uc3QgaW5pdGlhbFpvb20gPSBfdmlld1pvb20gPyBwYXJzZUZsb2F0KF92aWV3Wm9vbSkgOiAobWFwLmluaXRpYWxab29tID8gcGFyc2VGbG9hdChtYXAuaW5pdGlhbFpvb20pIDogdW5kZWZpbmVkKTtcclxuICAvLyBpbml0aWFsQ2VudGVyOiBwcmVmZXIgdmlldy5jZW50ZXJYL1kgKG5vcm1hbGl6ZWQgMC0xKSBvdmVyIHRvcC1sZXZlbFxyXG4gIGNvbnN0IGhhc1ZpZXdDZW50ZXIgPSBfdmlld0NlbnRlclggIT09IFwiXCIgJiYgX3ZpZXdDZW50ZXJZICE9PSBcIlwiO1xyXG4gIGNvbnN0IGluaXRpYWxDZW50ZXI6IFN0UG9pbnQgfCB1bmRlZmluZWQgPSBoYXNWaWV3Q2VudGVyXHJcbiAgICA/IHsgeDogcGFyc2VGbG9hdChfdmlld0NlbnRlclgpLCB5OiBwYXJzZUZsb2F0KF92aWV3Q2VudGVyWSkgfVxyXG4gICAgOiB1bmRlZmluZWQ7XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBpbWFnZVVybCxcclxuICAgIG1hcmtlcnNVcmwsXHJcbiAgICBtaW5ab29tOiBwYXJzZUZsb2F0KG1hcC5taW5ab29tID8/IFwiMC4xXCIpLFxyXG4gICAgbWF4Wm9vbTogcGFyc2VGbG9hdChtYXAubWF4Wm9vbSA/PyBcIjEwXCIpLFxyXG4gICAgaW1nVzogZXhwbGljaXRXLFxyXG4gICAgaW1nSDogZXhwbGljaXRILFxyXG4gICAgd2lkdGg6IG1hcC53aWR0aCxcclxuICAgIGhlaWdodDogbWFwLmhlaWdodCxcclxuICAgIGFsaWduOiBtYXAuYWxpZ24gYXMgU3RNYXBDb25maWdbXCJhbGlnblwiXSxcclxuICAgIGluaXRpYWxab29tLFxyXG4gICAgaW5pdGlhbENlbnRlcixcclxuICAgIGljb25Qcm9maWxlczogREVGQVVMVF9JQ09OUyxcclxuICAgIHlhbWxCYXNlczogcmVzdEJhc2VzLFxyXG4gIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRlc3Ryb3lBbGwoKTogdm9pZCB7XHJcbiAgZm9yIChjb25zdCBtIG9mIGluc3RhbmNlcykgbS5kZXN0cm95KCk7XHJcbiAgaW5zdGFuY2VzID0gW107XHJcbn1cclxuXHJcbi8qIC0tLS0gZXhwb3NlIEFQSSAtLS0tICovXHJcblxyXG5jb25zdCBhcGk6IFpvb21NYXBTdGF0aWNBcGkgPSB7XHJcbiAgY3JlYXRlKGVsOiBIVE1MRWxlbWVudCwgY29uZmlnOiBTdE1hcENvbmZpZywgbWFya2Vycz86IFN0TWFya2VyW10pOiBTdGF0aWNNYXAge1xyXG4gICAgLy8gRW1iZWQgY29uZmlnXHJcbiAgICBlbC5jbGFzc0xpc3QuYWRkKFwiem0tc3RhdGljLXJvb3RcIiwgXCJ6bS1zdGF0aWMtaW5pdGlhbGlzZWRcIik7XHJcbiAgICBlbC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXptLWluaXRlZFwiLCBcIjFcIik7XHJcbiAgICBlbC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXptLWNvbmZpZ1wiLCBKU09OLnN0cmluZ2lmeShjb25maWcpKTtcclxuICAgIGlmIChtYXJrZXJzICYmIG1hcmtlcnMubGVuZ3RoID4gMCkge1xyXG4gICAgICBlbC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXptLW1hcmtlcnNcIiwgSlNPTi5zdHJpbmdpZnkobWFya2VycykpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgbWFwID0gbmV3IFN0YXRpY01hcChlbCk7XHJcbiAgICBpbnN0YW5jZXMucHVzaChtYXApO1xyXG4gICAgcmV0dXJuIG1hcDtcclxuICB9LFxyXG4gIHNjYW4sXHJcbiAgZGVzdHJveUFsbCxcclxufTtcclxuXHJcbi8vIEV4cG9zZSBnbG9iYWxseVxyXG4od2luZG93IGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pLlpvb21NYXBTdGF0aWMgPSBhcGk7XHJcblxyXG4vLyBBdXRvLXNjYW4gb24gRE9NIHJlYWR5XHJcbmlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImxvYWRpbmdcIikge1xyXG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHNjYW4oKSk7XHJcbn0gZWxzZSB7XHJcbiAgc2NhbigpO1xyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7OztBQWdCQSxNQUFNLEtBQUs7QUFHWCxNQUFJLGtCQUE2RDtBQUVqRSxXQUFTLG1CQUFrRDtBQUN6RCxRQUFJLG9CQUFvQixPQUFXLFFBQU87QUFDMUMsUUFBSTtBQUNGLFlBQU1BLE1BQUssU0FBUyxlQUFlLHVCQUF1QjtBQUMxRCxVQUFJQSxPQUFNQSxJQUFHLGFBQWE7QUFDeEIsMEJBQWtCLEtBQUssTUFBTUEsSUFBRyxXQUFXO0FBQzNDLGVBQU87QUFBQSxNQUNUO0FBQUEsSUFDRixTQUFTLElBQUk7QUFBQSxJQUFlO0FBQzVCLHNCQUFrQjtBQUNsQixXQUFPO0FBQUEsRUFDVDtBQVFBLFdBQVMsY0FBYyxNQUFzQjtBQUMzQyxRQUFJLENBQUMsS0FBTSxRQUFPO0FBRWxCLFFBQUksS0FBSyxXQUFXLFNBQVMsS0FBSyxLQUFLLFdBQVcsVUFBVSxLQUFLLEtBQUssV0FBVyxHQUFHLEVBQUcsUUFBTztBQUc5RixRQUFJLElBQUksS0FBSyxRQUFRLFVBQVUsRUFBRTtBQUVqQyxVQUFNLFFBQVEsaUJBQWlC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
