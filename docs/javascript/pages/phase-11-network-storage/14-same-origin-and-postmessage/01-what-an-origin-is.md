---
title: "1 · What an origin is"
sidebar_label: "1 · What an origin is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy), [Origin (glossary)](https://developer.mozilla.org/en-US/docs/Glossary/Origin), [`Location`](https://developer.mozilla.org/en-US/docs/Web/API/Location), [`document.domain`](https://developer.mozilla.org/en-US/docs/Web/API/Document/domain), [`<iframe>` `sandbox`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe), [`X-Frame-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options). Documentation-validated; **no timings**.

**An origin is a tuple: scheme, host, port.** Two URLs are same-origin when all three match.
Nothing else counts — not the path, not the query, not the user, not the certificate.

```
https://shop.example.com/a/b?c=1
└─┬──┘  └──────┬────────┘ └────┘
scheme      host          path — irrelevant
                          port: implied 443
```

| Compared with `http://store.company.com/dir/page.html` | Result | Why |
|---|---|---|
| `http://store.company.com/dir2/other.html` | ✅ same origin | "Only the path differs" |
| `https://store.company.com/page.html` | ❌ | "Different protocol" |
| `http://store.company.com:81/dir/page.html` | ❌ | "Different port (`http://` is port 80 by default)" |
| `http://news.company.com/dir/page.html` | ❌ | "Different host" |

🔴 **The port is part of it, and the default port is implied rather than absent.**
`http://x.com` and `http://x.com:80` are the same origin; `http://x.com:8080` is a third
party to both. That single rule explains why a dev server on `:3000` cannot read from an API
on `:8080` even though both are `localhost`.

⚠️ **"Same origin" is not "same site".** `a.example.com` and `b.example.com` are *same-site*
and **cross-origin** — which is why cookies (site-scoped) and `localStorage` (origin-scoped)
disagree about who can see what, covered in
[09 · 02](../09-cookies/02-tokens-and-samesite.md) and
[10 · 01](../10-web-storage/01-the-api-and-what-it-costs.md).

## Origins you did not expect

- **`about:blank` and `javascript:` URLs inherit** the origin of the document containing
  them — so a blank iframe you created is same-origin with you, and scripting it works.
- **`data:` URLs get a new, empty security context** — an opaque origin that is same-origin
  with nothing, including itself.
- **`file:///` documents are treated as opaque origins** in modern browsers: "files from the
  same folder are not assumed to be same-origin and may trigger CORS errors". Opening
  `index.html` from disk is not a smaller version of serving it.
- **A sandboxed `<iframe>` without `allow-same-origin` has an opaque origin too.** Anything
  it posts arrives with `event.origin === "null"` — the **string**, and it is
  **chunk 2**'s most dangerous edge, because `"null"` is not a value you
  can allow-list meaningfully.

## What the policy actually restricts

**It is not "cross-origin is blocked".** MDN splits it into three, and only one is generally
disallowed:

| Interaction | Default | Examples |
|---|---|---|
| **Writes** | ✅ typically allowed | links, redirects, form submissions |
| **Embedding** | ✅ typically allowed | `<script>`, `<img>`, `<link rel=stylesheet>`, `<iframe>`, `@font-face`, `<video>` |
| **Reads** | ❌ typically disallowed | reading a cross-origin response body, an embedded document's DOM |

🔴 **"Reads are disallowed but read access is often leaked by embedding."** That sentence is
the whole security model in one line, and it is why the details matter:

- **A cross-origin `<script>` runs with your page's privileges** — the origin that matters is
  the *embedding document's*, not the script URL's. A compromised CDN is a compromise of your
  page (**15 · CSP** *(not written yet)* is the mitigation).
- **Error details are hidden for cross-origin scripts** — a `window.onerror` from one arrives
  as the opaque `"Script error."` unless the script is served with CORS and `crossorigin`.
- **Sizes and load timing leak** — an `<img>` you cannot read still tells you whether it
  loaded, and how big it is.
- **Embedding is what CORS then re-opens for reads**, deliberately and per-response
  ([05 · CORS](../05-cors-client-side/README.md)).

## What you can touch across a window boundary

Given a cross-origin `iframe.contentWindow`, `window.opener`, `window.parent` or the return
of `window.open()`, the reachable surface is a **fixed, tiny allow-list** — everything else
throws a `SecurityError`:

| On `Window` | On `Location` |
|---|---|
| `blur()`, `close()`, `focus()`, **`postMessage()`** | `replace()` |
| read `closed`, `frames`, `length`, `opener`, `parent`, `self`, `top`, `window` | **write** `href` |
| read/write `location` | |

**Two consequences worth internalising:**

1. 🔴 **`location.href` is write-only across origins.** You can navigate someone else's frame
   and you cannot read where it is. That asymmetry is exactly why
   `postMessage(msg, targetOrigin)` needs an explicit target — "a malicious site can change
   the location of the window without your knowledge" (**chunk 2** *(next)*).
