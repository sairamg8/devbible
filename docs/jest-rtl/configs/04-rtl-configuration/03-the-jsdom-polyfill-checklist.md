---
title: "The jsdom polyfill checklist"
sidebar_label: "03 · The jsdom polyfill checklist"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the [jsdom README](https://github.com/jsdom/jsdom#unimplemented-parts-of-the-web-platform)
> (unimplemented parts of the web platform), the
> [React Testing Library setup guide](https://testing-library.com/docs/react-testing-library/setup)
> and the [Jest configuration reference](https://jestjs.io/docs/configuration).
> **No sandbox, no console blocks.**

**jsdom is a DOM implementation, not a browser.** It has no layout engine and no
rendering, so anything that depends on a box having a size, a page having a scroll
position, or the browser having decided a media query does not exist there.

Those gaps produce errors inside `render()`, which is why RTL gets blamed for them.

---

## What is missing, and why

| API | Why jsdom lacks it | Symptom |
|---|---|---|
| `window.matchMedia` | Media queries need layout | `matchMedia is not a function` |
| `ResizeObserver` | Requires a layout engine | `ResizeObserver is not defined` |
| `IntersectionObserver` | Requires a viewport | `IntersectionObserver is not defined` |
| `window.scrollTo` | No scrolling | `Not implemented: window.scrollTo` |
| `Element.scrollIntoView` | Same | `scrollIntoView is not a function` |
| `HTMLCanvasElement.getContext` | No raster surface | `Not implemented: HTMLCanvasElement.prototype.getContext` |
| `URL.createObjectURL` | No blob storage | `createObjectURL is not a function` |
| `TextEncoder` / `TextDecoder` | Node globals not exposed in the jsdom sandbox | `TextEncoder is not defined` |
| `crypto.randomUUID` | Depends on the Node version and environment | `randomUUID is not a function` |

⚠️ **`Not implemented:` messages are logged, not thrown.** jsdom prints them and carries
on, so a test can pass while the behaviour under test never happened. Treat the first one
you see as a real finding.

---

## The checklist, copy-ready

```ts
// src/test/polyfills.ts — imported from setupTests.ts
import { TextEncoder, TextDecoder } from 'node:util';

// ── matchMedia ──────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,           // 🔴 see the note below
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),      // deprecated, still called by older libs
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});

// ── observers ───────────────────────────────────────────────
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
global.ResizeObserver = ObserverStub as unknown as typeof ResizeObserver;
global.IntersectionObserver = ObserverStub as unknown as typeof IntersectionObserver;

// ── scrolling ───────────────────────────────────────────────
window.scrollTo = jest.fn();
Element.prototype.scrollIntoView = jest.fn();

// ── encoding (often needed in setupFiles, not here — see below)
global.TextEncoder ??= TextEncoder;
global.TextDecoder ??= TextDecoder as typeof global.TextDecoder;

// ── object URLs ─────────────────────────────────────────────
global.URL.createObjectURL = jest.fn(() => 'blob:test');
global.URL.revokeObjectURL = jest.fn();
```

---

## 🔴 The three traps in that file

### 1. `matches: false` is a decision, not a default

Every media query answers "no". A component rendering a mobile layout under
`(max-width: 768px)` will therefore always take the desktop branch, and **the mobile
branch is never tested** while every test passes.

Make it explicit where it matters:

```ts
window.matchMedia = jest.fn().mockImplementation((query: string) => ({
  matches: query.includes('max-width: 768px'),   // stated, not assumed
  media: query,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  /* … */
}));
```

### 2. A stubbed observer never fires

`ResizeObserver` above accepts callbacks and calls none. A component that renders nothing
until its first resize entry arrives will render nothing, forever. **A virtualised list is
the usual casualty** — it measures, gets no answer, and shows zero rows.

When the callback matters, capture and fire it:

```ts
let trigger: ResizeObserverCallback;
global.ResizeObserver = class {
  constructor(cb: ResizeObserverCallback) { trigger = cb; }
  observe() {} unobserve() {} disconnect() {}
} as unknown as typeof ResizeObserver;

// in the test
act(() => trigger([{ contentRect: { width: 800, height: 600 } } as ResizeObserverEntry], {} as ResizeObserver));
```

### 3. `TextEncoder` usually belongs in `setupFiles`, not here

If a module reads it **at import scope**, a polyfill in `setupFilesAfterEnv` runs too
late — the module was already evaluated. That is one of the few genuine uses for Jest's
earlier `setupFiles` stage ([chunk 03](../03-setup-lifecycle.md)).

---

## Prefer a real implementation where one exists

A stub that lies is worse than no stub. Where a faithful package exists, use it:

| Instead of | Use |
|---|---|
| A hand-written `ResizeObserver` | `resize-observer-polyfill` |
| A canvas stub | `jest-canvas-mock` |
| A `matchMedia` stub in a media-query-heavy app | A library that supports changing the match at runtime |

And for a component that genuinely depends on layout — a drag handle, a virtualised grid,
anything measuring a box — **jsdom is the wrong tool**. Those belong in
[Playwright](../../../playwright/pages/README.md), where boxes have real sizes.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `matchMedia is not a function` | Not implemented in jsdom | Polyfill it in the setup file |
| Mobile branch never covered, tests all green | `matches: false` for every query | Make the match query-dependent |
| `ResizeObserver is not defined` | Not implemented | Stub the class |
| A virtualised list renders zero rows | The stub never fires its callback | Capture the callback and trigger it |
| `Not implemented: window.scrollTo` in the log, test passes | jsdom logs rather than throwing | Stub it — and check what silently did not happen |
| `TextEncoder is not defined` despite polyfilling | Read at import scope, polyfilled too late | Move it to `setupFiles` |
| Canvas code throws on `getContext` | No raster surface in jsdom | `jest-canvas-mock`, or do not test it in jsdom |
| File-upload preview breaks | `URL.createObjectURL` missing | Stub both create and revoke |
| Polyfill works in one file only | Applied inside a test rather than the setup file | Move it to the setup file |
| Layout assertions always read 0 | `getBoundingClientRect` returns zeroes — no layout engine | Do not assert on geometry in jsdom |

---

## Interview questions

**Q. Why does jsdom lack `matchMedia`, `ResizeObserver` and `IntersectionObserver`?**
All three depend on layout and a viewport. jsdom implements the DOM, not rendering, so
there is nothing to measure.

**Q. What is dangerous about the standard `matchMedia` stub?**
`matches: false` answers "no" to every query, so responsive branches are never taken. The
suite is green and one whole rendering path is untested.

**Q. Your virtualised list renders zero rows under jsdom.**
The `ResizeObserver` stub never invokes its callback, so the component's measured height
stays zero. Capture the callback and fire it with a synthetic entry.

**Q. Why is `Not implemented: window.scrollTo` worth attention when nothing fails?**
jsdom logs and continues, so the behaviour under test did not run while the test still
passed — a false pass, not a warning.

**Q. Why might `TextEncoder` still be undefined after polyfilling it?**
It was polyfilled in `setupFilesAfterEnv` but read at import scope, so the module
evaluated first. It belongs in `setupFiles`.

**Q. When should you stop polyfilling?**
When the component's behaviour genuinely depends on layout. A stack of stubs that all lie
tests nothing — use a real browser via Playwright.

**Q. Stub or real polyfill package?**
Prefer a faithful implementation. A stub that silently answers wrongly produces green
tests that assert nothing, which is worse than an error.

**Q. Why do these errors look like RTL's fault?**
They surface inside `render()`, when the component touches the missing API. RTL only
mounted it — the gap is jsdom's.

---

← **Prev:** [02 · The setup file](./02-the-setup-file.md) ·
**Next:** 05 · `vitest.config` reference *(not written yet)*
