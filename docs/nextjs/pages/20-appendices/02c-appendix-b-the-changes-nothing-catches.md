---
title: "Appendix B · part 3 — the 15 → 16 changes nothing catches: six image defaults that moved, a rename that changes your runtime, and the metrics that quietly stopped existing"
sidebar_label: "06 · Appendix B — the changes nothing catches"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`), [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag), [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag) and [`refresh`](https://nextjs.org/docs/app/api-reference/functions/refresh).
> Target: **Next.js 16.3.4** · Turbopack default. Documentation-verified; **no sandbox run, no timings**.

**[Part 2](02b-appendix-b-the-15-to-16-migration-mechanically.md) covered everything the build stops you on. Those are the cheap changes: you cannot ship them by accident. This page is the expensive half — the changes that build clean, pass your tests, and behave differently in front of a user. Six `next/image` defaults moved, one of them coercing silently rather than erroring. A codemod-driven rename can move your proxy onto a runtime you did not choose. Two build metrics stopped existing, which means any CI gate parsing them now passes vacuously. There is no tooling that finds these; there is only knowing the list.**

## Category 3 — behaviour changed and nothing tells you

🔴 **This is the short list that matters.** Every item here builds clean, passes tests, and behaves differently.

**`images.minimumCacheTTL`: 60 seconds → 4 hours.** The reasoning is stated — *"For some Next.js users, image revalidation was happening frequently, often because the upstream source images missed a `cache-control` header"* — and the consequence is that an image you replace at the same URL can now be stale for four hours instead of one minute.

**`images.qualities`: everything → `[75]` only.** And it does not error:

> *"If you specify a `quality` prop not included in the `image.qualities` array, the quality will be coerced to the closest value in `images.qualities`."*

So `quality={90}` silently becomes 75. Your images get smaller and slightly worse, and nothing in the build says so.

**`16` removed from default `images.imageSizes`.** Smaller `srcset` attributes; only matters if you genuinely served 16px images.

**`images.maximumRedirects`: unlimited → 3.** A remote image behind four redirects stops resolving.

**Local IP optimization is blocked.** *"A new security restriction blocks local IP optimization by default."* The symptom is a `400 Bad Request`, and the escape is `images.dangerouslyAllowLocalIP` — named to make you think, and the docs add: *"Only enable once you understand the SSRF risk."*

**Local images with query strings now need config.** `<Image src="/assets/photo?v=1" …/>` requires an `images.localPatterns` entry with a matching `search`, *"to prevent enumeration attacks."*

**Scroll behaviour is no longer overridden.** If you set `scroll-behavior: smooth` globally, Next.js used to force `auto` during route transitions so navigation felt instant. It no longer does. To get the old behaviour back you opt in with an attribute:

```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  )
}
```

**`process.argv` no longer contains `'dev'` during `next dev`.** The config file used to be loaded twice; it is not any more.

> *"A consequence of this change is that, when running `next dev` checking if `process.argv` includes `'dev'`, in your Next.js config file, will return `false`."*

`typegen` and `build` are still visible. The documented replacement is `NODE_ENV`:

```js
// next.config.js
const isDev = process.env.NODE_ENV === 'development'
if (isDev) {
  startServer()
}
```

**`size` and `First Load JS` are gone from `next build` output.** Not a behaviour change in the app, but a change in what you can measure — and if a dashboard or a CI budget parses that output, it now parses nothing.

> *"We found these to be inaccurate in server-driven architectures using React Server Components. Both our Turbopack and Webpack implementations had issues, and disagreed on how to account for Client Components payload."*

The documented alternative is field measurement: Lighthouse, or Core Web Vitals via analytics.

## Category 4 — renamed, with a consequence attached

**`middleware` → `proxy`.** The rename is mechanical — the codemod does the file, the named export and the config flags (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`). The consequence is not:

