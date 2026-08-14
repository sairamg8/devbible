---
title: "map — using it instead of if"
sidebar_label: "02 · Using it instead of if"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_map_module](https://nginx.org/en/docs/http/ngx_http_map_module.html)
> (the lazy-evaluation sentence, `map_hash_max_size` 2048, `map_hash_bucket_size`
> 32|64|128), [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html)
> (what `if` does) and [ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html)
> (`access_log … if=`).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**Most nginx configs reach for `if` and should have reached for `map`. This chunk
is the four reasons why, and the five patterns that cover nearly all real use.**

## The comparison

```nginx
# ✗ the way people reach for first
location / {
    if ($http_user_agent ~* "bot") {
        set $limit 10k;
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

| | `map` | `if` in `location` |
|---|---|---|
| Cost when unused | **zero** — evaluated only when read | evaluated per request |
| Where it can live | `http`, shared by every server | duplicated per location |
| Semantics | a pure lookup | creates a **nested configuration context** with surprising inheritance |
| Multi-way branching | natural — one entry per case | nested `if`s, and nginx has **no `else`** |

The documentation is explicit about the first row: *"Since variables are evaluated
only when they are used, the mere declaration even of a large number of 'map'
variables does not add any extra costs to request processing."* You can declare
fifty maps and pay for none of them on a request that reads none.

The third row is the one that actually causes outages, and
[topic 07](../07-if-is-evil/README.md) is the full argument.

## Five patterns worth stealing

### 1. Drop noise from the access log — Phase 10

```nginx
map $request_uri $loggable {
    default      1;
    ~^/healthz$  0;
    ~^/assets/   0;
}

access_log /var/log/nginx/access.log main if=$loggable;
```

Health checks from a load balancer can be most of your log volume. `access_log`
takes an `if=` parameter that skips the line when the value is `0` or an empty
string.

### 2. Never cache a logged-in user's response — Phase 6

```nginx
map $http_cookie $skip_cache {
    default        0;
    "~*sessionid=" 1;
}

proxy_cache_bypass $skip_cache;    # do not SERVE from cache
proxy_no_cache     $skip_cache;    # do not STORE in cache
```

You need both directives and they need the same condition — that pairing is the
single most important thing in Phase 6, and a `map` is how you express it once.

### 3. Long-lived caching for hashed assets only — Phase 3

```nginx
map $uri $asset_cache {
    default                       "no-cache";
    "~\.[0-9a-f]{8,}\.(js|css)$"  "public, max-age=31536000, immutable";
}

add_header Cache-Control $asset_cache always;
```

Hashed filenames are safe to cache forever; `index.html` must never be. One map
expresses the whole policy, keyed on the thing that actually distinguishes them.

### 4. Choose a backend by path — Phase 8

```nginx
map $uri $backend {
    default    app_web;
    ~^/api/    app_api;
    ~^/admin/  app_admin;
}

proxy_pass http://$backend;
```

⚠️ A **variable in `proxy_pass` changes the rules**: it disables the URI-rewriting
behaviour and forces runtime DNS resolution, so it needs a `resolver`. Phase 4
covers exactly what changes. Separate `location` blocks are usually clearer; this
pattern earns its place when the mapping is genuinely data.

### 5. WebSocket upgrade — Phase 4

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

Mandatory, not optional. A literal `proxy_set_header Connection "upgrade";` breaks
every non-WebSocket request through that location, because it tells the backend to
upgrade a connection nobody asked to upgrade.

## Chaining maps

A `map` reads one source variable, so combining conditions means mapping into an
intermediate variable and mapping again:

```nginx
map $http_cookie $has_session {
    default 0;
    "~*sessionid=" 1;
}

map "$has_session:$request_method" $skip_cache {
    default   0;
    "~^1:"    1;      # any method, logged in
    "~:POST$" 1;      # any user, POST
}
```

The `"$a:$b"` trick — building a composite key out of two variables — is the
standard way, and it works because the map's source is an arbitrary string, not
just a single variable.

**Two levels is comfortable. Three is a signal.** A map chain that deep is telling
you the decision belongs in Node, where it can have a test.

## Sizing the hash

Two directives exist and nginx tells you when it needs them:

| Directive | Default |
|---|---|
| `map_hash_max_size` | `2048` |
| `map_hash_bucket_size` | `32`, `64` or `128` — *"depends on the processor's cache line size"* |

You will only meet these with a large `include`d map — a redirect table with
thousands of entries. The error log names the directive and the value to raise it
to, so this is a "fix it when nginx asks" setting rather than something to tune
preemptively.

## Gotchas

**Symptom:** `access_log … if=$loggable` logs everything anyway.
**Cause:** The map produced something other than `0` or an empty string — often
because `default` was missing and an unmatched key produced an empty string in
the *other* direction than you assumed.
**Fix:** Write `default 1;` explicitly and check the map's output by logging the
variable itself while you develop.

**Symptom:** The cache serves one user's page to another.
**Cause:** `proxy_cache_bypass` set without `proxy_no_cache` — the logged-in
response was still *stored*, and the next anonymous visitor got it.
**Fix:** Always set both from the same variable. This is the failure mode the
pattern above exists to prevent.

**Symptom:** `proxy_pass http://$backend;` fails with
`no resolver defined to resolve …`.
**Cause:** A variable in `proxy_pass` forces runtime DNS resolution.
**Fix:** Add a `resolver`, or use separate `location` blocks with literal upstream
names. Phase 4 covers the full set of behaviours a variable changes.

**Symptom:** A composite-key map never matches.
**Cause:** The separator appears inside one of the values — a `:` inside a URI, for
example — so the composite string is not shaped the way the regex expects.
**Fix:** Choose a separator that cannot occur in either value, and anchor the
regex.

**Symptom:** nginx logs `could not build map_hash, you should increase
map_hash_bucket_size`.
**Cause:** A large included map exceeded the default hash sizing.
**Fix:** Set the directive to the value the error message names. This is expected
with big tables, not a misconfiguration.

## Trade-off

**`map` is a lookup table and refuses to be anything more.** It maps one source
string to one result, with no combining of inputs, no arithmetic, and no
conditionals beyond matching. Expressing "logged in **and** not on the admin path"
means either a composite key or a chain of maps, and both get opaque quickly.

That limitation is the feature. It keeps decisions in nginx declarative and
readable, and it makes the boundary obvious: when the logic no longer fits in one
lookup, it belongs in Node where it can be tested. The cost is that the boundary
is enforced by taste rather than by the tool — nothing stops you writing the
three-level chain.

## Interview questions

**★ Why is `map` preferred over `if`?**
It is a pure lookup with no configuration-context side effects; it lives once in
`http` instead of being repeated per location; it branches many ways naturally
where nginx has no `else`; and it costs nothing on requests that never read it,
because variables are evaluated only when used.

**★ How do you stop nginx caching responses for logged-in users?**
Map the session cookie to a flag and use it for **both** `proxy_cache_bypass`
(do not serve from cache) and `proxy_no_cache` (do not store in cache). Setting
only the first still stores the personalised response, which is how one user's
page ends up served to another.

**★ How would you exclude health checks from the access log?**
Map `$request_uri` to `0` for the health path and `1` otherwise, then
`access_log … if=$loggable`. `access_log` skips the line when the value is `0` or
an empty string.

**Can a `map` combine two conditions?**
Not directly — it reads one source string. The idiom is to build a composite key,
`map "$a:$b" $result { … }`, or to chain: map into an intermediate variable and
map again. Beyond two levels, the logic belongs in the application.

**What changes when you put a variable in `proxy_pass`?**
It disables the URI-replacement behaviour and forces runtime DNS resolution, so a
`resolver` becomes necessary. That is why a mapped backend is a deliberate choice
rather than a default one.

**Is declaring many `map` blocks expensive?**
No. The documentation states that because variables are evaluated only when used,
declaring even a large number of map variables adds no cost to request processing.

---

← Prev: [The mechanism](01-the-mechanism.md) · Index: [`map`](README.md) · Next → ["If is evil"](../07-if-is-evil/README.md)
