---
name: research-nextjs-ch15-realtime-jobs-edge
description: Banked primary-source research for devbible Next.js chapter 15 topics 03 (SSE/WebSockets), 04 (background jobs and queues) and 05 (edge functions and custom cache structures). Every load-bearing sentence quoted verbatim with its URL. DO NOT RE-DERIVE.
metadata:
  type: research
  project: devbible
  track: nextjs
  chapter: 15
  date: 2026-09-05
---

# Research bank — Next.js ch15 · topics 03, 04, 05

🔴 **Do not re-derive.** One pass, 2026-09-05. Every chunk of topics 03/04/05 was written
from this file. Fetched with `curl` against `nextjs.org/docs/<path>.md` (the docs site
serves markdown when you append `.md`), the MDN content repo's raw markdown, the WHATWG
HTML living standard, the PostgreSQL 18 manual, and `vercel.com/docs` with
`Accept: text/markdown`.

**Version spine (already established, not re-derived):** Next.js **16.3.4** · React
**19.2.8** · Node **24.20.0** · PostgreSQL **18.4**. Every Next.js doc page fetched
carried `version: 16.3.4` in its frontmatter.

---

## 1 · Streaming Route Handlers and SSE

### Next.js — Streaming guide
<https://nextjs.org/docs/app/guides/streaming> (lastUpdated 2026-08-25)

> *"Outside of React rendering, Route Handlers can stream raw responses using the Web
> Streams API. This is useful for Server-Sent Events, large file generation, or any
> response where you want data to arrive progressively"*

> *"In traditional server-side rendering, the server produces the full HTML document
> before sending anything. A single slow database query or API call can block the entire
> page. Streaming changes this by using chunked transfer encoding to send parts of the
> response as they become ready."*

**What can affect streaming** (the whole section is load-bearing):

> *"Any layer between your server and the client that buffers the response can diminish
> the benefits of streaming. The HTML may be fully generated progressively on the server,
> but if a proxy, CDN, or even the client itself collects all the chunks before rendering
> them, the user sees a single delayed response instead of progressive rendering."*

> *"Nginx and similar reverse proxies buffer responses by default. Disable buffering by
> setting the `X-Accel-Buffering` header to `no`"*

> *"Content Delivery Networks may buffer entire responses before forwarding them to the
> client. Check your CDN provider's documentation for streaming support. Some require
> specific configuration or plan tiers to pass through chunked responses."*

> *"Not all serverless environments support streaming. AWS Lambda, for example, requires
> response streaming mode to be explicitly enabled (it is not the default). Vercel
> supports streaming natively."*

> *"Gzip and Brotli compression can buffer chunks internally before flushing, as the
> compression algorithm needs enough data to compress efficiently. This can add latency to
> the first visible chunk."*

> *"Safari/WebKit buffers streaming responses until 1024 bytes have been received, so very
> small responses paint all at once instead of progressively. Real applications easily
> exceed this threshold (layouts, styles, scripts), so it only affects minimal demos or
> tiny Route Handler responses."*

> *"Command-line tools like `curl` also buffer by default. The `-N` flag disables output
> buffering, but `curl` still relies on newline characters to flush lines to the terminal.
> A stream that sends chunks without newlines may appear to stall even with `-N`."*

> *"The `Accept-Encoding: identity` header disables compression so chunks are not buffered
> by the compression layer."*

The `next.config.js` snippet the guide gives for nginx:

```js
module.exports = {
  async headers() {
    return [
      { source: '/:path*{/}?', headers: [{ key: 'X-Accel-Buffering', value: 'no' }] },
    ]
  },
}
```

Same snippet appears in Self-Hosting §"Streaming and Suspense"
<https://nextjs.org/docs/app/guides/self-hosting>:
> *"The Next.js App Router supports streaming responses when self-hosting. If you are
> using nginx or a similar proxy, you will need to configure it to disable buffering to
> enable streaming."*

### Next.js — route.js reference
<https://nextjs.org/docs/app/api-reference/file-conventions/route> (lastUpdated 2026-04-30)

> *"Route Handlers allow you to create custom request handlers for a given route using the
> Web Request and Response APIs."*

> *"The following HTTP methods are supported: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`,
> `HEAD`, and `OPTIONS`."*

Version history row: `v15.0.0-RC` — *"The default caching for `GET` handlers was changed
from static to dynamic"*.

Route segment config defaults listed on that page:
```
export const dynamic = 'auto'
export const dynamicParams = true
export const revalidate = false
export const fetchCache = 'auto'
export const runtime = 'nodejs'
```

### Next.js — Route Handlers getting started
<https://nextjs.org/docs/app/getting-started/route-handlers>

> *"Route Handlers are not cached by default. You can, however, opt into caching for `GET`
> methods. Other supported HTTP methods are **not** cached."*

> *"When Cache Components is enabled, `GET` Route Handlers follow the same model as normal
> UI routes in your application. They run at request time by default, can be prerendered
> when they don't access uncached or runtime data, and you can use `use cache` to include
> uncached data in the static response."*

> *"Prerendering stops if the `GET` handler accesses network requests, database queries,
> async file system operations, request object properties (like `req.url`,
> `request.headers`, `request.cookies`, `request.body`), runtime APIs like `cookies()`,
> `headers()`, `connection()`, or non-deterministic operations."*

### Next.js — `connection()`
<https://nextjs.org/docs/app/api-reference/functions/connection>

> *"The `connection()` function allows you to indicate rendering should wait for an
> incoming user request before continuing."*

> *"It's useful when a component doesn't use Request-time APIs like `cookies` or `headers`,
> but still needs to produce different output per request, such as `Math.random()` or
> `new Date()`."*

### Next.js — `maxDuration`
<https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration>

> *"The `maxDuration` option allows you to set the maximum execution time (in seconds) for
> server-side logic in a route segment. Deployment platforms can use `maxDuration` from the
> Next.js build output to add specific execution limits."*

> *"If using Server Actions, set the `maxDuration` at the page level to change the default
> timeout of all Server Actions used on the page."*

Introduced `v13.4.10`.

### MDN — `EventSource`
<https://developer.mozilla.org/en-US/docs/Web/API/EventSource>
(source: `https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/eventsource/index.md`)

> *"An `EventSource` instance opens a persistent connection to an HTTP server, which sends
> events in `text/event-stream` format. The connection remains open until closed by calling
> `EventSource.close()`."*

> *"Unlike WebSockets, server-sent events are unidirectional; that is, data messages are
> delivered in one direction, from the server to the client"*

🔴 The connection-limit warning, verbatim:
> *"When **not used over HTTP/2**, SSE suffers from a limitation to the maximum number of
> open connections, which can be specially painful when opening various tabs as the limit
> is _per browser_ and set to a very low number (6). The issue has been marked as "Won't
> fix" in Chrome and Firefox. This limit is per browser + domain… When using HTTP/2, the
> maximum number of simultaneous _HTTP streams_ is negotiated between the server and the
> client (defaults to 100)."*