2. **`window.opener` is a live handle back to the opener.** A page you link to with
   `target="_blank"` can call `opener.location.replace(...)` and navigate the tab the user
   came from — the reason `rel="noopener"` exists. Modern browsers imply it for
   `target="_blank"`, but the attribute is still the thing you can point at in review.

⚠️ **`iframe.contentDocument` is `null` cross-origin, not an error you can catch usefully.**
The DOM of a document you do not own is simply not there.

## `document.domain` is dead — do not learn it

Setting `document.domain = "company.com"` on two pages under different subdomains used to
make them same-origin. **It is deprecated**, and MDN's warning is that it "undermines
same-origin policy security". Three specifics that make it unusable even where it still
works:

- **Both sides must set it**, and any assignment "overwrites the port number to `null`", so
  `company.com:8080` cannot be paired with `company.com` by setting it on one side only.
- **It throws `SecurityError` in a sandboxed `<iframe>`.**
- 🔴 **It does not affect origin checks in Web APIs** — `localStorage`, `indexedDB`,
  `BroadcastChannel` and `SharedWorker` keep their real origins, so the "same origin" it
  creates is partial and inconsistent.

**The replacement is `postMessage`**, which is the whole of chunk 2 — an explicit channel
between origins instead of pretending the boundary is not there.

## Controlling who may embed *you*

The policy protects you from reading others. It does nothing about others framing you, and a
framed page is a clickjacking target — the user clicks your button believing it is something
else.

```http
X-Frame-Options: DENY
Content-Security-Policy: frame-ancestors 'none'
```

**`frame-ancestors` is the modern one**, and MDN notes plainly that sites "can use
`X-Frame-Options` header to prevent cross-origin framing". Both are **response headers** — a
client-side "am I framed?" check (`window.top !== window.self`) is a fallback, not a
defence, because the framing page controls what runs after it.

⚠️ **And when you are the one embedding**, `<iframe sandbox>` removes capabilities from the
frame — scripts, forms, popups, same-origin identity — and adding `allow-same-origin` gives
its origin back. **`sandbox="allow-scripts allow-same-origin"` on same-origin content is the
combination that removes the sandbox entirely**, because the framed page can reach out and
rewrite its own sandbox attribute.

## Gotchas

**Symptom → cause → fix.**

- **`localhost:3000` cannot read `localhost:8080`** → different port means different origin →
  CORS on the API, or a dev-server proxy.
- **The page works served over HTTP and breaks on HTTPS** → scheme is part of the origin, and
  mixed content is blocked besides → make every URL scheme-relative to the page or absolute
  `https:`.
- **`iframe.contentDocument` is `null` with no exception** → cross-origin document, no DOM
  access → use `postMessage`.
- **`window.onerror` reports only `"Script error."`** → cross-origin script, details withheld
  → serve the script with CORS headers and add `crossorigin` to the tag.
- **Opening `index.html` from disk triggers CORS errors** → `file:///` is an opaque origin →
  serve it over HTTP, even locally.
- **A message arrives with `origin === "null"`** → a sandboxed iframe without
  `allow-same-origin`, or a `data:` URL → treat it as untrusted; it cannot be allow-listed
  meaningfully.
- **Subdomains still cannot share state after setting `document.domain`** → it is deprecated
  and does not apply to storage APIs → use `postMessage`, or a shared backend.
- **A partner site frames your app and users are phished through it** → nothing prevents
  framing by default → send `frame-ancestors` (or `X-Frame-Options`).

## Interview questions

**What exactly makes two URLs same-origin?** Identical scheme, host and port. Paths, queries
and fragments are irrelevant; a default port counts as that port.

**Is cross-origin access blocked?** No — writes and embedding are generally allowed, only
reads are generally disallowed, and embedding leaks some read information anyway (load
success, dimensions, timing). CORS is what selectively re-opens reads.

**What can you do with a cross-origin `window` reference?** A short allow-list:
`postMessage`, `blur`, `focus`, `close`, a few read-only booleans, and `location.href` as
**write-only** plus `location.replace()`. Everything else throws.

**Why does `rel="noopener"` matter?** Without it the opened page gets a live `window.opener`
and can navigate the tab it was opened from — cross-origin navigation is a permitted write.

**Why is `document.domain` not the answer for subdomain communication?** It is deprecated,
requires both sides to opt in, nulls the port, throws in sandboxed frames, and does not
change the origin used by `localStorage`, `IndexedDB`, `BroadcastChannel` or `SharedWorker`.
`postMessage` is the supported mechanism.

**Same-origin policy protects you from reading others — what protects you from being
framed?** `Content-Security-Policy: frame-ancestors` or `X-Frame-Options`, both response
headers. A JavaScript frame-busting check is not a defence.

---

← [Overview](./README.md) · Next → **2 · `postMessage`** *(next)*
