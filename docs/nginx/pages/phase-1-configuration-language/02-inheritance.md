---
title: "Inheritance and the replace rule"
sidebar_label: "02 · Inheritance and the replace rule"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
> (`proxy_set_header`, `proxy_hide_header` inheritance notes),
> [ngx_http_headers_module](https://nginx.org/en/docs/http/ngx_http_headers_module.html)
> (`add_header`, and `add_header_inherit` from 1.29.3),
> [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) and
> [CHANGES-1.30](https://nginx.org/en/CHANGES-1.30).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**A child context inherits its parent's directives — until it sets that directive
itself, at which point it throws away everything it inherited and keeps only what
it wrote. Not merged. Replaced.**

This one rule causes more nginx bugs than any other single thing in the product.
It is the reason a `location` that adds one proxy header silently loses the other
four, and the reason a security header vanishes from exactly one endpoint.

## The rule

```nginx
http {
    server {
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;

        location / {
            # inherits BOTH headers — it sets none of its own
        }

        location /api/ {
            add_header X-Request-Id $request_id;
            # ✗ now sends ONLY X-Request-Id.
            #   X-Frame-Options and X-Content-Type-Options are GONE.
        }
    }
}
```

`location /api/` did not *add* a header to the two it had. It **replaced the
whole set** with one entry.

Say it in one sentence, because this is the sentence to carry into every later
phase:

> **Inheritance is all-or-nothing, per directive, per level. Set none and you
> inherit everything; set one and you inherit nothing.**

The nginx documentation states this on each affected directive — the phrasing to
recognise is *"These directives are inherited from the previous configuration
level if and only if there are no `X` directives defined on the current level."*
Once you know to look for that sentence, you will see it everywhere.

## Which directives behave this way

Any directive that can appear **more than once** in a context, building up a set:

| Directive | Set of | Phase |
|---|---|---|
| `proxy_set_header` | headers sent to the backend | 4 |
| `add_header` | headers sent to the client | 3, 9 |
| `proxy_hide_header`, `proxy_pass_header` | headers filtered from the backend response | 4 |
| `fastcgi_param`, `uwsgi_param`, `grpc_set_header` | the same idea for other protocols | — |
| `allow` / `deny` | access rules | 9 |
| `limit_req`, `limit_conn` | applied limits | 9 |
| `proxy_cache_valid` | per-status cache TTLs | 6 |
| `error_page` | error handlers | 2, 3 |
| `index`, `gzip_types`, `ssl_protocols` | lists | 3, 5, 7 |

Single-valued directives — `root`, `client_max_body_size`, `proxy_pass`,
`proxy_read_timeout`, `sendfile` — simply override, and that surprises nobody.
**The trap is specifically the plural ones.**

## The three fixes

### 1. Repeat the inherited ones

Verbose, explicit, and always correct:

```nginx
location /api/ {
    add_header X-Frame-Options        DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-Request-Id           $request_id;   # the new one
    proxy_pass http://app;
}
```

### 2. Put them in an include and include it everywhere

The standard answer for proxy headers, and it scales:

```nginx
# /etc/nginx/snippets/proxy.conf
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

```nginx
location /api/ {
    include snippets/proxy.conf;
    proxy_set_header X-Request-Id $request_id;   # additions after the include
    proxy_pass http://app;
}
```

The include expands *in place*, so everything is written at the same level and
nothing is inherited — the rule never gets a chance to bite. Page 03 covers the
mechanics.

### 3. Set them at the highest level that is true

If every location wants the header, set it once in `server` (or `http`) and
resist the urge to add one in a child:

```nginx
server {
    add_header X-Frame-Options        DENY  always;
    add_header X-Content-Type-Options nosniff always;

    location /api/ { proxy_pass http://app; }   # sets no add_header — inherits both
}
```

**The failure mode this avoids is quiet.** Nobody notices a missing security
header until a scanner or an auditor does, months later, on exactly one path.

### 4. `add_header_inherit merge` — new in 1.29.3

nginx 1.29.3 added `add_header_inherit` and `add_trailer_inherit`, and they take
**`on | off | merge`** with a default of `on`. The `merge` value is the direct fix
for response headers: the level's own headers are added to the inherited ones
instead of replacing them.

```nginx
http {
    add_header_inherit merge;      # 1.29.3+ — children add to the set, not replace it

    server {
        add_header X-Frame-Options DENY always;

        location /api/ {
            add_header X-Request-Id $request_id always;   # now BOTH are sent
        }
    }
}
```

Two caveats. It is **1.29.3 and later only**, so a config that must also run on an
older nginx cannot rely on it. And it covers `add_header` and `add_trailer`
**only** — there is no equivalent for `proxy_set_header`, so the include pattern
remains the general answer.

## The other half of `add_header`: it skips most responses

`add_header` has a second surprise that is not about inheritance at all, and the
two together account for nearly every "my header is missing" ticket.

By default `add_header` applies **only to a specific list of successful and
redirect status codes** — 200, 201, 204, 206, 301, 302, 303, 304, 307, 308. A
500 from your backend, a 404, a 403 from `deny`: **no header**.

```nginx
add_header Strict-Transport-Security "max-age=63072000" always;
#                                                       ^^^^^^
#                                        every response, including errors
```

**Use `always` on anything security-relevant.** HSTS, CSP, `X-Content-Type-Options`
and friends are exactly the headers you do not want dropped on an error page. The
mechanism behind this is the response-phase filter chain, covered in Phase 2.

## Reading it in a real config

The practical version of this page is a habit: when a directive seems to be
ignored, ask **"did something below redefine it?"** and answer with

```bash
nginx -T | grep -n 'proxy_set_header\|add_header'
```

`nginx -T` prints the fully resolved configuration (Phase 0, page 06). Look at
every level between `http` and the `location` in question. If any of them sets
the directive, everything above it is gone.

## Gotchas

**Symptom:** Express sees the wrong `Host`, or `req.ip` is nginx's address, but
only for some routes.
**Cause:** One `location` added a single `proxy_set_header` and discarded the
inherited `Host`, `X-Real-IP` and `X-Forwarded-*` set.
**Fix:** Use the include-snippet pattern so every `location` writes the full set
at its own level. This is the number-one cause of "trust proxy is configured and
still wrong" in Phase 4.

**Symptom:** A security header is present on most pages and missing on one.
**Cause:** That path's `location` sets an `add_header` of its own.
**Fix:** Repeat the inherited headers there, use `add_header_inherit` on 1.29.3+,
or move them all to `server` and add none in children. Verify with
`curl -I` against the specific path, not the site root.

**Symptom:** HSTS or CSP is missing on error pages, and a security scan flags it.
**Cause:** `add_header` without `always` — error status codes are not in the
default list.
**Fix:** Add `always` to every security header.

**Symptom:** `proxy_hide_header` stopped hiding something after you added another
one in a nested location.
**Cause:** Same rule — the plural directive was replaced, not extended.
**Fix:** Same three fixes. Nothing about this rule is specific to `add_header`;
it is every multi-valued directive.

**Symptom:** You moved `add_header` from `location` up to `server` and a
different location broke.
**Cause:** That other location has its own `add_header`, so it never sees the
`server`-level one — moving the directive up does not help a child that sets its
own.
**Fix:** Audit every level with `nginx -T` before consolidating. Consolidation
only works if the children set none.

## Trade-off

**Replace-not-merge makes each level's configuration complete and local.** You can
read one `location` block and know exactly which headers it sends, without
reconstructing an inheritance chain in your head. A merging model would mean no
block could be understood alone, and removing an inherited value would need
special syntax.

The cost is real and it is paid in silence: the failure mode is a missing header,
never an error. `nginx -t` cannot catch it, and neither can a code review that
looks at the diff instead of the whole resolved config. That is why the
include-snippet pattern is worth adopting before you get bitten rather than
after.

## Interview questions

**★ How does directive inheritance work in nginx?**
A context inherits its parent's directives — but only if it does not define that
directive itself. As soon as a level sets one, the entire inherited set for that
directive is discarded and replaced by what that level defines. It is
replace-not-merge, per directive, per level.

**★ You add one `proxy_set_header` in a `location` and the backend stops seeing
`Host` and `X-Forwarded-For`. Why?**
Because `proxy_set_header` is multi-valued: defining any at the `location` level
replaces the whole set inherited from `server`. The fix is to write the full set
at that level, most maintainably by `include`ing a snippet that contains all of
them.

**★ Why is a security header missing from your 500 responses?**
`add_header` applies only to a documented list of status codes (200, 201, 204,
206, 301, 302, 303, 304, 307, 308) unless you add the `always` parameter. Error
responses are not in that list, so every security header should be written with
`always`.

**★ Which directives does the replace rule apply to?**
The multi-valued ones — the directives that build up a set: `proxy_set_header`,
`add_header`, `proxy_hide_header`, `fastcgi_param`, `allow`/`deny`, `limit_req`,
`proxy_cache_valid`, `error_page`, `index`, `gzip_types`, `ssl_protocols`.
Single-valued directives like `root` or `client_max_body_size` simply override,
which surprises no one.

**What is the cleanest way to avoid the trap across many locations?**
Put the shared directives in a snippet file and `include` it in every location
that needs them, adding any extras after the include. Because the include expands
in place, everything is defined at the same level and inheritance never applies.

**What did nginx 1.29.3 add for this?**
`add_header_inherit` and `add_trailer_inherit`, taking `on | off | merge` and
defaulting to `on`. Setting `merge` makes a level's own headers add to the
inherited set instead of replacing it — the direct fix for response headers. It
does not cover `proxy_set_header`, and it does not exist before 1.29.3, so the
include pattern remains the general answer.

**How do you confirm which directives a `location` actually ends up with?**
`nginx -T` dumps the fully resolved configuration with all includes expanded.
Read every level from `http` down to the `location`: if any of them defines the
directive, everything above it has been discarded.

---

← Prev: [Directives and contexts](01-directives-and-contexts.md) · Index: [Phase 1](README.md) · Next → [`include` and the file layout](03-include-and-files.md)