Properties: `readyState` — *"Possible values are `CONNECTING` (`0`), `OPEN` (`1`), or
`CLOSED` (`2`)."* · `url` · `withCredentials`.
Events: `error` — *"Fired when a connection to an event source failed to open."* ·
`message` · `open`.

> *"The event "message" is a special case, as it will capture events without an event field
> as well as events that have the specific type `event: message` It will not trigger on any
> other event type."*

### MDN — Using server-sent events
<https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events>

> *"The server-side script that sends events needs to respond using the MIME type
> `text/event-stream`. Each notification is sent as a block of text terminated by a pair of
> newlines."*

> *"Messages sent from the server that don't have an `event` field are received as
> `message` events."*

> *"By default, if the connection between the client and server closes, the connection is
> restarted. The connection is terminated with the `.close()` method."*

> *"The event stream is a simple stream of text data which must be encoded using UTF-8.
> Messages in the event stream are separated by a pair of newline characters. A colon as
> the first character of a line is in essence a comment, and is ignored."*

> *"The comment line can be used to prevent connections from timing out; a server can send
> a comment periodically to keep the connection alive."*

Field table, verbatim:
- `event` — *"A string identifying the type of event described… The `onmessage` handler is
  called if no event name is specified for a message."*
- `data` — *"When the `EventSource` receives multiple consecutive lines that begin with
  `data:`, it concatenates them, inserting a newline character between each one. Trailing
  newlines are removed."*
- `id` — *"The event ID to set the `EventSource` object's last event ID value."*
- `retry` — *"The reconnection time. If the connection to the server is lost, the browser
  will wait for the specified time before attempting to reconnect. This must be an integer,
  specifying the reconnection time in milliseconds. If a non-integer value is specified,
  the field is ignored."*

> *"All other field names are ignored."*
> *"If a line doesn't contain a colon, the entire line is treated as the field name with an
> empty value string."*

The PHP demo sets `header("X-Accel-Buffering: no")`, `Content-Type: text/event-stream`,
`Cache-Control: no-cache` — useful as the canonical header trio.

### WHATWG HTML — §9.2 Server-sent events
<https://html.spec.whatwg.org/multipage/server-sent-events.html>

ABNF (§9.2.5), verbatim:
```
stream        = [ bom ] *event
event         = *( comment / field ) end-of-line
comment       = colon *any-char end-of-line
field         = 1*name-char [ colon [ space ] *any-char ] end-of-line
end-of-line   = ( cr lf / cr / lf )
```
> *"Event streams in this format must always be encoded as UTF-8."*

Connection state, §9.2.2:
> *"A reconnection time, in milliseconds. This must initially be an implementation-defined
> value, probably in the region of a few seconds. A last event ID string. This must
> initially be the empty string."*

Response validation, §9.2.2 constructor steps:
> *"Otherwise, if res's status is not 200, or if res's `Content-Type` is not
> `text/event-stream`, then fail the connection."*
> *"If res is an aborted network error, then fail the connection."*
> *"Otherwise, if res is a network error, then reestablish the connection, unless the user
> agent knows that to be futile"*
> *"processEventSourceEndOfBody given response res… if res is not a network error, then
> reestablish the connection."* 🔴 — i.e. a **clean end of stream still reconnects**.

Reconnect algorithm, §9.2.3:
> *"Wait a delay equal to the reconnection time of the event source. Optionally, wait some
> more. In particular, if the previous attempt failed, then user agents might introduce an
> exponential backoff delay to avoid overloading a potentially already overloaded server."*
> *"If the `EventSource` object's last event ID string is not the empty string: Let
> lastEventIDValue be the `EventSource` object's last event ID string, encoded as UTF-8. Set
> (`Last-Event-ID`, lastEventIDValue) in request's header list."*

§9.2.4:
> *"The `Last-Event-ID` HTTP request header reports an `EventSource` object's last event ID
> string to the server when the user agent is to reestablish the connection."*

Field processing, §9.2.6:
> *"If the field name is "data" — Append the field value to the data buffer, then append a
> single U+000A LINE FEED (LF) character to the data buffer."*
> *"If the field name is "id" — If the field value does not contain U+0000 NULL, then set
> the last event ID buffer to the field value. Otherwise, ignore the field."*
> *"If the field name is "retry" — If the field value consists of only ASCII digits, then
> interpret the field value as an integer in base ten, and set the event stream's
> reconnection time to that integer. Otherwise, ignore the field."*
> *"Once the end of the file is reached, any pending data must be discarded. (If the file
> ends in the middle of an event, before the final empty line, the incomplete event is not
> dispatched.)"*
> *"Set the last event ID string of the event source to the value of the last event ID
> buffer. The buffer does not get reset, so the last event ID string of the event source
> remains set to this value until the next time it is set by the server."*
> *"If the data buffer is an empty string, set the data buffer and the event type buffer to
> the empty string and return."* 🔴 — a bare `id:` with no `data:` fires nothing.
> *"Collect the characters on the line after the first U+003A COLON character (:), and let
> value be that string. If value starts with a U+0020 SPACE character, remove it from
> value."*

Authoring notes, §9.2.7:
> *"Legacy proxy servers are known to, in certain cases, drop HTTP connections after a short
> timeout. To protect against such proxy servers, authors can include a comment line (one
> starting with a ':' character) every 15 seconds or so."*
> *"Authors are also cautioned that HTTP chunking can have unexpected negative effects on
> the reliability of this protocol, in particular if the chunking is done by a different
> layer unaware of the timing requirements."*
> *"Clients that support HTTP's per-server connection limitation might run into trouble when
> opening multiple pages from a site if each page has an `EventSource` to the same domain.
> Authors can avoid this using the relatively complex mechanism of using unique domain names
> per connection, or by allowing the user to enable or disable the `EventSource`
> functionality on a per-page basis, or by sharing a single `EventSource` object using a
> shared worker."*

§9.2.5 buffering note:
> *"Since connections established to remote servers for such resources are expected to be
> long-lived, UAs should ensure that appropriate buffering is used. In particular, while
> line buffering with lines are defined to end with a single U+000A LINE FEED (LF) character
> is safe, block buffering or line buffering with different expected line endings can cause
> delays in event dispatch."*

### MDN — `ReadableStream()` constructor
<https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/ReadableStream>

> *"`start` (controller) — This is a method, called immediately when the object is
> constructed."*
> *"`pull` (controller) — This method… will be called repeatedly when the stream's internal
> queue of chunks is not full, up until it reaches its high water mark. If `pull()` returns
> a promise, then it won't be called again until that promise fulfills; if the promise
> rejects, the stream will become errored."*
> *"`cancel` (reason) — This method… will be called if the app signals that the stream is to
> be canceled (e.g., if `ReadableStream.cancel()` is called). The contents should do
> whatever is necessary to release access to the stream source."*

