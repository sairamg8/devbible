---
sidebar_position: 0
title: "Overview"
sidebar_label: "Overview"
description: "Chapter 9 overview"
---

# ▲ Styling and UI

> **Page priority:** 🟢 `[D]` **Daily driver / Must Master**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  



> **Source:** current-project backup remapped + improved for exact syllabus title

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

## 2. Real-World Engineering Scenario

**Scenario**: A Marketing Site Loading Google Fonts, a Hero Image, and a Chat Widget — Each With Genuinely Different Urgency.
The hero image is the LCP element and must be prioritized. The page's heading font must be available immediately to avoid FOIT/FOUT-driven layout shift. A third-party chat widget script is useful but not remotely urgent — it can load whenever the browser has spare idle time, long after the page feels fully loaded. Using `<Image priority>` for the hero, `next/font`'s self-hosted, zero-shift loading for the heading font, and `<Script strategy="lazyOnload">` for the chat widget encodes each element's actual urgency explicitly, rather than treating "load everything as fast as possible" as a single undifferentiated goal that would otherwise have the chat widget competing for bandwidth with the actual LCP resource.

---

## 3. Production-Grade Code Example

```tsx
// app/layout.tsx — next/font: self-hosted, zero-layout-shift font loading
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' }); // downloaded at BUILD time, self-hosted

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/page.tsx — next/image with priority for the actual LCP element
import Image from 'next/image';

export default function HomePage() {
  return (
    <div>
      <Image
        src="/hero.avif"
        alt="Hero"
        width={1200}
        height={600}
        priority // this IS the LCP element — skip lazy-loading, preload, fetchpriority=high
      />
      <Image
        src="/testimonial-avatar.jpg"
        alt="Customer"
        width={80}
        height={80}
        // no priority — below the fold, correctly lazy-loaded by default
      />
    </div>
  );
}
```

```tsx
// app/layout.tsx — next/script: explicit loading strategy matching actual urgency
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <Script src="https://widget.chat-vendor.com/embed.js" strategy="lazyOnload" />
        <Script id="analytics-init" strategy="afterInteractive">
          {`window.analytics.init('${process.env.NEXT_PUBLIC_ANALYTICS_KEY}');`}
        </Script>
      </body>
    </html>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `priority` on the Actual LCP Image
```tsx
// ❌ WRONG: next/image lazy-loads by DEFAULT — an above-the-fold hero image without `priority`
// is actively DELAYED exactly like the "lazy-loading the LCP image" pitfall in the Web Vitals bible
<Image src="/hero.avif" alt="Hero" width={1200} height={600} />

// ✅ CORRECT: explicitly mark the true LCP candidate as priority
<Image src="/hero.avif" alt="Hero" width={1200} height={600} priority />
```

### ⚠️ Pitfall 2: Setting `priority` on Every Image "Just to Be Safe"
```tsx
// ❌ WRONG: priority disables lazy-loading and adds a preload hint — marking MANY images
// priority means they all compete for early bandwidth, diluting the actual LCP resource's
// advantage (the exact "preloading too many resources" pitfall, applied via next/image)
<Image src="/img1.jpg" priority /> <Image src="/img2.jpg" priority /> <Image src="/img3.jpg" priority />

// ✅ CORRECT: priority should mark ONLY the genuine LCP candidate, typically one image
```

### ⚠️ Pitfall 3: Using `beforeInteractive` for Non-Critical Scripts
```tsx
// ❌ WRONG: beforeInteractive blocks hydration for a script that doesn't need to run this early —
// a chat widget or analytics script delaying the page becoming interactive hurts INP for no reason
<Script src="https://widget.chat-vendor.com/embed.js" strategy="beforeInteractive" />

// ✅ CORRECT: reserve beforeInteractive for scripts that are GENUINELY required before hydration
// (rare — e.g. a polyfill the app's own code depends on); use lazyOnload for everything else
<Script src="https://widget.chat-vendor.com/embed.js" strategy="lazyOnload" />
```