> *"The `edge` runtime is **NOT** supported in `proxy`. The `proxy` runtime is `nodejs`, and it cannot be configured. If you want to continue using the `edge` runtime, keep using `middleware`. We will follow up on a minor release with further `edge` runtime instructions."*

🔴 **So the codemod can move you onto a runtime you did not choose.** If your middleware relied on edge-runtime characteristics, review that file by hand rather than accepting the transform.

**`cacheLife` and `cacheTag` lost `unstable_`.** Drop the aliased imports:

```ts
// Before
import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from 'next/cache'
// After
import { cacheLife, cacheTag } from 'next/cache'
```

**`experimental.turbopack` → top-level `turbopack`.**

## Category 5 — new APIs you should adopt during the migration, not after

`updateTag` and `refresh` are additions, and the migration is the natural moment to use them because the `revalidateTag` signature change already sends you to every call site.

> `updateTag` is *"a new Server Actions-only API that provides **read-your-writes** semantics, where a user makes a change and the UI immediately shows the change, rather than stale data. It does this by expiring and immediately refreshing data within the same request."*

```ts
'use server'
import { updateTag } from 'next/cache'

export async function updateUserProfile(userId: string, profile: Profile) {
  await db.users.update(userId, profile)
  updateTag(`user-${userId}`) // the user sees their own change immediately
}
```

Against `revalidateTag`, which is stale-while-revalidate and right for *"blog posts, product catalogs, or documentation"* — content where *"a slight delay in updates is acceptable."*

And `refresh`, for the case where the mutation changes something the current page displays but did not touch:

```ts
'use server'
import { refresh } from 'next/cache'

export async function markNotificationAsRead(notificationId: string) {
  await db.notifications.markAsRead(notificationId)
  refresh() // update the unread count in the header
}
```

## Gotchas

**★ Symptom: images look slightly softer after the upgrade and no config changed.** Cause: `images.qualities` now defaults to `[75]`, and a `quality` prop outside the array is silently coerced to the nearest allowed value rather than erroring. Fix: declare the qualities you actually use.

```ts
const nextConfig = { images: { qualities: [50, 75, 100] } }
export default nextConfig
```

**★ Symptom: you replace a logo at the same URL and it stays stale all afternoon.** Cause: `images.minimumCacheTTL` went from 60 seconds to 4 hours. Fix: either version the URL, or restore the old TTL knowingly — `images: { minimumCacheTTL: 60 }` — accepting the revalidation cost the new default was chosen to avoid.

**★ Symptom: a remote image 404s in production and loads fine when you paste the URL in a browser.** Cause: `images.maximumRedirects` is now 3, and the browser follows more. Fix: shorten the redirect chain at the source, or raise the limit deliberately: `images: { maximumRedirects: 5 }`.

**★ Symptom: image optimization returns `400 Bad Request` inside a VPC.** Cause: local IP optimization is blocked by default as a security restriction. Fix: `images: { dangerouslyAllowLocalIP: true }` — and only after reading the SSRF warning the docs attach to it, because the flag is named the way it is on purpose.

**★ Symptom: navigation feels sluggish after the upgrade on a site with `scroll-behavior: smooth`.** Cause: Next.js no longer overrides it during route transitions, so every navigation now animates the scroll to top. Fix: opt back in with `<html data-scroll-behavior="smooth">`, which restores the previous behaviour explicitly.

**★ Symptom: a `next.config` side effect stops firing in dev.** Cause: the config is no longer loaded twice, so `process.argv.includes('dev')` is `false`. Fix: switch the guard to `process.env.NODE_ENV === 'development'`, or use the config `phase`. Note `typegen` and `build` are still visible in `argv`, so a partial fix will look like it worked.

**★ Symptom: your bundle-size CI gate stopped failing and nobody noticed for a month.** Cause: `size` and `First Load JS` were removed from `next build` output, so the parser finds nothing and the gate passes vacuously. Fix: rebuild the gate on field data — Lighthouse in CI or Core Web Vitals from analytics — and delete the parser rather than leaving it green and meaningless.

