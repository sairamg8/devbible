---
title: "Next.js 16 turned a missing default.js from a runtime 404 into a build failure, so every parallel-route slot in an app upgraded from 15 — including the implicit children slot — now needs a file that in most cases contains four lines"
sidebar_label: "02c · default.js required"
sidebar_position: 107
description: "Why default.js exists, what soft and hard navigation do to slot state, the Next.js 16 build-failure change, the two documented bodies for the file, and the doc pages that still disagree about it."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [Upgrade to version 16 › Parallel Routes `default.js` requirement](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`), [`default.js`](https://nextjs.org/docs/app/api-reference/file-conventions/default) (`2025-10-09`) and [Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes) (`2026-08-25`).
> Target: **Next.js 16.3.4**. Documentation-verified — **no sandbox run**.

**This is the parallel-routes change most likely to stop a version-16 upgrade dead, and it is easy to miss because it does not appear in the breaking-changes summary people skim. The router keeps each slot's active subpage in client state. A full page load destroys that state and the URL alone cannot rebuild it, so unmatched slots need a documented fallback. Through Next.js 15 a missing fallback meant a 404 at runtime. In Next.js 16 it means the build fails.**

## The quote that governs this page

> *"## Parallel Routes `default.js` requirement*
> *All parallel route slots now require explicit `default.js` files. Builds will fail without them.*
> *To maintain previous behavior, create a `default.js` file that calls `notFound()` or returns `null`."*
> — [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16#parallel-routes-defaultjs-requirement) (`lastUpdated: 2026-08-25`)

Both documented bodies, verbatim from the same section:

```tsx title="app/@modal/default.tsx"
import { notFound } from 'next/navigation'

export default function Default() {
  notFound()
}
```

Or return `null`:

```tsx title="app/@modal/default.tsx"
export default function Default() {
  return null
}
```

Pick by intent. `notFound()` reproduces the pre-16 behaviour — the URL genuinely is not a valid state for this slot. `return null` says the slot is simply absent in this state, which is what you want for a modal slot: the modal is not open, and that is not an error.

## Why the file exists at all

> *"The `default.js` file is used to render a fallback within Parallel Routes when Next.js cannot recover a slot's active state after a full-page load."*

> *"During soft navigation, Next.js keeps track of the active *state* (subpage) for each slot. However, for hard navigations (full-page load), Next.js cannot recover the active state. In this case, a `default.js` file can be rendered for subpages that don't match the current URL."*
> — [`default.js`](https://nextjs.org/docs/app/api-reference/file-conventions/default)

The worked example the docs use: `@team` has a `settings` page, `@analytics` does not.

> *"When navigating to `/settings`, the `@team` slot will render the `settings` page while maintaining the currently active page for the `@analytics` slot."*
> *"On refresh, Next.js will render a `default.js` for `@analytics`."*

That asymmetry is the entire mechanism. A soft navigation is a *diff* applied to router state that already knows what every slot was showing. A hard navigation has only the URL — and the URL says nothing about `@analytics`, because slot names are not in the URL.

## `children` needs one too

> *"Additionally, since `children` is an implicit slot, you also need to create a `default.js` file to render a fallback for `children` when Next.js cannot recover the active state of the parent page. If you don't create a `default.js` for the `children` slot, it will return a 404 page for the route."*

So in a segment with slots, the `default.js` audit is *n + 1* files: one per `@slot`, plus one for `children` at the same level.

```
app/dashboard/
├── layout.tsx
├── page.tsx
├── default.tsx        ← the implicit children slot
├── @team/
│   ├── page.tsx
│   └── default.tsx
└── @analytics/
    ├── page.tsx
    └── default.tsx
```

## The props it takes

> *"`params` (optional): A promise that resolves to an object containing the dynamic route parameters from the root segment down to the slot's subpages."*

| Example | URL | `params` |
|---|---|---|
| `app/[artist]/@sidebar/default.js` | `/zack` | `Promise<{ artist: 'zack' }>` |
| `app/[artist]/[album]/@sidebar/default.js` | `/zack/next` | `Promise<{ artist: 'zack', album: 'next' }>` |

```tsx title="app/[artist]/@sidebar/default.tsx"
export default async function Default({
  params,
}: {
  params: Promise<{ artist: string }>
}) {
  const { artist } = await params
  return <p>Nothing selected for {artist}.</p>
}
```

Like every other `params` in Next.js 16, it is a promise and only a promise.

## ⚠️ The documentation contradicts itself, and here is exactly how

Three pages, three statements, all live at 16.3.4:

| Page | `lastUpdated` | What it says happens without `default.js` |
|---|---|---|
| [Upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16#parallel-routes-defaultjs-requirement) | 2026-08-25 | *"Builds will fail without them."* |
| [`default.js`](https://nextjs.org/docs/app/api-reference/file-conventions/default) | 2025-10-09 | *"an error is returned for named slots (`@team`, `@analytics`, etc) and requires you to define a `default.js` in order to continue"* — and for `children`, *"it will return a 404 page for the route"* |
| [Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#defaultjs) | 2026-08-25 | *"On refresh, Next.js will render a `default.js` for `@analytics`. If `default.js` doesn't exist, a `404` is rendered instead."* |

The upgrade guide is the one to act on: it is the document that describes the version-16 change, it is current, and its instruction (*"To maintain previous behavior, create a `default.js` file that calls `notFound()` or returns `null`"*) only makes sense if the old 404 behaviour is no longer what you get by default. The `default.js` reference agrees in substance for named slots — *"an error is returned … and requires you to define a `default.js` in order to continue"*.

The Parallel Routes page's *"a `404` is rendered instead"* appears to be a surviving pre-16 sentence. **I could not confirm from the documentation whether it is stale or describes a narrower runtime case**, so treat it as unreliable rather than as a second opinion. Either way the action is identical and cheap: write the files.

## The upgrade checklist

```bash
# every slot folder in the app
find app -type d -name '@*'
```

For each result, ensure a `default.tsx` sits inside it; then add one beside every `page.tsx` that shares a segment with slots, for the implicit `children` slot. A modal slot wants `null`; a content slot that has no meaningful empty state wants `notFound()`.

## Gotchas

**★ Symptom: `next build` fails after upgrading 15 → 16, pointing at a parallel route.** Cause: a slot with no `default.js`. In 16 this is a build-time requirement, not a runtime fallback. Fix — the four-line file, in every `@slot` folder:

```tsx title="app/@modal/default.tsx"
export default function Default() {
  return null
}
```

**★ Symptom: you added `default.tsx` to every `@slot` and the build still fails — or a route 404s on refresh.** Cause: the implicit `children` slot was missed. `children` is a slot and needs its own `default.js` in the same segment. Fix:

```tsx title="app/dashboard/default.tsx"
export default function Default() {
  return null
}
```

**★ Symptom: the modal is open, the user hits refresh, and the modal is still there over a blank page — or the app 404s.** Cause: the `@modal` slot has no `default.js`, or it has one that renders the modal. On a hard load the slot cannot recover its state and falls back to `default.js`. Fix — the modal slot's default must be `null`, so a refresh lands on the real page:

```tsx title="app/@modal/default.tsx"
export default function Default() {
  return null
}
```

**Symptom: you added `default.tsx` returning `null` and now an invalid URL silently renders an empty region instead of 404ing.** Cause: `null` is the "absent, and that is fine" answer. Fix — for slots where an unmatched state is genuinely an error, use the other documented body:

```tsx title="app/@team/default.tsx"
import { notFound } from 'next/navigation'

export default function Default() {
  notFound()
}
```

**Symptom: `default.tsx` destructures `params` synchronously and throws.** Cause: `params` in `default.js` is one of the APIs whose synchronous access version 16 removed. Fix — `await` it, exactly as in a page.

**Symptom: your `default.tsx` renders the same thing as `page.tsx` and the panel never appears empty.** Cause: copying `page.tsx` into `default.tsx` to silence the build error. It silences it and then produces a subtly wrong UI — a refresh shows the slot's landing content where the user had navigated elsewhere. Fix — decide the empty state deliberately; `null` or `notFound()` are the documented choices, and a purpose-built empty state is the third.

**Symptom: a soft navigation shows a slot's old subpage even though the URL changed.** Cause: documented and intentional — a soft navigation *"maintains the other slot's active subpages, even if they don't match the current URL"*. Fix — if a slot must clear when the URL leaves its territory, give it a catch-all subpage that renders `null`, the technique the modal pattern uses. See [02d](02d-intercepting-routes-and-the-modal-pattern.md).

## Interview questions

**★ Why does `default.js` exist at all?**
Because slot names are not in the URL, so the URL is not a complete description of the UI state. The router keeps each slot's active subpage in client state and applies navigations as a diff. A full page load throws that state away, and the incoming URL cannot say what `@analytics` was showing — so for every slot that does not match the current URL, Next.js needs something to render. `default.js` is that something.

**★ What changed about `default.js` in Next.js 16?**
It went from optional to mandatory. The upgrade guide states it plainly: *"All parallel route slots now require explicit `default.js` files. Builds will fail without them."* Previously a missing file produced a 404 at runtime for the unmatched slot. The migration is mechanical — add a `default.js` that calls `notFound()` to preserve the old behaviour, or one that returns `null` where absence is a legitimate state — but it is a build-stopper on an app that has been using parallel routes since 15, and the implicit `children` slot is the one people forget.

**★ Which slots need a `default.js` — and how many files is that for a segment with two slots?**
Three. One for each `@slot`, plus one for the implicit `children` slot, which the docs describe as needing its own fallback *"when Next.js cannot recover the active state of the parent page"* and warn will otherwise *"return a 404 page for the route"*.

**★ For a modal implemented with a `@modal` slot, should `default.js` return `null` or call `notFound()`?**
`null`. The whole point of the modal pattern is that a shared URL, or a refresh while the modal is open, should land on the real standalone page rather than the modal — so on a hard load the modal slot must render nothing, letting `children` render the actual page. `notFound()` would turn a perfectly valid deep link into a 404. Use `notFound()` in the other direction: for a content slot where an unmatched URL really is a broken state.

**The Parallel Routes reference says a missing `default.js` renders a 404, and the upgrade guide says the build fails. Which is right?**
The upgrade guide, because it is the document that describes the version-16 change and is current as of 2026-08-25, and because its own remediation advice — "to maintain previous behavior, create a `default.js` that calls `notFound()`" — is only coherent if the previous 404 behaviour is gone. The `default.js` reference agrees for named slots, saying an error is returned and a file is required to continue. The Parallel Routes sentence looks like surviving pre-16 text; it is not worth relying on either way, since the remedy is the same and costs four lines per slot.

**How would you audit an existing codebase for this before upgrading?**
List every slot folder — `find app -type d -name '@*'` — and check for a `default` file in each; then, for every segment that contains a slot folder, check for a `default` file beside its `page`. Both halves matter, because the `children` slot has no `@` folder to find. Fixing them all before the upgrade turns a hard build failure into a no-op.

---

← [02b · Parallel routes](02b-parallel-routes-and-named-slots.md) · [Chapter 2 overview](01-explanation.md) · Next → [02d · Intercepting routes and the modal pattern](02d-intercepting-routes-and-the-modal-pattern.md)
