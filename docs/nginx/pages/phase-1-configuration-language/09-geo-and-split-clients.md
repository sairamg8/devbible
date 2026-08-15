---
title: "geo and split_clients"
sidebar_label: "09 · geo and split_clients"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against [ngx_http_geo_module](https://nginx.org/en/docs/http/ngx_http_geo_module.html)
> and [ngx_http_split_clients_module](https://nginx.org/en/docs/http/ngx_http_split_clients_module.html).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**Two more `http`-context lookup blocks, both cousins of `map`. `geo` maps IP
addresses to values; `split_clients` maps a hashed key to percentage buckets.
Neither is something you need often, and both are the right answer when you do.**

## `geo` — lookups by IP address

```text
Syntax:   geo [$address] $variable { ... }
Default:  —
Context:  http
```

```nginx
geo $internal {
    default        0;
    10.0.0.0/8     1;
    172.16.0.0/12  1;
    192.168.0.0/16 1;
    127.0.0.1/32   1;
}

server {
    location /metrics {
        # allow only internal networks, without repeating the CIDR list
        if ($internal = 0) { return 403; }
        stub_status;
    }
}
```

It is `map` with CIDR keys and **longest-prefix matching** rather than string
matching. By default the source is `$remote_addr`; the optional first argument
lets you use something else:

```nginx
geo $http_x_forwarded_for $from_cdn { ... }   # ⚠ client-controlled — see below
```

Special parameters, mirroring `map`'s:

| Parameter | Meaning |
|---|---|
| `default` | value when no range matches. **Without it the default is an empty string**, and `0.0.0.0/0` / `::/0` can be written instead |
| `include` | pull the ranges in from a file — several inclusions allowed, and how large tables are managed |
| `ranges` | keys are address **ranges** rather than CIDR. **Must be the first parameter**, and addresses should be in ascending order for load speed |
| `proxy` | defines trusted addresses: a request from one of them uses the address in `X-Forwarded-For` instead |
| `proxy_recursive` | with it, the **last non-trusted** address in `X-Forwarded-For` is used; without it, simply the last address |
| `delete` | remove a previously defined network |

IPv6 works the same way — the documented example maps `::1` and `2001:0db8::/32`
alongside their IPv4 equivalents.

### Where `geo` is genuinely useful

- **An internal-network flag** shared across many `server` and `location` blocks,
  defined once rather than repeated as `allow`/`deny` lists everywhere.
- **Exempting your own monitoring** from a rate limit (Phase 9):

  ```nginx
  geo $internal {
      default 0;
      10.0.0.0/8 1;
  }
  map $internal $limit_key {
      0 $binary_remote_addr;   # limit external clients by IP
      1 "";                    # empty key = not limited at all
  }
  limit_req_zone $limit_key zone=api:10m rate=10r/s;
  ```

  That `map` returning an empty string is the documented way to exempt a client
  from `limit_req`: a zone key that evaluates to empty is not counted.

### `geo` is not geolocation

The name misleads. `geo` maps **IP ranges you supply** to values. Actual
country-level geolocation needs a database:

| Module | Status |
|---|---|
| `ngx_http_geoip_module` | the **legacy** MaxMind GeoIP database; the `nginx-module-geoip` package |
| GeoIP2 | a third-party module — not in stock nginx |

And the underlying caveat applies whichever you use: IP geolocation is
approximate, VPNs and mobile carriers defeat it routinely, and it is not an
access-control mechanism. Anything security-relevant belongs in the application.

## `split_clients` — percentage buckets

```text
Syntax:   split_clients string $variable { ... }
Default:  —
Context:  http
```

```nginx
split_clients "${remote_addr}${http_user_agent}${date_gmt}" $variant {
    0.5%    ".one";
    2.0%    ".two";
    *       "";
}
```

*"The value of the original string is hashed using MurmurHash2"*, and the
resulting 32-bit value is assigned to a bucket. The documentation spells the
arithmetic out: `0.5%` covers hash values 0–21,474,835, `2.0%` covers
21,474,836–107,374,180, and `*` covers 107,374,181–4,294,967,295. `*` is the
remainder — the "everything else" bucket, and it is mandatory in practice.

The documented example keys on `"${remote_addr}AAA"` — the trailing literal is a
**salt**. Adding one changes every bucket assignment, which is how you re-roll a
split without changing the percentages.

### The canary deploy

This is the pattern worth remembering, and Phase 11 returns to it:

```nginx
split_clients "${remote_addr}" $backend {
    5%   app_canary;
    *    app_stable;
}

server {
    location / {
        proxy_pass http://$backend;      # ⚠ variable in proxy_pass — Phase 4
    }
}
```

**The choice of hash key decides the behaviour, and this is the whole art of it:**

| Key | Behaviour |
|---|---|
| `$remote_addr` | **sticky per client** — the same visitor always lands in the same bucket |
| `$cookie_session` | sticky per session, and survives a client's IP changing |
| `$request_id` | **random per request** — the same user can bounce between variants |
| `"${remote_addr}${date_gmt}"` | re-buckets daily |

For a canary you almost always want **sticky**, because a user who sees the new
version on one request and the old one on the next gets an incoherent experience —
mismatched assets, a session the other version does not understand. `$remote_addr`
or a session cookie; not `$request_id`.

### An A/B test

```nginx
split_clients "${cookie_uid}" $ab_variant {
    50%  "b";
    *    "a";
}

location / {
    proxy_set_header X-AB-Variant $ab_variant;   # let the app decide what to do
    proxy_pass http://app;
}
```

Splitting at the edge and letting the application act on a header is usually
better than serving two different backends: one deployment, and the analytics stay
in the application where they belong.

## Gotchas

**Symptom:** `geo` on `$http_x_forwarded_for` lets anyone into an internal-only
endpoint.
**Cause:** `X-Forwarded-For` is entirely client-controlled. Anyone can claim to be
`10.0.0.1`.
**Fix:** Use the default `$remote_addr`, and get the real client IP with the
`realip` module (Phase 4) so `$remote_addr` is already correct. Never trust a
forwarded header without an explicit trust chain.

**Symptom:** A canary split sends the same user to a different version on every
request.
**Cause:** The hash key varies per request — `$request_id`, or something including
a timestamp.
**Fix:** Key on `$remote_addr` or a session cookie. Stickiness comes entirely from
the key.

**Symptom:** `split_clients` percentages do not add to what you expect, and some
requests get an empty variable.
**Cause:** No `*` bucket, so anything past the listed percentages falls through to
an empty string.
**Fix:** Always include `*` as the last entry.

**Symptom:** `nginx: [emerg] "geo" directive is not allowed here`.
**Cause:** It is inside `server` or `location`.
**Fix:** `geo` and `split_clients` are `http`-context blocks, like `map` and
`upstream` ([page 01](01-directives-and-contexts.md)).

**Symptom:** A country-based rule blocks legitimate users.
**Cause:** IP geolocation is approximate, and VPNs, corporate egress and mobile
carriers routinely place users in the wrong country.
**Fix:** Do not use it for access control. It is acceptable for a default language
or currency; it is not an authorisation mechanism.

**Symptom:** After changing the canary from 5% to 10%, users who were in the
canary moved out of it.
**Cause:** The bucket boundaries are computed from the hash and the listed
percentages, so changing the percentages re-partitions the space.
**Fix:** Expect it. Ramp deliberately, and do not assume the 5% cohort is a subset
of the 10% one.

## Trade-off

**`split_clients` gives you traffic splitting with no state and no coordination —
and no memory.** There is no record of which user is in which bucket, no way to
move one user, and no consistency guarantee across a percentage change. It is a
hash function, and that is all.

For a short canary that is exactly right: zero infrastructure, one reload to
change the split, one reload to roll back. For a real feature-flag system —
per-user targeting, gradual rollout with a stable cohort, kill switches — you want
a service that stores decisions, and the split belongs in the application rather
than in nginx.

## Interview questions

**★ What does `split_clients` do, and what determines whether a user sticks to one
bucket?**
It hashes a string you supply (MurmurHash2) and assigns the result to a percentage
bucket. Stickiness comes entirely from the key: `$remote_addr` or a session cookie
keeps a user in one bucket; `$request_id` re-rolls on every request. For canary
deploys you want sticky, or users get mismatched assets between requests.

**★ How would you run a 5% canary deploy with nginx alone?**
`split_clients "${remote_addr}" $backend { 5% app_canary; * app_stable; }` and
`proxy_pass http://$backend;` — noting that a variable in `proxy_pass` changes
its behaviour and needs a resolver. Ramp by editing the percentage and reloading;
roll back the same way.

**★ Does `geo` do geolocation?**
No. It maps IP ranges *you provide* to values, with longest-prefix matching — a
`map` for CIDRs. Real geolocation needs a database via the legacy
`ngx_http_geoip_module` or a third-party GeoIP2 module, and even then it is
approximate and unsuitable for access control.

**Why is `geo $http_x_forwarded_for …` dangerous?**
Because `X-Forwarded-For` is set by the client and can claim any address. An
"internal network" check built on it is trivially bypassed. Use `$remote_addr`,
and fix it with the `realip` module so that it holds the true client address.

**How do you exempt internal traffic from a rate limit?**
Map the internal flag to an **empty** limit key: a `limit_req_zone` key that
evaluates to an empty string is not counted at all. `geo` supplies the flag,
`map` turns it into either `$binary_remote_addr` or `""`.

**Why must `split_clients` include a `*` bucket?**
Because the listed percentages rarely total 100, and anything outside them falls
through to an empty string rather than to a sensible default. `*` is the
remainder bucket and should always be the last entry.

---

← Prev: [`rewrite`, `return` and regular expressions](08-rewrite-and-return.md) · Index: [Phase 1](README.md) · Syllabus → [Part 1 — How nginx works](../../syllabus/01-how-nginx-works.md)
