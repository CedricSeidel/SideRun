/*!
 * SideRun v2.2.0 - Animated flying border effect
 * @license MIT | @author Cedric Seidel
 * https://github.com/PVULJVCOB/SideRun
 */

(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const mix = (a, b, t) => a * (1 - t) + b * t;

  /**
   * Apple-style squircle radius calculation
   * Based on iOS design guidelines: radius ≈ width × 0.2237 (continuous corners)
   */
  function calcAppleRadius(w, h) {
    const min = Math.min(w, h);
    const ratio = 0.2237; // Apple's magic ratio for continuous corners
    return Math.min(min * ratio, min / 2);
  }

  // State management
  const cleanupMap = new WeakMap();
  const instanceMap = new WeakMap();
  const initInProgress = new WeakSet();

  // Shared animation pool
  const RafPool = (() => {
    let rafId = null;
    const callbacks = new Set();
    const tick = () => {
      callbacks.forEach(cb => { try { cb(); } catch (e) {} });
      rafId = requestAnimationFrame(tick);
    };
    return {
      add(cb) {
        callbacks.add(cb);
        if (callbacks.size === 1 && !rafId) rafId = requestAnimationFrame(tick);
        return () => {
          callbacks.delete(cb);
          if (!callbacks.size && rafId) { cancelAnimationFrame(rafId); rafId = null; }
        };
      }
    };
  })();

  function init(hostEl, options = {}) {
    if (!hostEl) return () => {};

    // Find stroke container or use host directly
    let strokeHost = hostEl.querySelector('.site-nav__stroke.siderun, .card__stroke.siderun');
    if (!strokeHost) strokeHost = hostEl;

    if (initInProgress.has(strokeHost)) return () => {};
    initInProgress.add(strokeHost);

    // Cleanup previous instance
    const prev = cleanupMap.get(strokeHost);
    if (prev) try { prev(); } catch (e) {}

    // Read CSS tokens
    const cs = getComputedStyle(hostEl);
    const cssVal = (name, def) => parseFloat(cs.getPropertyValue(name)) || def;

    const cfg = {
      tail: cssVal('--sr-tail', 10),
      gap: cssVal('--sr-gap', 10),
      ease: cssVal('--sr-ease', 0.1),
      margin: cssVal('--sr-margin', 11),
      maxFps: cssVal('--sr-max-fps', 60),
      trackPointer: false,
      useAppleRadius: false,
      maxRadius: null,
      pauseOffscreen: true,
      ...options
    };

    // Create SVG structure
    const injected = document.createElement('div');
    injected.className = 'sr-injected';
    injected.setAttribute('aria-hidden', 'true');

    const wrapper = document.createElement('div');
    wrapper.className = 'sr-wrapper';
    wrapper.style.cssText = `position:absolute;inset:-${cfg.margin}px;pointer-events:none;overflow:visible`;

    const svg = document.createElementNS(NS, 'svg');
    svg.classList.add('siderun-border');

    const group = document.createElementNS(NS, 'g');
    const layers = ['sr-border-top', 'sr-runner-1', 'sr-runner-2', 'sr-border-bottom'].map(cls => {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('class', cls);
      group.appendChild(rect);
      return rect;
    });
    const [borderTop, runner1, runner2, borderBottom] = layers;

    svg.appendChild(group);
    wrapper.appendChild(svg);
    injected.appendChild(wrapper);

    // Ensure relative positioning
    if (getComputedStyle(strokeHost).position === 'static') {
      strokeHost.style.position = 'relative';
    }
    strokeHost.appendChild(injected);

    // Animation state
    const metrics = { perimeter: 0, segment: 0, head: 0, widthSpan: 0, bases: {} };
    const state = { hoverX: 0.5, hoverY: 0.5, isHover: false };
    const primary = { target: 0, eased: 0 };
    const secondary = { target: 0, eased: 0 };
    
    let hostRect = hostEl.getBoundingClientRect();
    let unregister = null;
    let disposed = false;
    let isInViewport = true;
    const prefersReducedMotion = matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    function setGeometry(w, h, r) {
      const stroke = cssVal('--sr-stroke-width', 3);
      const off = stroke / 2;
      const iw = Math.max(0, w - stroke);
      const ih = Math.max(0, h - stroke);
      layers.forEach(rect => {
        rect.setAttribute('x', off);
        rect.setAttribute('y', off);
        rect.setAttribute('width', iw);
        rect.setAttribute('height', ih);
        rect.setAttribute('rx', r);
      });
    }

    function recalc() {
      if (disposed) return;
      hostRect = hostEl.getBoundingClientRect();
      const cs = getComputedStyle(hostEl);
      const stroke = parseFloat(cs.getPropertyValue('--sr-stroke-width')) || 3;
      const m = cfg.margin;

      const w = Math.max(0, hostRect.width + m * 2);
      const h = Math.max(0, hostRect.height + m * 2);

      svg.setAttribute('width', w);
      svg.setAttribute('height', h);
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      wrapper.style.width = `${w}px`;
      wrapper.style.height = `${h}px`;

      const iw = w - stroke;
      const ih = h - stroke;

      // Calculate radius
      let r;
      if (cfg.useAppleRadius) {
        r = calcAppleRadius(w, h);
      } else {
        const cssRadius = parseFloat(cs.getPropertyValue('border-radius')) || 12;
        r = cssRadius + m; // Concentric offset
      }
      if (cfg.maxRadius) r = Math.min(r, cfg.maxRadius);
      r = Math.min(r, Math.min(iw, ih) / 2);

      setGeometry(w, h, r);

      // Calculate perimeter
      const arcQ = Math.PI * r * 0.5;
      let perim = 2 * (iw + ih) - 8 * r + 2 * Math.PI * r;
      if (!isFinite(perim) || perim <= 0) perim = 2 * (iw + ih);

      metrics.perimeter = perim;
      metrics.segment = arcQ + cfg.tail * 2;
      metrics.head = arcQ + cfg.tail;
      metrics.widthSpan = Math.max(0, iw - r * 2);

      const b = metrics.bases;
      b.ps = metrics.head;
      b.pe = -metrics.widthSpan - arcQ + metrics.head;
      b.ss = metrics.head - perim * 0.5;
      b.se = -perim * 0.5 - metrics.widthSpan - arcQ + metrics.head;
      b.wrap = b.se + perim;

      primary.eased = primary.target = b.ps;
      secondary.eased = secondary.target = b.ss;
      applyDashes();
    }

    function updateTargets() {
      if (!metrics.perimeter) return;
      const b = metrics.bases;
      if (state.isHover) {
        const ratio = clamp(state.hoverX, 0, 1);
        primary.target = mix(b.ps, b.pe, ratio);
        secondary.target = mix(b.se, b.ss, ratio);
      } else {
        primary.target = b.ps;
        secondary.target = b.ss;
      }
    }

    const lastDash = {};
    function applyDashes() {
      if (!metrics.perimeter) return;
      const { perimeter: p, segment: seg } = metrics;
      const mainGap = Math.max(0, p - seg);

      const set = (el, arr, off, key) => {
        const a = `${arr}`, o = `${off}`;
        if (lastDash[key + 'a'] !== a) { el.setAttribute('stroke-dasharray', a); lastDash[key + 'a'] = a; }
        if (lastDash[key + 'o'] !== o) { el.setAttribute('stroke-dashoffset', o); lastDash[key + 'o'] = o; }
      };

      set(runner2, `${seg} ${mainGap}`, primary.eased, 'r2');
      set(runner1, `${seg} ${mainGap}`, secondary.eased, 'r1');

      const tailLen = Math.max(0, -secondary.eased + primary.eased - cfg.gap * 2 - seg);
      set(borderTop, `${tailLen} ${p - tailLen}`, primary.eased - seg - cfg.gap, 'bt');

      const trailLen = Math.max(0, p + secondary.eased - primary.eased - cfg.gap * 2 - seg);
      set(borderBottom, `${trailLen} ${p - trailLen}`, secondary.eased - seg - cfg.gap + p * 2, 'bb');
    }

    let lastFrame = 0;
    function step() {
      if (disposed || !isInViewport) return;
      const now = performance.now();
      if (now - lastFrame < 1000 / cfg.maxFps) return;
      lastFrame = now;

      updateTargets();
      const d1 = Math.abs(primary.target - primary.eased);
      const d2 = Math.abs(secondary.target - secondary.eased);

      if (!state.isHover && d1 < 0.4 && d2 < 0.4) {
        primary.eased = primary.target;
        secondary.eased = secondary.target;
        applyDashes();
        return;
      }

      if (prefersReducedMotion) {
        primary.eased = primary.target;
        secondary.eased = secondary.target;
      } else {
        primary.eased += (primary.target - primary.eased) * cfg.ease;
        secondary.eased += (secondary.target - secondary.eased) * cfg.ease;
      }
      applyDashes();
    }

    // Event handlers
    const updateFromEvent = (e) => {
      hostRect = hostEl.getBoundingClientRect();
      state.hoverX = clamp((e.clientX - hostRect.left) / (hostRect.width || 1), 0, 1);
      state.hoverY = clamp((e.clientY - hostRect.top) / (hostRect.height || 1), 0, 1);
    };

    const onEnter = (e) => { state.isHover = true; if (cfg.trackPointer) updateFromEvent(e); };
    const onMove = (e) => { if (cfg.trackPointer) updateFromEvent(e); };
    const onLeave = () => { state.isHover = false; };

    // Attach events
    const isTouch = 'ontouchstart' in window;
    if (cfg.trackPointer && !isTouch) {
      hostEl.addEventListener('pointerenter', onEnter, { passive: true });
      hostEl.addEventListener('pointermove', onMove, { passive: true });
      hostEl.addEventListener('pointerleave', onLeave, { passive: true });
    } else {
      // Navbar mode: hover on links
      const links = hostEl.querySelectorAll('a');
      if (links.length) {
        const linkEnter = (e) => {
          state.isHover = true;
          const r = e.currentTarget.getBoundingClientRect();
          hostRect = hostEl.getBoundingClientRect();
          state.hoverX = clamp(((r.left + r.right) / 2 - hostRect.left) / (hostRect.width || 1), 0, 1);
        };
        links.forEach(l => {
          l.addEventListener('mouseenter', linkEnter);
          l.addEventListener('mouseleave', onLeave);
        });
        hostEl.addEventListener('mouseleave', onLeave);
      } else {
        hostEl.addEventListener('mouseenter', () => { state.isHover = true; });
        hostEl.addEventListener('mouseleave', onLeave);
      }
    }

    // Touch support
    if (isTouch) {
      hostEl.addEventListener('touchstart', () => { state.isHover = true; }, { passive: true });
      hostEl.addEventListener('touchend', () => { setTimeout(() => { state.isHover = false; }, 150); }, { passive: true });
    }

    // ResizeObserver with debounce
    let resizeTimer = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(recalc, 300);
    });
    ro.observe(hostEl);

    // Intersection observer for offscreen pause
    let io = null;
    if (cfg.pauseOffscreen && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(([e]) => {
        isInViewport = e.isIntersecting;
        if (isInViewport && !unregister) unregister = RafPool.add(step);
        else if (!isInViewport && unregister) { unregister(); unregister = null; }
      }, { threshold: 0 });
      io.observe(hostEl);
    }

    // Visibility handling
    const onVis = () => {
      if (document.hidden && unregister) { unregister(); unregister = null; }
      else if (!document.hidden && isInViewport && !unregister) unregister = RafPool.add(step);
    };
    document.addEventListener('visibilitychange', onVis);

    // Start
    recalc();
    unregister = RafPool.add(step);
    initInProgress.delete(strokeHost);

    // Cleanup function
    const cleanup = () => {
      disposed = true;
      if (unregister) unregister();
      if (io) io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      injected.remove();
      cleanupMap.delete(strokeHost);
    };

    cleanupMap.set(strokeHost, cleanup);
    instanceMap.set(hostEl, { recalc, cleanup });
    return cleanup;
  }

  // Export
  const api = { init };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SideRun = api;
})();
