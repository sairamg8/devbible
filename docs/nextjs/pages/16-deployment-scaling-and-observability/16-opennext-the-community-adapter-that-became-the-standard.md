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

## What it is, and how it got here

OpenNext describes its own origin as an open-source initiative started in 2023 with a single goal: making Next.js truly portable, deployable on any platform rather than only on Vercel. What began as a serverless adapter for AWS Lambda written by the SST community grew into a multi-platform effort backed by Cloudflare, Netlify and a wider body of contributors.

The second half of that story is the working group. In collaboration with Vercel, OpenNext helped establish the Deployment Adapters Working Group alongside Cloudflare, Netlify, Google, AWS Amplify and others, with the explicit purpose of designing a standard Deployment Adapters API for Next.js. That API is now stable in Next.js 16.2 — and the consequence OpenNext names is the one that justified three years of work: platforms no longer need to reverse-engineer the build output.

The framework side of the story is unusually candid about who did what. Next.js's own account is that OpenNext filled the gap: it translated Next.js build output into something providers could consume, mapping framework semantics onto each provider's primitives. What started as a compatibility layer became an early production-grade adapter, particularly on AWS, with Cloudflare and Netlify joining the effort later. The conclusion the framework team draws from it is the design premise of the Adapter API itself — OpenNext showed that Next.js build output can serve as a stable, defined interface that adapters target directly.

Dorseuil Nicolas of OpenNext frames the outcome as a transformation rather than an acquisition: the collaboration between OpenNext and the Next.js team turned a community-driven workaround into an official standard, which he offers as evidence that the future of web frameworks is built on openness and shared innovation.

Fred K Schott, an engineer at Cloudflare, explains why Cloudflare was there from the beginning: they believed developers deserved a stable, open contract for deploying Next.js apps anywhere, and the official Adapter API is what makes that vision real.

## Three adapters, three maintainers

OpenNext today is an umbrella over three separately-maintained adapters:

| Adapter | Maintained by |
| --- | --- |
| `@opennextjs/aws` | The SST community |
| `@opennextjs/cloudflare` | The Cloudflare team |
| `@opennextjs/netlify` | The Netlify team |

The Next.js announcement records their status at the time it was written: adapters for Netlify, Cloudflare and AWS through OpenNext were in active development, with releases expected later that year. As of the docs checked on 2026-09-03, the Deploying page lists only **Vercel** and **Bun** as verified adapters, and says that Cloudflare and Netlify are working on verified adapters built on the Adapter API. Cloudflare and Netlify still appear separately under "Other Platforms" — a section whose integrations, the docs state, are not built on the public Adapter API and are not verified by the Next.js team, so their feature support and compatibility may vary.

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

OpenNext arrived at the same conclusion the framework later encoded in the immutable-assets feature, and its reasoning is worth following because it explains *why* the two cases differ.

**Hashed files** carry a hash in the filename, and OpenNext states the guarantee that makes them special: the hash values in the filenames are guaranteed to change when the file's content is modified. Because of that guarantee, hashed files should be cached at both the CDN level and the browser level, and the cache-control setting OpenNext recommends for them is `public,max-age=31536000,immutable`.

**Un-hashed files** are the other files inside `.open-next/assets`, copied from your app's `public/` folder. Their filenames may stay the same even when the content changes, and that single difference inverts the policy: un-hashed files should be cached at the CDN level but **not** at the browser level, and when their content changes the CDN cache should be invalidated on deploy. The recommended cache-control setting for them is `public,max-age=0,s-maxage=31536000,must-revalidate`.

That second policy is the correct answer for `public/` and is the one people get wrong: a browser that caches `/logo.png` for a year cannot be told about a change, but a CDN can be purged.

### Caches: and the one that must never be public

OpenNext writes two distinct caches into `.open-next/cache`, and they carry very different risk.

The **route cache** holds the `html` plus `json` or `rsc` files prerendered during the build, merged into a single `.cache` file. Its job is to seed the revalidation cache.

The **fetch cache** holds the responses to `fetch` calls — and the docs attach a warning to it rather than a description: those responses might contain sensitive information, so you must make sure the files are not publicly accessible.

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

The **wrapper** is the platform entrypoint; the **converter** translates the platform's event and result types into OpenNext's internal ones. The shipped wrappers are `aws-lambda` (the default), `aws-lambda-streaming`, `node` — which OpenNext describes as creating a Node server and explicitly warns is not suitable for serverless — and `cloudflare`.

`supportStreaming` on the wrapper type is not decoration. It is the same capability the Next.js platform matrix marks as **Required** for Server Components, PPR, Cache Components and Server Actions. A wrapper that reports `false` cannot host those features at full fidelity.

### The streaming caveat nobody warns you about until production

OpenNext's own note on the streaming wrapper is unusually honest, and it has four parts. Streaming on Lambda requires the `aws-lambda-streaming` wrapper and is not enabled by default. Even with it, you may encounter unexpected behaviour, because AWS Lambda appears to apply some buffering to the response. In rare cases that buffering means streaming will not properly start at all. And the scope of the damage is bounded: this is an issue with the Lambda runtime itself, and where it bites it should only affect time to first byte.

The Next.js self-hosting guide names the same class of problem one layer up, warning that some cloud load balancers — it names AWS ALB with Lambda integration as the example — may buffer responses by default. Streaming is an end-to-end property. It fails at whichever hop buffers, and every hop between the function and the browser is a candidate.

## Monorepos change the bundle layout

