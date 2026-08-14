---
title: "rewrite, return and regular expressions"
sidebar_label: "08 · rewrite, return and regex"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html)
> — `return`, `rewrite` and its four flags, `set`, `break`, `rewrite_log`
> (default `off`), and the "Internal Implementation" section including the
> ten-iteration limit — and
> [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> (`$request_uri`, `location` regex modifiers).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**`return` ends a request. `rewrite` changes its URI and usually sends it back
around the loop. Reach for `return` first — it is simpler, faster, and covers most
of what people write `rewrite` for.**

## `return` — the one you want

```text
Syntax:   return code [text];
          return code URL;
          return URL;
Context:  server, location, if
```

```nginx
return 301 https://$host$request_uri;      # permanent redirect
return 302 /login;                         # temporary redirect
return 404;                                # a status, no body
return 200 "ok\n";                         # a status and a body
return 444;                                # close the connection, send nothing
```

`return` *"stops processing and returns the specified code to a client"*. It is
terminal: nothing after it in that context runs.

Three things worth knowing:

- **`444` is nginx's own non-standard code** — documented as closing the
  connection without sending a response header. It is the correct response to
  traffic you want to give nothing to at all (Phase 2's catch-all server, Phase
  9's blocklists).
- **The body text and the URL can contain variables**, which is what makes the
  canonical redirect below work.
- **`return 200 "…"` needs a content type.** Without `default_type` or an explicit
  `add_header Content-Type`, the browser gets whatever `default_type` says — which
  defaults to `text/plain` (topic 03).

### The canonical HTTPS redirect

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    return 301 https://$host$request_uri;
}
```

One line, no condition, no `if`, no `rewrite`. It works because `$request_uri` is
*"the full original request URI (with arguments)"* — path and query string
together, exactly as sent ([page 04](04-variables.md)).

Written with `rewrite` it would be longer, slower and would need care to preserve
the query string. This is the worked example of "prefer `return`".

## `rewrite` — changing the URI

```text
Syntax:   rewrite regex replacement [flag];
Context:  server, location, if
```

*"If the specified regular expression matches a request URI, the URI is changed as
specified in the replacement string."*

```nginx
rewrite ^/old/(.*)$ /new/$1 permanent;     # 301 to the client
rewrite ^/api/(.*)$ /v2/$1 last;           # internal, re-matches locations
```

### The four flags

| Flag | What it does |
|---|---|
| **`last`** | stop this set of rewrite directives and **search for a new location** matching the changed URI |
| **`break`** | stop this set of rewrite directives; **stay in the current location** |
| **`redirect`** | return a **302** temporary redirect to the client |
| **`permanent`** | return a **301** permanent redirect to the client |

The split that matters: **`last` and `break` stay inside nginx; `redirect` and
`permanent` go back to the browser.**

`last` versus `break` is the pair people confuse. `last` restarts location
selection with the new URI — so the request may land in a completely different
block. `break` keeps the current location's configuration and just proceeds with
the new URI.

One documented special case that catches people: *"if a replacement string starts
with `http://`, `https://`, or `$scheme`, processing stops and the redirect is
returned to a client"* — **even with no flag**. So this is a 302 whether you meant
it or not:

```nginx
rewrite ^/go$ https://example.com/;    # an external redirect, flag or no flag
```

## The execution model

The "Internal Implementation" section is short and explains most surprises. The
directives *"are compiled at the configuration stage into internal instructions
that are interpreted during request processing"* by *"a simple virtual stack
machine"*, and processing runs like this:

1. Server-level rewrite directives execute **in sequence**.
2. Then, repeatedly:
   - a **location is searched** based on the request URI;
   - the rewrite directives **inside that location** execute in sequence;
   - **the loop repeats if the URI was rewritten — but not more than 10 times.**

Three consequences:

- **Rewrite directives run early**, in the rewrite phase, before content-phase
  directives like `proxy_pass`. Configuration order is not execution order
  ([page 04](04-variables.md)).
- **`rewrite … last` re-enters location matching**, which is why it can send a
  request somewhere unexpected.
- **Ten iterations is the ceiling.** Exceed it and you get
  `rewrite or internal redirection cycle`.

## Regular expressions in nginx

nginx uses **PCRE**, and regexes appear in four places: `location ~` / `~*`,
`server_name ~`, `map` keys, and `rewrite`.

```nginx
location ~* \.(jpg|jpeg|png|gif|webp|avif)$ { expires 30d; }
rewrite ^/user/(\d+)/profile$ /profile?id=$1 last;
map $request_uri $ver { "~^/api/v(?<n>\d+)/" $n; }        # named capture
```

| Form | Meaning |
|---|---|
| `~` | case-sensitive match |
| `~*` | case-insensitive match |
| `!~`, `!~*` | negated, inside `if` only |
| `(...)` → `$1`, `$2` | positional captures |
| `(?<name>...)` → `$name` | named captures |

Four practical rules:

1. **Anchor everything.** `^` and `$` turn "contains" into "is", and an unanchored
   pattern in a `location` matches far more than intended.
2. **Escape the dot.** `\.js$` is "ends in .js"; `.js$` is "any character then
   `js`", which also matches `xjs`.
3. **Captures do not survive an internal redirect.** After `rewrite … last`, `$1`
   from the previous round is gone. Capture into a named variable with `map`, or
   with `set`, if you need the value later.
4. **Prefix locations are cheaper than regex locations**, and they are tried
   first. Use a plain prefix wherever the pattern allows it (Phase 2).

### `set` and `break`

```nginx
set $mobile 0;                   # rewrite-module variable assignment
break;                           # stop processing rewrite directives here
```

Both are rewrite-module directives, so both run in the rewrite phase. `set` is
covered on [page 04](04-variables.md) — the short version is that `map` is almost
always the better tool, because `set` runs at a time you did not choose.

### `rewrite_log`

```nginx
rewrite_log on;      # default: off
```

*"Enables … logging of `ngx_http_rewrite_module` directives processing results
into the `error_log` at the `notice` level."* Turn it on with
`error_log … notice;` while debugging a rewrite chain, and turn it back off — it
is per-request logging and it is verbose.

## Redirect status codes

| Code | Meaning | Use for |
|---|---|---|
| **301** | permanent | a URL that has genuinely moved forever |
| **302** | found / temporary | a temporary destination |
| **307** | temporary, **method preserved** | a temporary redirect that must not turn a POST into a GET |
| **308** | permanent, **method preserved** | the permanent equivalent |

**301 is cached by browsers, often aggressively and semi-permanently.** Shipping a
wrong 301 means users keep hitting the wrong destination long after you fix it,
with no way to reach them. When unsure, ship a 302, confirm it is right, then
promote it.

307 and 308 exist because 301 and 302 historically allowed clients to change a
POST into a GET on redirect. If a redirect can ever apply to a non-GET request,
use 307/308.

## Gotchas

**Symptom:** A redirect loses the query string.
**Cause:** It was built from `$uri`, which never contains arguments.
**Fix:** `return 301 https://$host$request_uri;` — `$request_uri` includes them.

**Symptom:** `rewrite or internal redirection cycle while processing "/…"`.
**Cause:** A rewritten URI still matches the rule that rewrote it, so the loop
repeats until nginx's ten-iteration limit.
**Fix:** Anchor the regex so the output cannot match the input, or use `break`
instead of `last`, or restructure into separate `location` blocks.

**Symptom:** `rewrite … last` sent the request to a completely different
`location`.
**Cause:** That is what `last` does — it restarts location selection with the new
URI.
**Fix:** Use `break` if you meant to stay in the current location. Understand
which you want before choosing.

**Symptom:** A `rewrite` with no flag produced a 302 to an external site.
**Cause:** The replacement started with `http://`, `https://` or `$scheme`, which
makes it an external redirect regardless of flag.
**Fix:** Expected behaviour — but be deliberate about it, and prefer `return` for
anything that is genuinely a redirect.

**Symptom:** `$1` is empty after a rewrite.
**Cause:** Captures do not survive an internal redirect; a new round of location
matching means new captures.
**Fix:** Capture into a named variable (`map`, or `set`) before the rewrite if the
value is needed downstream.

**Symptom:** A 301 you shipped by mistake is still redirecting users after you
fixed it.
**Cause:** Browsers cache permanent redirects, sometimes for a very long time.
**Fix:** There is no clean remedy — which is the argument for shipping 302 first
and promoting to 301 once you are sure.

## Trade-off

**`rewrite` is powerful and `return` is boring, and boring is what you want at the
edge.** A regex rewrite can express anything, runs a regular expression on every
matching request, participates in a loop with a documented iteration cap, and
interacts with location matching in ways you have to hold in your head.

`return` does one thing and stops. Most redirect requirements — canonical host,
HTTPS, a retired path — are `return` plus a `server` or `location` block, with no
regex at all. Save `rewrite` for genuine URI transformation with a capture in it,
and keep the chain short enough that the ten-iteration limit is never a
consideration.

## Interview questions

**★ What is the difference between `rewrite … last` and `rewrite … break`?**
`last` stops the current set of rewrite directives and **restarts location
matching** with the new URI, so the request may end up in a different block.
`break` stops the rewrite directives but **stays in the current location** and
continues with the new URI.

**★ Why is `return 301 https://$host$request_uri;` preferred over a `rewrite` for
the HTTPS redirect?**
It is terminal and needs no regex, and `$request_uri` is the full original URI
including the query string, so nothing is lost. The `rewrite` version is longer,
runs a regular expression, and needs care to preserve arguments.

**★ What does `return 444` do?**
It is nginx's non-standard code that closes the connection without sending any
response header — no status line, nothing. It is the right answer for traffic you
want to give nothing to, such as requests to an unrecognised `Host` on the
catch-all server.

**★ What causes `rewrite or internal redirection cycle`?**
A rewritten URI that still matches the rule which rewrote it, so location matching
and rewriting repeat. The rewrite module caps the loop at ten iterations and then
errors. Fix it by anchoring the regex, using `break`, or splitting into separate
locations.

**When should you use 307/308 instead of 301/302?**
When the redirect can apply to a non-GET request. 301 and 302 historically allowed
clients to convert a POST into a GET on redirect; 307 and 308 preserve the method
and body.

**Why should a new redirect start as a 302?**
Because browsers cache 301s aggressively and often semi-permanently. A wrong 301
keeps sending users to the wrong place long after you have fixed the config, with
no way to reach the clients that cached it. Ship 302, verify, then promote.

**Do regex captures survive a `rewrite … last`?**
No. The internal redirect restarts location matching, and `$1` from the earlier
round is gone. Capture the value into a named variable first if you need it
downstream.

---

← Prev: ["If is evil"](07-if-is-evil.md) · Index: [Phase 1](README.md) · Next → [`geo` and `split_clients`](09-geo-and-split-clients.md)