### MDN — `ReadableStreamDefaultController.desiredSize`
> *"The `desiredSize` read-only property… returns the desired size required to fill the
> stream's internal queue."*
> *"The number can be negative if the queue is over-full… The value is `null` if the stream
> has errored and `0` if it is closed."*

### MDN — `Request.signal`
> *"The read-only `signal` property of the `Request` interface returns the `AbortSignal`
> associated with the request."*

---

## 2 · WebSockets in a serverless-first world

### Vercel — WebSockets
<https://vercel.com/docs/functions/websockets> (last_updated 2026-08-10)

🔴 **The load-bearing sentence for the whole topic:**
> *"Next.js does not expose an API for handling WebSocket upgrades. As a workaround, you can
> use the `experimental_upgradeWebSocket()` API"*

> *"A WebSocket connection starts as an HTTP `GET` request with an `Upgrade` header. Before
> the connection is upgraded, the request goes through the same routing and security
> controls as other requests to Vercel Functions, including Routing Middleware, rewrites,
> Firewall rules, and rate limits."*

> *"A single WebSocket connection is pinned to one Vercel Function instance. Messages sent
> over that connection reach the same function instance for the lifetime of the connection,
> and Fluid compute allows a single function instance to handle multiple WebSocket
> connections."*

> *"WebSocket connections close when a Vercel Function reaches its maximum duration."*

> *"New WebSocket connections are not guaranteed to reach the same Vercel Function instance.
> If a client reconnects, it may connect to a different instance. After a new deployment,
> new connections may reach the new deployment while existing connections remain on the
> previous deployment until they close."*

> *"Store durable state, presence, counters, rooms, and pub/sub coordination in an external
> data store instead of relying on in-memory variables."*

> *"WebSocket connections use Vercel Functions and follow the same limits and pricing model
> as other Function invocations. This includes Function usage while the connection is
> active, plus Fast Data Transfer and Fast Origin Transfer for data sent over the
> connection."*

> *"WebSockets require Fluid compute to be enabled. This is the default for new projects
> created on or after April 23, 2025."*

Client reconnect example given by Vercel (exponential backoff, capped at 30 s) — reusable.

### Vercel — `@vercel/functions` · `experimental_upgradeWebSocket`
<https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package>

> *"Upgrades an incoming HTTP GET request to a WebSocket connection."*
> *"`experimental_upgradeWebSocket()` requires the `ws` package in your project."*
> *"`maxPayload` … Default 262144 (256 KiB) … Maximum allowed message size in bytes."*
> *"When using `experimental_upgradeWebSocket()` in a Next.js app with Cache Components
> enabled, call `connection()` before `experimental_upgradeWebSocket()`. This opts the route
> handler out of static prerendering, so the WebSocket upgrade runs only at request time."*
> *"this API only works on the Vercel platform and gives you less control over the request
> lifecycle; when possible, you should handle WebSocket connections using native Node.js
> APIs instead."*
> *"When developing a Next.js app that uses `experimental_upgradeWebSocket()` locally, you
> must run the development server using `vc dev` with Vercel CLI 54.14.2 or above instead of
> `next dev`."*

### Next.js — custom server
<https://nextjs.org/docs/app/guides/custom-server>

> *"Next.js includes its own server with `next start` by default… A custom Next.js server
> allows you to programmatically start a server for custom patterns. The majority of the
> time, you will not need this approach."*
> *"When using standalone output mode, it does not trace custom server files. This mode
> outputs a separate minimal `server.js` file, instead. These cannot be used together."*
> *"`server.js` does not run through the Next.js Compiler or bundling process."*
> Option table includes `httpServer` — *"`node:http#Server` — (Optional) The HTTP Server that
> Next.js is running behind"*. This is the hook a `ws` `WebSocketServer` attaches to.

---

## 3 · `after()`, `waitUntil` and background work

### Next.js — `after`
<https://nextjs.org/docs/app/api-reference/functions/after> (lastUpdated 2026-03-13)

> *"`after` allows you to schedule work to be executed after a response (or prerender) is
> finished. This is useful for tasks and other side effects that should not block the
> response, such as logging and analytics."*

> *"It can be used in Server Components (including `generateMetadata`), Server Functions,
> Route Handlers, and Proxy."*

> *"`after` is not a Request-time API and calling it does not cause a route to become
> dynamic. If it's used within a static page, the callback will execute at build time, or
> whenever a page is revalidated."*

> *"`after` will run for the platform's default or configured max duration of your route.
> If your platform supports it, you can configure the timeout limit using the `maxDuration`
> route segment config."*

> *"`after` will be executed even if the response didn't complete successfully. Including
> when an error is thrown or when `notFound` or `redirect` is called."*

> *"You can use React `cache` to deduplicate functions called inside `after`."*
> *"`after` can be nested inside other `after` calls"*

Request APIs inside `after`:
> *"You can call `cookies` and `headers` directly inside the `after` callback when used in
> Route Handlers and Server Functions."*
> *"Server Components (including pages, layouts, and `generateMetadata`) **cannot** use
> `cookies`, `headers`, or other Request-time APIs inside `after`. This is because Next.js
> needs to know which part of the component tree accesses request data to support Partial
> Prerendering and Cache Components, but `after` runs after React's rendering lifecycle."*
> *"Calling `cookies()` or `headers()` inside the `after` callback in a Server Component
> will throw a runtime error."*

🔴 The serverless mechanism, verbatim:
> *"Using `after` in a serverless context requires waiting for asynchronous tasks to finish
> after the response has been sent. In Next.js and Vercel, this is achieved using a
> primitive called `waitUntil(promise)`, which extends the lifetime of a serverless
> invocation until all promises passed to `waitUntil` have settled."*
> *"When `after` is called, Next.js will access `waitUntil` like this:
> `const RequestContext = globalThis[Symbol.for('@next/request-context')]`"*

Platform support table: Node.js server Yes · Docker Yes · Static export **No** ·
Adapters platform-specific.

Version history: `v15.1.0` — *"`after` became stable."*; `v15.0.0-rc` —
*"`unstable_after` introduced."*

### Next.js — Self-hosting §`after`
<https://nextjs.org/docs/app/guides/self-hosting>
> *"When stopping the server, ensure a graceful shutdown by sending `SIGINT` or `SIGTERM`
> signals and waiting. The Next.js server will finish in-flight requests and execute any
> pending `after()` callbacks before exiting. Platforms should allow a configurable drain
> period (10-30 seconds is recommended) to ensure all background work completes."*

### Vercel — `waitUntil` / `getDeadline`
<https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package>

