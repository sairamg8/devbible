---
sidebar_position: 5
title: "`next/script` loading strategies for third-party scripts."
sidebar_label: "`next/script` loading strategies for third-party scripts."
description: "`next/script` loading strategies for third-party scripts."
---

# ▲ `next/script` loading strategies for third-party scripts.

> **Syllabus chapter:** 9. Styling and UI  
> **Exact concept:** `next/script` loading strategies for third-party scripts.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

## 1. Under-The-Hood Mechanics

Three built-in components each target a specific, historically hard-to-get-right performance problem — automating what would otherwise be manual, error-prone optimization work.

### `next/image`: Automatic Resizing, Lazy Loading & CLS Prevention
```
<Image src={...} width={800} height={600} />
        │
        ├── Requires width/height (or fill) ──► reserves layout space BEFORE load, preventing CLS
        ├── Serves resized, format-negotiated (AVIF/WebP) variants per requesting device ──► via a built-in image optimization endpoint
        ├── loading="lazy" by DEFAULT ──► unless `priority` is set (see LCP pitfalls below)
        └── `priority` ──► disables lazy-loading AND emits a <link rel="preload"> + fetchpriority="high"
```

### `next/font`: Self-Hosted, Zero-Layout-Shift Font Loading
Rather than a `<link>` to Google Fonts' CDN (a render-blocking, third-party-origin request with its own connection setup cost), `next/font` downloads the font file **at build time**, self-hosts it alongside the app's own static assets, and automatically computes fallback font metrics to minimize the layout shift a font swap would otherwise cause (see the [Web Vitals CLS doc](../../../web-vitals-performance/pages/06-cls-optimization/01-preventing-cls.md) for the underlying font-metric-mismatch mechanics this solves).

### `next/script`: Loading Strategy as an Explicit Choice
Third-party scripts (analytics, chat widgets, ads) each have different urgency — `next/script`'s `strategy` prop makes that urgency an explicit, declared choice instead of an accidental default:
- `beforeInteractive` — loaded and executed before any page hydration; reserved for scripts genuinely needed before the page is interactive at all (rare).
- `afterInteractive` (default) — loaded as soon as the page is interactive.
- `lazyOnload` — loaded during browser idle time, latest possible — for scripts with zero urgency (most analytics).
- `worker` (experimental) — offloads script execution to a Web Worker via Partytown, keeping the main thread free entirely.

---
