---
sidebar_position: 11
title: "Next.js as a Backend for Frontend is an API layer, not a backend replacement — publicly reachable, any HTTP method, and any content type you care to serve"
sidebar_label: "Backend for Frontend: the API layer"
description: "Route Handlers as public endpoints, the error-handling shape and what not to leak through it, serving non-UI content types, Accept-header content negotiation with Vary, and consuming request payloads exactly once."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [How to use Next.js as a backend for your frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (docs `lastUpdated` 2026-06-25), [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route), [`rewrites`](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites), and MDN's [Content negotiation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation) and [`Vary`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary) references.
> Target: **Next.js 16.3.4** (16.3 = Active LTS). Node.js `>= 20.9`. Related: [04 · Route Handlers for RESTful APIs](04-route-handlers-routets-for-restful-apis.md).

**"Backend for Frontend" in Next.js means a specific, bounded thing, and the guide draws the boundary in three bullets: an API layer that is publicly reachable, handles any HTTP request, and can return any content type. It is not a backend replacement. This page covers the layer itself — how a Route Handler is shaped, what it may serve, how two representations can share one URL, and the single-use nature of a request body. Forwarding, webhooks and the request/response extensions are the next page; the caveats that decide when *not* to use any of this are the one after.**

## The boundary

The guide's framing is that Next.js supports the Backend for Frontend pattern by letting you create public endpoints that handle HTTP requests and return any content type — not just HTML. From those endpoints you can reach data sources and perform side effects such as updating remote data. That is a wider remit than "render a page", and it is deliberately so.

It then draws the line just as explicitly, in a "Good to know" callout: these backend capabilities are **not a full backend replacement**. They are an API layer with three defining properties — it is publicly reachable, it handles any HTTP request, and it can return any content type. Read those three as a specification rather than a boast. "Publicly reachable" is a security obligation. "Any HTTP request" means you own method handling. "Any content type" is what makes RSS, `llms.txt` and image endpoints possible in the same tree as your pages.

Three tools implement it: Route Handlers, `proxy`, and — in the Pages Router — API Routes.

```bash package="pnpm"
pnpm create next-app --api
```

The `--api` flag scaffolds an example `route.ts` in `app/`.

## Public endpoints, and the error-handling shape

Route Handlers are public HTTP endpoints, and the docs say so without qualification: any client can access them. Nothing about the file's location in the tree, or the fact that only your own frontend calls it, makes one private.

```ts filename="/app/api/route.ts"
export function GET(request: Request) {}
```

```ts filename="/app/api/route.ts"
import { submit } from '@/lib/submit'

export async function POST(request: Request) {
  try {
    await submit(request)
    return new Response(null, { status: 204 })
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected error'

    return new Response(message, { status: 500 })
  }
}
```

Directly beneath that snippet, the guide warns you against exposing sensitive information in the error messages you send to the client — which is the docs showing a shape and then telling you to tighten it, because the snippet itself returns `reason.message` verbatim. A database driver's error message routinely contains a table name, a column, a constraint, or a connection string fragment. Log the real error; return an opaque one.

```ts
} catch (reason) {
  console.error('[POST /api]', reason)
  return new Response('Internal Server Error', { status: 500 })
}
```

## Any content type

Route Handlers exist precisely so you can serve non-UI responses: the guide lists JSON, XML, images, files and plain text as examples, and the list is illustrative rather than exhaustive.

Next.js already owns several conventional endpoints — `sitemap.xml`, `opengraph-image.jpg` and `twitter-image`, favicon and app icons, `manifest.json`, `robots.txt`. Anything beyond those you define yourself, and the guide's own examples of custom ones are `llms.txt`, `rss.xml`, and paths under `.well-known`:

```ts filename="/app/rss.xml/route.ts"
export async function GET(request: Request) {
  const rssResponse = await fetch(/* rss endpoint */)
  const rssData = await rssResponse.json()

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
 <title>${rssData.title}</title>
 <description>${rssData.description}</description>
 <link>${rssData.link}</link>
 <copyright>${rssData.copyright}</copyright>
 ${rssData.items.map((item) => {
   return `<item>
    <title>${item.title}</title>
    <description>${item.description}</description>
    <link>${item.link}</link>
    <pubDate>${item.publishDate}</pubDate>
    <guid isPermaLink="false">${item.guid}</guid>
 </item>`
 })}
</channel>
</rss>`

  const headers = new Headers({ 'content-type': 'application/xml' })

  return new Response(rssFeed, { headers })
}
```

The guide attaches a one-line instruction to that example: sanitize any input used to generate markup. It is worth pausing on, because the template interpolates CMS-supplied strings straight into XML. A title containing `]]>` or a raw `&` produces a malformed feed; a title containing markup produces an injection. Escape every interpolated value, or use a serializer.

## Content negotiation: same URL, two representations

Rewrites can match on a request header, which lets one URL serve different content types depending on what the client asked for in `Accept`. The example the docs reach for is a documentation site that returns HTML pages to browsers and raw Markdown to AI agents from the same `/docs/…` URLs — one canonical address, two representations, chosen by the client.

```js filename="next.config.js"
module.exports = {
  async rewrites() {
    return [
      {
        source: '/docs/:slug*',
        destination: '/docs/md/:slug*',
        has: [
          {
            type: 'header',
            key: 'accept',
            value: '(.*)text/markdown(.*)',
          },
        ],
      },
    ]
  },
}
```

```ts filename="app/docs/md/[...slug]/route.ts"
import { getDocsMd, generateDocsStaticParams } from '@/lib/docs'

