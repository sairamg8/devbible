---
title: "XSS and correct output encoding"
sidebar_label: "09 · XSS and encoding"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — `node:http` and `JSON.stringify` behaviour
> executed on this machine.

**XSS is an encoding bug, not a filtering bug.** The same string is safe in one context
and executable in another, so "sanitise the input" is the wrong frame — you encode on the
way *out*, for the context you are writing into.

## Why input filtering fails

A value is stored once and rendered in many places: HTML text, an attribute, a URL, a
`<script>` block, a CSS value. Each has different metacharacters. A filter at the input
boundary has to guess every future context, and it will be wrong for one of them — while
also corrupting legitimate data, because `O'Brien` and `1 < 2` are not attacks.

Encode at the point of output, where the context is known.

| Output context | Encoding |
|---|---|
| HTML text | `&lt; &gt; &amp;` — what a template engine does by default |
| HTML attribute | Entity-encode **and always quote** the attribute |
| JavaScript string / JSON in a script | `<` for `<`, plus JSON encoding |
| URL parameter | `encodeURIComponent` |
| CSS value | Avoid entirely — do not interpolate into CSS |

## The Node-specific trap: JSON in a script tag

Server-rendered state is the classic case, and `JSON.stringify` does not make it safe:

```js
const user = {name: '</script><script>alert(1)</script>'};
html += `<script>window.__USER__ = ${JSON.stringify(user)};</script>`;
```

```console
<script>window.__USER__ = {"name":"</script><script>alert(1)</script>"};</script>
```

**The `</script>` inside the string terminates the block early**, and everything after it
is markup the browser parses. `JSON.stringify` is doing its job correctly — its job is
JSON, and JSON has no opinion about HTML.

The fix is to escape every `<` as its unicode escape, so it can never close a tag:

```js
const safe = JSON.stringify(user).replace(/</g, '\\u003c');
```

```console
<script>window.__USER__ = {"name":"\u003c/script>\u003cscript>alert(1)\u003c/script>"};</script>
```

No `<` survives, so nothing can terminate the block. `\u003c` is a valid JSON escape, so
`JSON.parse` still yields the original string — verified. Escape `\u2028` and `\u2029`
alongside it: both are legal inside JSON strings but are **line terminators in JavaScript**.

Better still, do not embed state in a script at all. Put it in
`<script type="application/json">` and `JSON.parse` its `textContent` — a non-executable
type means a breakout has nothing to run.

## `Content-Type` decides whether markup executes

Node sets **no** `Content-Type` unless you do:

```console
/html   -> content-type: text/html
/plain  -> content-type: text/plain
/none   -> content-type: (none)
```

With no header, the browser sniffs — and content it decides is HTML gets parsed as HTML,
whatever you intended. A user-uploaded file echoed back, an error message containing
input, a JSON endpoint that omits the header: all of them can execute.

```js
res.setHeader('content-type', 'application/json; charset=utf-8');
res.setHeader('x-content-type-options', 'nosniff');
```

`nosniff` tells the browser to trust the declared type rather than guess
([page 22](./22-security-headers.md)). Serve user-uploaded files from a separate origin
with `Content-Disposition: attachment` — same-origin uploads are a stored-XSS delivery
mechanism no encoding fixes.

## React is not immunity

JSX escapes interpolated values, which removes the common case. The exceptions are
explicit, and they are where React apps get hit:

```jsx
<div dangerouslySetInnerHTML={{__html: post.body}} />   // exactly what it says
<a href={user.website}>profile</a>                       // javascript:alert(1)
```

**A `javascript:` URL in `href` or `src` executes on click**, and JSX will not stop it —
it is a valid attribute value. Validate the scheme:

```js
const u = URL.parse(candidate);                    // returns null instead of throwing
const safeHref = u && (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '#';
```

Server-side templating has the same shape: `{{ }}` escapes in most engines, `{{{ }}}` or
`| safe` does not. Grep for the unescaped form in review — it is a short list and it is
where the bugs are.

## When you must accept HTML