**★ Symptom: after the codemod your proxy no longer has edge-runtime behaviour.** Cause: `proxy` is Node.js-only and cannot be configured otherwise; the codemod renamed the file regardless. Fix: if you genuinely needed edge, keep the `middleware` convention for now — the docs say a minor release will carry further instructions — and review that one file by hand rather than trusting the transform.

**★ Symptom: `<Image src="/assets/photo?v=1" …/>` stops rendering and the build says nothing.** Cause: local image sources with query strings now require an `images.localPatterns` entry with a matching `search`, added *"to prevent enumeration attacks."* Fix: declare the pattern, or drop the cache-busting query and version the filename instead — the second is usually the better answer anyway.

```ts
const nextConfig = {
  images: {
    localPatterns: [{ pathname: '/assets/**', search: '?v=1' }],
  },
}
export default nextConfig
```

**★ Symptom: retina images look right but a dense icon grid got blurrier.** Cause: `16` was dropped from the default `images.imageSizes` array, shrinking every `srcset`. The stated reasoning is that `devicePixelRatio: 2` fetches a 32px image for a 16px slot anyway. Fix: if you genuinely serve 16px sources, put the value back explicitly.

```ts
const nextConfig = {
  images: { imageSizes: [16, 32, 48, 64, 96, 128, 256, 384] },
}
export default nextConfig
```

**★ Symptom: a script that inspected `.next` after `next dev` now finds unfamiliar contents, or a stray lock complaint appears.** Cause: `next dev` and `next build` use separate output directories in 16 — dev writes to `.next/dev` — so they can run concurrently, and a lockfile prevents two instances of either on the same project. Fix: point any tooling at the specific directory rather than at `.next` as a whole, and treat the lock message as information rather than an error: it names the running server's URL and the PID.

**★ Symptom: the whole team upgraded fine and a slice of real users see a blank page.** Cause: the browser floor moved to Chrome/Edge/Firefox 111+ and Safari 16.4+. Nothing in your pipeline knows what your users run. Fix: check the floor against analytics *before* shipping. This is the only requirement in the upgrade that has no build-time signal at all, which is why it belongs on this page rather than with the version floors in [part 1](02-appendix-b-react-upgrade-blueprint-tracking-react-canary-nex.md).

**★ Symptom: Sass compiles differently after the upgrade and no Sass file changed.** Cause: `sass-loader` was bumped to v16, which supports the modern Sass API. Fix: nothing is broken by default, but deprecation output from the modern API can be new and noisy — read it rather than silencing it, because the legacy API it warns about is the one Turbopack's tilde behaviour also dropped.

## Interview questions

**★ Which 16 changes fail the build, and which ship to users?**
Building: removed synchronous Request APIs, missing parallel-route `default.js`, a `webpack()` config under the default Turbopack build, and single-argument `revalidateTag`. Shipping: every `next/image` default that moved — `minimumCacheTTL` to four hours, `qualities` to `[75]` with silent coercion, `maximumRedirects` to three, `imageSizes` dropping 16, local IPs blocked — plus the scroll-behaviour override going away and the browser floor rising to Chrome/Edge/Firefox 111 and Safari 16.4. That second list is the one to review by hand, because nothing in CI will raise it.

**★ Why is `quality={90}` more dangerous than an unsupported config key?**
Because an unsupported key errors and this does not. The default `images.qualities` is `[75]`, and a value outside the array is coerced to the nearest allowed one rather than rejected. So the build passes, the page renders, the images are subtly different, and there is no signal anywhere connecting the change to the upgrade. Silent coercion is worse than a hard failure precisely because it survives review.

**★ `revalidateTag` and `updateTag` both invalidate. When do you reach for each?**
`revalidateTag` marks data stale and serves the stale copy while it revalidates — right for content where a short delay is fine, and the docs name blog posts, product catalogs and documentation. `updateTag` is Server-Actions-only and gives read-your-writes: it expires and immediately refreshes within the same request, so a user who just saved a profile sees their own change rather than the previous value. The rule of thumb is whose change it is. If the person who triggered the mutation is about to look at the result, `updateTag`; if it is a background content update for everyone else, `revalidateTag`.

