---
title: "The manifest members that shape the install surface rather than the running app — and why the Next.js type is a suggestion, not a contract"
sidebar_label: "10c · Secondary manifest members and typing"
sidebar_position: 33
description: "screenshots, shortcuts, prefer_related_applications, orientation and categories, plus what MetadataRoute.Manifest does and does not enforce."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against MDN's
> [Web App Manifest members index](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)
> and [`prefer_related_applications`](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/prefer_related_applications),
> and the Next.js [`manifest.json` convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest).
> Target: **Next.js 16.3.4**, App Router.

**The seven members in [10b](10b-manifest-fields-that-change-behaviour.md) decide how the
installed app behaves. The ones here decide whether anyone installs it at all, and one of them
can switch installability off entirely from a single pasted line.** They get their own page
because they are the members people either skip (`screenshots`, and then wonder why the
install dialog is a thin bar) or copy blind from a native-app checklist
(`prefer_related_applications`, and then lose the prompt). The page closes on
`MetadataRoute.Manifest` — what that type is actually doing, which is less than you think.

## The ones that look decorative and are not

**`screenshots`.** On Android, Chromium promotes an install to a richer, more app-like dialog
when the manifest carries screenshots with appropriate `form_factor` values. Without them you
get the small bar. This is the cheapest install-conversion change available and the one nobody
ships.

```ts title="app/manifest.ts (excerpt)"
screenshots: [
  {
    src: '/screenshots/board-mobile.png',
    sizes: '540x720',
    type: 'image/png',
    form_factor: 'narrow',
    label: 'Sprint board on mobile',
  },
  {
    src: '/screenshots/board-desktop.png',
    sizes: '1280x800',
    type: 'image/png',
    form_factor: 'wide',
    label: 'Sprint board on desktop',
  },
],
```

**`shortcuts`.** Long-press / right-click menu entries on the installed icon. Each has a
`url` that must be inside [`scope`](10b-manifest-fields-that-change-behaviour.md), and its own
`icons`. Good for the two or three actions that are genuinely the reason someone installed the
thing — not a second navigation menu.

```ts title="app/manifest.ts (excerpt)"
shortcuts: [
  {
    name: 'Start a new sprint',
    short_name: 'New sprint',
    url: '/sprints/new',
    icons: [{ src: '/icons/shortcut-new-sprint.png', sizes: '96x96', type: 'image/png' }],
  },
  {
    name: 'Today’s standup',
    short_name: 'Standup',
    url: '/standup',
    icons: [{ src: '/icons/shortcut-standup.png', sizes: '96x96', type: 'image/png' }],
  },
],
```

Shortcut icons are their own asset set — the manifest `icons[]` are not reused for them, and
an entry with no `icons` renders with a platform default.

**`prefer_related_applications`.** This one is a trap in reverse. Setting it to `true` tells
browsers to promote a native app from `related_applications` *instead of* your web app — and
MDN is explicit that for Chromium it must be `false` or omitted for your web app to be
installable at all. If a native-app team hands you a manifest fragment to paste in, read this
line before you paste.

**`orientation`.** A hint, honoured mainly in installed windows on mobile. `'any'` unless you
have a real reason; locking orientation in a productivity app is a way to annoy tablet users.

**`categories`, `description`, `lang`, `dir`.** Store-listing metadata. Harmless. MDN notes
`dir` and `lang` are not implemented, so do not build anything on them.

## The Next.js type may lag the spec

`MetadataRoute.Manifest` is a TypeScript constraint, nothing more — the object you return is
serialised to JSON as written. Newer manifest members (`launch_handler`, `scope_extensions`,
`note_taking`, `file_handlers`) may not be in the shipped type on any given release. The
docs' own guidance for the full field list is to inspect `MetadataRoute.Manifest` in your
editor rather than trust a doc table, which is a polite way of saying it moves.

When you need a member the type does not know about, widen at the return, do not fight it:

