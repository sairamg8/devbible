---
title: "Avatars and attachments are the two places SprintDesk hands a URL it does not control to an image optimizer running on its own server — and the scripts pass is where every third-party tag has to justify both its strategy and its route"
sidebar_label: "06b · Avatars, attachments, scripts"
sidebar_position: 13
description: "The chapter 9 milestone, part two — user avatars and attachment previews through next/image with a narrow remotePatterns allow-list, the header-forwarding trap for authenticated files, the third-party scripts pass, and the acceptance criteria and phase gate."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [Image component API reference](https://nextjs.org/docs/app/api-reference/components/image) (sections `#remotepatterns`, `#sizes`, `#placeholder`, `#blurdataurl`, `#unoptimized`, `#preload`) and the [`<Script>` API reference](https://nextjs.org/docs/app/api-reference/components/script) (`lastUpdated: 2026-08-25`).
> Version spine: **Next.js 16.3.4** · React 19.2.8 · Node 20.9 floor. `next` is **not installed in this checkout**; documentation-verified only, **no sandbox run**, no byte counts and no timings.

**SprintDesk's two image cases look similar and are not. An avatar is small, fixed-size, repeated forty times on a board and never the largest element on screen. An attachment preview is large, variable, sometimes the thing the user opened the page to see, and — unlike the avatar — frequently protected. What they share is the property that makes this section a security topic rather than a styling one: both take a URL that originated outside your codebase and hand it to a decoder running on your server. `remotePatterns` is the control for that, and [04d](04d-remote-patterns-is-a-security-control.md) is why. This page finishes the milestone with those two components, the third-party scripts pass, and the acceptance criteria that say whether the chapter's work actually landed.**

## Avatars

Remote, user-supplied, and small. Three facts from the API reference decide the component's shape.

**Dimensions are mandatory for remote images.** The reference is explicit that you *"must set both `width` and `height` properties unless"* the image is statically imported or uses `fill`, and for remote sources specifically: *"Since Next.js does not have access to remote files during the build process, you'll need to provide the `width`, `height` and optional `blurDataURL` props manually."* An avatar has a design size, so this costs nothing.

**No preload.** 🔴 Note that the prop for this is no longer `priority` — the reference states that *"[s]tarting with Next.js 16, the `priority` property has been deprecated in favor of the `preload` property in order to make the behavior clear"*, which is the finding [04b](04b-loading-priority-preload-eager-fetchpriority.md) is built on. Either way an avatar does not get it: forty preloaded avatars is forty requests competing with the content.

**No blur.** `placeholder` defaults to `empty`, and `blur` *"[m]ust be used with the `blurDataURL` property"*, which for a remote image you have to supply yourself. A 40-pixel square does not earn that round trip — see [04c](04c-blur-placeholders-where-the-bytes-come-from.md) for where blur does earn it.

```tsx
// app/components/avatar.tsx — a Server Component; nothing here needs the client
import Image from 'next/image'

export function Avatar({ user, size = 40 }: { user: { name: string; avatarUrl: string }; size?: number }) {
  return (
    <Image
      src={user.avatarUrl}
      alt={user.name}
      width={size}
      height={size}
      className="sd-avatar"
    />
  )
}
```

```css
/* app/globals.css, continued */
.sd-avatar {
  border-radius: 9999px;
  border: 1px solid var(--sd-border);
  background: var(--sd-surface);
}
```

The `alt` is the member's name, not `"avatar"` — the image *is* the person in this UI, and a screen reader announcing "avatar" forty times conveys nothing.

## The allow-list, written narrowly

Avatars live on a storage host, and that host now has to be named in `next.config.js` or every request will fail. The temptation is to name the hostname and stop. The reference is unusually direct about why that is wrong:

> *"When omitting `protocol`, `port`, `pathname`, or `search` then the wildcard `**` is implied. This is not recommended because it may allow malicious actors to optimize urls you did not intend."*

```js
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.sprintdesk.dev',
        port: '',
        pathname: '/avatars/**',
        search: '',
      },
      {
        protocol: 'https',
        hostname: 'assets.sprintdesk.dev',
        port: '',
        pathname: '/attachments/**',
        search: '',
      },
    ],
  },
}
```

Two entries rather than one `/**`, because avatars and attachments have different lifecycles and one of them may later move. `search: ''` is the field people skip, and the docs give the reason to write it: *"Omitting the `search` property allows all search parameters which could allow malicious actors to optimize URLs you did not intend."* An unconstrained query string is an unbounded number of distinct cache keys for the same file.

🔴 **And the one that is not obvious from the config at all:**

> *"Note that any allowed `remotePatterns` that respond with a redirect will follow the redirect from the remote image server without validating `remotePatterns` again on the redirect location."*

If `assets.sprintdesk.dev` can be made to redirect, the allow-list stops applying at the redirect. `maximumRedirects` is the lever; [04d](04d-remote-patterns-is-a-security-control.md) is the full argument.

## Attachment previews, and the trap that only appears in production

Attachments are large, variably sized, and rendered inside a responsive container — which makes `sizes` load-bearing rather than optional:

> *"If `sizes` is missing, the browser assumes the image will be as wide as the viewport (`100vw`). This can cause unnecessarily large images to be downloaded."*

> *"In addition, `sizes` affects how `srcset` is generated: Without `sizes`: Next.js generates a limited `srcset` (e.g. 1x, 2x), suitable for fixed-size images. With `sizes`: Next.js generates a full `srcset` (e.g. 640w, 750w, etc.), optimized for responsive layouts."*

```tsx
// app/components/attachment-preview.tsx
import Image from 'next/image'

export function AttachmentPreview({ file }: { file: { url: string; name: string; contentType: string } }) {
  if (file.contentType === 'image/svg+xml') {
    return <Image src={file.url} alt={file.name} width={640} height={480} unoptimized />
  }

  return (
    <div className="sd-attachment">
      <Image
        src={file.url}
        alt={file.name}
        fill
        sizes="(max-width: 768px) 100vw, 640px"
        className="sd-attachment-img"
      />
    </div>
  )
}
```

```css
.sd-attachment {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 8px;
  background: var(--sd-surface);
}
.sd-attachment-img {
  object-fit: contain;
}
```

`fill` *"causes the image to expand to the size of the parent element"*, so the parent must be positioned and must have a size — the `aspect-ratio` is what reserves the space and stops the layout shifting when the file loads.

The SVG branch is not defensive coding; it is the documented recommendation: *"We recommend using the `unoptimized` prop when the `src` prop is known to be SVG. This happens automatically when `src` ends with `\".svg\"`."* SprintDesk's attachment URLs are opaque identifiers rather than filenames, so the automatic case does not apply and the content type has to be checked explicitly.

### 🔴 Authenticated attachments break the optimizer, silently in the wrong environment

> *"For security reasons, the Image Optimization API using the default loader will **not** forward headers when fetching the `src` image. If the `src` image requires authentication, consider using the `unoptimized` property to disable Image Optimization."*

This is the trap in this milestone that costs the most time, because it does not reproduce until attachments are actually protected — which, in SprintDesk, happens in [chapter 10](../10-forms-authentication-and-security-hardening/06-project-milestone-sprintdesk-auth-authjs.md), a chapter after the code was written. The optimizer fetches the URL server-side with none of the browser's cookies or `Authorization` header, so a protected file comes back `401` and the image is broken for everyone.

Two workable answers, and one that is not:

| Approach | Works | Cost |
|---|---|---|
| Signed URL with a short-lived token in the path or query | ✓ | The signature must satisfy `remotePatterns` — a token in the query means `search: ''` cannot be used |
| `unoptimized` for protected files | ✓ | No resizing, no format negotiation; the original bytes are served |
| Relying on the optimizer to pass the session cookie | ✗ | Documented as not happening, for security reasons |

Take the signed URL for attachments people actually look at, and `unoptimized` for the long tail. Decide it now rather than in chapter 10, because the choice changes the `remotePatterns` entry above.

## The scripts pass

Four third-party or inline scripts, each with a written justification. This table is the deliverable — a `<Script>` whose strategy nobody can explain is the thing this chapter exists to prevent.

| Script | Strategy | Where | Why |
|---|---|---|---|
| Theme initialiser (inline) | `beforeInteractive` | `app/layout.tsx` | Must set the attribute before first paint; see [06](06-project-milestone-sprintdesk-design-system-pass.md) |
| Consent manager | `beforeInteractive` | `app/layout.tsx` | Must be authoritative before anything reads a cookie; a documented use for the strategy |
| Product analytics | `afterInteractive` (default) | `app/(marketing)/layout.tsx` | Wanted early, not before first-party code; **not** on authenticated routes |
| Support chat | `lazyOnload` | `app/(marketing)/layout.tsx` | Idle-time work, with an `onError` fallback to a `mailto:` |

Two rules from [05c](05c-inline-scripts-attribute-forwarding-and-where-the-tag-belongs.md) are doing the real work in that table. Analytics and chat are in the marketing layout rather than the root layout, so the board — the page users spend their day on — loads neither. And the support chat has an error path, because a chat widget removed by an ad blocker is otherwise an empty panel with no fallback.

```tsx
// app/(marketing)/layout.tsx
import Script from 'next/script'
import { SupportChat } from '@/app/components/support-chat'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script src="https://cdn.example-analytics.com/tag.js" strategy="afterInteractive" />
      <SupportChat />
    </>
  )
}
```

`SupportChat` is the Client Component from [05b](05b-onload-onready-onerror-and-the-client-component-boundary.md) — it exists as a separate file for one reason, which is that `onError` cannot be attached from a Server Component.

## Acceptance criteria

The milestone is done when all of these hold. Each maps to a specific mechanism in this chapter rather than to an impression.

- [ ] `grep -rn "next/font" app/ lib/` returns exactly one file — `lib/fonts.ts`.
- [ ] `grep -rn "@import 'tailwindcss'" app/` returns exactly one file, imported only by the root layout.
- [ ] Every `remotePatterns` entry names `protocol`, `hostname`, `port`, `pathname` **and** `search`. No entry omits a field.
- [ ] No `<Image>` with a remote `src` is missing `width`/`height` or `fill`.
- [ ] Every `fill` image has a `sizes` value and a positioned parent with a reserved aspect ratio.
- [ ] Every inline `<Script>` has an `id`, and no inline script body interpolates a value.
- [ ] Each `<Script>` in the codebase can be matched to a row of the strategy table above, including the route it is scoped to.
- [ ] No `<Script>` sits in `app/layout.tsx` unless it must run before first paint.
- [ ] Reloading a dark-themed page shows no light flash, and `<html>` carries `suppressHydrationWarning` and nothing else does.
- [ ] Toggling the theme changes every surface, including CSS Module components and any runtime-injected styles.
- [ ] Blocking the analytics hostname in the browser leaves the site fully functional, and the chat widget falls back to a `mailto:`.
- [ ] The decision for protected attachments — signed URL or `unoptimized` — is written down, and the `remotePatterns` entry matches it.

## Phase gate

You are done with this chapter when you can take an unfamiliar App Router codebase, open its root layout, and say for each of the four things in it — the global stylesheet import, the font className, the inline script and any third-party tag — which routes pay for it, when it executes relative to hydration, and what would break if it moved one level down the tree. If you can only answer that for the font, the chapter is not finished.

## Gotchas

**★ Symptom: every avatar 400s in production and works locally.** Cause: the remote host is not in `remotePatterns`, or is there with a `pathname` that does not match — the docs state that *"[a]ny other protocol, hostname, port, or unmatched path will respond with `400` Bad Request."* Fix: add the entry with every field written out, and match the path prefix the storage host actually serves:

```js
{ protocol: 'https', hostname: 'assets.sprintdesk.dev', port: '', pathname: '/avatars/**', search: '' }
```

**★ Symptom: attachment previews download multi-megabyte originals on mobile.** Cause: a `fill` image with no `sizes`, so *"the browser assumes the image will be as wide as the viewport (`100vw`)"* and Next generates only a limited `srcset`. Fix: declare the real layout width at each breakpoint:

```tsx
<Image src={file.url} alt={file.name} fill sizes="(max-width: 768px) 100vw, 640px" />
```

**★ Symptom: protected attachments render as broken images after auth ships, and nothing changed in the image code.** Cause: the optimizer *"will not forward headers when fetching the `src` image"*, so the server-side fetch is unauthenticated. Fix: serve a signed URL, or opt the file out of optimization entirely:

```tsx
<Image src={file.url} alt={file.name} width={640} height={480} unoptimized />
```

**★ Symptom: an SVG attachment renders blank or distorted.** Cause: SVG is not a raster format and the optimizer is not the right tool for it; the docs recommend `unoptimized` when the source is known to be SVG, automatically only when the URL ends in `.svg`. Fix: branch on the content type, as in `AttachmentPreview` above — opaque attachment URLs never end in `.svg`, so the automatic case will not save you.

**★ Symptom: a code review asks why the board loads a chat widget and nobody can answer.** Cause: a `<Script>` was added to the root layout, which the docs describe as loading *"when any route in your application is accessed"*. Fix: move it to the layout of the area that offers it. This is the single highest-value line in the scripts pass and it is one line of diff.

**★ Symptom: the avatar list shifts as images arrive.** Cause: missing `width`/`height` on a remote image, so nothing reserves the box before the bytes land. Fix: the props are mandatory for remote sources precisely because the build cannot measure the file — pass the design size, which you know.

**Symptom: `priority` produces a deprecation warning.** Cause: *"Starting with Next.js 16, the `priority` property has been deprecated in favor of the `preload` property"*. Fix: rename it — and while you are there, check that the image deserves it at all. See [04b](04b-loading-priority-preload-eager-fetchpriority.md).

**Symptom: the same avatar is fetched under dozens of distinct optimizer URLs.** Cause: the storage host appends a cache-busting query string and `remotePatterns` omits `search`, so every variant is a separate cache key. Fix: pin it — `search: ''` for no query at all, or an exact value like `search: '?v=2'`, which the docs give as the way *"to ensure an exact match"*.

**Symptom: a redirect on the asset host serves an image from somewhere else entirely.** Cause: `remotePatterns` is not re-validated on the redirect target. Fix: reduce redirects at the source and constrain `maximumRedirects`; treat any asset host that redirects as part of your trust boundary.

**Symptom: analytics fires on the login page.** Cause: the tag is in the root layout, not the marketing layout. Fix: the same one-line move as the chat widget — and it is worth grepping for it as a habit, because tags migrate upward over time as people add them to whatever file is open.

## Interview questions

**★ Why is `remotePatterns` a security control rather than a convenience?**
Because it decides whose bytes reach a native image decoder running on your server. Every field you leave out is an implied `**` — the docs say so and say it is not recommended — so a config naming only a hostname permits any protocol, port, path and query on that host, which on a shared or multi-tenant storage host is a much larger surface than intended. The sharpest edge is that a permitted host's redirect is followed *without re-validating the patterns*, so the allow-list stops applying at the redirect.

**★ An authenticated attachment renders as a broken image. Walk through the diagnosis.**
Start from where the fetch happens. The optimizer requests `src` from your server, not from the browser, and the documentation states it will not forward headers for security reasons — so no cookie, no `Authorization`, and a `401` from the storage host. The tell is that the file loads fine when you paste its URL into a browser tab, which sends everyone looking at the storage host instead of the optimizer. The fixes are a signed URL or `unoptimized`; there is no option that makes the optimizer authenticate, and that is deliberate.

**★ Why do avatars get no preload and no blur placeholder, when both are optimisations?**
Because both are *scarce* optimisations. Preload — the prop that replaced `priority` in Next.js 16 — is a claim on early bandwidth, and forty simultaneous claims mean none of them is a priority. A blur placeholder for a remote image requires a `blurDataURL` you generate and ship yourself, and the docs warn that a large one hurts performance; for a 40-pixel square there is nothing meaningful to hide. Both belong to the one large image the user came to see, which on a board page is an attachment, not a face.

**★ Why are analytics and chat in the marketing layout rather than the root layout?**
Because a root-layout script loads on every route in the application, and the routes users spend their time on are the authenticated ones — where neither script has a job. Moving them down means the board never downloads, parses or executes either. It is also the documentation's own recommendation: include third-party scripts only in the specific pages or layouts that need them. The cost is that a marketing-to-app navigation and an app-to-marketing navigation now behave differently, which is worth knowing but is not a defect.

**★ Which single file in this milestone is the most dangerous, and why?**
`app/layout.tsx`. It holds the global stylesheet import, the font className, the theme initialiser and any `beforeInteractive` tag — four things with four different scoping rules, all in a file whose diff looks trivial. Anything added there is added to every route, including ones that do not exist yet, and nothing in the file signals that. The reason the milestone puts the font loader in `lib/fonts.ts` and the analytics tag in a nested layout is to keep this file as short as it can be.

**Why write `search: ''` when the URLs have no query string today?**
Because "today" is doing the work in that sentence. Omitting the field implies `**`, so the first time the storage host starts appending a cache-buster — or an attacker appends one — every variant is an accepted, separately-cached optimizer request for the same file. Writing the empty value costs nothing and converts a future silent change into an immediate `400` that someone will notice.

**The design looks right and the Lighthouse score did not move. What did this milestone actually buy?**
Mostly correctness and boundaries rather than a number, and the measurement belongs to chapter 11 anyway. What changed materially: authenticated routes no longer load two third-party scripts, the theme no longer flashes, images reserve their space so layout shift has one fewer cause, and the optimizer accepts a narrow list of URLs instead of a hostname. Some of that shows up in a score and some of it only shows up as an incident that did not happen.

**What in this milestone will break first when chapter 10 adds authentication?**
Attachment previews, for the header-forwarding reason above — and it will break after the image code has been reviewed and merged, which is what makes it worth deciding now. The second thing is the CSP: every inline script added here needs a nonce or a hash to survive a strict policy, which is why 05c keeps inline bodies constant and passes data as attributes. Both are predictable from this chapter and neither is visible from within it.

---

← [06 · Milestone: design system pass](06-project-milestone-sprintdesk-design-system-pass.md) · [Chapter index](01-explanation.md) · Next → [Chapter 10 · Forms, auth and security hardening](../10-forms-authentication-and-security-hardening/01-explanation.md)
