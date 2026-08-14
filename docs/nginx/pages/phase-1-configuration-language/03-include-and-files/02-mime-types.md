---
title: "MIME types and default_type"
sidebar_label: "02 · MIME types"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html) —
> `types` (documented default `text/html html; image/gif gif; image/jpeg jpg;`),
> `default_type` (documented default **`text/plain`**), `types_hash_bucket_size` (64),
> `types_hash_max_size` (1024), and the note that *"a sufficiently full mapping table is
> distributed with nginx in the `conf/mime.types` file"*.
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**Every nginx installation includes one file the same way, and it is the clearest
illustration of what an `include` is for — plus the source of a browser error you
will eventually hit.**

## The one include everybody has

```nginx
http {
    include       mime.types;
    default_type  application/octet-stream;
}
```

`mime.types` is a single `types { … }` block mapping file extensions to MIME
types. It is a plain include with no magic — you could paste its several hundred
lines into `nginx.conf` and get identical results.

**The include is not optional**, and the reason is the documented default of
`types` itself:

```nginx
# what nginx does with no include at all
types {
    text/html  html;
    image/gif  gif;
    image/jpeg jpg;
}
```

Three extensions. Everything else — every `.css`, every `.js`, every `.png` —
falls through to `default_type`.

## `default_type` defaults to `text/plain`, not `octet-stream`

This is the detail almost every config gets right by copying and almost nobody
can state. The documented default is **`text/plain`**. The line you see in every
`nginx.conf` — `default_type application/octet-stream;` — is a deliberate
override.

The difference is what a browser does with something nginx could not identify:

| `default_type` | Unknown extension behaves as | Suits |
|---|---|---|
| `text/plain` (nginx's default) | rendered as text in the browser | almost nothing in production |
| `application/octet-stream` (the conventional setting) | offered as a download | file servers, most apps |

Neither is universally right, and there is a security angle worth knowing: an
unidentified file served as `text/plain` is *displayed*, so a user-uploaded file
with an unmapped extension gets rendered rather than downloaded.
`application/octet-stream` plus `X-Content-Type-Options: nosniff` (Phase 9) is the
conservative pairing for anything user-supplied.

## Adding a type

If a browser refuses your ES module, your `.wasm` or your font, it is a MIME
problem. Fix it by adding a mapping, not by editing the shipped file:

```nginx
http {
    include mime.types;

    types {
        application/javascript  mjs;
        application/wasm        wasm;
        image/avif              avif;
        font/woff2              woff2;
    }

    default_type application/octet-stream;
}
```

A second `types` block **adds to** the mapping rather than replacing it — a rare
and welcome exception to [page 02's replace rule](../02-inheritance.md), because
`types` merges by extension. Note that the merge is per *extension*: redefining
one that already exists overrides just that entry.

**Do not edit the packaged `mime.types`.** It is owned by the nginx package and
the next upgrade overwrites it, taking your addition with it — a failure that
surfaces weeks later during an unrelated deploy.

The `types` directive is also usable in `server` and `location`, which is
occasionally handy: a download-only path can set
`default_type application/octet-stream;` locally while the rest of the site
behaves normally.

## Extensions are case-insensitive, and several map to one type

Quoted from the documentation: *"Extensions are case-insensitive"*, and several
can map to one type. The documented example:

```nginx
types {
    application/octet-stream bin exe dll;
    application/octet-stream deb;
    application/octet-stream dmg;
}
```

So `.JPG` and `.jpg` behave the same, and you do not need a separate line per
extension for the same type — though splitting them across lines, as above, is
equally valid.

## When the table gets large

Two knobs exist and nginx tells you when it needs them:

| Directive | Default |
|---|---|
| `types_hash_max_size` | `1024` |
| `types_hash_bucket_size` | `64` |

You will not touch these unless you add a very large custom mapping table, and
when you do, the error log will name the directive and the value to raise it to.

## Gotchas

**Symptom:** The browser refuses an ES module with
`Failed to load module script: Expected a JavaScript module script but the server
responded with a MIME type of "text/plain"`.
**Cause:** `.mjs` is not in the shipped mapping, so `default_type` applied — and
nginx's documented default for that is `text/plain`.
**Fix:** Add `types { application/javascript mjs; }` after `include mime.types`,
and set `default_type application/octet-stream;`. Confirm with
`curl -I` and read the `Content-Type` header.

**Symptom:** CSS loads but is not applied, and the console says the stylesheet was
ignored due to its MIME type.
**Cause:** Same class of problem — `include mime.types` is missing entirely, so
`.css` is falling through to `default_type`.
**Fix:** Add the include. If it is present, check with `nginx -T` that it is the
file you think it is.

**Symptom:** A custom MIME type worked for months and then stopped after a system
update.
**Cause:** The addition was made by editing `/etc/nginx/mime.types`, which the
package replaced on upgrade.
**Fix:** Put custom mappings in your own config as a second `types` block. Never
edit package-owned files.

**Symptom:** A user-uploaded file with an unknown extension renders in the browser
instead of downloading.
**Cause:** `default_type` left at nginx's `text/plain`.
**Fix:** `default_type application/octet-stream;` plus
`add_header X-Content-Type-Options nosniff always;` on any path that serves
user-supplied files (Phase 9).

**Symptom:** A font loads but the browser logs a MIME-type warning.
**Cause:** `woff2` missing from an older `mime.types`, or a custom build.
**Fix:** Add `font/woff2 woff2;`. Check what your file actually contains rather
than assuming — `nginx -T | grep woff2` answers it directly.

## Trade-off

**Extension-based MIME mapping is fast and occasionally wrong.** nginx never
inspects file contents; it looks at the characters after the last dot and consults
a hash table. That is why serving a file is cheap, and why a file with the wrong
extension is served with confidently wrong metadata.

Content sniffing would be more accurate and much slower, and browsers'
willingness to sniff is itself a security problem — which is what
`X-Content-Type-Options: nosniff` exists to switch off. The nginx position is:
get the extension right, declare the type, and tell the browser not to guess.

## Interview questions

**★ Why does every `nginx.conf` include `mime.types`?**
Because the `types` directive's built-in default maps only three extensions —
`html`, `gif`, `jpg`. Everything else falls through to `default_type`. The include
supplies the real table, which ships with nginx as `conf/mime.types`.

**★ What is `default_type`'s actual default, and why does the conventional value
differ?**
The documented default is `text/plain`. Configs conventionally override it to
`application/octet-stream` so an unidentified file is offered as a download rather
than rendered as text in the browser — which matters most for user-uploaded
content.

**★ A browser refuses to run your `.mjs` file. What is the nginx-side cause?**
The extension is not in the MIME mapping, so `default_type` applied and the
browser received `text/plain` where it required a JavaScript MIME type. Add a
`types` block mapping `mjs` after `include mime.types`.

**If you add a second `types` block, does it replace the first?**
No — this is the exception to the replace-not-merge rule. `types` merges by
extension, so a second block adds mappings and only overrides the specific
extensions it redefines.

**Why should you not edit `/etc/nginx/mime.types` directly?**
It is owned by the nginx package and will be overwritten on upgrade, silently
removing your addition. Custom mappings belong in your own configuration as an
additional `types` block.

**Does nginx inspect file contents to decide the `Content-Type`?**
No. It maps the file extension through a hash table and never looks at the bytes.
That makes serving cheap and makes a misnamed file confidently mislabelled — which
is why `X-Content-Type-Options: nosniff` belongs on anything user-supplied.

---

← Prev: [How `include` works](01-how-include-works.md) · Index: [`include` and the file layout](README.md) · Next → [Variables](../04-variables.md)