Rich-text input is a real requirement. **Do not write the sanitiser.** Use a maintained,
allowlist-based library, run it where you control the environment, and keep it updated —
bypasses are found regularly, which is the whole argument against your own regex.

```js
import createDOMPurify from 'dompurify';
import {JSDOM} from 'jsdom';
const DOMPurify = createDOMPurify(new JSDOM('').window);
const clean = DOMPurify.sanitize(userHtml, {ALLOWED_TAGS: ['p','b','i','em','strong','a','ul','ol','li']});
```

Allowlist tags and attributes — never denylist. And sanitise on **output** as well as on
storage, so a library update improves already-stored content.

## The defence that survives a mistake

Encoding is the fix; **CSP is what limits the damage when you miss one**
([page 22](./22-security-headers.md)). A policy without `unsafe-inline` means an injected
`<script>` does not run even if it lands in the page.

And [page 03](./03-token-storage.md) is the other half: with an `HttpOnly` cookie, XSS
cannot read the session credential, so the blast radius is a compromised page rather than
a stolen, portable credential.

## Gotchas

**Symptom:** Server-rendered state breaks the page, or executes
**Cause:** `JSON.stringify` does not escape `</script>`.
**Fix:** Replace `<` with `\u003c` (and `\u2028`/`\u2029`), or use
`<script type="application/json">`.

**Symptom:** A JSON response renders as HTML in the browser
**Cause:** No `Content-Type`, so the browser sniffed — Node sets none by default.
**Fix:** Set it explicitly, plus `X-Content-Type-Options: nosniff`.

**Symptom:** XSS in a React app that "escapes everything"
**Cause:** `dangerouslySetInnerHTML`, or a `javascript:` URL in `href`.
**Fix:** Sanitise HTML with a library; validate URL schemes against http/https.

**Symptom:** An uploaded file executes script on your domain
**Cause:** User content served same-origin with a sniffable type.
**Fix:** Separate origin, `nosniff`, `Content-Disposition: attachment`.

**Symptom:** Escaping corrupts legitimate data — `O&#39;Brien` in the database
**Cause:** Encoding applied on input instead of output.
**Fix:** Store raw, encode when rendering, per context.

**Symptom:** An unquoted attribute is exploitable despite entity encoding
**Cause:** `<div class={{value}}>` — a space ends the attribute.
**Fix:** Always quote attributes.

**Symptom:** A homegrown sanitiser is bypassed
**Cause:** Denylisting tags or regex-based filtering.
**Fix:** An allowlist-based, maintained library.

## Interview questions

**★ Why is input sanitisation the wrong fix for XSS?**
Because safety depends on the output context, and one stored value is rendered into
several. A filter at input has to predict every future context, corrupts legitimate data
in the process, and still misses one. Encode on output, for the context you are writing
into.

**★ What is wrong with `JSON.stringify` inside a `<script>` tag?**
It does not escape `</script>`, so a string containing it terminates the block early and
the rest is parsed as markup — verified. Replace `<` with `\u003c` (still valid JSON,
`JSON.parse` unaffected), also escape `\u2028`/`\u2029`, or use a non-executable
`<script type="application/json">`.

**★ How does `Content-Type` relate to XSS?**
If you do not set it — and Node sets none by default — the browser sniffs and may parse
your response as HTML, executing markup in it. Set the type explicitly and send
`X-Content-Type-Options: nosniff`.

**★ Does React make you safe from XSS?**
It removes the common case by escaping interpolated values, but not
`dangerouslySetInnerHTML`, and not a `javascript:` URL in an `href` or `src` — JSX treats
that as an ordinary attribute value. Validate URL schemes, and sanitise any HTML you
render.

**What if the product genuinely needs rich text?**
Use a maintained allowlist-based sanitiser rather than writing one, allowlist tags and
attributes, and sanitise on output as well as on storage so library updates improve
existing content.

**What limits the damage when an encoding bug slips through?**
CSP without `unsafe-inline` stops injected script from running, and an `HttpOnly` cookie
means the session credential cannot be read and carried away. Encoding is the fix; those
two bound the failure.

---

← Prev: [Injection](./08-injection.md) · Next → [Path traversal](./10-path-traversal.md)