export async function generateStaticParams() {
  return generateDocsStaticParams()
}

export async function GET(_: Request, ctx: RouteContext<'/docs/md/[...slug]'>) {
  const { slug } = await ctx.params
  const mdDoc = await getDocsMd({ slug })

  if (mdDoc == null) {
    return new Response(null, { status: 404 })
  }

  return new Response(mdDoc, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
    },
  })
}
```

The `Vary` header is the whole correctness story. `Vary: Accept` on the response tells caches that the body they are storing depends on the request's `Accept` header. Leave it off and a shared cache is free to hand a cached Markdown response to a browser, or a cached HTML response to an agent, because as far as it knows one URL means one body. The docs note that most hosting providers already fold `Accept` into their cache key — but setting `Vary` explicitly is what guarantees correct behaviour across every CDN and proxy cache, not just the one you happen to deploy behind.

Two operational notes travel with that example. First, `generateStaticParams` lets the Markdown variants be pre-rendered at build time, so they can be served from the edge without hitting the origin server on every request. Second — and this is the one that surprises people — the `/docs/md/...` route stays directly accessible whether or not the rewrite sent the client there. If you want that representation reachable only through negotiation, the docs' suggestion is to use `proxy` to block direct requests that do not carry the expected `Accept` header.

## Consuming request payloads

The body arrives on the `Request` instance and you read it with the standard methods — `.json()`, `.formData()`, or `.text()`. `GET` and `HEAD` requests do not carry a body at all, so there is nothing to read on those.

```ts filename="/app/api/send-email/route.ts"
import { sendMail, validateInputs } from '@/lib/email-transporter'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email')
  const contents = formData.get('contents')

  try {
    await validateInputs({ email, contents })
    const info = await sendMail({ email, contents })

    return Response.json({ messageId: info.messageId })
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected exception'

    return new Response(message, { status: 500 })
  }
}
```

The "Good to know" attached to that snippet is a single rule: validate data before passing it to other systems. The handler above does exactly that with `validateInputs` before `sendMail` — the mail transporter never sees a value the boundary has not checked.

The body is single-use:

```ts filename="/app/api/clone/route.ts"
export async function POST(request: Request) {
  try {
    const clonedRequest = request.clone()

    await request.text()
    await clonedRequest.text()
    await request.text() // Throws error

    return new Response(null, { status: 204 })
  } catch {
    return new Response(null, { status: 500 })
  }
}
```

The rule the docs state is flat: you can only read the request body once, and if you need it a second time you must clone the request first. The third `await request.text()` above is the failing line — the clone absorbed the second read, and the original stream is already consumed.

This matters most in the proxy pattern below, where you want to validate the body *and* forward it.

## Manipulating data, and the method choice

A Route Handler is a place to transform, filter and aggregate data from one or several sources. The docs give two reasons for doing that work there rather than in the browser: it keeps logic out of the frontend and avoids exposing your internal systems to it, and it moves heavy computation onto the server, which reduces the client's battery and data usage.

```ts filename="/app/api/weather/route.ts"
import { parseWeatherData } from '@/lib/weather'

