---
title: "Cookies"
sidebar_label: "04 · Cookies"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Node has no cookie API. A request carries one `Cookie` header holding every
cookie; a response sets them one `Set-Cookie` line at a time. The attributes —
`HttpOnly`, `Secure`, `SameSite` — are the entire security model of session
authentication.**

## What arrives, and how

```console
$ node cookie.mjs
server sees     : "sid=abc; theme=dark"
set-cookie in   : ["p=1","q=2"]
```

Node joins duplicate `Cookie` request headers with `; ` — not the `, ` used for
every other header ([page 01](01-http-server.md)) — so the handler sees one
string in wire format regardless of how the client split them. `set-cookie` is
the opposite exception: always an array, even inbound.

## Parsing, and the parser you must not use

```js
function parseCookies(header = '') {
  const out = Object.create(null);            // no prototype: a cookie named
  for (const part of header.split(';')) {     // '__proto__' cannot poison it
    const i = part.indexOf('=');
    if (i < 0) continue;                      // attribute-less token, skip
    const k = part.slice(0, i).trim();
    if (k && !(k in out)) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
```

`indexOf` rather than `split('=')` because base64 values end in `=`. First
occurrence wins, matching what browsers and every real parser do.

`URLSearchParams` looks like it would work. It is wrong in three ways:

```console
$ node cookie.mjs
correct parser  : {"sid":"abc","theme":"dark","note":"a b+c"}
URLSearchParams : {"sid":"abc","theme":"light","note":"a b+c","flag":""}

cookie plus, manual : "a+b"
cookie plus, USP    : "a b"
```

Last occurrence wins instead of first (`theme` became `light`); the attribute-less
token `flag` was invented as an empty-string key; and `+` is decoded as a space,
so a base64 value containing `+` is silently corrupted. In production use
`cookie` (the package Express uses) — but know why the shortcut fails.

## Setting them

```js
res.setHeader('Set-Cookie', [
  'sid=s%3Anew; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800',
  'theme=dark; Path=/; SameSite=Lax',
  'legacy=; Path=/; Max-Age=0',
]);
```

```console
$ node cookie.mjs
wire            : Set-Cookie: sid=s%3Anew; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800
wire            : Set-Cookie: theme=dark; Path=/; SameSite=Lax
wire            : Set-Cookie: legacy=; Path=/; Max-Age=0
```

**One cookie per header line.** Passing an array to `setHeader` emits separate
lines; joining them into one string with `; ` produces a single malformed cookie
whose attributes swallow the others. This is the one header where the array form
is mandatory.

`res.setHeader` *replaces*. To add a cookie to a response that may already have
one, read first:

```js
const existing = res.getHeader('Set-Cookie') ?? [];
res.setHeader('Set-Cookie', [...(Array.isArray(existing) ? existing : [existing]), cookie]);
```

## The attributes

| Attribute | Effect | Use |
|---|---|---|
| `HttpOnly` | Invisible to `document.cookie` | **Every** session cookie. It is the XSS mitigation |
| `Secure` | HTTPS only | Always in production; omit on plain-HTTP localhost or the cookie never sets |
| `SameSite=Lax` | Not sent on cross-site POSTs, sent on top-level navigation | The default in current browsers; right for session cookies |
| `SameSite=Strict` | Never sent cross-site | Breaks "click the email link and be logged in" |
| `SameSite=None` | Sent everywhere — **requires `Secure`** | Third-party embeds only |
| `Max-Age` / `Expires` | Lifetime; omit both for a session cookie | `Max-Age` wins where both are present |
| `Path` / `Domain` | Scope | Widening `Domain` shares the cookie with every subdomain — usually not what you want |
| `__Host-` prefix | Browser-enforced: `Secure`, `Path=/`, no `Domain` | Free hardening for a session cookie |

```js
// the session cookie worth copying
const cookie = [
  `__Host-sid=${encodeURIComponent(token)}`,
  'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=604800',
].join('; ');
```

**Deleting a cookie means re-setting it** with an empty value, `Max-Age=0`, and
the *same* `Path` and `Domain` it was created with. A mismatched path leaves the
original in place and the user stays logged in.

## What goes in a cookie

Nothing you would mind the user editing. A cookie is client-controlled storage:
`role=admin` is a request parameter, not a fact. Two workable shapes:

- **An opaque session id** — random, ≥128 bits, looked up server-side in Redis or
  Postgres. Revocation is a delete. This is the default choice.
- **A signed token** (JWT or `cookie-signature`) — stateless, but revocation
  needs a denylist, which reintroduces the store you were avoiding.

`SameSite=Lax` blunts CSRF but does not remove it; state-changing forms still
want a CSRF token, and anything driven by a bearer token in a header sidesteps
cookies entirely. That is [Phase 8](../../syllabus/03-application.md) territory.

## Gotchas

**Symptom:** Only the last of several cookies is set
**Cause:** They were joined into one `Set-Cookie` string.
**Fix:** Pass an array to `setHeader`.

**Symptom:** The cookie never appears in the browser during local development
**Cause:** `Secure` on plain HTTP.
**Fix:** Set `Secure` only when the request is HTTPS.

**Symptom:** Logout leaves the user logged in
**Cause:** The clearing cookie used a different `Path` or `Domain`.
**Fix:** Match the original attributes exactly, plus `Max-Age=0`.

**Symptom:** A base64 cookie value comes back corrupted, `+` turned into spaces
**Cause:** Parsed with `URLSearchParams`, which applies form decoding.
**Fix:** A real cookie parser, or `decodeURIComponent` on the raw slice.

**Symptom:** Auth breaks after moving the frontend to another domain
**Cause:** `SameSite=Lax` stops the cookie on cross-site requests.
**Fix:** `SameSite=None; Secure` plus a strict CORS allow-list — or move the API
to a subdomain of the site.

**Symptom:** An object built from cookie names behaves strangely
**Cause:** A cookie named `__proto__` polluted the prototype.
**Fix:** `Object.create(null)`, or a `Map`.

## Interview questions

**★ What do `HttpOnly`, `Secure` and `SameSite` each defend against?**
`HttpOnly` keeps the cookie out of `document.cookie`, so an XSS payload cannot
exfiltrate the session. `Secure` keeps it off plaintext HTTP, defeating passive
interception. `SameSite` stops the browser attaching it to cross-site requests,
which is the CSRF defence. They are independent; a session cookie wants all three.

**★ How do you delete a cookie?**
You cannot — you overwrite it with an empty value and `Max-Age=0`, using the same
`Path` and `Domain`. Any mismatch creates a second cookie and leaves the original.

**★ Why is `URLSearchParams` the wrong cookie parser?**
It is form decoding, not cookie decoding: `+` becomes a space, later duplicates
override earlier ones where cookies take the first, and valueless tokens become
empty-string keys. Verified — `note=a+b` parsed as `"a b"`.

**★ Session id or JWT in the cookie?**
An opaque id keeps all authority server-side, so revocation is one delete and the
cookie leaks nothing. A JWT removes the lookup but makes revocation a denylist,
which is the state you were trying to avoid. Default to the id unless you have a
measured reason.

**Why is `Set-Cookie` the only header you send as an array?**
The syntax has no separator for multiple cookies — attributes are already
`;`-delimited — so each cookie needs its own header line.

**What does the `__Host-` prefix buy you?**
The browser refuses the cookie unless it is `Secure`, has `Path=/` and has no
`Domain`. It makes the hardening unforgeable by a subdomain.

---

← Prev: [HTTP in practice](03-http-fundamentals.md) · Next → [fetch](05-fetch.md)