> *"If you're using **Next.js 15.1 or above**, we recommend using the built-in `after()`
> function from `next/server` **instead** of `waitUntil()`."*
> *"Extends the lifetime of the request handler for the lifetime of the given Promise…
> You can use it for anything that can be done after the response is sent, such as logging,
> sending analytics, or updating a cache, without blocking the response."*
> 🔴 *"Promises passed to `waitUntil()` will have the same timeout as the function itself.
> If the function times out, the promises will be cancelled."*

`getDeadline`:
> *"Returns the shared invocation deadline for the current function invocation as a `Date`
> object. The deadline is the time when Vercel will terminate the invocation if it has not
> completed, based on the function's configured `maxDuration`. This includes request
> processing and asynchronous `waitUntil` tasks."*
> *"Returns `undefined` when the deadline is not available"*
The doc's own worked example is the **split-the-work / resume-page** pattern.

`attachDatabasePool`:
> *"Call this function right after creating a database pool to ensure proper connection
> management in Fluid Compute. This function ensures that idle pool clients are properly
> released before functions suspend."*

---

## 4 · Cron

### Vercel — Managing cron jobs
<https://vercel.com/docs/cron-jobs/manage-cron-jobs> (last_updated 2026-08-11)

> *"It is possible to secure your cron job invocations by adding an environment variable
> called `CRON_SECRET` to your Vercel project. We recommend using a random string of at
> least 16 characters for the value of `CRON_SECRET`."*
> *"The value of the variable will be automatically sent as an `Authorization` header when
> Vercel invokes your cron job. Your endpoint can then compare both values, the
> authorization header and the environment variable, to verify the authenticity of the
> request."*
> *"The `authorization` header will have the `Bearer` prefix for the value."*

Their exact Route Handler:
```ts
export function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  return Response.json({ success: true });
}
```

> *"Every cron job request includes the `x-vercel-cron-schedule` header, which contains the
> cron expression that triggered the invocation."*

> 🔴 *"Vercel will not retry an invocation if a cron job fails."*

> *"If you create a cron job for a path that doesn't exist, it generates a 404 error.
> However, **Vercel still executes your cron job**."*

> *"If your cron job runs longer than the interval between invocations, Vercel can trigger a
> second instance while the first is still running. This can lead to race conditions,
> duplicate processing, or data corruption."*
> *"To prevent concurrent runs, use a lock mechanism like Redis distributed locks in your
> cron job."*

🔴 Delivery, verbatim:
> *"Cron job delivery is best effort. Most invocations run as scheduled, but occasional
> transient network errors can prevent a request from reaching your function. In those
> cases, your function does not execute, and no runtime log is created for that scheduled
> run."*
> *"Cron delivery can also occasionally invoke the same scheduled run more than once.
> Because of this, cron jobs should be resilient to both missed runs and duplicate runs."*
> *"Design your operations to be **idempotent** and reconciliation-based so each run can
> safely reprocess outstanding work since the last successful run. For example: Good: "Set
> user status to active" (running twice has the same effect). Bad: "Increment user credit by
> 10" (running twice doubles the credit)."*
> *"Use both locks (to prevent concurrent runs) and idempotent reconciliation (to handle
> duplicate or missed runs safely) for the most reliable cron jobs."*

> *"Cron jobs do not follow redirects. When a cron-triggered endpoint returns a 3xx redirect
> status code, the job completes without further requests."*
> *"Note that when cron jobs respond with a redirect or a cached response, they will not be
> shown in the logs."*
> *"There is currently no support for `vercel dev`, `next dev`, or other framework-native
> local development servers."*
> *"If you Instant Rollback to a previous deployment, active cron jobs **will not** be
> updated."*
> *"Creating a new deployment will not interrupt your running cron jobs; they will continue
> until they finish."*
> *"In most cases, these limits are sufficient. However, if you need more processing time,
> it's recommended to split your cron jobs into different units or distribute your workload
> by combining cron jobs with regular HTTP requests with your API."*

---

## 5 · Durable queues

### Vercel — Queues concepts
<https://vercel.com/docs/queues/concepts> (last_updated 2026-08-12) · **Beta**

> *"Producers publish messages to a topic. Consumer groups read and process those messages
> independently. Messages persist until they are acknowledged or expire. Failed processing
> attempts are retried automatically. Delivery is at-least-once, so consumers should be
> idempotent."*

> *"Vercel Queues provides **at-least-once** delivery semantics. Every accepted message is
> delivered to each consumer group at least one time. In most cases, a message is delivered
> exactly once, but there are edge cases where a message may be delivered more than once:
> **Consumer timeouts**: If your function processes a message but doesn't acknowledge it
> before the visibility timeout expires, Vercel assumes the delivery failed and redelivers
> the message. **Infrastructure events**: During rare events like availability zone
> failovers, a message that was already delivered may be redelivered."*

> *"Design your consumers to be **idempotent**, meaning they produce the same result whether
> they process a message once or multiple times. Common strategies include using a unique
> message ID to deduplicate, or making operations naturally idempotent (like setting a value
> rather than incrementing it)."*

> *"When a message is delivered to a consumer, it becomes temporarily invisible to other
> consumers in the same group. This is the **visibility timeout**."*
> *"The default visibility timeout is **60 seconds**. You can configure it per receive
> request from 0 to 3,600 seconds (60 minutes). Setting it to `0` peeks at the message
> without leasing it."*

> *"Retention is configurable per-message from 60 seconds to 7 days, defaulting to 24
> hours."*

> *"Every message is synchronously written to **three separate availability zones** before
> the publish call returns."*

> *"For the first 32 delivery attempts, Vercel respects your configured retry delay. After
> 32 attempts, the system begins forcing exponential backoff to maintain system health and
> prevent runaway deliveries."*

🔴 DLQ:
> *"Vercel Queues doesn't have a built-in dead-letter queue. Instead, you handle poisoned
> messages at the application level using the SDK's `retry` handler."*
> *"Because messages with no delivery attempts are always prioritized over retried messages,
> a poisoned message naturally falls to lower priority."*

Their retry handler shape:
```ts
export const POST = handleCallback(
  async (message, metadata) => { await fulfillOrder(message) },
  { retry: (error, metadata) => {
      if (metadata.deliveryCount > 10) return { acknowledge: true }
      const delay = Math.min(300, 2 ** metadata.deliveryCount * 5)
      return { afterSeconds: delay }
  } },
)
```

Ordering:
> *"Vercel Queues delivers messages in **approximate write order**… **Retried messages have
> lower priority than new messages.** … **No FIFO guarantee.** Even with a single consumer
> and max concurrency set to 1, message order is not strictly first-in-first-out."*

