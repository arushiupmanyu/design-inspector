(function () {
  // Smarter main content detection
  function getMainContentContainer() {
    // Try common selectors first
    const selectors = ['main', '[role=main]', '.container', '#main', '.content', '#content'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;
    }
    // Fallback: find the largest centered element that's not full width
    let best = null, maxArea = 0;
    Array.from(document.body.querySelectorAll('*')).forEach(el => {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      // Heuristic: not full width, centered, visible, not too small
      if (
        area > maxArea &&
        rect.width < window.innerWidth &&
        rect.left > 0 &&
        rect.right < window.innerWidth &&
        el.offsetWidth > 300 && // ignore tiny elements
        el.offsetHeight > 100 &&
        getComputedStyle(el).display !== 'none'
      ) {
        maxArea = area;
        best = el;
      }
    });
    return best || document.body;
  }

  // More accurate padding/margin/gutter
  function getContentPaddingAndMargin() {
    const container = getMainContentContainer();
    const rect = container.getBoundingClientRect();
    const style = getComputedStyle(container);
    return {
      marginLeft: style.marginLeft,
      marginRight: style.marginRight,
      marginTop: style.marginTop,
      marginBottom: style.marginBottom,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      distanceFromViewport: {
        left: Math.max(0, Math.round(rect.left)) + 'px',
        right: Math.max(0, Math.round(window.innerWidth - rect.right)) + 'px',
        top: Math.max(0, Math.round(rect.top)) + 'px',
        bottom: Math.max(0, Math.round(window.innerHeight - rect.bottom)) + 'px'
      }
    };
  }

  // Robust spacing between visually stacked elements
  function getStackedSpacing(tag1, tag2) {
    const container = getMainContentContainer();
    const els1 = Array.from(container.querySelectorAll(tag1)).filter(el => el.offsetHeight > 0);
    const els2 = Array.from(container.querySelectorAll(tag2)).filter(el => el.offsetHeight > 0);
    if (els1.length && els2.length) {
      const r1 = els1[0].getBoundingClientRect();
      const r2 = els2.find(el => el.getBoundingClientRect().top > r1.bottom);
      if (r2) {
        return Math.round(r2.getBoundingClientRect().top - r1.bottom) + 'px';
      }
    }
    return null;
  }

  function getSpacingDetails() {
    return {
      headingToSubheading: getStackedSpacing('h1', 'h2'),
      subheadingToBody: getStackedSpacing('h2', 'p'),
      headingToBody: getStackedSpacing('h1', 'p')
    };
  }

  // Font details (still global, but could be container-scoped if needed)
  const getFontDetails = (selector) => {
    const container = getMainContentContainer();
    const el = container.querySelector(selector);
    if (!el) return null;
    const style = getComputedStyle(el);
    return {
      selector,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
    };
  };

  // Prominent color extraction (text/background, visible only)
  function rgbToHex(rgb) {
    const result = rgb.match(/\d+/g);
    if (!result) return rgb;
    return (
      "#" +
      result
        .slice(0, 3)
        .map((x) => parseInt(x).toString(16).padStart(2, "0"))
        .join("")
    );
  }

  function getProminentColors() {
    const container = getMainContentContainer();
    const elements = Array.from(container.querySelectorAll("*"))
      .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && getComputedStyle(el).display !== 'none');
    const textColors = {};
    const bgColors = {};
    elements.forEach(el => {
      const style = getComputedStyle(el);
      // Text color
      if (style.color && style.color.startsWith("rgb")) {
        const hex = rgbToHex(style.color);
        if (hex !== "#000000" && hex !== "#ffffff") textColors[hex] = (textColors[hex] || 0) + 1;
      }
      // Background color
      if (style.backgroundColor && style.backgroundColor.startsWith("rgb")) {
        const hex = rgbToHex(style.backgroundColor);
        if (hex !== "#000000" && hex !== "#ffffff" && hex !== "#ffffff00") bgColors[hex] = (bgColors[hex] || 0) + 1;
      }
    });
    return {
      text: Object.entries(textColors).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([hex]) => hex),
      background: Object.entries(bgColors).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([hex]) => hex)
    };
  }

  // Helper to filter out 0px/null/empty values from objects
  function filterValues(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const filtered = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v && v !== '0px' && v !== 0 && v !== null && v !== 'null' && v !== '' && !(typeof v === 'object' && Object.keys(filterValues(v)).length === 0)) {
        if (typeof v === 'object') {
          const nested = filterValues(v);
          if (Object.keys(nested).length > 0) filtered[k] = nested;
        } else {
          filtered[k] = v;
        }
      }
    }
    return filtered;
  }

  // Get spacing between consecutive <section> elements
  function getSectionSpacings() {
    const sections = Array.from(document.querySelectorAll('section')).filter(
      el => el.offsetHeight > 0 && el.offsetWidth > 0 && getComputedStyle(el).display !== 'none'
    );
    const spacings = [];
    for (let i = 0; i < sections.length - 1; i++) {
      const rect1 = sections[i].getBoundingClientRect();
      const rect2 = sections[i + 1].getBoundingClientRect();
      const spacing = Math.round(rect2.top - rect1.bottom);
      if (spacing >= 0) {
        spacings.push({
          between: `Section ${i + 1} & Section ${i + 2}`,
          spacing: spacing + 'px'
        });
      }
    }
    return spacings;
  }

  const prominentColors = getProminentColors();
  const allColors = [
    ...(prominentColors.text || []),
    ...(prominentColors.background || [])
  ].filter(c => typeof c === 'string' && c.startsWith('#'));

  // Robust visual gutter detection
  function getVisualGutter() {
    const candidates = Array.from(document.body.querySelectorAll('*')).filter(el => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        el.offsetWidth > 300 &&
        el.offsetHeight > 100 &&
        rect.width < window.innerWidth * 0.95 &&
        rect.left >= 0 &&
        rect.right <= window.innerWidth &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.position !== 'fixed' &&
        style.position !== 'absolute'
      );
    });

    let best = null, maxArea = 0;
    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > maxArea) {
        maxArea = area;
        best = rect;
      }
    }

    if (!best) return { left: null, right: null };

    return {
      left: Math.max(0, Math.round(best.left)) + 'px',
      right: Math.max(0, Math.round(window.innerWidth - best.right)) + 'px'
    };
  }

  const result = {
    fonts: [
      getFontDetails("h1"),
      getFontDetails("h2"),
      getFontDetails("p"),
    ].filter(Boolean),
    pagePaddingAndMargin: filterValues(getContentPaddingAndMargin()),
    visualGutter: getVisualGutter(),
    spacing: filterValues(getSpacingDetails()),
    sectionSpacings: getSectionSpacings(),
    colors: allColors,
  };

  // Create floating UI overlay (dark mode, SF Pro Text, minimal, Apple-like)
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "32px";
  container.style.right = "32px";
  container.style.zIndex = 999999;
  container.style.background = "rgba(22,22,24,0.96)";
  container.style.border = "1px solid #222";
  container.style.borderRadius = "18px";
  container.style.boxShadow = "0 8px 32px rgba(0,0,0,0.18)";
  container.style.padding = "24px 28px";
  container.style.maxWidth = "360px";
  container.style.fontFamily = "'SF Pro Text', 'San Francisco', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
  container.style.fontSize = "14px";
  container.style.color = "#f5f5f7";
  container.style.overflowY = "auto";
  container.style.maxHeight = "80vh";
  container.style.backdropFilter = "blur(16px)";
  container.style.transition = "box-shadow 0.2s cubic-bezier(.4,0,.2,1)";

  // Add SF Pro Text font if available
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.cdnfonts.com/css/sf-pro-display';
  document.head.appendChild(fontLink);

  // Helper to format objects as pretty HTML (no 0px/null)
  function pretty(obj) {
    if (Array.isArray(obj)) {
      return obj.map(pretty).join('<br>');
    } else if (typeof obj === 'object' && obj !== null) {
      return Object.entries(obj)
        .map(([k, v]) => `<div style="margin-bottom:2px;"><span style="color:#a1a1aa;">${k}:</span> <span style="color:#fff;">${pretty(v)}</span></div>`)
        .join('');
    } else {
      return `<span style="color:#fff;">${obj}</span>`;
    }
  }

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span style="font-weight:600;font-size:16px;letter-spacing:-0.01em;">Design Inspector</span>
      <button id="design-inspector-close-btn" style="background:rgba(36,36,38,0.7);color:#fff;border:none;padding:2px 10px;cursor:pointer;border-radius:8px;font-size:14px;transition:background 0.15s;outline:none;">✕</button>
    </div>
    <div style="margin-bottom:14px;">
      <span style="color:#a1a1aa;font-weight:500;">Fonts:</span><br>${pretty(result.fonts)}
    </div>
    ${Object.keys(result.pagePaddingAndMargin).length ? `<div style="margin-bottom:14px;"><span style="color:#a1a1aa;font-weight:500;">Padding, Margin & Gutter:</span><br>${pretty(result.pagePaddingAndMargin)}</div>` : ''}
    ${Object.keys(result.visualGutter).length ? `<div style="margin-bottom:14px;"><span style="color:#a1a1aa;font-weight:500;">Visual Gutter:</span><br>${pretty(result.visualGutter)}</div>` : ''}
    ${Object.keys(result.spacing).length ? `<div style="margin-bottom:14px;"><span style="color:#a1a1aa;font-weight:500;">Spacing:</span><br>${pretty(result.spacing)}</div>` : ''}
    ${result.sectionSpacings.length ? `<div style="margin-bottom:14px;"><span style="color:#a1a1aa;font-weight:500;">Section Spacing:</span><br>${result.sectionSpacings.map(s => `<div style='margin-bottom:2px;'><span style='color:#a1a1aa;'>${s.between}:</span> <span style='color:#fff;'>${s.spacing}</span></div>`).join('')}</div>` : ''}
    ${result.colors.length ? `<div style="margin-bottom:0;"><span style="color:#a1a1aa;font-weight:500;">Prominent Colors:</span><br>${result.colors.map(c => `<span style='display:inline-block;width:18px;height:18px;border-radius:6px;background:${c};margin-right:8px;border:1px solid #333;vertical-align:middle;'></span><span style='vertical-align:middle;'>${c}</span>`).join('<br>')}</div>` : ''}
  `;

  // Attach close button event listener
  const closeBtn = container.querySelector('#design-inspector-close-btn');
  if (closeBtn) {
    closeBtn.onclick = () => container.remove();
  }

  document.body.appendChild(container);
})();
  