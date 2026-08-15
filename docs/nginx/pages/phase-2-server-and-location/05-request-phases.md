---
title: "The request-processing phases"
sidebar_label: "05 · Request-processing phases"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html)
> ("Internal Implementation" — the stack machine and the processing order),
> [Development guide](https://nginx.org/en/docs/dev/development_guide.html)
> (*"`ngx_http_core_run_phases()` … runs request phases from
> `NGX_HTTP_POST_READ_PHASE` to `NGX_HTTP_CONTENT_PHASE`. The last phase is
> intended to generate a response and pass it along the filter chain."*),
> [njs reference](https://nginx.org/en/docs/njs/reference.html) (processing
> repeats from `NGX_HTTP_SERVER_REWRITE_PHASE` / `NGX_HTTP_REWRITE_PHASE`),
> [ngx_http_js_module](https://nginx.org/en/docs/http/ngx_http_js_module.html)
> (`js_access` is *"a handler in the access phase"*; a variable referenced only in
> `log_format` *"will not be executed until the log phase"*) and
> [ngx_http_headers_module](https://nginx.org/en/docs/http/ngx_http_headers_module.html)
> (`add_header`'s status list and `always`).
>
> ⚠️ **Scope note.** The full ordered list of `NGX_HTTP_*_PHASE` constants lives in
> the development guide's *Phases* section, which could not be retrieved in full
> while writing this page. Rather than reproduce a list from memory — which this
> bible does not do — the page teaches the ordering through behaviours that each
> have their own documented source, named above.
>
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**A request does not run your configuration top to bottom. It passes through a
fixed sequence of stages, and each module's directives execute in the stage they
belong to — no matter where in the file you wrote them. Configuration order is not
execution order.**

## The order that matters to you

Five stages account for essentially everything a fullstack config does:

| Stage | What runs | Directives |
|---|---|---|
| **1. Read and normalise** | the request line and headers are parsed; the client address may be rewritten | `realip` (`set_real_ip_from`, `real_ip_header`) |
| **2. Server rewrite** | rewrite directives written at `server` level | `rewrite`, `return`, `set`, `if` at server level |
| **3. Find the location** | the algorithm from [page 03](03-location-matching/README.md) | — |
| **4. Location rewrite** | rewrite directives inside the chosen location | `rewrite`, `return`, `set`, `if` |
| **5. Access, then content, then log** | who may proceed; who generates the response; what gets recorded | `allow`/`deny`, `auth_request`, `limit_req` · `proxy_pass`, `root`, `try_files` · `access_log` |

Two documented anchors bound the sequence. The development guide states that
`ngx_http_core_run_phases()` *"runs request phases from
`NGX_HTTP_POST_READ_PHASE` to `NGX_HTTP_CONTENT_PHASE`"* — so reading the request
is first and generating the response is last — and that *"the last phase is
intended to generate a response and pass it along the filter chain"*, which is the
mechanism the whole second half of this page depends on.

The rewrite module's own documentation supplies stages 2–4 exactly:

> 1. *"directives of this module specified on the server level are executed
>    sequentially"*
> 2. *"repeatedly: a location is searched based on a request URI; directives of
>    this module specified inside the found location are executed sequentially;
>    the loop is repeated if a request URI was rewritten, but not more than 10
>    times"*

And the log stage is documented by implication in the njs module: a variable
*"referenced only in the `log_format` directive … will not be executed until the
log phase"* — so logging happens after the response, and a variable's value there
is its final one.

## Why this explains three things

### 1. `set` before `proxy_pass` does not do what it looks like

```nginx
location / {
    set $x "before";
    proxy_pass http://app;      # content stage
    set $x "after";             # ✗ STILL runs before proxy_pass — rewrite stage
}
```

Both `set` directives belong to the rewrite module and both execute in stage 4.
`proxy_pass` runs in the content stage, long after. It sees `$x = "after"`.

**The rule: within a stage, order is the order you wrote. Across stages, the stage
wins.** Use `map` for derived values ([Phase 1](../phase-1-configuration-language/06-map/README.md))
and the question disappears.

### 2. `realip` fixes `$remote_addr` for everything downstream

`set_real_ip_from` and `real_ip_header` act in stage 1, before any location is
chosen. That is precisely why they work: by the time `limit_req` counts a key in
the access stage, or `access_log` writes a line in the log stage, `$remote_addr`
already holds the real client address.

The consequence for Phase 9 is direct: **rate limiting behind a CDN is fixed at
stage 1, not at the limit itself.** Get `realip` right and every later stage is
automatically correct.

### 3. 🔴 `add_header` disappears on a 500

This is the one to remember, and it has two independent causes that both live in
this page.

**Cause A — it is a response filter, and it has a status-code list.** The
documentation is exact: `add_header` *"adds the specified field to a response
header provided that the response code equals 200, 201, 204, 206, 301, 302, 303,
304, 307, or 308"*. A 500, a 404, a 403 from `deny` — none of those are in the
list.

```nginx
add_header Strict-Transport-Security "max-age=63072000" always;
#                                                       ^^^^^^
#  `always` (1.7.5) adds the header "regardless of the response code"
```

**Cause B — the replace rule.** If any level below defines an `add_header`, the
inherited ones are gone
([Phase 1, page 02](../phase-1-configuration-language/02-inheritance.md)).

Both together are why "my security header is missing" is nginx's most reported
non-bug. **Write `always` on every security-relevant header, and check what the
level below defines.**

The reason it is a *filter* at all is the documented one: the content stage
generates a response and passes it along a **filter chain**. `add_header`, `gzip`,
`sub_filter` and `ssi` are all links in that chain, which is also why the response
headers you see are the product of everything in it rather than of one directive.

## What runs after the response

The log stage runs **after** the response has been sent. Three consequences:

- **`$status`, `$body_bytes_sent` and `$request_time` are only final at log
  time** — which is exactly why they are meaningful in `access_log` and useless
  earlier.
- **`access_log … if=$var`** evaluates its condition at that point, so a variable
  set anywhere earlier in the request is available (Phase 10).
- **A slow client inflates `$request_time`** but not `$upstream_response_time`,
  because the former measures until the last byte reaches the client and the
  latter measures the backend. Phase 10 is that distinction in full.

## What this means for reading a config

Three habits follow, and they are the practical output of the page:

1. **Do not reason about a config top to bottom.** Ask which stage a directive
   belongs to. `rewrite`/`set`/`if`/`return` are early; `allow`/`deny`/
   `auth_request`/`limit_req` are in the middle; `proxy_pass`/`root`/`try_files`
   produce the response; `access_log` is last.
2. **A directive that "does not take effect" is usually running at a different
   time than you assumed** — or was replaced by inheritance. Those two causes
   cover most of it.
3. **Anything you want on every response, including errors, needs `always`.**

## Gotchas

**Symptom:** A `set` in a location has no effect on `proxy_pass`.
**Cause:** All rewrite-module directives run in the rewrite stage, before the
content stage where `proxy_pass` runs — regardless of file order.
**Fix:** Use `map` to derive the value. `set` is only safe where the ordering does
not matter.

**Symptom:** Security headers are present on 200s and missing on 404s and 500s.
**Cause:** `add_header` applies only to the documented status list without
`always`.
**Fix:** Add `always` to every security header. Verify by requesting a URL that
404s, not the site root.

**Symptom:** `realip` is configured and `limit_req` still counts the CDN's
address.
**Cause:** `set_real_ip_from` does not list the CDN's ranges, so `$remote_addr`
was never rewritten — and the access stage saw the original.
**Fix:** List the actual ranges. Everything downstream corrects itself once stage
1 is right (Phase 4).

**Symptom:** A variable logged in `access_log` has a different value than you set
earlier in the request.
**Cause:** The log stage runs after the response, so you are seeing the final
value — after any rewrite or internal redirect changed it.
**Fix:** Expected. If you need the earlier value, capture it into a separate
variable before the change.

**Symptom:** An `add_header` inside an `if` block dropped the ones outside it.
**Cause:** The replace rule — `if` is a configuration level
([Phase 1](../phase-1-configuration-language/07-if-is-evil/README.md)).
**Fix:** Do not put `add_header` inside `if`. Use `map` and a variable value,
relying on nginx omitting a header whose value is empty.

## Trade-off

**Fixed phases give you a predictable pipeline and take away the ability to
express order directly.** You cannot say "do this, then that" across modules; you
can only place directives and let the pipeline decide when they run. For anyone
arriving from application code, that is the single least intuitive thing about
nginx — the file reads like a script and is not one.

What it buys is that every request costs the same well-defined traversal, modules
compose without knowing about each other, and there is no per-request ordering
logic to get wrong. The cost is that "why did this not happen?" needs a mental
model rather than a read-through — which is why this page exists at all, and why
its practical output is three habits rather than a diagram.

## Interview questions

**★ Why does a `set` written after `proxy_pass` still take effect before it?**
Because they run in different stages. All rewrite-module directives — `set`,
`rewrite`, `return`, `if` — execute in the rewrite stage, while `proxy_pass`
generates the response in the content stage. Within a stage the order is the order
you wrote; across stages, the stage wins. Configuration order is not execution
order.

**★ Why does a security header set with `add_header` disappear on a 500?**
Two independent reasons. `add_header` only applies to the documented status list
(200, 201, 204, 206, 301, 302, 303, 304, 307, 308) unless you add `always`. And if
any configuration level below defines its own `add_header`, the inherited set is
replaced. Both are common, and both produce a silently missing header.

**★ Why does the `realip` module have to run early?**
Because it rewrites `$remote_addr` in the first stage, before a location is even
chosen. Everything downstream — access rules, `limit_req` counting, the access log
— then sees the true client address automatically. Fixing the client IP at that
stage is why rate limiting behind a CDN works at all.

**When does the log stage run, and why does it matter?**
After the response has been sent. That is why `$status`, `$body_bytes_sent` and
`$request_time` are meaningful there and not earlier, and why a variable logged in
`access_log` shows its final value after any rewrite. The njs documentation notes
that a variable referenced only in `log_format` is not evaluated until the log
phase.

**What is the filter chain?**
The development guide describes the last phase as generating a response and
passing it along a filter chain. `add_header`, `gzip`, `sub_filter` and `ssi` are
links in it, which is why the headers a client finally receives are the product of
the whole chain rather than of any single directive.

**A directive in your config appears to have no effect. What are the two most
likely explanations?**
It is running at a different stage than you assumed — so something later
overwrote its effect, or it ran before the thing it was meant to influence. Or a
configuration level below it redefined the same multi-valued directive and
discarded the inherited set. Those two account for most of it.

---

← Prev: [Named locations, `internal` and nesting](04-named-and-internal.md) · Index: [Phase 2](README.md) · Next → [Internal redirects](06-internal-redirects/README.md)