```ts title="app/manifest.ts"
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SprintDesk',
    short_name: 'SprintDesk',
    start_url: '/board',
    scope: '/',
    display: 'standalone',
    // Not necessarily present in the shipped Manifest type; emitted verbatim regardless.
    launch_handler: { client_mode: 'navigate-existing' },
  } as MetadataRoute.Manifest
}
```

Use the cast on the *whole object* only where you must, and add a comment naming the member
that forced it — otherwise the cast silently swallows a typo in `start_url` six months later.

## Gotchas

### `prefer_related_applications: true` copied from a native-app checklist
**Symptom.** The app stops being installable in Chromium. No error anywhere.
**Cause.** That member tells the browser to promote an entry from `related_applications`
rather than your web app. MDN states it must be `false` or omitted for a Chromium install to
be offered.
**Fix.** Omit it. Keep `related_applications` if you want the *option* discoverable, but leave
the preference alone:

```ts title="app/manifest.ts (excerpt)"
related_applications: [
  { platform: 'play', id: 'com.example.sprintdesk' },
],
// prefer_related_applications: intentionally omitted — setting it true
// suppresses the web install prompt.
```

### A `shortcuts` entry points outside `scope`
**Symptom.** Tapping a shortcut on the installed icon opens the system browser instead of the
app window.
**Cause.** Shortcut URLs are subject to the same scope rule as everything else. A `scope` of
`/board/` with a shortcut to `/settings` is an out-of-scope navigation by definition.
**Fix.** `scope: '/'` and shortcut URLs under it; or narrow the shortcuts, not the scope.

### `screenshots` with no `form_factor`
**Symptom.** You added screenshots and the install dialog did not get richer.
**Cause.** Chromium's richer install UI is selected per form factor; entries without
`form_factor` are not matched to the surface being shown.
**Fix.** Ship at least one `'narrow'` and one `'wide'` entry, as in the snippet above, with
real dimensions in `sizes` that match the actual PNGs.

### The `as MetadataRoute.Manifest` cast hides a typo
**Symptom.** A manifest that type-checks and does nothing — wrong `start_url`, a missing
`icons` array, `dispaly` instead of `display`.
**Cause.** A whole-object cast added to smuggle in one unsupported member disables checking
for every other member too.
**Fix.** Keep the typed return and attach the extra member separately, so the rest stays
checked:

```ts title="app/manifest.ts"
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  const base: MetadataRoute.Manifest = {
    id: '/',
    name: 'SprintDesk',
    short_name: 'SprintDesk',
    start_url: '/board',
    scope: '/',
    display: 'standalone',
    icons: [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
  }
  // Only this member escapes the type.
  return { ...base, launch_handler: { client_mode: 'navigate-existing' } }
}
```


## Interview questions

**What does `prefer_related_applications` do, and why is it dangerous?**
It tells the browser to prefer installing a native app listed in `related_applications` over
your web app. MDN states that for Chromium it must be `false` or omitted for the web app to be
installable, so a stray `true` — usually pasted in from a native-app integration checklist —
removes your install prompt with no diagnostic anywhere.

**How do you get the richer Android install dialog instead of the small bar?**
Ship `screenshots` in the manifest with `form_factor` set — at minimum one `'narrow'` for
phones and one `'wide'` for desktop — alongside correct `sizes` and a `label`. It is the
highest-leverage manifest edit for install conversion and almost nobody does it.

**A shortcut on the installed icon opens the browser rather than the app. Why?**
Its `url` is outside `scope`. Shortcuts obey the same scope boundary as ordinary navigation,
and `scope` is inferred from `start_url` when omitted — so a `start_url` of `/board` quietly
narrows scope to `/board/` and puts `/settings` outside it.

**What is `MetadataRoute.Manifest` actually enforcing?**
Nothing at runtime. It is a compile-time shape; the returned object is serialised verbatim.
That means new spec members can be emitted before the type knows about them, and it also means
a type-level cast to smuggle one in silently disables checking on everything else — spread a
typed base object instead of casting the whole return.

---

← [Manifest fields that change behaviour](10b-manifest-fields-that-change-behaviour.md) · [Chapter 12 overview](01-explanation.md) · Next → [Installability and the install prompt](10d-installability-and-the-install-prompt.md)
