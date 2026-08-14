---
title: "Calling them"
sidebar_label: "02 · Calling them"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`prerenderToNodeStream`](https://react.dev/reference/react-dom/static/prerenderToNodeStream)
> (all four Usage sections and the full options list) and
> [`prerender`](https://react.dev/reference/react-dom/static/prerender) (the same options,
> the `reactNode` expectation), with
> [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) for the client
> half.
> No sandbox script backs this page; claims are cited, not measured.

[Chunk 01](01-the-static-apis.md) was about what these renderers *are*. This one is about
what you actually type — the shape the root component has to take, the two ways to consume
the prelude, and the option that decides whether the page ships React at all.

## The root component renders the whole document

Both references say the same thing about `reactNode`:

> It is expected to represent the entire document, so the App component should render the
> `<html>` tag.

```js
export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/styles.css"></link>
        <title>My app</title>
      </head>
      <body>
        <Router />
      </body>
    </html>
  );
}
```

React fills in the parts you did not write:

> React will inject the **doctype** and your bootstrap `<script>` tags into the resulting
> HTML stream:

```html
<!DOCTYPE html>
<html>
  <!-- ... HTML from your components ... -->
</html>
<script src="/main.js" async=""></script>
```

And the client side matches it — `hydrateRoot` is given `document`, not a `div`:

```js
import { hydrateRoot } from 'react-dom/client';
import App from './App.js';

hydrateRoot(document, <App />);
```

🔴 **That pairing is not optional trivia.** Hydrating the whole document is what makes the
React 19 [document-metadata](../10-document-metadata/README.md) and
[stylesheet](../15-stylesheets-and-precedence.md) features work end to end — React has to own
`<head>` on both sides for hoisting and deduplication to survive hydration. A prerendered
page that mounts into a `<div>` and leaves `<head>` to a template is a different, more
limited arrangement.

Note also where the injected bootstrap script lands: **after `</html>`, with `async=""`**.
You do not place it yourself, and you do not need to.

## Consuming the prelude

**Piping it straight to a response** (Node):

```js
import { prerenderToNodeStream } from 'react-dom/static';

// The route handler syntax depends on your backend framework
app.use('/', async (request, response) => {
  const { prelude } = await prerenderToNodeStream(<App />, {
    bootstrapScripts: ['/main.js'],
  });

  response.setHeader('Content-Type', 'text/plain');
  prelude.pipe(response);
});
```

**Reading it into a string** — which is what an actual build step does, because the output is
going to a file rather than a socket:

```js
import { prerenderToNodeStream } from 'react-dom/static';

async function renderToString() {
  const {prelude} = await prerenderToNodeStream(<App />, {
    bootstrapScripts: ['/main.js']
  });

  return new Promise((resolve, reject) => {
    let data = '';
    prelude.on('data', chunk => {
      data += chunk;
    });
    prelude.on('end', () => resolve(data));
    prelude.on('error', reject);
  });
}
```

⚠️ **The reference's own example names that function `renderToString`**, which is a genuinely
confusing choice given that `renderToString` is a different React API with different
semantics. It is doing the *opposite* of what the real `renderToString` does — waiting rather
than bailing out of Suspense boundaries. Do not read the example as an equivalence.

Two details in that snippet are worth keeping when you adapt it: `'error'` is wired to
`reject`, because a stream can fail after the Promise has already resolved; and the
concatenation is the honest form for a build step, where you want the whole document as one
string to write to disk.

## The options

Identical lists on both APIs, and identical to the server renderers' with one absence
(covered in [chunk 03](03-aborting-errors-caveats.md)):

| Option | What it does |
|---|---|
| `bootstrapScripts` | *"An array of string URLs for the `<script>` tags to emit on the page. Use this to include the `<script>` that calls `hydrateRoot`. **Omit it if you don't want to run React on the client at all**."* |
| `bootstrapModules` | the same, but emits `<script type="module">` |
| `bootstrapScriptContent` | *"this string will be placed in an inline `<script>` tag"* |
| `identifierPrefix` | prefix for `useId` IDs. *"Useful to avoid conflicts when using multiple roots on the same page. **Must be the same prefix as passed to `hydrateRoot`**"* |
| `namespaceURI` | root namespace. Defaults to HTML; `'http://www.w3.org/2000/svg'` for SVG or `'http://www.w3.org/1998/Math/MathML'` for MathML |
| `onError` | *"fires whenever there is a server error, whether recoverable or not"* — [chunk 03](03-aborting-errors-caveats.md) |
| `progressiveChunkSize` | *"The number of bytes in a chunk."* — [chunk 03](03-aborting-errors-caveats.md) |
| `signal` | *"lets you abort prerendering and render the rest on the client"* — [chunk 03](03-aborting-errors-caveats.md) |

### `bootstrapScripts` is the real architectural switch

🔴 **Omitting it is a documented, supported choice, and it changes what you are building.**
With it, you get a server-rendered page that hydrates. Without it, you get HTML with **no
React on the client at all** — no bundle, no hydration, no interactivity, and none of the
cost of any of them. For a marketing page, a docs page or an email-adjacent template, that is
the entire point of prerendering.

This is the one option on the list with a consequence you would put in an architecture
document rather than a config file. It also interacts with everything in
[topic 04](../04-hydrateroot.md): if nothing calls `hydrateRoot`, the hydration cost that
topic measures out simply is not paid.

### `identifierPrefix` has to match on both sides

The requirement is stated on both the renderer and `hydrateRoot`. `useId` generates IDs from
the tree position plus this prefix; if the server used one prefix and the client another, the
IDs disagree and you get a hydration mismatch of exactly the kind
[topic 02](../02-hydration-mismatches.md) describes — one that will not reproduce in a
client-only dev server, because there is only one prefix there.

You need it when *"using multiple roots on the same page"*. If you have one root, you almost
certainly should not be setting it at all.

### `namespaceURI` is for documents that are not HTML

Defaults to HTML, which is what you want for a page. The two documented alternatives —
`'http://www.w3.org/2000/svg'` and `'http://www.w3.org/1998/Math/MathML'` — are for
prerendering a standalone SVG or MathML document, not for pages that merely *contain* SVG.
Inline `<svg>` inside an HTML page needs nothing here; React already handles the namespace
switch at the element.

## Gotchas

**Symptom:** the prerendered page renders but nothing is interactive.
**Cause:** `bootstrapScripts` was omitted, so no script calls `hydrateRoot`.
**Fix:** add it — or, if the page really is meant to be static, this is working as intended,
and it is the cheapest page you can ship.

**Symptom:** hydration warnings about `useId` values on a prerendered page, which never
reproduce locally.
**Cause:** `identifierPrefix` was passed to the prerender but not to `hydrateRoot`, or the
two differ. A client-only dev server has only one prefix, so the mismatch cannot appear there.
**Fix:** pass the same prefix on both sides, or drop it on both if you have a single root.

**Symptom:** the root component renders a `<div>` and the metadata and stylesheet hoisting
from React 19 misbehaves.
**Cause:** these APIs expect the root to *"represent the entire document"* and render
`<html>`; hoisting into `<head>` assumes React owns it.
**Fix:** render the whole document and hydrate `document`.

**Symptom:** a duplicate `<!DOCTYPE html>` or a hand-placed bootstrap `<script>` appearing
twice.
**Cause:** React injects both. The doctype and the bootstrap tags are not yours to write.
**Fix:** remove them from your component and from the surrounding template.

**Symptom:** the string-building version resolves, but the file on disk is truncated.
**Cause:** the `'error'` event was not handled, so a mid-stream failure was silent.
**Fix:** wire `'error'` to `reject` as the documented example does.

**Symptom:** SVG output comes out with wrong or missing namespaces after switching to
`namespaceURI: 'http://www.w3.org/2000/svg'`.
**Cause:** that option sets the **root** namespace for the whole stream. It is for
prerendering an SVG document, not an HTML page containing SVG.
**Fix:** leave it at the default for pages.

## Interview questions

**★ What does the root component have to render for `prerender` to work?**
The entire document, including `<html>`. Both references say the node *"is expected to
represent the entire document"*. React injects the doctype and the bootstrap `<script>` tags
around it, and the client calls `hydrateRoot(document, <App />)` to match.

**★ How do you prerender a page that ships no React at all?**
Omit `bootstrapScripts` (and `bootstrapModules`). The reference says so directly — *"Omit it
if you don't want to run React on the client at all."* You get HTML with no client runtime
and no hydration cost, which for a static page is the whole point.

**★ Why does `identifierPrefix` have to match `hydrateRoot`?**
Because `useId` derives IDs from it. Different prefixes produce different IDs on the server
and the client, which is a hydration mismatch — and one that will not show up in a
client-only dev environment, because there is only ever one prefix there.

**★ You need the prerendered HTML as a string, not a stream. How?**
Read the prelude to completion — accumulate `'data'` chunks, resolve on `'end'`, and reject on
`'error'`. That is React's own documented pattern for the Node API. Nothing is lost by doing
this: the Promise had already waited for the whole app before the stream was handed over.

**★ When would you set `namespaceURI`?**
Only when prerendering a document that is itself SVG or MathML. It sets the root namespace for
the stream. An HTML page with inline `<svg>` in it needs nothing — React handles that at the
element.

---

← Prev: [The third renderer family](01-the-static-apis.md) ·
Index: [08 · Prerendering](README.md) ·
Next → [Aborting, errors and the caveat](03-aborting-errors-caveats.md)
