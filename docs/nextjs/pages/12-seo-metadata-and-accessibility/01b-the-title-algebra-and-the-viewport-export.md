---
title: "`title` is the only metadata field with real structure, and `viewport` stopped being metadata in Next.js 14 — both fail silently when you get them wrong"
sidebar_label: "01b · The title algebra and the viewport export"
sidebar_position: 2
description: "title.default, title.template and title.absolute and how they compose down a route tree; the separate viewport / generateViewport export, why it cannot stream, and the accessibility trap sitting in its own reference example."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`generateMetadata` reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
> (page `lastUpdated: 2026-08-25`) and
> [`generateViewport`](https://nextjs.org/docs/app/api-reference/functions/generate-viewport)
> (`2026-06-09`), plus
> [WCAG 2.2 SC 1.4.4 Resize Text](https://www.w3.org/TR/WCAG22/#resize-text).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified — **no sandbox run**.

**Every other metadata field is a value you set. `title` is a small language: three forms, two
of which apply to *child* segments rather than the segment that declares them, which is why a
template declared in the wrong file is inert and produces no error. This page is that language
in full, plus two things that live next to it — the `viewport` export, which stopped being part
of `metadata` in Next.js 14 and now fails silently if you leave it there, and which carries an accessibility
trap in its own reference example.
[01](01-static-and-dynamic-metadata-metadata-objects-generatemetadat.md) is the resolution
model these fields resolve under; [01c](01c-the-tags-the-metadata-api-will-not-emit.md) is the
list of tags this API deliberately refuses to generate for you.**

## The title algebra

| Form | Applies to | Effect |
|---|---|---|
| `title: 'About'` | this segment | Fills a parent's `template` if there is one |
| `title.default` | **child** segments | The title used when a child sets none |
| `title.template` | **child** segments | `'%s · Acme'`, applied to a child's string title |
| `title.absolute` | this segment | Ignores every parent template |

The rules that trip people up, all stated in the reference:

- **A template applies to children, never to the segment that declares it.** A `template` in
  `app/blog/layout.tsx` *does* decorate a `title` declared in `app/blog/page.tsx`, because the
  page is a child segment of that layout. But a `template` declared in a `page.tsx` is inert,
  because a page is always the terminating segment and has no children at all.
- **`title.default` is required whenever you set `title.template`.** Without it, a route that
  never supplies a title has nothing to substitute into `%s`.
- **`title.template` has no effect at all if no descendant defines a `title` or a
  `title.default`.** It is not a fallback; it is a decorator with nothing to decorate.
- **`title.absolute` is the escape hatch** for the one page that must not read
  `Home · SprintDesk · SprintDesk` — a marketing landing page, or a page whose title is already
  a full sentence at the length a search result will truncate.

```tsx
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'SprintDesk', template: '%s · SprintDesk' },
}
```

```tsx
// app/blog/page.tsx        →  <title>Blog · SprintDesk</title>
export const metadata: Metadata = { title: 'Blog' }
```

```tsx
// app/page.tsx             →  <title>SprintDesk — sprint planning that stays out of the way</title>
export const metadata: Metadata = {
  title: { absolute: 'SprintDesk — sprint planning that stays out of the way' },
}
```

### Templates compose down a tree, and that is usually a bug

Because a nested layout is a child segment of the layout above it, a `template` in a nested
layout is itself decorated by the template above — and then applies its own template to its
children. Two layouts each adding a suffix gives you both suffixes:

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: { default: 'SprintDesk', template: '%s · SprintDesk' },
}
```

```tsx
// app/docs/layout.tsx
export const metadata: Metadata = {
  title: { default: 'Docs', template: '%s | Docs' },
}
// A page under /docs setting title: 'Webhooks' resolves through the nested
// template first, then the root one: "Webhooks | Docs · SprintDesk".
```

That is occasionally what you want and usually not, at which point the nested layout should use
`absolute` for its own default and set a template that already includes the brand:

```tsx
// app/docs/layout.tsx
export const metadata: Metadata = {
  title: { absolute: 'Docs · SprintDesk', template: '%s · Docs · SprintDesk' },
}
```

The general habit: **`generateMetadata` in a leaf that builds a title from data should almost
always use `absolute`**, because a fetched title is already the complete, intentional string
and an inherited suffix will push the distinguishing part past the ~60 characters a search
result shows.

```tsx
// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost((await params).slug)
  return { title: { absolute: `${post.title} · SprintDesk` } }
}
```

## `viewport` is a separate export, and has been since 14

`themeColor`, `colorScheme` and `viewport` were deprecated inside `metadata` in **Next.js
14.0** and moved to a sibling export with the same two shapes — a static `viewport` object or a
`generateViewport` function, again mutually exclusive within a segment, again Server Components
only. There is a `metadata-to-viewport-export` codemod for the migration.

```tsx
// app/layout.tsx
import type { Viewport } from 'next'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  colorScheme: 'light dark',
}
```

Leaving these in `metadata` does not fail the build; it stops emitting the tags, which is why a
themed install banner can quietly go grey after an upgrade. The manifest side of that story is
in [10b](10b-manifest-fields-that-change-behaviour.md).

### The one hard difference from metadata: viewport cannot stream

Metadata that is not ready when the body starts flushing gets appended later
([01d](01e-streaming-metadata-and-html-limited-bots.md)). Viewport cannot do that, because it
governs how the browser lays the page out in the first place — a viewport that arrived after
first paint would be a reflow. So a `generateViewport` that touches request data blocks the
document. The documented escapes are `'use cache'` when it depends on external but not
per-request data, or wrapping the document's `<body>` in a `<Suspense>` boundary to declare the
whole route dynamic.

In practice, **a viewport that needs request data is nearly always a design mistake**. A theme
colour read from a cookie is the common case, and it costs you the static shell of every route
under that layout. Ship both colours with `prefers-color-scheme` media queries, as above, and
let the device pick.

### 🔴 Do not copy the reference's own `userScalable` example

The `generateViewport` page shows this, explicitly as a completeness example:

```tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,     // 🔴
  userScalable: false, // 🔴
}
```

It emits `maximum-scale=1, user-scalable=no`, which blocks pinch-zoom. WCAG 2.2 SC 1.4.4
requires text to be resizable up to 200% without loss of content or functionality, and this is
the single most common way a site fails it. The same reference notes that the viewport tag is
set automatically and that manual configuration is usually unnecessary — take that sentence and
ignore the example. iOS Safari has ignored `user-scalable=no` since iOS 10, so on the platform
people usually add it for, it does not even work; it only degrades Android and desktop.

If you added it to stop iOS zooming when a form field is focused, the actual cause is a font
size below 16px on the input. Fix the CSS:

```css
input, select, textarea { font-size: 16px; }
```

## Gotchas

**★ `title.template` declared in a `page.tsx` silently does nothing.** A page is a terminating
segment with no children, and templates only apply to children. The symptom is a suffix that
never appears anywhere; the fix is to move the template up into the layout.

**★ Setting `title.template` without `title.default` breaks every route that sets no title.**
The reference states the default is required. Routes that would have fallen back now have
nothing to substitute into `%s`.

**★ Nested layouts each carrying a template produce doubled suffixes.** The nested template is
applied first and its result is fed to the outer one. Give the nested layout an `absolute`
default and a template that already contains the brand, or drop the template from one of them.

**★ A data-driven leaf title inherits a brand suffix and gets truncated in results.** A fetched
article title is already at the useful length; adding ` · SprintDesk` pushes the distinguishing
words out of the visible part of the SERP snippet. Use `title.absolute` in `generateMetadata`.

**★ `themeColor` inside `metadata` stopped working in 14 and nothing tells you.** It is
deprecated, not removed-with-an-error, so the build stays green and the tag stops appearing.
Move it to the `viewport` export or run the `metadata-to-viewport-export` codemod.

**★ `generateViewport` reading a cookie makes the whole route dynamic and cannot be fixed by
streaming.** Viewport affects initial layout, so it cannot be appended later the way metadata
can. Either `'use cache'` it, wrap the document body in `<Suspense>` and accept a dynamic
route, or express the variation in CSS media queries instead.

**★ `userScalable: false` copied from the reference example fails WCAG 1.4.4.** It disables
pinch-zoom. iOS ignores it anyway, so it only harms the platforms where it works. If you added
it to stop input-focus zoom on iOS, set the input font size to 16px instead.

## Interview questions

**★ What is the difference between `title.default` and `title.absolute` in a layout?**
Both define what child segments get when they set no title of their own, but `default`
participates in any `template` inherited from further up the tree and `absolute` ignores it. In
a nested layout under a root that sets `template: '%s · Acme'`, a `default` child title comes
out decorated and an `absolute` one does not.

**★ A layout sets `title.template` and the suffix never appears. Name three possible causes.**
The template is in a `page.tsx` rather than a layout, so it has no child segments to apply to;
or no descendant sets a `title` or `title.default`, so there is nothing to substitute; or the
descendant used `title.absolute`, which deliberately ignores parent templates.

**★ Why is `viewport` a separate export from `metadata` rather than a field inside it?**
Because it is not a description of the document for external consumers — it is an instruction
to the browser about how to lay the page out, and it must be resolved before first paint.
Metadata can be appended to the body later if it is slow; viewport cannot. Separating the
exports lets Next treat them under different rules, and it is why `generateViewport` blocks
where `generateMetadata` streams.

**★ You need a per-user theme colour from a cookie. What does that cost you?**
The static shell of every route under the layout that declares it. `generateViewport` reading
`cookies()` defers to request time, and because viewport cannot stream, the document blocks
until it resolves — the documented workaround is a `<Suspense>` around the body, which is a way
of saying "this route is dynamic now". The cheap alternative is to emit both theme colours with
`prefers-color-scheme` media queries and let the device choose, which costs nothing.

**★ Why is `user-scalable=no` a bug rather than a preference?**
It removes the reader's ability to enlarge text, which WCAG 2.2 SC 1.4.4 requires up to 200%.
It is also ineffective on iOS Safari, which has ignored it for years, so it degrades Android
and desktop while not achieving the thing it was usually copied in to achieve. The problem it
is normally reached for — iOS zooming in when an input is focused — is caused by an input font
size under 16px and is fixed in CSS.

---

← [Static and dynamic metadata](01-static-and-dynamic-metadata-metadata-objects-generatemetadat.md) · [Chapter 12 overview](01-explanation.md) · Next → [The tags the API will not emit](01c-the-tags-the-metadata-api-will-not-emit.md)
