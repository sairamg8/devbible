---
title: "Variables"
sidebar_label: "04 · Variables"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_core_module — embedded variables](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> (every description quoted below), [ngx_http_map_module](https://nginx.org/en/docs/http/ngx_http_map_module.html)
> (lazy evaluation), [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html)
> (`$upstream_*`) and [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html)
> (`set`, `uninitialized_variable_warn`).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**nginx variables are not variables. They are named accessors, evaluated the
moment they are read and not before, and most of them are read-only views onto
the request. Treating them as storage is the source of a whole family of bugs.**

## Three kinds

| Kind | Example | Where it comes from |
|---|---|---|
| **Built-in** | `$uri`, `$host`, `$remote_addr`, `$status` | The core module and each other module — you cannot set these |
| **Pattern** | `$http_x_request_id`, `$sent_http_content_type`, `$arg_page`, `$cookie_session` | Generated on demand from a header, response header, query argument or cookie |
| **Yours** | `set $backend "app";`, or anything a `map` or a regex capture creates | The rewrite module, `map`, `geo`, `split_clients` |

## The pattern families

These four cover most of what you will ever need, and none of them has to be
declared:

| Pattern | Reads | Example |
|---|---|---|
| `$http_<name>` | a **request** header | `$http_user_agent`, `$http_authorization`, `$http_x_forwarded_for` |
| `$sent_http_<name>` | a **response** header | `$sent_http_content_type`, `$sent_http_cache_control` |
| `$arg_<name>` | a query-string argument | `?page=2` → `$arg_page` |
| `$cookie_<name>` | a cookie | `$cookie_session` |

**The naming rule, quoted:** *"the last part of a variable name is the field name
converted to lower case with dashes replaced by underscores"*. So
`X-Request-ID` becomes `$http_x_request_id`. Every time. Get this wrong and you
get an empty string rather than an error, which is the theme of this page.

## The three URI variables

The one distinction to memorise, because it decides what you log and what you
forward:

| Variable | Documented as | Contains arguments? | Changes during processing? |
|---|---|---|---|
| **`$request_uri`** | "full original request URI (with arguments)" | **yes** | **no** — always the original |
| **`$uri`** | "current URI in request, normalized"; *"the value may change during request processing"* | **no** | **yes** — rewrites and internal redirects change it |
| `$document_uri` | "same as `$uri`" | no | yes |

Worked through, for `GET /a/../b/index.html?x=1` on a server that internally
redirects to `/index.html`:

| | Value |
|---|---|
| `$request_uri` | `/a/../b/index.html?x=1` — raw, original, untouched |
| `$uri` at first | `/b/index.html` — normalized, no query string |
| `$uri` after the internal redirect | `/index.html` |
| `$args` | `x=1` |
| `$is_args` | `?` (empty string when there are no arguments) |

The practical rules:

- **Logging and redirects → `$request_uri`.** It is what the client actually
  asked for, and it already includes the query string. This is why the canonical
  HTTPS redirect is `return 301 https://$host$request_uri;` and needs no `$args`
  handling (page 08).
- **Matching and internal decisions → `$uri`.** It is normalized and reflects
  where the request currently *is*.
- **Never build a redirect from `$uri`** — you will silently drop the query
  string.

Two related ones worth knowing: `$document_root` is "root or alias directive's
value for the current request", and `$realpath_root` is the same with symlinks
resolved.

## The ones you will actually use

| Variable | Documented meaning | Where |
|---|---|---|
| `$host` | *"host name from the request line, or … the 'Host' request header field, or the server name matching a request"* — in that order | proxying, redirects |
| `$scheme` | `http` or `https` | `X-Forwarded-Proto`, redirects |
| `$https` | `on` in SSL mode, otherwise empty string | conditional logic |
| `$remote_addr` | client address — **rewritten by `realip`** (Phase 4) | logs, rate limits |
| `$proxy_add_x_forwarded_for` | the client's `X-Forwarded-For` with `$remote_addr` appended | Phase 4 |
| `$request_id` | "unique request identifier generated from 16 random bytes, in hexadecimal" (1.11.0) | end-to-end tracing (Phase 10) |
| `$request_time` | "request processing time … time elapsed since the first bytes were read from the client" | Phase 10 |
| `$upstream_response_time` | how long the **backend** took | Phase 10 |
| `$status` | response status (1.3.2) | logs |
| `$body_bytes_sent` / `$bytes_sent` | response bytes, without / with headers | logs |
| `$time_iso8601` | local time, ISO 8601 | JSON logs |
| `$binary_remote_addr` | the client address in binary — a quarter of the memory as a rate-limit key | Phase 9 |
| `$connection`, `$connection_requests` | connection serial number, and requests on it | keep-alive debugging |

`$request_id` deserves the emphasis it gets in Phase 10: it is a free,
per-request trace id you can forward to Node and echo in your application logs,
turning two unrelated log streams into one.

## `$host` is not `$http_host`, and the difference is security

Both look like "the hostname the client asked for", and they differ in the case
that matters:

| | `$http_host` | `$host` | `$server_name` |
|---|---|---|---|
| Source | the raw `Host` header, exactly | request line, else `Host` header, else **the matching server name** | the `server_name` value that matched |
| Client-controlled | **entirely** | mostly | **no** |
| Empty when no `Host` header | yes | no — falls back | no |
| Lowercased / port stripped | no | yes | n/a |

**Prefer `$host`.** It is normalized and never empty. But note that "mostly
client-controlled" is still client-controlled: an attacker can send any `Host`
header, and if your default server accepts it, `$host` is their value. That is a
real attack (password-reset links built from `$host`, cache poisoning), and the
defence is Phase 2's catch-all default server. `$server_name` is the only one of
the three that cannot be influenced by the client.

## Evaluated when used, not when declared

The `map` documentation states it directly: *"Since variables are evaluated only
when they are used, the mere declaration even of a large number of 'map'
variables does not add any extra costs to request processing."*

Two consequences:

1. **Declaring `map` blocks is free.** Fifty of them cost nothing on a request
   that reads none.
2. **A variable's value can differ depending on where it is read.** `$uri` after
   a rewrite is not `$uri` before it. This is not a caching bug; it is the whole
   design.

`map` results *are* cached per request unless the block is declared `volatile`
(page 06). Built-ins like `$uri` are not cached — they reflect current state.

## `set`, and why it is not a variable assignment

```nginx
set $backend "app";                       # rewrite module, not a general assignment
set $cache_bypass "1";
```

`set` belongs to `ngx_http_rewrite_module`, whose directives *"are compiled at the
configuration stage into internal instructions that are interpreted during request
processing"* by *"a simple virtual stack machine"*. It runs in the rewrite phase —
early, and **not in the order the file suggests** relative to other modules'
directives.

That is why this does not work the way it reads:

```nginx
location / {
    set $x "before";
    proxy_pass http://app;      # runs in the content phase, long after set
    set $x "after";             # ✗ still runs BEFORE proxy_pass
}
```

Both `set` directives execute during the rewrite phase; `proxy_pass` sees
`$x = "after"`. **Configuration order is not execution order** — Phase 2 covers
the phases properly. Prefer `map` for deriving values (page 06) and use `set`
only for genuinely simple, order-independent cases.

## Undefined variables

Reading a header that was not sent gives an **empty string**, not an error:

```nginx
proxy_set_header X-Trace $http_x_trace_id;   # empty string if the client sent none
```

A *misspelled* built-in is different — `$reqest_uri` fails at startup with
`unknown "reqest_uri" variable`, because nginx validates variable names it knows
about. The dangerous case is the pattern families: `$http_anything` is always
valid syntax, so a typo in a header name is silently an empty string forever.

`uninitialized_variable_warn` (default `on`) logs a warning when an
uninitialized variable is used, which is worth having in the error log while you
develop.

## Gotchas

**Symptom:** A redirect loses the query string — `?next=/dashboard` disappears.
**Cause:** The redirect was built from `$uri`, which never contains arguments.
**Fix:** `return 301 https://$host$request_uri;`. `$request_uri` is the full
original including the query string, which is exactly why the canonical redirect
is written that way.

**Symptom:** `$http_x_request_id` is always empty even though the header is
being sent.
**Cause:** The name conversion — lower case, dashes to underscores. `X-Request-ID`
is `$http_x_request_id`; anything else is a different, empty variable.
**Fix:** Apply the rule mechanically. And remember there is no error for this: an
unknown `$http_*` name is valid syntax and evaluates to an empty string.

**Symptom:** Password-reset emails contain an attacker's domain, or the cache
serves the wrong site.
**Cause:** The application built absolute URLs from a client-controlled `Host`,
forwarded by nginx as `$host`.
**Fix:** A catch-all default server that rejects unknown hostnames (Phase 2), and
`$server_name` where you need a value the client cannot influence.

**Symptom:** `nginx: [emerg] unknown "foo" variable` on startup.
**Cause:** A misspelled built-in, or a variable created by a module that is not
loaded.
**Fix:** Check the spelling and the module. Note this only protects you for
*known* variables — `$http_foo` and `$arg_foo` never produce this error.

**Symptom:** A `set` directive appears to be ignored by `proxy_pass`.
**Cause:** All rewrite-module directives run in the rewrite phase, before the
content phase where `proxy_pass` runs — regardless of the order they appear in the
file.
**Fix:** Use `map` to derive the value (page 06). Reserve `set` for
order-independent cases.

## Trade-off

**Lazily evaluated, silently-empty variables make nginx configs cheap and
fragile.** Nothing costs anything until it is read, `map` blocks are free to
declare, and headers you did not receive do not need guarding. In exchange, a
mistyped variable name produces no error at any point — not at `nginx -t`, not at
reload, not at request time — just an empty value that quietly changes behaviour.

The mitigation is habits, not tooling: apply the `$http_*` naming rule
mechanically, use `$request_uri` for anything client-facing, and check derived
values by logging them (Phase 10) rather than assuming they are set.

## Interview questions

**★ What is the difference between `$uri` and `$request_uri`?**
`$request_uri` is the full original request URI **including the query string**,
and it never changes. `$uri` is the current, normalized URI **without**
arguments, and it does change during processing — rewrites and internal redirects
update it. Use `$request_uri` for logs and redirects; use `$uri` for internal
matching.

**★ Why is `return 301 https://$host$request_uri;` the correct HTTPS redirect?**
Because `$request_uri` already carries the path and the query string exactly as
the client sent them, so nothing is lost and no `$args` handling is needed.
Building the same redirect from `$uri` silently drops the query string.

**★ How do you read an arbitrary request header?**
`$http_<name>`, with the name lower-cased and dashes replaced by underscores —
`X-Request-ID` becomes `$http_x_request_id`. Response headers use
`$sent_http_<name>`, query arguments `$arg_<name>`, cookies `$cookie_<name>`. A
name you never received evaluates to an empty string, not an error.

**★ What is the difference between `$host`, `$http_host` and `$server_name`?**
`$http_host` is the raw `Host` header and can be absent. `$host` is normalized —
request line, else `Host` header, else the matching server name — and is never
empty, which makes it the usual choice. `$server_name` is the `server_name` value
that matched and is the only one the client cannot influence, which matters when
you are building absolute URLs.

**When are nginx variables evaluated?**
Only when they are read. The `map` documentation says so explicitly: declaring
many map variables adds no per-request cost, because nothing is computed until
something uses it. `map` results are cached per request unless declared
`volatile`; built-ins reflect current state and change as the request is
processed.

**Why might a `set` directive appear not to affect `proxy_pass`?**
Because `set` belongs to the rewrite module, whose directives all execute in the
rewrite phase — before the content phase where `proxy_pass` runs — no matter where
they appear in the file. Configuration order is not execution order.

**What happens if you misspell a variable name?**
It depends. A misspelled *built-in* fails at startup with
`unknown "..." variable`. A misspelled `$http_*`, `$arg_*` or `$cookie_*` name is
perfectly valid syntax and silently evaluates to an empty string — which is the
more dangerous case, because nothing ever reports it.

---

← Prev: [`include` and the file layout](03-include-and-files.md) · Index: [Phase 1](README.md) · Next → [Units, quoting and comments](05-syntax-details.md)
