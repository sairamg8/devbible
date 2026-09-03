---
sidebar_position: 16
title: "OpenNext reverse-engineered Next.js for three years, proved the build output could be a contract, and then got that contract adopted upstream"
sidebar_label: "OpenNext"
description: "What OpenNext is, how the AWS/Cloudflare/Netlify adapters are structured, the wrapper–converter override model, and how the project's compatibility layer became the official Adapter API."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [OpenNext · Overview](https://opennext.js.org/), [OpenNext AWS · Architecture](https://opennext.js.org/aws/inner_workings/architecture), [OpenNext AWS · Components Overview](https://opennext.js.org/aws/inner_workings/components/overview), [Next.js Across Platforms: Adapters, OpenNext, and Our Commitments](https://nextjs.org/blog/nextjs-across-platforms) (25 March 2026), and [Deploying](https://nextjs.org/docs/app/getting-started/deploying).
> Target: **Next.js 16.3.4**. Adapter API stable since **16.2**. Prior page: [15 · Testing adapters, verified status](15-testing-adapters-and-the-verified-adapter-contract.md).

**OpenNext began in 2023 as a serverless adapter for AWS Lambda from the SST community, and spent three years doing the work nobody wanted to do: reading Next.js build output that was never meant to be read, and mapping it onto other people's infrastructure. That labour is why the Adapters API exists. The project did not lose when the framework absorbed its insight — it won, and its members now sit in the Next.js Ecosystem Working Group. Understanding OpenNext matters for two reasons: it is still what most non-Vercel Next.js deployments actually run on today, and its architecture is the clearest available picture of what a Next.js deployment decomposes into when you take the single `next start` process apart.**

## What it is, in its own words

> *"OpenNext started in 2023 as an open-source initiative to make Next.js truly portable — deployable on any platform, not just Vercel. What began as a serverless adapter for AWS Lambda by the SST community has grown into a multi-platform effort backed by Cloudflare, Netlify, and a broader community of contributors."*

> *"In collaboration with Vercel, OpenNext helped establish the Deployment Adapters Working Group, alongside Cloudflare, Netlify, Google, AWS Amplify, and others, to design a standard Deployment Adapters API for Next.js. That API is now stable in Next.js 16.2, meaning platforms no longer need to reverse-engineer the build output."*

The framework side of the story is unusually candid about who did what:

> *"OpenNext filled that gap. It translated Next.js build output into something providers could consume, mapping framework semantics onto each provider's primitives. What started as a compatibility layer became an early production-grade adapter, especially on AWS, with Cloudflare and Netlify joining the effort later. OpenNext showed that Next.js build output can serve as a stable, defined interface that adapters target directly."*

> *"The collaboration between OpenNext and the Next.js team transformed a community-driven workaround into an official standard, proving that the future of web frameworks is built on openness and shared innovation."*
> — Dorseuil Nicolas, OpenNext

And from Cloudflare, on why they were there from the start:

> *"Cloudflare has been part of OpenNext since the beginning because we believed developers deserve a stable, open contract for deploying Next.js apps anywhere. The official Next.js Adapter API makes that vision real."*
> — Fred K Schott, Engineer at Cloudflare

## Three adapters, three maintainers

OpenNext today is an umbrella over three separately-maintained adapters:

| Adapter | Maintained by |
| --- | --- |
| `@opennextjs/aws` | The SST community |
| `@opennextjs/cloudflare` | The Cloudflare team |
| `@opennextjs/netlify` | The Netlify team |

The Next.js announcement records their status at the time of writing: *"Adapters for Netlify, Cloudflare, and AWS through OpenNext are in active development, with expected releases later this year."* As of the docs checked on 2026-09-03, the Deploying page lists only **Vercel** and **Bun** as verified adapters and notes that *"Cloudflare and Netlify are working on verified adapters built on the Adapter API."* Cloudflare and Netlify still appear separately under "Other Platforms", whose integrations *"are not built on the public Adapter API and are not verified by the Next.js team, so feature support and compatibility may vary."*

That is the state to hold in your head: OpenNext's *existing* integrations predate the Adapter API and do not use it; its *next generation* is being rebuilt on top of it. **I could not confirm from the documentation which specific OpenNext releases have completed that migration** — check each adapter's own release notes rather than assuming.

## What a Next.js deployment decomposes into

The AWS architecture page is the most valuable document in the OpenNext project, because it enumerates the pieces a single `next start` process is actually doing. OpenNext splits them into separate deployables:

| Backend | Job |
| --- | --- |
| Servers (Node or Edge) | SSR, ISR, SSG and API requests via the standalone `NextServer` |
| Middleware | Optional separate deployable, when set to external |
| Image Optimization | Serves the `Image` component's transforms, bundling `sharp` |
| Revalidation | Polls a FIFO queue and issues `HEAD` requests to revalidate routes |
| Warmer | Keeps functions warm |
| Initializer | Seeds the cache from build output |
| Tag Provider | Populates the revalidation table with tags |

### Assets: the hashed/un-hashed split

OpenNext arrived at the same conclusion the framework later encoded in the immutable-assets feature, and its wording is worth reading because it explains *why* the two cases differ:

> *"**Hashed files** … The hash values in the filenames are guaranteed to change when the content of the files is modified. Therefore, hashed files should be cached both at the CDN level and at the browser level. The recommended cache control setting for these file is `public,max-age=31536000,immutable`"*

> *"**Un-hashed files** Other files inside the `.open-next/assets` folder are copied from your app's `public/` folder … The filename for un-hashed files may remain unchanged when the content is modified. Un-hashed files should be cached at the CDN level, but not at the browser level. When the content of un-hashed files is modified, the CDN cache should be invalidated on deploy. The recommended cache control setting for these file is `public,max-age=0,s-maxage=31536000,must-revalidate`"*

That second policy is the correct answer for `public/` and is the one people get wrong: a browser that caches `/logo.png` for a year cannot be told about a change, but a CDN can be purged.

### Caches: and the one that must never be public

> *"Route cache: This cache includes `html` and `json` or `rsc` files that are prerendered during the build. They are merged into a single `.cache` file. They are used to seed the revalidation cache."*

> *"Fetch cache: This cache includes fetch call responses, which might contain sensitive information. Make sure these files are not publicly accessible."*

The fetch cache holds upstream API responses — including anything an authenticated server-side `fetch` returned. Serving `.open-next/cache` from the same bucket as `.open-next/assets` is a data breach, not a misconfiguration.

## The override model: wrapper and converter

OpenNext's extension mechanism is worth understanding even if you never use it, because it is the shape every portable Next.js runtime converges on. Two pieces sit between the platform's event format and the framework's handler:

```typescript
type WrapperHandler<
  E extends BaseEventOrResult = InternalEvent,
  R extends BaseEventOrResult = InternalResult,
> = (
  handler: OpenNextHandler<E, R>,
  converter: Converter<E, R>
) => Promise<(...args: any[]) => any>

export type Wrapper<
  E extends BaseEventOrResult = InternalEvent,
  R extends BaseEventOrResult = InternalResult,
> = BaseOverride & {
  wrapper: WrapperHandler<E, R>
  supportStreaming: boolean
}
```

The **wrapper** is the platform entrypoint; the **converter** translates the platform's event and result types into OpenNext's internal ones. The shipped wrappers are `aws-lambda` (the default), `aws-lambda-streaming`, `node` (*"Create a node server, not suitable for serverless"*) and `cloudflare`.

`supportStreaming` on the wrapper type is not decoration. It is the same capability the Next.js platform matrix marks as **Required** for Server Components, PPR, Cache Components and Server Actions. A wrapper that reports `false` cannot host those features at full fidelity.

### The streaming caveat nobody warns you about until production

> *"If you want to enable streaming in lambda, you need to use this wrapper. It is not enabled by default. Be aware that you might encounter some unexpected behaviors when using streaming. Aws Lambda seems to apply some buffering on the response. In some rare cases it might mean that streaming won't properly start. This is an issue with the lambda runtime itself, but this should only impact TTFB (Time To First Byte) in those cases."*

The Next.js self-hosting guide names the same class of problem one layer up: *"Some cloud load balancers (for example, AWS ALB with Lambda integration) may buffer responses by default."* Streaming is an end-to-end property. It fails at whichever hop buffers, and every hop between the function and the browser is a candidate.

## Monorepos change the bundle layout

OpenNext documents the monorepo case explicitly because the naive layout does not work: the server adapter must sit next to `.next/` inside `packages/web` so it can resolve dependencies from both the package's and the workspace root's `node_modules`, and a re-exporting `index.mjs` is placed at the bundle root so the function handler stays at a stable path. This is the runtime mirror of the adapter-side rule that traced `assets` keys are relative to `repoRoot`, not `projectDir`.

## A practical note

> *"Open-next doesn't work well on Windows. We recommend using WSL2 or a Linux VM."*

That is orthogonal to — but worth reading alongside — the August 2026 Next.js advisory for a critical RCE affecting Windows-hosted Next.js servers. Windows is the least-exercised path in this ecosystem end to end.

## Gotchas

**★ Serving the OpenNext cache directory from the same public bucket as the assets.**
`.open-next/cache` contains the fetch cache, which the docs warn *"might contain sensitive information"* — upstream API responses, including authenticated ones. Assets are public by design; the cache must not be. Two prefixes, two access policies, and a bucket policy that denies public reads on the cache prefix.

**★ Applying `immutable` cache headers to files copied from `public/`.**
Hashed `_next/static` files change name when they change content, so a one-year browser cache is safe. Files from `public/` keep their names, so a one-year browser cache is permanent: you have no way to tell a browser that `/logo.png` changed. Use `public,max-age=0,s-maxage=31536000,must-revalidate` and purge the CDN on deploy.

**★ Expecting streaming to work on Lambda without the streaming wrapper.**
The default `aws-lambda` wrapper does not stream; `aws-lambda-streaming` is a separate opt-in. Without it, PPR's static shell and the dynamic remainder arrive together after the full render, which the Next.js self-hosting guide describes as *"eliminating PPR's time-to-first-byte advantage."* The page still works, so nothing errors — you simply paid for PPR and did not get it.

**★ Enabling the streaming wrapper and stopping there.**
Even with it, the Lambda runtime may buffer, and an ALB or reverse proxy in front will happily buffer too. Verify end to end. On nginx the fix Next.js documents is a header:

```js filename="next.config.js"
module.exports = {
  async headers() {
    return [
      { source: '/:path*{/}?', headers: [{ key: 'X-Accel-Buffering', value: 'no' }] },
    ]
  },
}
```

**★ Assuming an OpenNext deployment is running on the official Adapter API.**
The existing AWS, Cloudflare and Netlify integrations predate it; the Next.js docs still list Cloudflare and Netlify under "Other Platforms" as not built on the public Adapter API. Which release of which adapter has migrated is a per-project question with a per-project answer. Read the adapter's changelog, not the framework's blog.

**★ Reading OpenNext's docs as if all three adapters behaved alike.**
They share a name, a working group and a philosophy — not a codebase or a release cadence. The AWS adapter's wrapper/converter overrides, the Cloudflare adapter's bindings and skew-protection notes, and the Netlify adapter's own model are separate surfaces. Follow the section for your target.

**★ Laying out a monorepo bundle with the adapter at the repository root.**
The server adapter has to sit beside `.next/` inside the app package so Node's resolver can reach both the package's and the workspace root's `node_modules`. Putting it at the bundle root without the re-exporting `index.mjs` shim produces module-not-found failures at cold start that look like a broken build.

**★ Developing OpenNext deployments on Windows.**
The project states plainly that it *"doesn't work well on Windows"* and recommends WSL2 or a Linux VM. Combined with the August 2026 advisory for a critical RCE affecting Windows-hosted Next.js servers, Windows is the least-travelled path in this ecosystem in both build and runtime.

## Interview questions

**★ What is OpenNext and why does it matter historically?**
An open-source initiative started in 2023 by the SST community to make Next.js deployable outside Vercel, now an umbrella over three adapters maintained by the SST community (AWS), Cloudflare and Netlify. It matters because it proved that Next.js build output could serve as a stable interface, which is the insight the official Adapter API was built on — and its maintainers helped design that API in the working group. The framework team's own account credits it with filling the gap that "no upstream, stable, public contract" left.

**★ What does a Next.js deployment decompose into once you stop running one `next start` process?**
In OpenNext's AWS architecture: a server backend wrapping the standalone `NextServer` for SSR/ISR/SSG/API, an image-optimization backend bundling `sharp`, a revalidation backend that polls a FIFO queue and issues `HEAD` requests, a warmer, an initializer that seeds the cache from build output, a tag provider that populates the revalidation table, and optionally middleware as its own deployable. Plus two asset classes and two cache classes on storage.

**★ Why do hashed and un-hashed assets need different cache policies?**
Hashed files under `_next/static` change filename when their content changes, so both the CDN and the browser can cache them for a year with `immutable`. Files from `public/` keep the same name across content changes, so a browser cache is unpurgeable — cache them at the CDN with a long `s-maxage` and `must-revalidate`, `max-age=0` in the browser, and purge the CDN on deploy.

**★ Which part of an OpenNext output must never be publicly readable, and why?**
The fetch cache inside `.open-next/cache`. It stores responses from server-side `fetch` calls, which the docs warn *"might contain sensitive information"* — anything an authenticated upstream request returned. The route cache in the same directory holds prerendered HTML/JSON/RSC and is less sensitive, but the simplest correct policy is that the whole cache prefix is private.

**★ What are a wrapper and a converter in OpenNext, and why is the split there?**
The wrapper is the platform's entrypoint — an AWS Lambda handler, a Cloudflare Worker fetch handler, a Node server — and declares whether it supports streaming. The converter translates that platform's event and result types into OpenNext's internal ones. Splitting them means adding a platform requires a new wrapper and converter pair rather than a fork of the request pipeline, which is the same inversion `@next/routing`'s `invokeMiddleware` callback uses.

**★ Streaming works locally and not in production on Lambda. Name three places it could be dying.**
The wrapper (the default `aws-lambda` wrapper does not stream; `aws-lambda-streaming` is opt-in), the Lambda runtime itself (OpenNext documents that it *"seems to apply some buffering on the response"*), and any load balancer or reverse proxy in front — the Next.js self-hosting guide specifically names AWS ALB with Lambda integration as a default-buffering combination, and nginx as needing `X-Accel-Buffering: no`.

**★ A colleague says "we're on OpenNext, so we're using the official Adapter API." Are they?**
Probably not yet. The existing integrations predate the API and were built by reverse-engineering; the next generation is being rebuilt on it. As of the docs checked here, only Vercel and Bun are listed as verified adapters, and Cloudflare and Netlify appear under "Other Platforms" as not built on the public Adapter API. The answer is per-adapter and per-release — check the changelog.

**★ Why did the Next.js team collaborate with OpenNext instead of competing with it?**
Because OpenNext had already demonstrated both the demand and the shape of the solution, and because the framework's credibility depended on the answer. The stated position is that Next.js *"is used by millions of developers, and many of them run on infrastructure that isn't Vercel. They deserve the same level of reliability and the same access to new features."* Making the same public contract serve Vercel's own adapter is what makes that claim checkable.

{/* FOOTER */}