OpenNext documents the monorepo case explicitly because the naive layout does not work: the server adapter must sit next to `.next/` inside `packages/web` so it can resolve dependencies from both the package's and the workspace root's `node_modules`, and a re-exporting `index.mjs` is placed at the bundle root so the function handler stays at a stable path. This is the runtime mirror of the adapter-side rule that traced `assets` keys are relative to `repoRoot`, not `projectDir`.

## A practical note

The project ships one platform warning on its own front page, and it is worth taking at face value:

> *"Open-next doesn't work well on Windows. We recommend using WSL2 or a Linux VM."*

That is orthogonal to — but worth reading alongside — the August 2026 Next.js advisory for a critical RCE affecting Windows-hosted Next.js servers. Windows is the least-exercised path in this ecosystem end to end.

## Gotchas

**★ Serving the OpenNext cache directory from the same public bucket as the assets.**
`.open-next/cache` contains the fetch cache, and OpenNext's warning about it is that those files might contain sensitive information — upstream API responses, including authenticated ones — and must not be publicly accessible. Assets are public by design; the cache must not be. Two prefixes, two access policies, and a bucket policy that denies public reads on the cache prefix.

**★ Applying `immutable` cache headers to files copied from `public/`.**
Hashed `_next/static` files change name when they change content, so a one-year browser cache is safe. Files from `public/` keep their names, so a one-year browser cache is permanent: you have no way to tell a browser that `/logo.png` changed. Use `public,max-age=0,s-maxage=31536000,must-revalidate` and purge the CDN on deploy.

**★ Expecting streaming to work on Lambda without the streaming wrapper.**
The default `aws-lambda` wrapper does not stream; `aws-lambda-streaming` is a separate opt-in. Without it, PPR's static shell and the dynamic remainder arrive together after the full render — which the Next.js self-hosting guide describes as eliminating PPR's time-to-first-byte advantage entirely. The page still works, so nothing errors — you simply paid for PPR and did not get it.

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
The project states plainly that OpenNext does not work well on Windows, and recommends WSL2 or a Linux VM instead. Combined with the August 2026 advisory for a critical RCE affecting Windows-hosted Next.js servers, Windows is the least-travelled path in this ecosystem in both build and runtime.

## Interview questions

**★ What is OpenNext and why does it matter historically?**
An open-source initiative started in 2023 by the SST community to make Next.js deployable outside Vercel, now an umbrella over three adapters maintained by the SST community (AWS), Cloudflare and Netlify. It matters because it proved that Next.js build output could serve as a stable interface, which is the insight the official Adapter API was built on — and its maintainers helped design that API in the working group. The framework team's own account credits OpenNext with filling exactly the gap left by the absence of an upstream, stable, public contract for providers to build against.

**★ What does a Next.js deployment decompose into once you stop running one `next start` process?**
In OpenNext's AWS architecture: a server backend wrapping the standalone `NextServer` for SSR/ISR/SSG/API, an image-optimization backend bundling `sharp`, a revalidation backend that polls a FIFO queue and issues `HEAD` requests, a warmer, an initializer that seeds the cache from build output, a tag provider that populates the revalidation table, and optionally middleware as its own deployable. Plus two asset classes and two cache classes on storage.

**★ Why do hashed and un-hashed assets need different cache policies?**
Hashed files under `_next/static` change filename when their content changes, so both the CDN and the browser can cache them for a year with `immutable`. Files from `public/` keep the same name across content changes, so a browser cache is unpurgeable — cache them at the CDN with a long `s-maxage` and `must-revalidate`, `max-age=0` in the browser, and purge the CDN on deploy.

**★ Which part of an OpenNext output must never be publicly readable, and why?**
The fetch cache inside `.open-next/cache`. It stores responses from server-side `fetch` calls, which OpenNext warns might contain sensitive information — anything an authenticated upstream request returned. The route cache in the same directory holds prerendered HTML/JSON/RSC and is less sensitive, but the simplest correct policy is that the whole cache prefix is private.

**★ What are a wrapper and a converter in OpenNext, and why is the split there?**
The wrapper is the platform's entrypoint — an AWS Lambda handler, a Cloudflare Worker fetch handler, a Node server — and declares whether it supports streaming. The converter translates that platform's event and result types into OpenNext's internal ones. Splitting them means adding a platform requires a new wrapper and converter pair rather than a fork of the request pipeline, which is the same inversion `@next/routing`'s `invokeMiddleware` callback uses.

**★ Streaming works locally and not in production on Lambda. Name three places it could be dying.**
The wrapper (the default `aws-lambda` wrapper does not stream; `aws-lambda-streaming` is opt-in), the Lambda runtime itself — OpenNext documents that Lambda appears to apply buffering to the response, and that in rare cases streaming will not properly start because of it — and any load balancer or reverse proxy in front. The Next.js self-hosting guide specifically names AWS ALB with Lambda integration as a default-buffering combination, and nginx as needing `X-Accel-Buffering: no`.

**★ A colleague says "we're on OpenNext, so we're using the official Adapter API." Are they?**
Probably not yet. The existing integrations predate the API and were built by reverse-engineering; the next generation is being rebuilt on it. As of the docs checked here, only Vercel and Bun are listed as verified adapters, and Cloudflare and Netlify appear under "Other Platforms" as not built on the public Adapter API. The answer is per-adapter and per-release — check the changelog.

**★ Why did the Next.js team collaborate with OpenNext instead of competing with it?**
Because OpenNext had already demonstrated both the demand and the shape of the solution, and because the framework's credibility depended on the answer. The team's stated position is that Next.js is used by millions of developers, that many of them run on infrastructure which is not Vercel, and that those developers deserve the same level of reliability and the same access to new features as everyone else. Making the same public contract serve Vercel's own adapter is what makes that claim checkable.

{/* FOOTER */}
