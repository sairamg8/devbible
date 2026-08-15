---
title: "1 · The API and the attributes"
sidebar_label: "1 · The API and the attributes"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Document.cookie`](https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie), [Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies), [`Set-Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie), [`encodeURIComponent()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent), [`CookieStore`](https://developer.mozilla.org/en-US/docs/Web/API/CookieStore), [`CookieStore.set()`](https://developer.mozilla.org/en-US/docs/Web/API/CookieStore/set), [Cookies Having Independent Partitioned State (CHIPS)](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies). Documentation-validated; **no timings**.

## Reading and writing are not symmetric

```js
document.cookie;
// "theme=dark; lang=en; session=abc123"  — every readable cookie, one string
```

🔴 **Reading gives you names and values only.** No `Path`, no `Expires`, no `Domain`, no
way to tell which cookie came from where — and **no `HttpOnly` cookies at all**, which is
the entire point of that flag.

```js
document.cookie = "theme=dark; Path=/; Max-Age=31536000; SameSite=Lax";
// sets ONE cookie — the others are untouched
```

⚠️ **Assignment is not assignment.** `document.cookie = "..."` looks like it replaces the
string you just read; it does not. It is a setter that parses one `Set-Cookie`-style
directive. Writing the whole string back would create one absurd cookie.

**Parsing the read side, since nothing does it for you:**

```js
const cookies = Object.fromEntries(
  document.cookie.split("; ").filter(Boolean).map((pair) => {
    const i = pair.indexOf("=");
    return [decodeURIComponent(pair.slice(0, i)), decodeURIComponent(pair.slice(i + 1))];
  }),
);
```

⚠️ **Split on the first `=` only** — a base64 value ends in `=` padding, and
`pair.split("=")` throws that away.

## Encode the value

```js
document.cookie = `note=${encodeURIComponent("hello; world")}`;   // ✅
document.cookie = "note=hello; world";                             // 🔴 truncated at ";"
```

🔴 **`;` separates directives, so an unencoded semicolon silently truncates the value** and
the rest is parsed as a bogus attribute. Commas and whitespace cause related problems.
**Encode on write, decode on read** — always, not only when you expect punctuation.

## The attributes

| Attribute | Does | Default if omitted |
|---|---|---|
| `Path=/` | which URL paths the cookie is sent to | the current directory — rarely what you want |
| `Domain=example.com` | share with subdomains | host-only: this exact host |
| `Max-Age=3600` | lifetime in seconds | session cookie — dies with the browser session |
| `Expires=<date>` | lifetime as a date | as above; `Max-Age` wins if both are present |
| `Secure` | HTTPS only | sent over plain HTTP too |
| `HttpOnly` | 🔴 invisible to JavaScript | readable by any script on the page |
| `SameSite=Lax` | cross-site behaviour ([chunk 2](./02-tokens-and-samesite.md)) | `Lax` in modern browsers |
| `Partitioned` | separate storage per top-level site | shared |

**Three of these deserve a closer look.**

### `Path` — the default is the trap

**Omitting `Path` does not mean "everywhere".** It means the directory of the page that set
the cookie, so a cookie set on `/admin/settings` is not sent to `/`. **Set `Path=/`
explicitly** unless you have a reason not to.

### `Domain` — omitting it is *narrower*, not wider

```js
// on app.example.com
document.cookie = "a=1";                        // host-only: app.example.com
document.cookie = "b=1; Domain=example.com";    // example.com AND every subdomain
```

⚠️ **This is backwards from most people's intuition** — specifying a `Domain` *widens*
scope to include subdomains. And you cannot set a cookie for a domain you are not on, or
for a public suffix such as `.com`.

### `HttpOnly` — you cannot set it from JavaScript

```js
document.cookie = "session=abc; HttpOnly";   // 🔴 the flag is ignored
```

🔴 **Only a server can set `HttpOnly`, via a `Set-Cookie` response header.** That is
structural: a flag whose purpose is to hide a cookie from scripts would be worthless if a
script could apply — or re-apply without it — at will.

## 🔴 Deleting, and why it fails

**There is no delete. You overwrite the cookie with one that has already expired:**

```js
document.cookie = "theme=; Max-Age=0; Path=/";
```

⚠️ **The `Path` and `Domain` must match what the cookie was set with.** They are part of a
cookie's identity, so a mismatch does not delete anything — it *creates a second cookie*
with the same name at a different scope, and now `document.cookie` contains both. The
symptom is a value that "will not delete", or one that reappears on the next page.

```js
// the cookie was set with Path=/admin
document.cookie = "token=; Max-Age=0";               // 🔴 no effect — path defaults to here
document.cookie = "token=; Max-Age=0; Path=/admin";  // ✅
```

🔴 **And an `HttpOnly` cookie cannot be deleted from JavaScript at all** — logging out has
to be a request to the server, which clears it with its own `Set-Cookie`.

## Size and count

**A cookie is capped at roughly 4 KB including its attributes**, and browsers limit how
many a single domain may hold. Exceeding either fails **silently** — the write simply does
not take, with no exception.

🔴 **The real cost is not storage, it is bandwidth.** Every cookie in scope is attached to
**every matching request** — HTML, JSON, images, stylesheets, fonts. A 3 KB cookie on a
page making 60 requests is 180 KB of upload the user never asked for, on every page view.

✅ **So: keep an identifier in the cookie and the data on the server.** A cookie is a
pointer, not a place to keep user preferences, feature flags or a serialised profile.

**Always check the write took:**

```js
document.cookie = `k=${encodeURIComponent(v)}; Path=/; SameSite=Lax`;
const ok = document.cookie.includes("k=");   // ✅ silent failure is the default
```

## `CookieStore` — the modern API

```js
await cookieStore.set({ name: "theme", value: "dark", path: "/", sameSite: "lax" });
const c = await cookieStore.get("theme");    // an object with attributes
await cookieStore.delete("theme");           // ✅ an actual delete
cookieStore.addEventListener("change", (e) => { … });
```

**It is asynchronous, returns structured objects, has a real `delete`, and can notify you
when a cookie changes** — everything `document.cookie` is not. ⚠️ **Check your targets**;
availability is not universal, and it still cannot see `HttpOnly` cookies, which is by
design.

## Gotchas

**Symptom:** Deleting a cookie did nothing, or created a duplicate
**Cause:** `Path`/`Domain` are part of a cookie's identity and did not match.
**Fix:** Expire it with the same `Path` and `Domain` it was set with.

**Symptom:** A cookie was missing on other pages of the site
**Cause:** `Path` defaulted to the setting page's directory.
**Fix:** `Path=/`.

**Symptom:** A cookie value was truncated
**Cause:** An unencoded `;` in the value ends the value and starts an attribute.
**Fix:** `encodeURIComponent` on write, `decodeURIComponent` on read.

**Symptom:** A base64 value lost its trailing `=`
**Cause:** `pair.split("=")` splits on every `=`.
**Fix:** Split on the first one only.

**Symptom:** `document.cookie = "...; HttpOnly"` had no effect
**Cause:** JavaScript cannot set `HttpOnly` — only a server can.
**Fix:** Set it from the server's `Set-Cookie`.

**Symptom:** A session cookie was not visible to JavaScript
**Cause:** It is `HttpOnly` — working exactly as intended.
**Fix:** Nothing. Ask the server; do not remove the flag to make debugging easier.

**Symptom:** Writing a cookie silently did nothing
**Cause:** The ~4 KB size cap or the per-domain count limit. Both fail without an error.
**Fix:** Store an id and keep the payload server-side; verify the write.

**Symptom:** Requests were unexpectedly large
**Cause:** Cookies ride on every matching request, including static assets.
**Fix:** Shrink them, or scope them with `Path` so they are not sent to asset routes.

**Symptom:** Assigning `document.cookie` wiped nothing but nothing changed either
**Cause:** Assignment sets one cookie; it neither replaces the whole jar nor merges.
**Fix:** Write one directive per cookie.

## Interview questions

**★ Why is `document.cookie` considered a bad API?**
Reading and writing are asymmetric and neither does what the syntax suggests. A read
returns every readable cookie as one `name=value` string with no attributes and no
`HttpOnly` cookies; a write looks like assignment but sets exactly one cookie; and there is
no delete — you overwrite with an expired cookie whose `Path` and `Domain` must match, or
nothing happens.

**★ Why does deleting a cookie so often fail?**
Because a cookie's identity includes its `Path` and `Domain`. Expiring `name=` with a
different path creates a *second* cookie rather than removing the first, so the value
appears to survive. And an `HttpOnly` cookie cannot be removed from JavaScript at all —
logout must go through the server.

**★ What does the `Domain` attribute do, and what is counter-intuitive about it?**
It widens scope. Omitting it gives a host-only cookie for exactly the current host;
specifying `Domain=example.com` shares it with every subdomain. People expect the opposite.
You also cannot set a cookie for a domain you are not on, or for a public suffix.

**★ Why can't JavaScript set `HttpOnly`?**
Because the flag exists to hide a cookie from scripts. If a script could set it — or reset
the cookie without it — the protection would be meaningless. Only a server's `Set-Cookie`
can apply it.

**★ What is the real cost of a large cookie?**
Upload bandwidth. Cookies are attached to every matching request, including images,
stylesheets and fonts, so a few kilobytes multiplies across every request on every page
view. Cookies should hold an identifier; the data belongs on the server.

**What happens when a cookie exceeds the size limit?**
Nothing visible — the write silently fails. There is no exception and no return value, so
the only way to know is to read it back.

**What does `CookieStore` improve?**
It is asynchronous, returns structured objects with their attributes, has a genuine
`delete`, and fires change events. It still cannot see `HttpOnly` cookies, which is
deliberate. Check availability before depending on it.

---

[Topic index](./README.md) · Next: [2 · Tokens, `SameSite` and the real decision](./02-tokens-and-samesite.md) →