Consumer security:
> *"Queue consumer functions on Vercel are not accessible from the outside world."*
> *"With this configuration, the function is completely air-gapped from the internet. It has
> no public URL and can only be invoked by Vercel's internal queue infrastructure."*
> *"This means you don't need to add authentication or authorization logic to your consumer
> functions."*

Idempotency key on publish:
> *"You can include an idempotency key when publishing a message to have Vercel deduplicate
> it for you… The deduplication window lasts for the entire lifetime of the original message
> (up to its TTL)."*

Delays:
> *"Delays can be set from 0 seconds up to 7 days, but cannot exceed the message's TTL."*
> *"Daisy-chain messages: Publish a message with the maximum delay, then have your consumer
> republish another delayed message until you reach the target time."*

Deployment partitioning:
> *"On Vercel, topics are **partitioned by deployment ID** by default. In push mode, Vercel
> delivers messages back to the same deployment that published them."*

`vercel.json` trigger shape:
```json
{ "functions": { "app/api/queues/process-order/route.ts": {
  "experimentalTriggers": [{ "type": "queue/v2beta", "topic": "orders",
    "retryAfterSeconds": 60, "initialDelaySeconds": 0 }] } } }
```
> *"Multiple route files with the same topic create separate consumer groups, each receiving
> a copy of every message."*

---

## 6 · Postgres as a queue

### PostgreSQL 18 — SELECT, The Locking Clause
<https://www.postgresql.org/docs/18/sql-select.html>

Syntax:
```
FOR { UPDATE | NO KEY UPDATE | SHARE | KEY SHARE } [ OF from_reference [, ...] ] [ NOWAIT | SKIP LOCKED ]
```

🔴 Verbatim, the sentence the whole pattern rests on:
> *"To prevent the operation from waiting for other transactions to commit, use either the
> NOWAIT or SKIP LOCKED option. With NOWAIT, the statement reports an error, rather than
> waiting, if a selected row cannot be locked immediately. With SKIP LOCKED, any selected
> rows that cannot be immediately locked are skipped. Skipping locked rows provides an
> inconsistent view of the data, so this is not suitable for general purpose work, but can
> be used to avoid lock contention with multiple consumers accessing a queue-like table.
> Note that NOWAIT and SKIP LOCKED apply only to the row-level lock(s) — the required ROW
> SHARE table-level lock is still taken in the ordinary way."*

> *"If a LIMIT is used, locking stops once enough rows have been returned to satisfy the
> limit (but note that rows skipped over by OFFSET will get locked)."*

> *"When a locking clause appears in a sub-SELECT, the rows locked are those returned to the
> outer query by the sub-query."*

> *"It is possible for a SELECT command running at the READ COMMITTED transaction isolation
> level and using ORDER BY and a locking clause to return rows out of order. This is because
> ORDER BY is applied first."*

> *"The WITH TIES option is used to return any additional rows that tie for the last place in
> the result set according to the ORDER BY clause; ORDER BY is mandatory in this case, and
> SKIP LOCKED is not allowed."*

> *"these clauses do not apply to WITH queries referenced by the primary query. If you want
> row locking to occur within a WITH query, specify a locking clause within the WITH query."*

### PostgreSQL 18 — NOTIFY
<https://www.postgresql.org/docs/18/sql-notify.html>

> *"if a NOTIFY is executed inside a transaction, the notify events are not delivered until
> and unless the transaction is committed."*
> *"if a listening session receives a notification signal while it is within a transaction,
> the notification event will not be delivered to its connected client until just after the
> transaction is completed (either committed or aborted)… So notification events are only
> delivered between transactions. The upshot of this is that applications using NOTIFY for
> real-time signaling should try to keep their transactions short."*
> *"If the same channel name is signaled multiple times with identical payload strings within
> the same transaction, only one instance of the notification event is delivered to
> listeners."*
> *"NOTIFY guarantees that notifications from the same transaction get delivered in the order
> they were sent. It is also guaranteed that messages from different transactions are
> delivered in the order in which the transactions committed."*
> *"In the default configuration it must be shorter than 8000 bytes. (If binary data or large
> amounts of information need to be communicated, it's best to put it in a database table and
> send the key of the record.)"*
> *"There is a queue that holds notifications that have been sent but not yet processed by
> all listening sessions. If this queue becomes full, transactions calling NOTIFY will fail
> at commit. The queue is quite large (8GB in a standard installation)"*
> *"no cleanup can take place if a session executes LISTEN and then enters a transaction for
> a very long time."*
> *"A transaction that has executed NOTIFY cannot be prepared for two-phase commit."*
> *"To send a notification you can also use the function `pg_notify(text, text)`."*
> *"the notification event message" includes "the notifying session's server process PID"* —
> so a listener can ignore its own writes.

---

## 7 · Edge runtime deprecation and what still runs globally

### Next.js — `runtime` route segment config
<https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime>
(lastUpdated 2026-04-30, version 16.3.4)

🔴 Verbatim:
> *"* **`'nodejs'`** (default) * **`'edge'`** (deprecated)"*
> *"The Edge Runtime is deprecated. Remove the `runtime` export from your route files."*
> *"This option cannot be used in Proxy."*

### Next.js — Edge Runtime Deprecated (error message page)
<https://nextjs.org/docs/messages/edge-runtime-deprecated>
> *"One or more routes in your application use `export const runtime = 'edge'`, which is
> deprecated."*
> *"Remove the `runtime` export from your route files: `- export const runtime = 'edge'`"*
> *"The Node.js runtime is the default, so no replacement is needed."*
> *"This applies to all route files that support the `runtime` segment config: `page.ts`,
> `layout.ts`, `route.ts`, and API routes."*

⚠️ The docs describe it as deprecated and say to remove the export. **They do not state a
removal version and do not state that the build fails.** Anything stronger than "deprecated,
warning only" is unconfirmed — say so.

### Next.js — proxy.js
<https://nextjs.org/docs/app/api-reference/file-conventions/proxy>
> *"Proxy defaults to using the Node.js runtime. The `runtime` config option is not available
> in Proxy files. Setting the `runtime` config option in Proxy will throw an error."*
Version history: `v16.0.0` — *"Middleware is deprecated and renamed to Proxy. Proxy defaults
to the Node.js runtime"*; `v15.5.0` — *"Middleware can now use the Node.js runtime (stable)"*.
> *"The name Proxy clarifies what Middleware is capable of. The term "proxy" implies a network
> boundary in front of the app, which is how this feature behaves. It can run outside of your
> application's main runtime and handle requests before they reach your app."*

### Next.js — Deploying to Platforms
<https://nextjs.org/docs/app/guides/deploying-to-platforms>