export async function POST(request: Request) {
  const body = await request.json()
  const searchParams = new URLSearchParams({ lat: body.lat, lng: body.lng })

  try {
    const weatherResponse = await fetch(`${weatherEndpoint}?${searchParams}`)

    if (!weatherResponse.ok) {
      /* handle error */
    }

    const weatherData = await weatherResponse.text()
    const payload = parseWeatherData.asJSON(weatherData)

    return new Response(payload, { status: 200 })
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected exception'

    return new Response(message, { status: 500 })
  }
}
```

The docs flag the method choice deliberately: this example uses `POST` to keep geo-location data out of the URL, on the grounds that `GET` requests may be cached or logged, which could expose sensitive information.

That is a genuinely useful default. Coordinates, search terms containing personal data, and identifiers you would not want in an access log all belong in a body rather than a query string — not because `POST` is encrypted (it is not) but because query strings end up in logs, `Referer` headers and cache keys.

## Gotchas

**★ Returning `reason.message` to the client.**
The guide's own snippets do this and then warn against it in the very next line — avoid exposing sensitive information in error messages sent to the client. Driver and ORM errors routinely contain table names, column names, constraint names and connection details. Log the real error server-side and return a fixed string with the status code.

**★ Reading the request body twice.**
`await request.text()` a second time throws. Any pattern that validates and then forwards — the proxy handler is the canonical one — must `request.clone()` first and consume the clone. The failure is easy to miss because it only occurs on the code path that actually forwards.

**★ Omitting `Vary: Accept` on a content-negotiated route.**
Without it, a shared cache is entitled to serve a cached Markdown response to a browser, or the reverse. Most hosts already key on `Accept`, which is exactly why this bug survives review and testing and then appears behind one particular CDN.

**★ Forgetting that the rewrite target is still directly addressable.**
`/docs/md/getting-started` responds whether or not the rewrite sent you there. If that representation should only be reachable through negotiation, block direct requests in `proxy` based on the expected `Accept` header — the rewrite is routing, not access control.

**★ Interpolating CMS strings into an XML or HTML template unescaped.**
The documented RSS handler builds markup by string interpolation, and the guide's own instruction beside it is to sanitize any input used to generate markup. A title with a bare `&`, a `<`, or a `]]>` breaks the feed; one with markup injects into it. Escape every interpolated value.

**★ Assuming a Route Handler is private because nothing links to it.**
Route Handlers are public HTTP endpoints and any client can reach them. There is no implicit protection from being undocumented, from living under `app/api/internal/`, or from only being called by your own frontend. Every handler needs its own authorization check, and the July 2026 disclosure of Server Function endpoint IDs is a reminder that "nobody knows the URL" is not a control.

**★ Putting sensitive values in a query string because `GET` was more convenient.**
Query strings land in access logs, `Referer` headers and cache keys. The weather example uses `POST` specifically so coordinates stay out of the URL, because `GET` requests may be cached or logged and that is how sensitive information leaks.

## Interview questions

**★ What does Next.js mean by "Backend for Frontend", and what does it explicitly not claim?**
An API layer that is publicly reachable, handles any HTTP request, and can return any content type — implemented with Route Handlers, `proxy`, and API Routes in the Pages Router. It explicitly does not claim to be a full backend replacement. It is the seam between your frontend and whatever services actually own the data, where you can aggregate, transform, and hide internal systems.

**★ Why is `Vary: Accept` load-bearing on a content-negotiated route?**
Because the response body depends on a request header, and a shared cache that does not know that will serve one representation to a client that asked for the other — Markdown to a browser, HTML to an agent. Most hosts already include `Accept` in their cache key, so omitting `Vary` often works, which is why it fails only on some CDN and only in production.

**★ You need to validate a request body and then forward it upstream. What is the trap?**
A request body can only be read once. Validating with `await request.json()` consumes it, so the forwarded request has an empty body. Call `request.clone()` first and validate the clone, exactly as the documented proxy handler does.

**★ Route Handlers versus Server Actions versus a Server Component read — which do you reach for?**
A Server Component reads its data directly from the source; that is the default and covers most needs. A Server Action mutates data from the client, and the guide warns against using them for fetching because Server Actions are queued, so fetching through them makes the requests run one after another rather than in parallel. A Route Handler is for clients that are not your own render: a browser data-fetching library, a webhook from a third party, a mobile app, an agent asking for Markdown. Choosing a Route Handler for a Server Component's data is the one combination the docs explicitly tell you not to use.

**★ Why does the documented weather endpoint use `POST` for what is conceptually a read?**
To keep latitude and longitude out of the URL. `GET` request URLs are cached and logged — by CDNs, by reverse proxies, by application logs, and in `Referer` headers on outbound links — so anything sensitive in a query string is copied into places you do not control. The choice is about where the data ends up, not about encryption.

{/* FOOTER */}
