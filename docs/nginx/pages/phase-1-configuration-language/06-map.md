---
title: "map"
sidebar_label: "06 · map"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_map_module](https://nginx.org/en/docs/http/ngx_http_map_module.html)
> — the example, the search order, the special parameters (`default`, `hostnames`,
> `include`, `volatile`), `map_hash_max_size` (2048) and `map_hash_bucket_size`
> (32|64|128, depending on the processor's cache line size) are all quoted from it.
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**`map` creates a variable whose value depends on another variable. It is a
lookup table, it costs nothing until read, and it is the correct answer to almost
every question that starts "how do I put an `if` in my nginx config?"**

## The shape

```text
Syntax:   map string $variable { ... }
Default:  —
Context:  http
```

```nginx
http {
    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }

    server {
        location /ws/ {
            proxy_set_header Upgrade    $http_upgrade;
            proxy_set_header Connection $connection_upgrade;   # ← the mapped value
            proxy_pass http://app;
        }
    }
}
```

That is the single most-copied `map` in existence — the WebSocket upgrade block
you will meet properly in Phase 4. Read it now as a `map`: *look at
`$http_upgrade`; if it is empty, `$connection_upgrade` is `close`; otherwise it is
`upgrade`.*

Note the context: **`http`**. A `map` is a declaration that sits beside your
`server` blocks, not inside one (page 01).

## The search order

Quoted from the documentation, in priority order:

1. **String value without a mask** — an exact match
2. **Longest string value with a prefix mask** — `*.example.com`
3. **Longest string value with a suffix mask** — `mail.*`
4. **First matching regular expression**, in order of appearance
5. **The `default` value**

Two things to take from that list. Exact matches beat wildcards beat regexes, so
you do not have to order your literal keys carefully. But **regexes are tried in
file order and the first match wins**, so among regexes, order is everything —
the same asymmetry you will meet again in Phase 2's location matching.

Also documented: **plain string keys are matched ignoring case.**

## The special parameters

### `default`

```nginx
map $http_user_agent $mobile {
    default       0;
    "~Opera Mini" 1;
}
```

Without `default`, an unmatched source value produces **an empty string**. Set it
explicitly. An empty string is falsy in an `if`, is an empty header value if you
forward it, and is indistinguishable from "the variable does not exist" when you
are debugging.

### `hostnames`

```nginx
map $http_host $name {
    hostnames;

    default       0;
    example.com   1;
    *.example.com 1;
    example.org   2;
    .example.net  3;      # with `hostnames`: matches example.net AND *.example.net
    wap.*         4;
}
```

`hostnames` turns on hostname-aware matching: prefix and suffix masks, and the
`.example.net` shorthand that covers **both** the bare domain and every
subdomain. Without it, `*.example.com` is just a literal string that will never
match anything.

### `include`

```nginx
map $http_user_agent $is_bot {
    default 0;
    include /etc/nginx/bots.map;    # one "key value;" pair per line
}
```

Multiple `include`s are supported. This is how a genuinely large table — bot user
agents, country codes, redirect maps of thousands of old URLs — stays out of your
main config.

### `volatile`

```nginx
map $uri $cache_key_part {
    volatile;                # do NOT cache the result for this request
    default $uri;
}
```

By default a `map` result is **computed once per request and cached**. `volatile`
switches that off, and you want it only when the source variable can change
mid-request — after a rewrite or an internal redirect changes `$uri`, for example
— and you need the value recomputed at the new state.

The default is right nearly always. Reach for `volatile` when a mapped value is
"stuck" at what it was earlier in processing.

## Regex keys and captures

`~` is case-sensitive, `~*` is case-insensitive, and captures are available in the
value:

```nginx
map $request_uri $version {
    default        "";
    "~^/api/v(\d+)/"  $1;         # positional capture
}

map $http_accept_language $lang {
    default            en;
    "~*^(?<primary>[a-z]{2})"  $primary;   # named capture
}
```

A value starting with `~` that you want treated as a *literal* must be escaped
with a backslash — otherwise nginx reads it as a regex.

## Why `map` instead of `if`

This is the point of the page, and page 07 argues it fully. The short version:

```nginx
# ✗ the way people reach for first
location / {
    if ($http_user_agent ~* "bot") {
        set $limit_rate 10k;
    }
    proxy_pass http://app;
}

# ✓ the way that is correct and cheaper
map $http_user_agent $rate {
    default 0;
    "~*bot" 10k;
}
location / {
    limit_rate $rate;
    proxy_pass http://app;
}
```

Four concrete advantages:

| | `map` | `if` in `location` |
|---|---|---|
| Cost when unused | **zero** — evaluated only when read | evaluated per request |
| Where it can live | `http`, shared by every server | duplicated per location |
| Semantics | a pure lookup | creates a nested configuration context with surprising inheritance |
| Multi-way branching | natural — one entry per case | nested `if`s, and nginx has no `else` |

The documentation is explicit about the first: *"Since variables are evaluated
only when they are used, the mere declaration even of a large number of 'map'
variables does not add any extra costs to request processing."* You can declare
fifty maps and pay for none of them.

## Patterns worth stealing

**Exclude health checks and assets from the access log** (Phase 10):

```nginx
map $request_uri $loggable {
    default            1;
    ~^/healthz$        0;
    ~^/assets/         0;
}
access_log /var/log/nginx/access.log main if=$loggable;
```

**Bypass the cache for logged-in users** (Phase 6):

```nginx
map $http_cookie $skip_cache {
    default        0;
    "~*sessionid=" 1;
}
proxy_cache_bypass $skip_cache;
proxy_no_cache     $skip_cache;
```

**Choose a backend by path prefix** (Phase 8):

```nginx
map $uri $backend {
    default        app_web;
    ~^/api/        app_api;
    ~^/admin/      app_admin;
}
proxy_pass http://$backend;    # note: a variable in proxy_pass changes the rules — Phase 4
```

**Long-lived caching for hashed assets only** (Phase 3):

```nginx
map $uri $asset_cache {
    default                       "no-cache";
    "~\.[0-9a-f]{8,}\.(js|css)$"  "public, max-age=31536000, immutable";
}
add_header Cache-Control $asset_cache always;
```

## Sizing the hash

Two directives exist and nginx tells you when it needs them:

| Directive | Default |
|---|---|
| `map_hash_max_size` | `2048` |
| `map_hash_bucket_size` | `32`, `64` or `128` — *"depends on the processor's cache line size"* |

You will only meet these with a large `include`d map — a redirect table with
thousands of entries. The error log names the directive and the value to use.

## Gotchas

**Symptom:** A mapped variable is empty for inputs you did not list.
**Cause:** No `default`, so the result is an empty string.
**Fix:** Always write `default`. An empty string is silently falsy everywhere and
is indistinguishable from a typo when you are debugging.

**Symptom:** `*.example.com` never matches anything.
**Cause:** The `hostnames` parameter is missing, so the key is just a literal
string containing an asterisk.
**Fix:** Add `hostnames;` as the first line of the block.

**Symptom:** `nginx: [emerg] "map" directive is not allowed here`.
**Cause:** The `map` is inside `server` or `location`.
**Fix:** Move it to the `http` context, beside your `server` blocks.

**Symptom:** A mapped value is correct at the start of a request and stale after
a rewrite.
**Cause:** `map` results are cached per request by default, and the source
variable changed after the first read.
**Fix:** Add `volatile;` to the block — but check first that you actually need
the recomputation, because caching is the right default.

**Symptom:** Two regex keys both match and the wrong one wins.
**Cause:** Among regexes, the **first match in file order** wins — same rule as
location matching.
**Fix:** Order most specific first. Exact and wildcard keys are unaffected: they
are ranked by specificity, not position.

**Symptom:** A key that starts with `~` is being treated as a regex.
**Cause:** It is — `~` introduces one.
**Fix:** Escape it with a backslash to match the literal character.

## Trade-off

**`map` is a lookup table and refuses to be anything more.** It maps one source
value to one result, with no combining of inputs, no arithmetic, no conditionals
beyond matching. Expressing "logged in **and** not on the admin path" means
chaining maps — mapping into an intermediate variable and mapping again — which
gets opaque quickly.

That limitation is the feature. A `map` chain three deep is a signal that the
decision belongs in Node, where it can be tested. Everything up to two levels is
comfortably within what nginx should be doing, and it costs nothing on requests
that never read the result.

## Interview questions

**★ What does `map` do, and why is it preferred over `if`?**
It declares a variable whose value is looked up from another variable. It is
preferred because it is a pure lookup with no configuration-context side effects,
it lives once in `http` rather than being repeated per location, it handles
multi-way branching naturally, and it costs nothing on requests that never read
it — variables are evaluated only when used.

**★ What is the matching order inside a `map`?**
Exact string, then longest prefix mask, then longest suffix mask, then the first
matching regular expression **in file order**, then `default`. So literal keys
rank by specificity regardless of position, but among regexes the first match
wins — order matters there and only there.

**★ What happens if a `map` has no `default` and nothing matches?**
The variable is an empty string. That is falsy in every test, produces an empty
header if you forward it, and looks exactly like a misspelled variable when
debugging — which is why `default` should always be written explicitly.

**★ When do you need `volatile`?**
When the source variable can change during request processing and you need the
mapped value recomputed. `map` results are cached per request by default, so a map
over `$uri` read before and after a rewrite returns the earlier value unless the
block is declared `volatile`.

**What does the `hostnames` parameter enable?**
Hostname-aware matching: prefix masks (`*.example.com`), suffix masks (`mail.*`),
and the `.example.net` shorthand that covers both the bare domain and all its
subdomains. Without it those keys are matched as literal strings and never fire.

**Is declaring many `map` blocks expensive?**
No. The documentation states that because variables are evaluated only when used,
declaring even a large number of map variables adds no cost to request processing.
The cost is paid per read, on requests that actually read them.

**How do you keep a very large map out of your main config?**
`include` a file of `key value;` pairs inside the map block; multiple includes are
supported. That is how redirect tables with thousands of entries, or bot user-agent
lists, are managed.

---

← Prev: [Units, quoting and comments](05-syntax-details.md) · Index: [Phase 1](README.md) · Next → ["If is evil"](07-if-is-evil.md)
