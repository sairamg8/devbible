---
title: "The asymmetry, in practice"
sidebar_label: "02 · The asymmetry, in practice"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_core_module — `location`](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> and [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**Prefix locations are chosen by specificity and ignore file order. Regex
locations are chosen by file order and ignore specificity. That one sentence is
why nginx configs feel random, and knowing it is most of what "being good at
nginx" means.**

## The asymmetry, side by side

| | Prefix locations | Regex locations |
|---|---|---|
| Selection rule | **longest match wins** | **first match wins** |
| Does file order matter? | **no** | **yes** |
| Does specificity matter? | **yes** | **no** |
| When evaluated | first, all of them | second, in sequence, stopping at the first hit |
| Can be skipped | — | yes, by `=` or `^~` |

Two consequences you can act on immediately:

1. **You may organise prefix locations however you like** — alphabetically, by
   subsystem, most-used first. It changes nothing.
2. **Regex locations must be ordered most specific first**, exactly like a
   `switch` you fall through. Adding a broad regex above a narrow one silently
   disables the narrow one.

## The failure it produces

```nginx
location ~* \.(js|css)$        { expires 30d; }                    # ← broad
location ~* /vendor/.*\.js$    { expires 1y; add_header X-Vendor 1; }  # ← never reached
```

The second block is dead. Every `.js` under `/vendor/` matched the first regex,
and the search terminated there. Nothing errors, nothing warns, and the config
reads as though both rules apply.

Reversed, both work:

```nginx
location ~* /vendor/.*\.js$    { expires 1y; add_header X-Vendor 1; }  # narrow FIRST
location ~* \.(js|css)$        { expires 30d; }
```

**A dead regex location is invisible.** `nginx -t` passes, `nginx -T` shows the
block, and the only symptom is a rule that does not take effect.

## The ordering discipline

Write prefix locations for readability and regex locations for correctness:

```nginx
server {
    # ── 1. Exact matches: cheapest, and immune to everything below ──
    location = /healthz          { access_log off; return 200 "ok\n"; }
    location = /favicon.ico      { access_log off; expires 1y; }
    location = /robots.txt       { access_log off; }

    # ── 2. Protected prefixes: ^~ so no regex can steal them ──
    location ^~ /static/         { root /srv/app; expires 1y; }
    location ^~ /.well-known/    { root /var/www/certbot; }   # ACME — Phase 5

    # ── 3. Regexes: MOST SPECIFIC FIRST. Order is the semantics. ──
    location ~* /vendor/.*\.js$  { expires 1y; }
    location ~* \.(js|css)$      { expires 30d; }
    location ~* \.(png|jpg|webp|avif)$ { expires 30d; }

    # ── 4. Ordinary prefixes: order irrelevant, longest wins ──
    location /api/               { proxy_pass http://app; }
    location /admin/             { proxy_pass http://admin; }

    # ── 5. The fallback ──
    location /                   { try_files $uri $uri/ /index.html; }
}
```

The comment banners are doing real work: they encode which sections may be
reordered freely and which must not be. Groups 1, 2, 4 and 5 are order-independent
and grouped for humans. **Group 3 is order-dependent and grouped because it must
be.**

`/.well-known/` under `^~` is a specific, load-bearing example: the ACME HTTP-01
challenge must be served as a plain file, and without `^~` a regex matching
extension-less files or a `try_files` fallback can intercept it and break
certificate renewal (Phase 5).

## Worked example — the phase gate

```nginx
server {
    listen 80;
    server_name app.example.com;
    root /srv/dist;

    location = / {                      # A
        try_files /landing.html =404;
    }
    location /api/ {                    # B
        proxy_pass http://app;
    }
    location /api/v1/ {                 # C
        proxy_pass http://app_v1;
    }
    location ^~ /static/ {              # D
        expires 1y;
    }
    location ~* \.css$ {                # E
        expires 30d;
    }
    location / {                        # F
        try_files $uri $uri/ /index.html;
    }
}
```

| Request | Wins | Reason |
|---|---|---|
| `/` | **A** | `=` matched exactly — search terminated immediately, nothing else evaluated |
| `/api/v1/users` | **C** | longest matching prefix. **B is also a match and loses on length, not on position** |
| `/api/orders` | **B** | longest matching prefix; C does not match |
| `/static/app.css` | **D** | `^~` on the longest matching prefix — **regex E is never checked** |
| `/theme/app.css` | **E** | prefix F remembered, then regex E matched and beat it |
| `/theme/app.js` | **F** | prefix F remembered, no regex matched, so the prefix is used |
| `/index.html` | **F** | same |

The two rows to be able to explain on demand are `/static/app.css` (a `^~` prefix
beating a regex) and `/theme/app.css` (a regex beating a prefix). **The only
difference between them is the `^~`.**

## Three rules that follow

**1. Protect any prefix whose contents must be handled together.** If everything
under a path must share a `root`, a `proxy_pass` or a header set, use `^~`. A
regex added six months later cannot then break it.

**2. Anchor every regex.** `location ~ \.js$` is "ends in .js";
`location ~ \.js` is "contains .js anywhere", which matches
`/foo.js.map` and `/api/inject.jsonp`. The missing `$` is the most common regex
location bug there is.

**3. Prefer prefixes to regexes wherever the pattern allows.** Prefix matching is
a hash-and-compare over literal strings; regex locations are a sequential scan of
PCRE evaluations. Beyond performance, they are order-independent, which is the
property that keeps a growing config maintainable.

## Nested locations

```nginx
location /api/ {
    proxy_pass http://app;

    location /api/uploads/ {
        client_max_body_size 100m;
        proxy_pass http://app;      # must be repeated — not inherited from the parent
    }
}
```

The same algorithm runs again inside the matched parent. Nesting expresses "this
is a special case of that" and inherits the parent's directives — subject to
[Phase 1's replace rule](../../phase-1-configuration-language/02-inheritance.md),
which is why `proxy_pass` is written out again.

**Nest only when the child is genuinely a variation of the parent.** Two
top-level prefixes are usually clearer, and they behave identically because prefix
matching does not care about structure.

## Gotchas

**Symptom:** A regex location is in the config, `nginx -T` shows it, and it never
takes effect.
**Cause:** An earlier regex matched first. The search terminates on the first
match, and there is no warning for an unreachable block.
**Fix:** Reorder most specific first. When auditing, read regex locations in file
order as a fall-through sequence, not as a set of independent rules.

**Symptom:** Adding a new broad regex broke an existing narrow one somewhere else
in the file.
**Cause:** It was inserted above the narrow rule.
**Fix:** New regexes go **last** unless they are more specific than everything
above. Treat inserting a regex the way you would treat inserting a case into a
fall-through switch.

**Symptom:** `location ~ \.js` matched `/api/data.json`.
**Cause:** Unanchored. Without `$` it means "contains `.js`".
**Fix:** `location ~ \.js$`. Anchor every regex location.

**Symptom:** ACME certificate renewal fails with a 404 on
`/.well-known/acme-challenge/...`.
**Cause:** A `try_files` fallback or a regex intercepted the path.
**Fix:** `location ^~ /.well-known/` with a plain `root`. This is exactly what
`^~` exists for.

**Symptom:** Moving `location /` around the file changed nothing, even though you
expected it to.
**Cause:** Prefix locations are order-independent by design.
**Fix:** Nothing — but the expectation is the tell. If you want ordering, you are
in regex territory, with everything that implies.

**Symptom:** A nested location lost its parent's `proxy_set_header` values.
**Cause:** It set one of its own, so the whole inherited set was replaced.
**Fix:** The include-snippet pattern from
[Phase 1](../../phase-1-configuration-language/02-inheritance.md). Nesting does
not change the replace rule.

## Trade-off

**Order-independence for prefixes is the right default and it removes a tool you
sometimes want.** With regex locations you can express "try this, else this, else
this" as a readable sequence — genuinely useful, and the reason people reach for
them. With prefixes you cannot, and you must express intent through specificity
and `^~` instead.

The cost of the regex route is that ordering becomes load-bearing and invisible.
Nothing in the config marks a block as unreachable, no tool reports it, and the
failure is a rule that quietly does not apply. That is why the discipline is
*prefixes wherever possible, few regexes, most specific first, and `^~` around
anything that must not be touched.*

## Interview questions

**★ Why does the order of `location` blocks matter for regexes but not for
prefixes?**
Prefix locations are all evaluated and the longest match is remembered —
specificity decides, position is irrelevant. Regex locations are tried in file
order and the search terminates on the first match, so position decides and
specificity is irrelevant.

**★ You add a regex location and an existing one stops working. What happened?**
The new one was placed above it and matches the same URLs, so the search
terminates before reaching the old block. There is no warning for an unreachable
location — reorder most specific first, and add new regexes last unless they are
genuinely narrower.

**★ Two locations both cover `/api/v1/users`: `location /api/` and
`location /api/v1/`. Which wins?**
`/api/v1/` — it is the longer matching prefix. Their positions in the file are
irrelevant.

**★ Why does `location ^~ /.well-known/` matter for TLS certificates?**
Because the ACME HTTP-01 challenge file must be served directly from disk, and
without `^~` a regex location or a `try_files` SPA fallback can intercept the path
and return the wrong thing — which fails renewal silently until the certificate
expires.

**What is wrong with `location ~ \.js`?**
It is unanchored, so it means "contains `.js`" rather than "ends in `.js`" — it
will match `/data.json`, `/foo.js.map` and `/inject.jsonp`. Anchor location
regexes with `$`.

**When should you nest a `location` inside another?**
When the child is genuinely a variation of the parent — same backend, one
different setting. The same matching algorithm runs inside the parent, and the
child inherits the parent's directives subject to the replace-not-merge rule. Two
top-level prefixes are usually clearer and behave identically.

**How would you lay out the location blocks in a real config?**
Exact `=` matches first for hot literal URLs; then `^~` prefixes for paths that
must not be intercepted; then regexes, most specific first, because that group is
the only order-dependent one; then ordinary prefixes in whatever order reads best;
then `location /` as the fallback.

---

← Prev: [The algorithm and the modifiers](01-the-algorithm.md) · Index: [The location matching algorithm](README.md) · Next → [Named locations, `internal` and nesting](../04-named-and-internal.md)
