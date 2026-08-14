---
title: "map — the mechanism"
sidebar_label: "01 · The mechanism"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_map_module](https://nginx.org/en/docs/http/ngx_http_map_module.html)
> — the example, the five-step search order and the special parameters (`default`,
> `hostnames`, `include`, `volatile`) are quoted from it.
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**A `map` is a lookup table with documented, exact matching rules. Learn the
search order and the four special parameters and there is nothing else to it.**

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
`server` blocks, not inside one
([page 01](../01-directives-and-contexts.md)).

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

## `default`

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

## `hostnames`

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

## `include`

```nginx
map $http_user_agent $is_bot {
    default 0;
    include /etc/nginx/bots.map;    # one "key value;" pair per line
}
```

Multiple `include`s are supported. This is how a genuinely large table — bot user
agents, country codes, a redirect map of thousands of retired URLs — stays out of
your main config.

## `volatile`

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
    default           "";
    "~^/api/v(\d+)/"  $1;                    # positional capture
}

map $http_accept_language $lang {
    default                    en;
    "~*^(?<primary>[a-z]{2})"  $primary;     # named capture
}
```

A value starting with `~` that you want treated as a *literal* must be escaped
with a backslash — otherwise nginx reads it as a regex.

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
**Cause:** Among regexes, the **first match in file order** wins.
**Fix:** Order most specific first. Exact and wildcard keys are unaffected: they
are ranked by specificity, not position.

**Symptom:** A key that starts with `~` is being treated as a regex.
**Cause:** It is — `~` introduces one.
**Fix:** Escape it with a backslash to match the literal character.

## Trade-off

**The matching rules are fixed and generous, which makes them easy to get subtly
wrong.** Case-insensitive literals, three kinds of wildcard, two kinds of regex
and a documented precedence order mean a `map` almost always matches *something* —
just not always what you intended, and never with an error.

The defence is to make the fallback explicit. `default` on every block turns "no
key matched" from an invisible empty string into a value you chose, and that alone
removes most of the debugging.

## Interview questions

**★ What is the matching order inside a `map`?**
Exact string, then longest prefix mask, then longest suffix mask, then the first
matching regular expression **in file order**, then `default`. Literal keys rank
by specificity regardless of position; among regexes the first match wins, so
order matters there and only there.

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
and the `.example.net` shorthand covering both the bare domain and all its
subdomains. Without it those keys are matched as literal strings and never fire.

**In which context does a `map` block go?**
`http` — beside your `server` blocks, not inside one. It is a declaration that
names a variable, which any `server` or `location` can then read.

**How do you keep a very large map out of your main config?**
`include` a file of `key value;` pairs inside the map block; multiple includes are
supported. That is how redirect tables with thousands of entries, or bot
user-agent lists, are managed.

---

← Index: [`map`](README.md) · Next → [Using it instead of `if`](02-using-it.md)
