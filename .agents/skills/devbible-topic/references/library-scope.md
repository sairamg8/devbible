# Library scope — when a surrounding library earns a page

`instructions.md` §2 fixes the scope at a named list of technologies and explicitly
parks GraphQL, tRPC and Kubernetes with *"Do not let these leak into the Node
syllabus."* That rule stands. This file is the **narrow, tested exception** for the
libraries a fullstack build genuinely cannot do without.

Settled by the user on 2026-09-03: **necessity test, auto-pin, no round-trip** — the
skill proposes the library and writes it, without stopping for approval.

---

## The test

> **A library earns a page when the reference implementation cannot be built without
> it. It stays parked when it is an architectural *layer* you would choose instead of
> something already in scope.**

| Earns a page | Why | Stays parked | Why |
|---|---|---|---|
| `jsonwebtoken` | You cannot teach stateless auth without it | **GraphQL** | An API layer chosen *instead of* Express |
| `bcrypt` | You cannot teach password storage without it | **tRPC** | Same, and only pays off end-to-end TS |
| `multer` | You cannot teach uploads without it | **Kubernetes** | A layer above Docker and Nginx |
| `helmet` | You cannot teach hardening a real Express app without it | a second ORM | You already teach one |
| `passport` | Only if the topic is third-party/OAuth login | a rival test runner | Jest is already in scope |

**Two questions that settle almost every case:**

1. *Would the reference implementation fail to run, or be irresponsible to ship,
   without this?* → it earns a page.
2. *Is this an alternative to something already taught, rather than a component of
   it?* → it stays parked.

⚠️ **When both point the same way, write it. When they conflict, park it and say so in
the report.** Parking costs one sentence; an unjustified track costs sessions.

---

## 🔴 The pin rule — non-negotiable

**A library may only be pulled in if it gets a pin in `src/data/pins.js` in the same
change.** A library taught but unpinned is worse than one not taught: the corpus makes
version-specific claims that nothing watches, and they rot silently.

**This is not hypothetical.** Measured on 2026-09-03:

| Library | Pages mentioning it | Pinned |
|---|---:|---|
| bcrypt | 32 | ❌ |
| helmet | 23 | ❌ |
| multer | 14 | ❌ |
| passport | 12 | ❌ |

**81 page-mentions, zero pins.** The corpus already teaches these and nothing watches
any of them. This rule exists so the number stops growing.

### The pin recipe

```js
  bcrypt: {
    label: 'bcrypt', source: 'npm:bcrypt', policy: 'latest',
    pin: '<the version you actually verified against>', checked: '<today>',
    tracks: ['nodejs', 'expressjs', 'real-world'],   // every track that teaches it
    names: ['bcrypt'],                                // matched in `> Verified:` lines
  },
```

Fields that decide whether it works — the header of `pins.js` is authoritative:

- **`source`** — `npm:<pkg>` for anything on the registry (almost every library);
  `eol:<product>` when it has a release *cycle* with EOL/LTS dates; `gh:<owner>/<repo>`
  for the stragglers.
- **`policy`** — 🔴 not optional. `latest` for a library. `lts` / `major` / `frozen`
  are for runtimes and databases.
- **`tracks`** — 🔴 **every** directory under `docs/` that teaches it. A pin cannot see
  pages outside its declared tracks, so a missing track means missing blast radius.
- **`names`** — lowercase strings matched against `> Verified:` lines. Keep them
  specific enough not to collide: `motion` needed narrowing because it matched
  `framer-motion`, and `mongodb` must not match *Spring Data MongoDB*.

**Then prove it is wired up:**

```bash
node scripts/currency.mjs --check
```

The new pin must appear with a real `latest` and a sane page count. A pin showing
`unanchored`, `unreachable`, or `0p` is not wired up — fix it before committing.

---

## Depth is not negotiable for a library

🔴 **A library page is not a README summary.** It clears exactly the same bar as any
other topic in `../../../references/authoring-contract.md`:

- The **mechanism**, not the API tour — *why bcrypt has a work factor at all*, not
  just that `hash()` takes one.
- **Runnable, complete examples** with realistic names. No `...` elisions.
- **Every gotcha the library actually has**, symptom → cause → fix, fix shown in code.
  These libraries are almost entirely gotcha: bcrypt's 72-byte input truncation, JWT's
  `alg: none` and the difference between signing and encrypting, multer's disk-vs-memory
  storage and unbounded file size.
- **Interview questions with answers**, `★` on the frequently-asked.
- Verified against the **primary source** at the lowest sufficient tier, per
  `../../../references/verification.md`.

A library page that lists the API and stops is the exact failure this project exists to
avoid.

---

## Where it goes

A library does **not** get its own top-level track. It belongs to the topic that needs
it, inside the track already teaching that concern:

```
docs/expressjs/pages/phase-<n>-auth/<nn>-hashing-passwords/     ← bcrypt lives here
docs/expressjs/pages/phase-<n>-auth/<nn>-stateless-sessions/    ← jwt lives here
docs/expressjs/pages/phase-<n>-uploads/<nn>-multipart-uploads/  ← multer lives here
```

**Why:** a reader searching for *"how do I store a password"* is inside the auth topic,
not browsing a library index. A standalone `docs/bcrypt/` track would also need its own
syllabus, phases and tier distribution — scaffolding the content does not justify.

⚠️ **A library that genuinely needs its own track is a brief change, not a judgement
call.** Say so and stop; `instructions.md` §2 is the user's to change.

---

## Report it

Whatever you pull in, the report says so explicitly (the version below is real —
checked against the npm registry on 2026-09-03, not invented for the example):

> Pulled in **bcrypt 6.0.0** for `<topic>` — the reference implementation cannot store
> a password without it. Pinned in `pins.js` (`npm:bcrypt`, `policy: latest`, tracks
> `nodejs`/`expressjs`), verified against the npm registry and the project README.
> `yarn currency` shows it current at 6.0.0 across 3 pages.

Naming it is what keeps the scope honest and lets the user veto cheaply.
