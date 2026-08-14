---
title: "If is evil"
sidebar_label: "07 · If is evil"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_rewrite_module](https://nginx.org/en/docs/http/ngx_http_rewrite_module.html)
> — the `if` directive's syntax, context, allowed conditions and the sentence
> *"the request is assigned the configuration inside the `if` directive"* are quoted
> from it — plus the module's "Internal Implementation" section, and
> [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> (`try_files`, `error_page`).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**"If is evil" is the title of a page on the nginx wiki, and it is not a joke.
`if` inside a `location` does not do what it looks like it does: it creates a
nested configuration context, and directives from other modules inside it behave
in ways that are documented as undefined.**

## What `if` actually is

```text
Syntax:   if (condition) { ... }
Default:  —
Context:  server, location
```

The documentation's own description, quoted:

> *"The specified condition is evaluated. If true, this module directives specified
> inside the braces are executed, **and the request is assigned the configuration
> inside the `if` directive**."*

Read that second clause carefully. `if` is a **block directive** — it creates a
configuration context, exactly like `location` does. The request is *moved into*
that context.

And note "**this module** directives". `if` belongs to
`ngx_http_rewrite_module`, and only that module's directives — `break`, `return`,
`rewrite`, `set` — are defined to work inside it. Everything else from every
other module happens to be *parseable* there and is not specified to behave.

## The two things that are safe

Only these are reliable inside `if`:

| Safe | Why |
|---|---|
| `return` | a rewrite-module directive; terminates processing immediately |
| `rewrite` | a rewrite-module directive; the classic conditional-redirect use |

`set` and `break` are also rewrite-module directives, so they execute — but `set`
inside `if` interacts with the phase ordering from
[page 04](04-variables.md) and is rarely what you want.

**Everything else** — `proxy_pass`, `add_header`, `try_files`, `root`, `expires`,
`limit_req`, `access_log` — may parse, and its behaviour inside `if` is not
something to build on.

## The classic breakages

### `add_header` inside `if` silently drops the inherited ones

```nginx
location / {
    add_header X-Frame-Options DENY;

    if ($http_user_agent ~* "bot") {
        add_header X-Robots-Tag noindex;
        # ✗ the request is now in the `if` context, which defines an add_header,
        #   so X-Frame-Options — inherited from the location — is GONE.
    }
}
```

This is just [page 02's replace rule](02-inheritance.md) applied to a context you
did not realise you had created. `if` is a level. It inherits, and it replaces.

### Two `if` blocks: the second wins, the first is discarded

```nginx
location / {
    if ($request_method = POST) { set $a 1; }
    if ($http_x_test)           { set $b 1; }   # if both match, only ONE context applies
    proxy_pass http://app;
}
```

There is no `else`, no `elseif`, and no accumulation. When two `if`s match, the
request ends up in one context and the other's configuration is not merged in.
Configurations that look like a chain of independent checks are not one.

### `if` with `proxy_pass` and `try_files`

```nginx
location / {
    try_files $uri $uri/ @fallback;

    if ($host = old.example.com) {
        proxy_pass http://legacy;    # ✗ documented as producing unpredictable results
    }
}
```

This combination — `if` containing a content-phase directive, alongside
`try_files` — is the canonical example on the wiki page, and it can produce
segfault-class behaviour in older nginx and wrong routing in current ones. It is
not a subtle performance concern; it is a "do not do this" case.

## What to use instead

Four replacements cover essentially every real use.

### 1. `map` — for deriving a value

The single most common substitution. See
[topic 06](06-map/02-using-it.md).

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

### 2. A separate `server` block — for host-based decisions

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

nginx already selects by hostname (Phase 2). Re-implementing that selection with
`if` inside one block is doing the work twice, and worse.

### 3. A more specific `location` — for path-based decisions

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

Location matching (Phase 2) is a fast, well-specified algorithm designed for
exactly this. `if` is not.

### 4. `try_files` — for "does this file exist?"

```nginx
# ✗
if (!-f $request_filename) { rewrite ^ /index.html last; }

# ✓
try_files $uri $uri/ /index.html;
```

`try_files` is purpose-built, runs in the right phase, and does not create a
context. The `-f`, `-d`, `-e` and `-x` file tests exist in `if` and are almost
never the right tool once `try_files` is on the table.

## The one place `if` is fine: `server` level with `return`

```nginx
server {
    listen 80;
    server_name example.com;

    # Acceptable: rewrite-module directive only, at server level, terminating.
    if ($request_method !~ ^(GET|HEAD|POST)$) {
        return 405;
    }
}
```

`if` at `server` level with `return` is the least dangerous form — but even here
there is usually a better tool. Method filtering is `limit_except` (Phase 9); an
HTTP-to-HTTPS redirect needs no condition at all, just a port-80 server that only
redirects (page 08).

**A workable rule:** if your `if` does not contain exactly one `return` or one
`rewrite`, rewrite the config.

## Why it is like this

The module's own "Internal Implementation" section explains it. Rewrite-module
directives *"are compiled at the configuration stage into internal instructions
that are interpreted during request processing"* by *"a simple virtual stack
machine"*, and they all execute in the rewrite phase.

So `if` is not a runtime branch over the whole configuration — it is an
instruction in a small interpreter that runs early, whose side effect is
selecting a configuration context. Directives from other modules were never part
of that design; they are simply structurally allowed to appear.

Understanding this makes the behaviour stop being surprising: `if` is doing
exactly what it was built to do, and what it was built to do is narrower than the
syntax suggests.

## Gotchas

**Symptom:** A header set at `location` level disappears for requests matching an
`if`.
**Cause:** The `if` created a configuration context that defines `add_header`, so
the inherited set was replaced.
**Fix:** Move the condition into a `map` and set the header unconditionally from
the mapped value, or repeat the inherited headers inside the `if`. Preferably the
first.

**Symptom:** Two `if` blocks both match and only one takes effect.
**Cause:** The request is assigned **one** configuration; matching contexts do not
merge, and there is no `else`.
**Fix:** Express the whole decision as a single `map` with one entry per case.

**Symptom:** `proxy_pass` inside `if`, combined with `try_files` in the same
location, routes unpredictably.
**Cause:** The documented-as-unsafe combination.
**Fix:** Separate `location` blocks. There is no configuration of this shape worth
saving.

**Symptom:** `nginx: [emerg] "if" directive is not allowed here` inside `http`.
**Cause:** `if` is `server` and `location` context only.
**Fix:** Whatever you were about to do at `http` level, a `map` does better — and
`map` is an `http`-context directive.

**Symptom:** A rewrite inside `if` loops, producing
`rewrite or internal redirection cycle`.
**Cause:** The rewritten URI still matches the condition, so the loop repeats —
capped at 10 iterations by the module.
**Fix:** Anchor the regex so the result cannot match again, or use `try_files`
or a distinct `location`. Phase 2 covers internal redirect cycles.

## Trade-off

**Avoiding `if` costs you directness.** "Redirect www to apex" is one line with
`if` and two `server` blocks without it. "Rate-limit bots" is three lines with
`if` and a `map` plus a directive without it. The `if` version is shorter, reads
more like code, and is what everyone reaches for first.

What you buy is a config that does what it looks like it does. The alternatives —
`map`, more `server` blocks, more `location` blocks, `try_files` — are all
mechanisms nginx is built around and optimised for, and none of them has a class
of behaviour documented as unpredictable.

There is no case where `if` is the only option. That is what makes the rule worth
following absolutely rather than case by case.

## Interview questions

**★ Why is `if` considered harmful in nginx?**
Because it is not a statement — it is a block directive that creates a
configuration context, and the request is assigned that context. Only
rewrite-module directives (`return`, `rewrite`, `set`, `break`) are defined to
work inside it; directives from other modules parse but are not specified to
behave, and combinations like `if` + `proxy_pass` + `try_files` are documented as
unpredictable.

**★ Which directives are safe inside `if`?**
`return` and `rewrite` — both rewrite-module directives, both terminating or
redirecting. A practical rule: if your `if` does not contain exactly one of those,
rewrite the configuration.

**★ Why does `add_header` inside an `if` drop the headers set outside it?**
Because `if` is a configuration level. The replace-not-merge inheritance rule
applies: the `if` context defines an `add_header`, so it inherits none from the
enclosing `location`.

**★ What do you use instead of `if`?**
`map` for deriving a value; a separate `server` block for host-based decisions; a
more specific `location` for path-based ones; `try_files` for file-existence
checks. Between them they cover essentially every real use.

**If two `if` blocks in the same location both match, what happens?**
The request is assigned one configuration; they do not merge and there is no
`else`. Configurations that read like a chain of independent checks are not one —
express the whole decision in a single `map` instead.

**Is `if` ever acceptable?**
At `server` level containing a single `return`, it is the least dangerous form —
but even there a better tool usually exists: `limit_except` for method filtering,
and a dedicated port-80 server for the HTTPS redirect, which needs no condition at
all.

**Why does `if` behave this way at all?**
Because the rewrite module compiles its directives into instructions for a small
stack machine that runs in the rewrite phase, and `if`'s effect is to select a
configuration context. Directives from other modules were never part of that
design; they are merely structurally allowed to appear inside the braces.

---

← Prev: [`map`](06-map/README.md) · Index: [Phase 1](README.md) · Next → [`rewrite`, `return` and regular expressions](08-rewrite-and-return.md)