> *"To run Next.js, your platform needs **a Node.js server**. That's it."*
> *"A single `next start` process handles every Next.js feature correctly: Server Components,
> ISR, PPR, Cache Components, Server Actions, Proxy, and `after()`."*
> *"Additional infrastructure (CDN caching, edge compute, shared cache) primarily improves
> performance and multi-instance consistency."*
> *"**Functional fidelity** means every Next.js feature works correctly… **Performance
> fidelity** means features achieve their optimal performance characteristics."*
> *"The "Edge Stitching" column is a **performance optimization**, not a correctness
> requirement. All features work correctly from a single origin server."*
> *"**Streaming Required** means the platform must support chunked transfer encoding or
> HTTP/2 streaming and must not buffer the response before sending it to the client."*
> *"**Shared Cache Recommended** means multiple server instances benefit from shared cache
> backends to coordinate… Without shared cache, each instance maintains its own cache
> independently — features still work correctly on each instance, but revalidation events
> don't propagate across instances."*
Feature matrix rows worth reusing: Proxy / Middleware — Streaming **No**, Shared Cache **No**,
Edge Stitching **No**, *"Runs at edge or origin"*. `after()` — *"Requires graceful shutdown
support"*.
CDN infrastructure compatibility table (Cloudflare Workers/KV/R2, Akamai EdgeWorkers/EdgeKV,
CloudFront Lambda@Edge/KeyValueStore/S3, Fastly Compute/KV Store, Azure Functions/Managed
Redis, Google Cloud Run) with *"These are available building blocks, not finished
integrations."*
> *"Next.js's rendering model places the static/dynamic boundary at the component level rather
> than the route level. Finer-grained boundaries provide more flexibility for developers at
> the cost of broader requirements for hosting platforms."*

### Next.js — Using a CDN with Next.js
<https://nextjs.org/docs/app/guides/cdn-caching>

