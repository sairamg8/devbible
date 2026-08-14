---
title: "What to use instead of if"
sidebar_label: "02 · What to use instead"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_map_module](https://nginx.org/en/docs/http/ngx_http_map_module.html),
> [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> (`try_files`, `limit_except`, `server_name`) and
> [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**Four replacements cover essentially every real use of `if`. Learn which one fits
which shape of condition and the directive stops being tempting.**

| Your condition is about… | Use |
|---|---|
| deriving a **value** from something | **`map`** |
| the **hostname** | **another `server` block** |
| the **URL path** | **another `location` block** |
| whether a **file exists** | **`try_files`** |

## 1. `map` — for deriving a value

The single most common substitution. See
[topic 06](../06-map/02-using-it.md) for the full treatment.

```nginx
# ✗
location / {
    if ($http_user_agent ~* "bot") { set $rate 10k; }
    limit_rate $rate;
}

# ✓
map $http_user_agent $rate {
    default 0;
    "~*bot" 10k;
}
location / {
    limit_rate $rate;
}
```

The reframe that makes this click: **stop asking "how do I branch?" and start
asking "what value do I need, and what determines it?"** Once the condition is
expressed as a lookup, the directive it feeds is unconditional.

This also handles the `and`/`or` that `if` cannot, by way of a composite key:

```nginx
map "$has_session:$request_method" $skip_cache {
    default   0;
    "~^1:"    1;
    "~:POST$" 1;
}
```

## 2. A separate `server` block — for host-based decisions

```nginx
# ✗
server {
    server_name example.com www.example.com;
    if ($host = www.example.com) {
        return 301 https://example.com$request_uri;
    }
}

# ✓ — two servers, no condition at all
server {
    server_name www.example.com;
    return 301 https://example.com$request_uri;
}

server {
    server_name example.com;
    # the real site
}
```

nginx already selects by hostname before your configuration runs (Phase 2).
Re-implementing that selection with `if` inside a single block does the work
twice, and does it worse.

## 3. A more specific `location` — for path-based decisions

```nginx
# ✗
location / {
    if ($uri ~ ^/api/) { proxy_pass http://app; }
    root /srv/dist;
}

# ✓
location /api/ { proxy_pass http://app; }
location /     { root /srv/dist; }
```

Location matching is a fast, precisely specified algorithm built for exactly this
(Phase 2). A prefix `location` is also cheaper than a regex `if`, because prefix
matching happens before any regex is considered.

## 4. `try_files` — for "does this file exist?"

```nginx
# ✗
if (!-f $request_filename) { rewrite ^ /index.html last; }

# ✓
try_files $uri $uri/ /index.html;
```

`try_files` is purpose-built, runs in the right phase, does not create a context,
and reads as what it means. The `-f`, `-d`, `-e` and `-x` tests exist inside `if`
and are almost never the right tool once `try_files` is available.

This is the SPA fallback in one line, and Phase 3 covers the important caveat —
that it must not be applied to `/api`.

## The one place `if` is acceptable

```nginx
server {
    listen 80;
    server_name example.com;

    # server level, rewrite-module directive only, terminating.
    if ($request_method !~ ^(GET|HEAD|POST)$) {
        return 405;
    }
}
```

`if` at **`server` level containing a single `return`** is the least dangerous
form: no other module's directives are involved, and `return` terminates
immediately so no configuration-context confusion can follow.

Even here there is usually a better tool:

| Instead of | Use | Phase |
|---|---|---|
| `if ($request_method !~ …) { return 405; }` | `limit_except` | 9 |
| `if ($scheme = http) { return 301 https://…; }` | a port-80 `server` that only redirects | 5 |
| `if ($http_user_agent ~ bad) { return 403; }` | `map` → `return $blocked` or a `deny` list | 9 |

**A workable rule:** if your `if` does not contain exactly one `return` or one
`rewrite`, rewrite the configuration.

## A worked conversion

Before — four separate problems in one block:

```nginx
location / {
    if ($host = www.example.com) { rewrite ^ https://example.com$request_uri permanent; }
    if ($http_user_agent ~* bot) { add_header X-Robots-Tag noindex; }
    if (!-f $request_filename)   { rewrite ^ /index.html last; }
    add_header X-Frame-Options DENY;
    root /srv/dist;
}
```

After — each decision handled by the mechanism designed for it:

```nginx
map $http_user_agent $robots {
    default "";
    "~*bot" "noindex";
}

server {
    server_name www.example.com;
    return 301 https://example.com$request_uri;      # ← host decision: its own server
}

server {
    server_name example.com;
    root /srv/dist;

    add_header X-Frame-Options DENY  always;
    add_header X-Robots-Tag    $robots always;        # ← empty value = header omitted

    location / {
        try_files $uri $uri/ /index.html;             # ← file existence: try_files
    }
}
```

Longer by a few lines, and every line now does what it appears to do. Note the
detail in `add_header X-Robots-Tag $robots` — nginx **omits a header whose value
is an empty string**, so the `map`'s `default ""` gives you "add this header only
for bots" with no condition at all.

## Gotchas

**Symptom:** You replaced an `if` with a `map` and the header now appears on every
response with an empty value.
**Cause:** Some other directive is setting it, or the map's `default` is a
non-empty string.
**Fix:** `default "";` — nginx omits a header whose value evaluates to an empty
string, which is what makes the conditional-header pattern work.

**Symptom:** Splitting one `server` into two duplicated a lot of configuration.
**Cause:** Both servers genuinely need the shared settings.
**Fix:** Put the shared parts in a snippet and `include` it in both
([topic 03](../03-include-and-files/01-how-include-works.md)). The redirect-only
server usually needs almost nothing anyway.

**Symptom:** Converting `if ($uri ~ ^/api/)` to `location /api/` changed which
requests match.
**Cause:** A prefix `location` and a regex are not the same test — anchoring,
case-sensitivity and trailing-slash behaviour all differ.
**Fix:** Check Phase 2's matching rules before assuming equivalence, and test the
boundary cases (`/api`, `/api/`, `/apifoo`).

**Symptom:** `try_files $uri /index.html;` made every API 404 return the SPA with
status 200.
**Cause:** The fallback was applied to a location that also covers `/api`.
**Fix:** Give `/api/` its own `location` with `proxy_pass` and no fallback. Phase
3 covers this specifically — it is the most common SPA misconfiguration there is.

## Trade-off

**Avoiding `if` costs you directness.** "Redirect www to apex" is one line with
`if` and two `server` blocks without it. "Set a header for bots" is three lines
with `if` and a `map` plus a directive without it. The `if` version is shorter,
reads more like code, and is what everyone reaches for first.

What you buy is a configuration that does what it looks like it does. The
alternatives are all mechanisms nginx is built around and optimised for, and none
of them has a class of behaviour documented as unpredictable.

There is no case where `if` is the only option. That is what makes the rule worth
following absolutely rather than case by case — a rule with no exceptions needs no
judgement at three in the morning.

## Interview questions

**★ What do you use instead of `if`?**
`map` for deriving a value; a separate `server` block for host-based decisions; a
more specific `location` for path-based ones; `try_files` for file-existence
checks. Between them they cover essentially every real use.

**★ How do you set a response header only for some requests, without `if`?**
Map the condition to the header value with `default "";`, then set the header
unconditionally from the mapped variable. nginx omits a header whose value is an
empty string, so the conditional falls out of the value rather than the control
flow.

**★ Is `if` ever acceptable?**
At `server` level containing a single `return`, it is the least dangerous form —
no other module's directives are involved and `return` terminates immediately.
Even there a better tool usually exists: `limit_except` for method filtering, and
a dedicated port-80 server for the HTTPS redirect, which needs no condition at
all.

**How do you express an `and` condition when nginx's `if` has no `and`?**
Build a composite key and map it: `map "$a:$b" $result { … }`. Chaining maps
through an intermediate variable works too. Beyond two levels, the decision
belongs in the application.

**Why is `location /api/` better than `if ($uri ~ ^/api/)`?**
Location matching is a specified, fast algorithm that runs before any regex is
considered, and it creates no unexpected configuration context. The `if` version
runs a regular expression per request and puts the content-phase directive inside
a context where its behaviour is not defined.

**What is the practical rule for reviewing an `if` in someone's config?**
If it does not contain exactly one `return` or one `rewrite`, it should be
rewritten. That single test catches nearly every dangerous use without needing to
reason about the specific directives involved.

---

← Prev: [What `if` actually is](01-what-if-does.md) · Index: ["If is evil"](README.md) · Next → [`rewrite`, `return` and regular expressions](../08-rewrite-and-return.md)
