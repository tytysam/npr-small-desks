import '@testing-library/jest-dom/vitest';

// jsdom has no matchMedia; components use it for reduced motion and layout
// width. Nothing matches by default; a test can replace it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}

// Nor scrollIntoView (the guide reveals a marked row).
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Nor ResizeObserver (the guide's marquee titles); jsdom has no layout anyway.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