Cache-Control by rendering strategy, verbatim:
> *"**Static pages** (no revalidation): `s-maxage=31536000` (one year)"*
> *"**ISR pages** (time-based revalidation): `s-maxage={revalidate},
> stale-while-revalidate={expire - revalidate}`. The default `expire` is one year, so
> `stale-while-revalidate` is included in the response header by default."*
> *"**Dynamic pages** (no caching): `private, no-cache, no-store, max-age=0,
> must-revalidate`"*
> *"Static assets (JavaScript, CSS, images, fonts) served from `/_next/static/` include
> content hashes in their filenames and have a 1 year `max-age` and `immutable` directive:
> `public, max-age=31536000, immutable`"*

🔴 The CDN-vs-on-demand gap:
> *"CDN-level caching alone does not support on-demand revalidation (`revalidateTag()` /
> `revalidatePath()`): those calls invalidate the Next.js server cache, but the CDN will
> continue serving its cached copy until the `s-maxage` TTL expires. To propagate on-demand
> revalidation to the CDN, trigger CDN purges alongside your revalidation call."*

Vary headers Next.js sets: `rsc`, `next-router-state-tree`, `next-router-prefetch`,
`next-router-segment-prefetch`, `next-url`.
> *"Many CDNs don't support `Vary` without additional configuration. Next.js addresses this
> with the `_rsc` search parameter: a hash of the relevant request header values that acts as
> a cache-key"*
> *"**The `rsc` header** must be forwarded from the client to the server… If a CDN strips it,
> the server returns HTML when the client-side router expects RSC data, which breaks
> client-side navigation, causing browser navigations instead."*
> *"**The `_rsc` search parameter** must be included in the cache key… By default, when an RSC
> request arrives without the correct `_rsc` value, the server responds with a **307
> redirect** to the URL with the correct hash. This behavior can be disabled by setting
> `experimental.validateRSCRequestHeaders` to `false`."*
> *"`proxy.js` (previously Middleware) should run before the CDN cache so it remains the
> source of truth for auth, redirects, and rewrites."*
> *"The Next.js team is working on moving all cache-affecting inputs into the URL pathname,
> eliminating the need for `Vary` on custom headers and removing the `_rsc` search
> parameter."* — status: *"It is in active design."*

---

## 8 · Custom cache structures

### Next.js — `use cache` · Cache keys
<https://nextjs.org/docs/app/api-reference/directives/use-cache>

> *"A cache entry's key is generated using a serialized version of its inputs, which includes:
> 1. **Build ID** - Unique per build, changing this invalidates all cache entries. If
> `deploymentId` is configured, it overrides the build ID for cache key purposes.
> 2. **Function ID** - A secure hash of the function's location and signature in the codebase
> 3. **Serializable arguments** - Props (for components) or function arguments
> 4. **HMR refresh hash** (development only)"*

> *"When a cached function references variables from outer scopes, those variables are
> automatically captured and bound as arguments, making them part of the cache key."*
> *"When a cached function reads root parameters, only the ones it actually reads become part
> of its cache key."*
> *"Arguments to cached functions and their return values must be serializable."*
> *"Arguments and return values use different serialization systems. Server Component
> serialization (for arguments) is more restrictive than Client Component serialization (for
> return values)."*
> *"You can accept non-serializable values **as long as you don't introspect them**."*
> *"Cached functions and components **cannot** access runtime APIs like `cookies()`,
> `headers()`, or `searchParams`, and the restriction follows the call stack… with the
> `next-request-in-use-cache` error. On a dynamically rendered route this surfaces when the
> route runs, so it can pass `next build` and fail under `next start`."*
Runtime caching behaviour table:
> *"**Serverless** — Cache entries typically don't persist across requests (each request can
> be a different instance), or during revalidation. Build-time caching works normally."*
> *"**Self-hosted** — Cache entries persist across requests."*
> *"Neither caching directive carries over to a new deploy, because the cache key includes the
> build (or `deploymentId`) ID."*
> *"When Draft Mode is enabled, all cached functions and components re-execute on every
> request, and results are not saved to the cache."*

### Next.js — `cacheTag`
<https://nextjs.org/docs/app/api-reference/functions/cacheTag>

🔴 The limits, verbatim:
> *"**Limits**: A single `cacheTag()` call accepts up to 128 tags, each with a maximum length
> of 256 characters. Tags longer than 256 characters are skipped, and any tags past the 128th
> in one call are dropped. Both cases log a console warning."*
> *"**Idempotent Tags**: Applying the same tag multiple times has no additional effect."*

### Next.js — `revalidateTag`
<https://nextjs.org/docs/app/api-reference/functions/revalidateTag>
> *"`revalidateTag` cannot be called in Client Components or Proxy, as it only works in server
> environments."*
> *"Tags are case-sensitive and must not exceed 256 characters. A tag that exceeds the limit is
> never assigned to cached data, so revalidating it does nothing."*
> *"**`profile="max"` (recommended)**: A one year window, long enough that requests are always
> served stale content while the revalidation runs."*
> *"**`{ expire: 0 }`**: Stale content is never served, so the next request is a blocking
> revalidate/cache miss."*
> *"**No second argument (deprecated)**: Behaves like `{ expire: 0 }`."*
> *"A revalidation is triggered by a request, not by the `revalidateTag` call, so pages using
> the tag revalidate as they are visited rather than all at once."*
> *"The single-argument form `revalidateTag(tag)` is deprecated. It currently works if
> TypeScript errors are suppressed, but this behavior may be removed in a future version."*

### Next.js — `updateTag`
<https://nextjs.org/docs/app/api-reference/functions/updateTag>
> *"`updateTag` can **only** be called from within Server Actions. It cannot be used in Route
> Handlers, Client Components, or any other context."*
> *"`updateTag` immediately expires the cached data for the specified tag. The next request
> will wait to fetch fresh data rather than serving stale content"*

### Next.js — `cacheLife`
<https://nextjs.org/docs/app/api-reference/functions/cacheLife>

Preset table, verbatim:

| Profile | Use Case | `stale` | `revalidate` | `expire` |
|---|---|---|---|---|
| `default` | Standard content | 5 minutes | 15 minutes | never |
| `seconds` | Real-time data | 30 seconds | 1 second | 1 minute |
| `minutes` | Frequently updated content | 5 minutes | 1 minute | 1 hour |
| `hours` | Content updated multiple times per day | 5 minutes | 1 hour | 1 day |
| `days` | Content updated daily | 5 minutes | 1 day | 1 week |
| `weeks` | Content updated weekly | 5 minutes | 1 week | 30 days |
| `max` | Stable content that rarely changes | 5 minutes | 30 days | 1 year |

> *"`cacheLife` cannot be used at module scope. Calling it at the top level of a file will
> throw an error."*
> *"When you set both `revalidate` and `expire`, `expire` must be longer than `revalidate`.
> Next.js validates this and raises an error for invalid configurations."*
> *"Any omitted properties in a custom profile inherit from the `default` profile."*
> *"The server sends the stale time via the `x-nextjs-stale-time` response header"*
> *"**Minimum of 30 seconds is enforced** to ensure prefetched links remain usable."*
> *"When you call revalidation functions from a Server Action… the entire client cache is
> immediately cleared, bypassing the stale time."*
Prerendering behaviour, verbatim:
> *"**`revalidate` of `0`, or `expire` under 5 minutes**: excluded from prerenders, becoming a
> "dynamic hole" resolved at request time. **`stale` under 30 seconds**: excluded from
> prerenders, because a prefetch would expire before the user could click. **`stale` of at
> least 30 seconds but under 5 minutes**: included in prerenders, but excluded from the
> route's App Shell."*
> *"Of the presets, only `seconds` falls under any of these thresholds: its `expire` of 1
> minute excludes it from prerenders."*
> *"The `cacheLife` function's type signature is generated from `next.config.ts` during `next
> dev`, `next build`, or `next typegen`"*

### Next.js — `cacheHandlers`
<https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers>
(introduced `v16.0.0`)

> *"**Most applications don't need custom cache handlers.** The default in-memory cache works
> well in the typical use case."*
> *"The default in-memory cache is isolated to each Next.js process. If you're running multiple
> servers or containers, each instance will have its own cache that isn't shared with others
> and is lost on restart."*
> *"**`default`**: Used by the `'use cache'` directive. **`remote`**: Used by the
> `'use cache: remote'` directive."*
> *"If you don't configure `cacheHandlers`, Next.js uses an in-memory LRU (Least Recently Used)
> cache for both `default` and `remote`."*
> *"You can also define additional named handlers (e.g., `sessions`, `analytics`) and reference
> them with `'use cache: <name>'`."*
> *"Note that `'use cache: private'` does not use cache handlers and cannot be customized."*

Interface:
```ts
get(cacheKey: string, softTags: string[]): Promise<CacheEntry | undefined>
set(cacheKey: string, pendingEntry: Promise<CacheEntry>): Promise<void>
refreshTags(): Promise<void>
getExpiration(tags: string[]): Promise<number>
updateTags(tags: string[], durations?: { expire?: number }): Promise<void>
```
```ts
interface CacheEntry {
  value: ReadableStream<Uint8Array>
  tags: string[]
  stale: number
  timestamp: number
  expire: number
  revalidate: number
}
```
> *"The entry may still be pending when this is called (i.e., its value stream may still be
> written to). Your handler should await the promise before processing the entry."*
> *"`getExpiration` returns: `0` if none of the tags were ever revalidated; a timestamp (in
> milliseconds) representing the most recent revalidation; `Infinity` to indicate soft tags
> should be checked in the `get` method instead."*
> *"`refreshTags()` — Called periodically before starting a new request to sync with external
> tag services."*
> *"**`updateTags()`** is called when `revalidateTag()` is invoked."*

Soft tags:
> *"Soft tags are implicit tags that Next.js automatically generates based on the route path.
> Every segment in the path gets a layout tag, plus the leaf route itself. For example, the
> route `/blog/hello` generates soft tags for `/layout`, `/blog/layout`, `/blog/hello/layout`,
> and `/blog/hello`. These tags are prefixed internally with `_N_T_`."*

Streams:
> *"**Use `.tee()`** if you need to both store and return the stream."*
> *"**Memory implications**: large pages produce large cache entries. For S3-like storage
> backends, consider streaming directly to storage without buffering the entire entry in
> memory."*
> *"**Partial writes**: the stream may error partway through rendering. Your handler should
> decide whether to keep partial entries or discard them. Discarding is safer, as partial
> entries can produce incomplete pages."*

Error handling:
> *"**`set()` failure**: the response is still served to the user because `set()` is called
> asynchronously after the response stream is already flowing."*
> *"**`get()` failure**: your handler should catch internal errors and return `undefined` (the
> "cache miss" signal). The framework does not wrap `get()` in a try/catch, so an unhandled
> exception from `get()` will propagate as a render error."*
> *"**Partial writes**: if a cache entry is partially written and then read, the behavior is
> undefined. Use atomic writes or a write-then-rename pattern to avoid serving partial
> entries."*

### Next.js — `use cache: remote`
<https://nextjs.org/docs/app/api-reference/directives/use-cache-remote>
> *"The `'use cache: remote'` directive lets you declaratively specify that a cached output
> should be stored in a remote cache instead of in-memory, providing durable caching shared
> across all server instances. This comes with tradeoffs: infrastructure cost and network
> latency during cache lookups."*
When to avoid, verbatim:
> *"If operations are already fast (< 50ms) due to proximity or local access, the remote cache
> lookup might not improve performance"*
> *"If cache keys have mostly unique values per request (search filters, price ranges,
> user-specific parameters), cache utilization will be near-zero"*
> *"If data changes frequently (seconds to minutes), cache hits will quickly go stale, leading
> to frequent misses and waiting for upstream revalidation"*
When it makes sense:
> *"Remote caching provides the most value when content is deferred to request time (outside
> the static shell)."*
> *"**Rate-limited APIs** … **Protecting slow backends** … **Expensive operations** … **Flaky
> or unreliable services**"*
> *"Note that `use cache` still provides value beyond server-side caching: it informs Next.js
> what can be prefetched and defines stale times for client-side navigation."*

### Next.js — How revalidation works
<https://nextjs.org/docs/app/guides/how-revalidation-works>
> *"When running multiple Next.js instances behind a load balancer, revalidation events are
> local by default. Calling `revalidateTag()` on instance A only invalidates the cache on that
> instance."*
> *"When a route is revalidated, Next.js regenerates **both** the HTML response and the RSC
> payload… Both artifacts are stored together in the same cache entry."*
> *"If a platform's cache serves HTML from one render and an RSC payload from a different
> render, users may see stale or mismatched content during client-side navigation."*
> *"Your handler must catch errors in `refreshTags()`: if it throws, the exception propagates
> as a request failure."*
> *"A thrown error is not treated as a cache miss; it propagates as a render error, so always
> return `undefined` to signal a miss."*
> *"The revalidation system prioritizes availability over strict consistency."*
> *"Cache failures result in degraded performance (stale content, extra renders), not broken
> applications."*
> *"during rolling deployments, a client built with deploy A may receive responses from a
> server running deploy B. `deploymentId` mitigates this"*

### Vercel — Runtime Cache (`getCache`)
<https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package>
> *"Returns a `RuntimeCache` object that allows you to interact with the Vercel Runtime Cache
> in any Vercel region."*
> *"This operation is propagated globally across all Vercel regions within 300ms."* (about
> `expireTag`)
> *"The maximum size of an item in the cache is 2 MB… A cached item can have a maximum of 128
> tags. The maximum tag length is 256 bytes."*
> *"Next.js's `revalidatePath` and `revalidateTag` API does not invalidate the Runtime
> Cache."*
`addCacheTag` limits: *"A cached response can have a maximum of 128 tags. The maximum tag
length is 256 bytes (UTF-8 encoded). Tag names cannot contain commas."*

---

## 9 · Claims I could NOT settle from a primary source

| Claim | What I wrote instead |
|---|---|
| A concrete removal version for `runtime = 'edge'` | Stated the docs mark it deprecated and say to remove the export, and that they **do not name a removal release** |
| Whether Next.js emits the edge deprecation as a build warning vs an error | Stated the docs describe it as a warning message (`/docs/messages/edge-runtime-deprecated` is titled *"Why This Warning Occurred"*) and that nothing in the docs says the build fails |
| Numeric `maxDuration` ceilings per plan | Not quoted. The Next.js doc only says platforms consume `maxDuration` from build output |
| Whether Next's dev server (`next dev`) buffers SSE | Not claimed |
| Exact per-browser HTTP/1.1 connection limit outside Chrome/Firefox | Quoted MDN's "6" and its own attribution, and marked it a per-browser-per-domain limit rather than a spec rule |
| That `request.signal` aborts in every Next deployment target | Framed as the Fetch standard's `Request.signal` plus the stream's `cancel()` callback, and said the framework docs do not enumerate per-platform abort behaviour |

---

## 10 · Libraries touched (pins the coordinator must add)

| Library | Version verified | Where | Note |
|---|---|---|---|
| `ws` | **not verified** — no version claimed on any page | topic 03 (custom server WebSocket) | Referenced by name only; no version-specific claim made, so no pin is strictly required. Report it. |
| `@vercel/functions` | **not verified** — Vercel docs do not print a version | topics 03/04 | Referenced by name only |
| `@vercel/queue` | Beta, no version printed | topic 04 | Referenced by name only |

No page in topics 03/04/05 makes a version-specific claim about a third-party library, so
none of the above is a hard pin requirement under the library-scope rule. Reported anyway.

---

## 11 · Queues, idempotency and cron — banked 2026-09-05 by ch15 fork C

🔴 **Not in sections 1–10.** Do not re-fetch.

### PostgreSQL 18 — INSERT
Source: <https://www.postgresql.org/docs/18/sql-insert.html>
> *"Only rows that were successfully inserted or updated will be returned."*
> *"ON CONFLICT DO NOTHING simply avoids inserting a row as its alternative action."*
> *"For ON CONFLICT DO NOTHING, it is optional to specify a conflict_target; when omitted, conflicts with all usable constraints (and unique indexes) are handled."*
> *"While CREATE INDEX CONCURRENTLY or REINDEX CONCURRENTLY is running on a unique index, INSERT ... ON CONFLICT statements on the same table may unexpectedly fail with a unique violation."*

### Stripe — idempotent requests
Source: <https://docs.stripe.com/api/idempotent_requests>
> *"Stripe's idempotency works by saving the resulting status code and body of the first request made for any given idempotency key, regardless of whether it succeeds or fails. Subsequent requests with the same key return the same result, including 500 errors."*
> 🔴 *"You can remove keys from the system automatically after they're at least 24 hours old. We generate a new request if a key is reused after the original is pruned."*
> *"The idempotency layer compares incoming parameters to those of the original request and errors if they're not the same."*
> *"Avoid using sensitive data … as idempotency keys."*
> *"All POST requests accept idempotency keys."*

### BullMQ 6.3.4
> <https://docs.bullmq.io/guide/workers/stalled-jobs>: *"if the CPU is very busy … the worker may not have time to renew the lock … which is likely to result in the job being marked as stalled."*
> <https://docs.bullmq.io/guide/workers/graceful-shutdown>: *"This call will not timeout by itself."*
> <https://docs.bullmq.io/guide/connections>: *"Classes that need blocking Redis commands, such as Worker and QueueEvents, will create duplicated connections internally."*

⚠️ **`https://docs.bullmq.io/guide/postgresql-backend` returns an EMPTY BODY.** The nav lists
it and the Queues pager confirms it exists. `04g` makes **no claim** about what that backend
supports or whether it offers transactional enqueue. Do not fill this in from memory.

### Vercel — cron quickstart
Source: <https://vercel.com/docs/cron-jobs/quickstart>
> *"Vercel invokes cron jobs only for production deployments and not for preview deployments."*

⚠️ Vercel's own cron example compares the secret with `!==`. `04h` quotes their code verbatim,
offers `timingSafeEqual` as defence in depth, and explicitly does **not** claim their version
is exploitable.

### Two SQL corrections worth keeping
- A windowed requeue using `row_number()` in an `UPDATE … SET` target list is **not permitted**
  by PostgreSQL. `04db` flags it and gives the `UPDATE … FROM (SELECT …)` rewrite.
- `04e` claims only what a unique constraint guarantees (at most one row per key) plus the two
  verbatim `INSERT` rules above. It does **not** describe lock-wait mechanics under concurrent
  uncommitted inserts — no settling sentence was found.