**★ The codemod renamed `middleware.ts` to `proxy.ts`. What do you check before merging?**
The runtime. `proxy` runs on Node.js and cannot be configured otherwise, and the docs say plainly that if you need the edge runtime you keep using `middleware`. So the question is whether that file depended on edge characteristics — geography, cold-start profile, or an API only available there. If it did, the rename is a behaviour change disguised as a refactor, and the guide says further edge instructions are coming in a minor, which means waiting is a legitimate choice.

**★ Nothing in your build output measures bundle size any more. What replaces it?**
Field measurement, which is what the docs recommend when they remove the metrics — Lighthouse, or Core Web Vitals from real users via `useReportWebVitals` into an analytics sink. The reason given for the removal is worth repeating because it generalises: in a server-driven architecture the framework's own accounting of "client bundle size" disagreed between bundlers and did not describe what a user downloads. A number that two implementations compute differently is not a budget you can hold anyone to.

**★ Give three changes in 16 that no build, test or type check will find.**
The `next/image` defaults, because they change output rather than validity — `minimumCacheTTL` from 60 seconds to 4 hours, `qualities` narrowed to `[75]` with silent coercion, `maximumRedirects` capped at 3. The scroll-behaviour override going away, which changes how navigation feels on any site with `scroll-behavior: smooth`. And the browser floor rising, which fails only in the field. A fourth honourable mention is `process.argv` no longer containing `'dev'`, which silently disables config-file side effects that were keyed on it.

**★ Why is `updateTag` restricted to Server Actions?**
Because its guarantee is read-your-writes *within the same request* — it expires the tagged data and immediately refreshes it before the response goes out, so the user who made the change sees the change. That only means anything in a context where there is a mutation and a subsequent render tied to the same request, which is exactly a Server Action. Outside one there is no "same request" to be consistent within, so the semantics would degrade to `revalidateTag` while looking like something stronger.

**★ When would you use `refresh` rather than either tag API?**
When the mutation changed something the current page shows but does not own. The documented example is marking a notification read and needing the unread count in the header to update — the header is not what you mutated and may not be tagged at all. `refresh` re-runs the client router against the current route, which picks the new value up without you having to model a tag relationship between two unrelated pieces of UI.

**★ Your CI has a bundle-size budget. What happened to it in 16, and what would you replace it with?**
It stopped working, silently. `size` and `First Load JS` were removed from `next build` output, so a gate that parses that output now finds nothing and passes. The reason for the removal is the reason not to rebuild the same gate: the numbers disagreed between Turbopack and webpack and did not correctly account for Client Component payload in a server-driven architecture — a budget two implementations compute differently is not enforceable. The replacement is field-shaped: Lighthouse in CI for a lab signal, and `useReportWebVitals` into analytics for real Core Web Vitals, which is what the docs point at.

**★ How would you review a 16 upgrade PR, given that most of the risky changes produce no diff?**
By reviewing the absence rather than the diff. I would ask for evidence on each silent item: what the image config looks like now and whether any `quality` prop falls outside `qualities`; whether anything set `scroll-behavior: smooth` and therefore needs `data-scroll-behavior`; whether `next.config` has side effects keyed on `process.argv`; whether any CI step parsed build output for sizes; whether a `middleware` file relied on the edge runtime before the codemod renamed it; and what the analytics say against the new browser floor. None of those are visible in the changed lines, which is precisely why they need to be asked rather than looked for.

---

← [Appendix B part 2 · the migration the build catches](02b-appendix-b-the-15-to-16-migration-mechanically.md) · [Chapter 20 overview](01-explanation.md) · Next → [Appendix C · Tooling](03-appendix-c-tooling.md)
