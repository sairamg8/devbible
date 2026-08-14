---
title: "The algorithm and the modifiers"
sidebar_label: "01 · The algorithm and the modifiers"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [ngx_http_core_module — `location`](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> (`location [ = | ~ | ~* | ^~ ] uri { … }`, `location @name { … }`, the modifier
> semantics) and [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html)
> (the four-step algorithm and the worked PHP example).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**Four sentences, and they are exact. Learn them verbatim and nginx routing stops
being guesswork.**

## The algorithm

Quoted from the documentation:

1. *"nginx first searches for the most specific **prefix location** given by
   literal strings **regardless of the listed order**."*
2. *"Then nginx checks locations given by **regular expression** in the order
   listed in the configuration file."*
3. *"The search of regular expressions terminates on the **first match**."*
4. *"If no regular expression matches then the configuration of the prefix
   location remembered earlier is used."*

Restated as a procedure:

```text
1. Look at every prefix location. Remember the LONGEST one that matches.
     → If it has `=` and matched exactly, stop. That is the answer.
     → If it has `^~`, stop. That is the answer. Skip step 2.
2. Try each regex location, in FILE ORDER. The FIRST one that matches wins.
3. No regex matched? Use the prefix location remembered in step 1.
```

Two facts that are easy to miss and account for most confusion:

- **Prefix locations are all evaluated before any regex is considered.** A regex
  never "gets there first" by being written higher in the file.
- **A regex, once one matches, beats the remembered prefix** — however specific
  that prefix was. `location /static/images/thumbnails/` loses to
  `location ~ \.png$` unless you say otherwise.

**Locations test only the URI, without the query string.** `?foo=bar` is never
part of the match.

## The five modifiers

```text
Syntax: location [ = | ~ | ~* | ^~ ] uri { ... }
        location @name { ... }
Context: server, location
```

| Modifier | Kind | Behaviour |
|---|---|---|
| `=` | exact | Matches the URI **exactly**. If it matches, **the search stops immediately** — nothing else is evaluated |
| `^~` | prefix | Matches a prefix, and if it is the longest matching prefix, **regexes are not checked at all** |
| *(none)* | prefix | Ordinary prefix. The longest match is remembered, then regexes are still tried |
| `~` | regex | Case-**sensitive** regular expression |
| `~*` | regex | Case-**insensitive** regular expression |
| `@name` | named | **Never matched against a URI.** Reachable only from `try_files`, `error_page` or `rewrite … last` — see [page 04](../04-named-and-internal.md) |

### `=` — the fastest possible match

```nginx
location = / {
    # ONLY the exact URI "/" — not /index.html, not /anything
    root /srv/landing;
}

location = /healthz {
    access_log off;
    return 200 "ok\n";
}
```

`=` terminates the search the moment it matches. For a URL hit constantly — a
health check, the site root on a busy front page — it is the cheapest routing
decision nginx can make, and it removes any chance of a regex stealing the
request.

### `^~` — "prefix wins, do not check regexes"

```nginx
location ^~ /static/ {
    root /srv/app;
    expires 1y;
}

location ~* \.(png|jpg|css|js)$ {
    # never reached for anything under /static/
    expires 30d;
}
```

`^~` is the tool for **"everything under this path is handled here, whatever it is
called."** Without it, `/static/logo.png` would be pulled into the regex block by
step 2, and any `proxy_pass`, `root` or header set in `/static/` would not apply.

Note the common misreading: the `^` in `^~` is **not** a regex anchor. `^~` is a
prefix modifier whose meaning is "and skip the regex step". Nothing about it is a
regular expression.

### Bare prefix — the workhorse

```nginx
location /api/ { proxy_pass http://app; }
location /     { root /srv/dist; }
```

`location /` matches everything, and because prefix matching takes the **longest**
match, `/api/users` still goes to `/api/` — position in the file is irrelevant.
This is why `location /` at the top of a config does not swallow everything, which
surprises people coming from ordered routing systems.

### `~` and `~*` — regexes

```nginx
location ~* \.(jpg|jpeg|png|gif|webp|avif)$ { expires 30d; }
location ~  ^/user/(\d+)$                   { proxy_pass http://app; }
```

Case-sensitive and case-insensitive PCRE. Captures become `$1`, `$2` or named
variables ([Phase 1, page 08](../../phase-1-configuration-language/08-rewrite-and-return.md)).

**These are the only locations where the order you write them in matters**, and
that is chunk 02's subject.

## The documented worked example

Straight from the documentation, and worth walking:

```nginx
server {
    listen      80;
    server_name example.org www.example.org;
    root        /data/www;

    location / {
        index   index.html index.php;
    }

    location ~* \.(gif|jpg|png)$ {
        expires 30d;
    }

    location ~ \.php$ {
        fastcgi_pass  localhost:9000;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include       fastcgi_params;
    }
}
```

| Request | Matched by | Result |
|---|---|---|
| `/logo.gif` | prefix `/` **then** regex `\.(gif\|jpg\|png)$` | the **regex** wins — served from `/data/www/logo.gif` with `expires 30d` |
| `/index.php` | prefix `/` **then** regex `\.php$` | the **regex** wins — passed to FastCGI |
| `/about.html` | prefix `/` only | the prefix wins — served as a file |
| `/` | prefix `/`, then `index` finds `index.php` | **internal redirect** to `/index.php`, locations searched **again**, ends at FastCGI |

That last row is the one to notice. `index` produced an **internal redirect**, and
the request re-entered location matching with a new URI — the mechanism
[page 06](../06-internal-redirects.md) covers in full.

## Gotchas

**Symptom:** Directives in `location /static/` seem to be ignored for image files.
**Cause:** A regex location like `~* \.(png|jpg)$` matched, and a matching regex
beats the remembered prefix.
**Fix:** `location ^~ /static/`, which stops regexes being checked at all.

**Symptom:** `location = /api/` never matches `/api/users`.
**Cause:** `=` is an exact match on the whole URI, not a prefix.
**Fix:** Drop the `=`. Use it only for URLs you mean literally, like `/healthz`.

**Symptom:** You moved `location /` to the bottom of the file and nothing changed.
**Cause:** Prefix locations are chosen by longest match *regardless of listed
order*. Moving them has no effect.
**Fix:** Nothing to fix — but if you *wanted* the order to matter, you were
reaching for a regex, and that is chunk 02.

**Symptom:** A `location` with a query string in it never matches.
**Cause:** Locations test only the URI. `?` and everything after it are not part
of the match.
**Fix:** Match on `$arg_name` in a `map` ([Phase 1](../../phase-1-configuration-language/06-map/README.md)),
or handle it in the application.

**Symptom:** `location ^~ /assets` behaves like a regex and you cannot work out
why the `^` is not anchoring.
**Cause:** It is not a regex. `^~` is a single prefix modifier meaning "longest
prefix, and skip the regex step".
**Fix:** Read it as one token. There is no regular expression involved.

**Symptom:** `/API/USERS` reaches a different location than `/api/users`.
**Cause:** Prefix matching and `~` are case-**sensitive**; only `~*` is not.
**Fix:** Use `~*` if you genuinely need case-insensitive routing — but prefer
fixing the caller, since case-varying URLs cause cache-key problems too.

## Trade-off

**A fully specified algorithm with no ambiguity, at the cost of two rules instead
of one.** You never have to wonder what nginx will do — the outcome is
determinable by reading. But "longest prefix regardless of order, first regex in
order" is two mental models in one mechanism, and everyone gets it wrong once.

The practical mitigation is to keep regex locations few and specific. A config
with two or three regexes is easy to reason about; a config with a dozen is a
sequence you have to simulate in your head, and that is precisely the config that
generates the bug reports.

## Interview questions

**★ Describe nginx's location matching algorithm.**
All prefix locations are checked and the longest match is remembered, regardless
of the order they appear in. Then regex locations are tried **in file order** and
the first match wins. If no regex matches, the remembered prefix location is used.
A matching `=` location stops the search immediately, and a `^~` on the longest
matching prefix skips the regex step entirely.

**★ What do `=` and `^~` do?**
`=` is an exact match on the whole URI and terminates the search immediately —
ideal for a hot, literal URL like `/healthz`. `^~` is a prefix modifier meaning
"if this is the longest matching prefix, do not check regexes at all" — the way to
protect a whole path from being pulled into a regex block.

**★ A request for `/static/logo.png` is being handled by a regex block instead of
`location /static/`. Why, and how do you fix it?**
Because a matching regex beats the remembered prefix, however specific that prefix
was. Change it to `location ^~ /static/`, which stops the regex step from running.

**★ Does the order of `location` blocks matter?**
Only for regex locations, where the first match in file order wins. Prefix
locations are selected by longest match regardless of where they appear, which is
why `location /` at the top of a file does not swallow everything.

**Why does `location /` not match every request even though `/` prefixes
everything?**
It does match every request — but prefix selection takes the *longest* match, so a
more specific prefix like `/api/` beats it. `/` is the fallback precisely because
it is the shortest.

**Do locations see the query string?**
No. Locations test only the URI portion of the request line, without arguments. To
branch on a query parameter, use `$arg_name` with a `map`, or handle it in the
application.

**In the documented PHP example, why does a request for `/` end up at FastCGI?**
`location /` matches, and its `index` directive finds `index.php`. That produces an
**internal redirect** to `/index.php`, and nginx searches locations again with the
new URI — this time the `\.php$` regex matches.

---

← Index: [The location matching algorithm](README.md) · Next → [The asymmetry, in practice](02-the-asymmetry.md)
