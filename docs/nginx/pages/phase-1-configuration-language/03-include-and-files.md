---
title: "include and the file layout"
sidebar_label: "03 · include and the file layout"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against [ngx_core_module](https://nginx.org/en/docs/ngx_core_module.html)
> (`include`, context `any`), [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> (`types` — default `text/html html; image/gif gif; image/jpeg jpg;`,
> `default_type` — default **`text/plain`**, `types_hash_bucket_size` 64,
> `types_hash_max_size` 1024) and
> [nginx: Linux packages](https://nginx.org/en/linux_packages.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**`include` is textual substitution at parse time, in whatever context it appears.
That single sentence explains both how a real config is organised and why so many
of them silently do nothing.**

## What `include` does

```text
Syntax:   include file | mask;
Default:  —
Context:  any
```

**`Context: any`** — you can put `include` anywhere a directive is legal, and the
included file's contents are parsed **as if they had been typed at that point**.
There is no scope, no namespace, no import semantics. It is `#include` from C.

Two consequences follow immediately, and they are the whole page:

1. **The included file must be legal where you include it.** A file full of
   `server { … }` blocks is only valid inside `http`. A file full of bare
   `proxy_set_header` lines is only valid inside a `server` or `location`. The
   same file cannot serve both purposes.
2. **Because contents land at the including level, inheritance never applies to
   them.** This is why the include-a-snippet pattern from page 02 works: the
   directives are written at the same level, so there is nothing to replace.

## Two kinds of included file

Keep them in separate directories and the confusion disappears:

| Kind | Contains | Included from | Convention |
|---|---|---|---|
| **Site file** | a whole `server { … }` block | `http` | `conf.d/*.conf` (or Debian's `sites-enabled/*`) |
| **Snippet** | bare directives, no enclosing block | inside `server` or `location` | `snippets/*.conf` |

```nginx
# nginx.conf (main)
http {
    include /etc/nginx/mime.types;         # a `types { }` block — legal in http
    include /etc/nginx/conf.d/*.conf;      # site files, each a whole server block
}
```

```nginx
# /etc/nginx/conf.d/app.conf — a SITE file
server {
    listen 80;
    server_name app.example.com;

    location /api/ {
        include /etc/nginx/snippets/proxy.conf;   # a SNIPPET, inside location
        proxy_pass http://app;
    }
}
```

```nginx
# /etc/nginx/snippets/proxy.conf — a SNIPPET: no braces, no server, no location
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

Put a site file where a snippet belongs and you get
`"server" directive is not allowed here`. Put a snippet where a site file belongs
and you get the same class of error one level up. Both are loud, which is the good
case.

## The glob is literal, and that is where files go missing

`include conf.d/*.conf` matches exactly what it says:

| File | Included? |
|---|---|
| `app.conf` | ✅ |
| `app.conf.bak` | ❌ — does not end in `.conf` |
| `app.conf.disabled` | ❌ |
| `app` | ❌ |
| `app-old.conf` | ⚠️ **yes** — and this is the dangerous one |

The silent failures run in both directions. A file you meant to be live is not
matched and does nothing — no error, because nginx cannot report a syntax error in
a file it never opened, so `nginx -t` passes happily. And a file you meant to be
*disabled* is matched, quietly reintroducing a duplicate `server_name`, where the
first block read wins and the second is ignored (Phase 2).

**The rule: disabled configs move out of the included directory. They do not get
renamed in place.**

This is exactly what `nginx -T` is for (Phase 0, page 06):

```bash
nginx -T | grep -n 'server_name'     # every virtual host nginx actually knows about
```

**If your file's contents are not in that output, nginx has never read it.** Stop
debugging behaviour and start debugging the include.

## `sites-available` / `sites-enabled` is Debian, not nginx

Worth repeating from Phase 0 because it belongs here mechanically. nginx knows
nothing about that layout. It works only because Debian and Ubuntu's `nginx.conf`
contains a line like `include /etc/nginx/sites-enabled/*;`.

The nginx.org packages and the official container image ship `conf.d/*.conf`
instead and have no `sites-enabled`. Drop a Debian tutorial's config onto such a
server and it sits in an unincluded directory doing nothing, while `nginx -t`
reports success.

Note also the mask difference: Debian's include is often `sites-enabled/*` with no
extension filter, which is why the symlink convention works there and why an
editor backup in that directory *is* picked up.

## MIME types: the worked example

Every nginx installation includes one file the same way, and it is the clearest
illustration of what an include is for.

```nginx
http {
    include       mime.types;
    default_type  application/octet-stream;
}
```

`mime.types` is a single `types { … }` block mapping extensions to MIME types.
It is a plain include: no magic, and you could paste its several hundred lines
into `nginx.conf` with identical results.

The `types` directive's own documented default is tiny — `text/html html;
image/gif gif; image/jpeg jpg;` — which is why the include is not optional. And
`default_type` defaults to **`text/plain`**, not `application/octet-stream`.

That default matters. `text/plain` means an unrecognised extension is handed to
the browser as text to display; `application/octet-stream` means "download this,
I do not know what it is". Neither is universally right:

| `default_type` | Unknown extension behaves as | Suits |
|---|---|---|
| `text/plain` (nginx's default) | rendered as text in the browser | almost nothing in production |
| `application/octet-stream` (the conventional setting) | offered as a download | file servers, most apps |

### Adding a type

If a browser refuses your ES module or your `.wasm`, it is a MIME problem, and
you fix it by adding a mapping rather than editing the shipped file:

```nginx
http {
    include mime.types;

    types {
        application/javascript  mjs;
        application/wasm        wasm;
        image/avif              avif;
        font/woff2              woff2;
    }
}
```

A second `types` block **adds to** the mapping rather than replacing it — a rare
and welcome exception to page 02's replace rule, because `types` merges by
extension. Editing the packaged `mime.types` instead works until the next package
upgrade overwrites it.

The symptom to recognise:
`Failed to load module script: Expected a JavaScript module script but the server
responded with a MIME type of "text/plain"` — a browser refusing an ES module
because the extension was not mapped.

If the table grows very large, `types_hash_max_size` (default 1024) and
`types_hash_bucket_size` (default 64) are the knobs, and nginx will tell you in
the error log when it needs them raised.

## A layout that scales

```text
/etc/nginx/
├── nginx.conf                 # main, events, http-level defaults, the includes
├── mime.types                 # shipped
├── conf.d/
│   ├── 00-defaults.conf       # http-level settings you own (gzip, logs, limits)
│   ├── app.conf               # one server block
│   └── admin.conf             # another
├── snippets/
│   ├── proxy.conf             # the proxy_set_header set (page 02)
│   ├── security-headers.conf  # add_header … always
│   └── ssl.conf               # ssl_protocols, ciphers, session cache
└── disabled/                  # NOT included — where retired configs live
```

Three properties worth copying: one file per site, snippets for anything repeated
across sites, and **a directory outside the include path for things that are
switched off.**

## Gotchas

**Symptom:** You created a config file, reloaded, and nothing changed —
`nginx -t` passes.
**Cause:** The file is not matched by any `include` mask, so nginx never opened
it. A file nginx never reads cannot have a syntax error.
**Fix:** `nginx -T | grep <something from your file>`. If it is absent, fix the
filename or the include, not the config.

**Symptom:** `nginx: [emerg] "server" directive is not allowed here`.
**Cause:** A site file included from inside a `server` or `location`, or from the
`main` context instead of `http`.
**Fix:** Site files (whole `server` blocks) go in `http`. Snippets (bare
directives) go inside `server` or `location`. Do not mix the two kinds in one
directory.

**Symptom:** A config you renamed to `app.conf.disabled` still has no effect —
good — but one you renamed to `app-old.conf` broke the site.
**Cause:** The second still matches `*.conf`, so a duplicate `server_name` is now
loaded and one of the two blocks is silently ignored.
**Fix:** Move retired configs to a directory outside the include path. Renaming
in place is a coin flip.

**Symptom:** The browser refuses an ES module with
`Expected a JavaScript module script but the server responded with a MIME type of
"text/plain"`.
**Cause:** `.mjs` is not in the mapping, so `default_type` applied — and nginx's
documented default for that is `text/plain`.
**Fix:** Add a `types { application/javascript mjs; }` block after
`include mime.types`, and set `default_type application/octet-stream;`. Do not
edit the packaged `mime.types` — the next upgrade replaces it.

**Symptom:** `include` with an absolute path works and a relative one does not.
**Cause:** Relative paths resolve against the **prefix**, which is a build-time
value differing between distro packages, nginx.org packages and the container.
**Fix:** `nginx -V 2>&1 | tr ' ' '\n' | grep prefix` to see what yours is, and
prefer absolute paths in anything that moves between environments.

## Trade-off

**Textual inclusion is trivial to reason about and gives you nothing to lean on.**
No namespacing, no parameters, no conditional includes, no way to say "include
this only if the file exists". Snippets cannot take arguments, so a snippet that
needs to vary becomes two snippets.

What you get in exchange is that `nginx -T` can always show you the complete
truth as one flat document. There is no build step and no indirection to resolve
in your head — which is why `-T` is such an effective debugging tool, and why it
is the answer to almost every question on this page.

## Interview questions

**★ What does `include` do, and in which contexts can it appear?**
It substitutes a file's contents at the point of inclusion, parsed as if typed
there. Its documented context is `any`, so it works anywhere a directive is legal
— which is why an included file must itself be legal at that level.

**★ Why does the include-a-snippet pattern avoid the inheritance trap?**
Because the included directives land at the including level rather than being
inherited from a parent. Since every `proxy_set_header` is written at the same
level, there is no inherited set for the replace rule to discard.

**★ You added a file to `conf.d/` and nothing happened, but `nginx -t` passes.
What is wrong?**
The file almost certainly does not match the include mask — `conf.d/*.conf` will
not pick up `app.conf.bak` or `app`. nginx cannot report a syntax error in a file
it never opened. `nginx -T` shows what it actually read.

**Is `sites-available` / `sites-enabled` an nginx feature?**
No. It is a Debian and Ubuntu packaging convention that works only because their
`nginx.conf` includes `sites-enabled/*`. The nginx.org packages and the official
container use `conf.d/*.conf` and have no such directory.

**Why does every `nginx.conf` include `mime.types`?**
Because the `types` directive's built-in default maps only three extensions —
`html`, `gif`, `jpg`. Everything else falls through to `default_type`, whose
documented default is `text/plain`. The include supplies the real table.

**A browser refuses to run your `.mjs` file. What is the nginx-side cause?**
The extension is not in the MIME mapping, so `default_type` applied and the
browser got `text/plain` where it required a JavaScript MIME type. Add a `types`
block mapping `mjs` after `include mime.types`; a second `types` block adds to the
mapping rather than replacing it.

**What is the risk of renaming a config file to disable it?**
If the new name still matches the include mask — `app-old.conf` does — it stays
live, and a duplicate `server_name` means one of the two blocks is silently
ignored. Move retired configs out of the included directory instead.

---

← Prev: [Inheritance and the replace rule](02-inheritance.md) · Index: [Phase 1](README.md) · Next → [Variables](04-variables.md)
