---
title: "Permissions, not role names"
sidebar_label: "02 · Permissions, not role names"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**A route should say what it protects, not who happens to have access. That one
substitution turns "add a role" from a search across the codebase into a line in
a map — and it is nearly impossible to retrofit.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** Express supplies
> nothing here: no roles, no permissions, no policy engine
> ([express reference](https://expressjs.com/en/5x/api/express.html)), so every
> structure below is application code. OAuth **scope** is a space-delimited list
> of case-sensitive strings
> ([RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html) §3.3), and a token
> whose scope is insufficient gets **403** with
> `WWW-Authenticate: Bearer error="insufficient_scope"`
> ([RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html) §3.1) — one of the few
> places a standard prescribes the authorization response. The
> **431** ceiling on claim size is
> [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §5 against Node's
> documented 16 KiB header default
> ([Node CLI](https://nodejs.org/api/cli.html#--max-http-header-sizesize)).
> **The naming, layout and migration guidance are this bible's.**

## The substitution

```js
// ⛔ the route knows about roles
router.delete('/orders/:id', requireRole('admin', 'support'), handler);

// ✅ the route knows about capabilities; roles map to them in one place
router.delete('/orders/:id', requirePermission('orders:delete'), handler);

const ROLE_PERMISSIONS = {
  admin:   ['orders:delete', 'orders:read', 'users:manage'],
  support: ['orders:delete', 'orders:read'],
  member:  ['orders:read'],
};
```

`requireRole('admin')` reads well and ages badly. The moment a second role needs
the same capability, every route mentioning `'admin'` has to be found and edited
— and **the routes that are missed are the bug**, silently, with no test failing.

Three things improve at once:

- **Adding a role is one line.** `auditor: ['orders:read']` grants across every
  route already protected by `orders:read`, with no route file touched.
- **The route line becomes reviewable.** `orders:delete` states the consequence;
  `admin` states a fact about your org chart that a reviewer cannot evaluate.
- **The guard stops being a place decisions live.** The map is the policy, in one
  file, greppable and diffable — which is what makes an authorization review
  possible at all.

🔴 **Do this on day one.** Retrofitting means auditing every route to work out
which capability each role check was standing in for, and that audit is exactly
the work nobody has time for. The migration path, when it is already too late, is
at the end of this page.

## Naming that survives

The permission string is a long-lived identifier — it ends up in code, in the
map, sometimes in tokens and in an admin UI. `resource:action` is the convention
worth adopting, with the resource plural and the action a verb:

```
orders:read   orders:write   orders:delete   orders:refund
users:read    users:manage   billing:read    reports:export
```

Two rules that pay for themselves:

**Name the capability, not the endpoint.** `orders:delete` survives the route
moving from `DELETE /orders/:id` to `POST /orders/:id/cancel`.
`delete_order_endpoint` does not.

**Do not encode the role in the permission.** `admin:orders:delete` re-couples
what the map exists to decouple — the whole point is that *which* roles hold a
capability is data, not part of its name.

⚠️ **Resist wildcards early.** `orders:*` looks tidy and turns every new
capability on that resource into a **silent, retroactive grant**: adding
`orders:refund` next month hands it to everyone holding the wildcard, and no
review shows it. If you must have one, spell it as an explicit list generated at
startup so the expansion is visible in code review.

## Where the map lives

| | In code | In the database |
|---|---|---|
| Changing policy | a deploy | an update, live |
| Review trail | the diff | your own audit table |
| Reading it | free, in memory | a lookup per request unless cached |
| Right when | roles are a product concept fixed by the team | customers define their own roles |

**Start in code.** It is reviewed, versioned, atomic with the code that depends on
it, and free to read. A permission map in the database is a feature — "customers
manage their own roles" — and it should be built when that is the requirement,
not in anticipation of it.

🔴 **If it does move to the database, it becomes a per-request lookup and needs a
cache — and the cache needs an invalidation story.** A revoked permission that
takes fifteen minutes to take effect is the same staleness problem as a token
that cannot be revoked
([page 04 · chunk 02](../04-authn-middleware/02-tokens-sessions-and-cost.md)),
arrived at by a different route. Decide the window deliberately; a shared store
makes it small ([Redis](../../../../redis/pages/README.md)).

## Permissions in the token, or looked up?

Two designs, and the difference is the same one as sessions versus tokens:

**Role in the token, permissions resolved server-side** *(recommended)*. The token
carries `role: 'support'`; the map turns it into capabilities on each request, in
memory. A capability added to a role takes effect on the **next request**, and the
token stays small.

**Permissions in the token.** The token carries the expanded list. Nothing is
resolved per request — and every permission change now waits for token expiry,
because the claim is already signed. Worse, the list grows with the account: this
is the concrete route to a **431 Request Header Fields Too Large** for exactly the
users with the most roles, since every request re-sends the whole list.

⚠️ **The exception is OAuth scopes**, where the token is deliberately the
authority — a third-party client was granted a subset of the user's rights, and
the resource server must honour exactly that. There the standard even fixes the
response: **403** with
`WWW-Authenticate: Bearer error="insufficient_scope"`. Scopes and internal
permissions are different things sharing a shape — a scope bounds what a *client*
may do on the user's behalf; a permission bounds what the *user* may do at all.
An API that needs both checks both.

## Role hierarchy, and the trap in it

Hierarchies are tempting — `admin` inherits everything `support` has, which
inherits `member` — and they encode a claim that is usually false: that
capabilities are totally ordered. The first `auditor` role (reads everything,
writes nothing) or `billing` role (touches invoices, cannot see orders) breaks
the chain, and the usual repair is to grant `admin` to a role that should never
have had it.

```js
// ✅ flat, explicit, and boring — each role is a list you can read in full
const ROLE_PERMISSIONS = {
  member:  ['orders:read'],
  support: ['orders:read', 'orders:refund'],
  auditor: ['orders:read', 'reports:export'],
  admin:   ['orders:read', 'orders:refund', 'orders:delete', 'users:manage'],
};
```

Duplication across the lists is the price, and it is a **feature**: the full
capability set of a role is visible in one place without following an inheritance
chain, which is what makes the map reviewable. If the duplication genuinely hurts,
compose the lists from named groups **at startup** — the expansion still ends up
explicit and greppable.

🔴 **Deny rules are worse than duplication.** "Everything admin has, except
`users:manage`" introduces precedence — what wins when a role both grants and
denies? — and precedence is where authorization bugs hide. Grant only.

## The superuser escape hatch

Nearly every system grows one, and the honest version is small and visible:

```js
const granted = ROLE_PERMISSIONS[req.user.role] ?? [];
if (granted.includes('*')) return next();          // ⚠️ one role, audited, logged
```

If it exists: **one** role holds it, it is granted by a process someone signs off,
every use is logged with the acting user, and it is never the default for
developers in production. The failure mode is not the hatch — it is the hatch
that quietly ends up on three roles because it was easier than adding a
permission.

## Migrating from roles to permissions

When the codebase is already full of `requireRole('admin')`, the safe order is:

1. **Add the map** and `requirePermission`, changing no routes. Nothing breaks
   because nothing uses it yet.
2. **Derive the map from reality**: for each existing role check, write down the
   capability it was standing in for. This is the audit, and it is the part that
   takes time.
3. **Convert route by route**, one resource at a time, keeping both guards on the
   route for the first pass if the risk warrants — `requireRole` then
   `requirePermission`, which can only be *more* restrictive.
4. **Assert the equivalence in a test** before dropping the old guard: for every
   role, the set of routes it can reach must be unchanged.
5. **Delete `requireRole`** and let the linter find the stragglers.

⚠️ **The one thing not to do is a bulk find-and-replace of `'admin'` with a
permission string.** It preserves today's behaviour and loses the information the
audit exists to produce — which routes were protected by accident and which by
intent.

## Gotchas

**Symptom:** Adding a role means editing forty route files
**Cause:** Routes check role names instead of capabilities
**Fix:** `requirePermission('orders:delete')` plus one role → permission map

**Symptom:** A new capability was granted to a role nobody intended
**Cause:** A `orders:*` wildcard expanded retroactively
**Fix:** Explicit lists; if a wildcard is unavoidable, expand it at startup so the
grant appears in review

**Symptom:** A permission change does not take effect until users log in again
**Cause:** The expanded permission list is a claim inside the token
**Fix:** Put the role in the token and resolve permissions server-side

**Symptom:** 431 for the users with the most roles
**Cause:** A permission list in the token, re-sent on every request
**Fix:** Identifiers in the token, resolution on the server

**Symptom:** Two roles that should differ end up identical
**Cause:** A hierarchy where a new role did not fit, repaired by granting a
higher one
**Fix:** Flat explicit lists; duplication is cheaper than a wrong inheritance edge

**Symptom:** Nobody can say what a role can actually do
**Cause:** Inheritance chains, or deny rules with precedence
**Fix:** Grant only, one readable list per role

**Symptom:** A revoked permission still works for another quarter of an hour
**Cause:** A database-backed map behind a cache with no invalidation
**Fix:** Decide the staleness window deliberately and invalidate on change

## Interview questions

**★ Why check permissions rather than role names in routes?**
Because a role is *who* and a permission is *what is protected*. Checking roles
means every capability change is a search across route files, and the routes you
miss are the bug. Checking permissions makes it one line in a map, and it makes
the route line self-documenting — `orders:delete` names the consequence,
`admin` does not.

**★ Should permissions live in the token or be resolved per request?**
Resolve them: put the role in the token and expand it server-side. Permissions in
the token cannot change until it expires, and the list grows with the account
until the header limit produces a 431 for your most-privileged users. OAuth
scopes are the deliberate exception — there the token is the authority by design.

**★ What is wrong with a role hierarchy?**
It asserts that capabilities are totally ordered, and the first auditor or
billing role disproves that. The usual repair is granting a higher role than
intended. Flat explicit lists duplicate, and that duplication is what makes a
role's full capability set readable in one place.

**★ How do you migrate an existing codebase from roles to permissions?**
Add the map and the new guard without changing routes; work out which capability
each existing role check stood for; convert one resource at a time, optionally
running both guards; assert per role that the reachable route set is unchanged;
then delete the old guard. A bulk find-and-replace preserves behaviour and
destroys the audit.

**Why are deny rules discouraged?**
Because they introduce precedence — what wins when a role both grants and denies?
— and precedence is where authorization bugs live. Grant only.

**What is `orders:*` actually costing you?**
Visibility. Every capability added to that resource later is granted
retroactively to everyone holding the wildcard, and no code review shows the
grant.

---

← Prev: [The second question](01-the-second-question.md) · Index: [RBAC middleware](README.md) · Next → [What RBAC cannot do](03-what-rbac-cannot-do.md)
