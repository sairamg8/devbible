---
title: "Seed data and fixtures"
sidebar_label: "03 · Seeds & fixtures"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 17 documentation (`overriding system
> value`, `on conflict`) and the node-postgres docs. Concept home:
> [PostgreSQL — CRUD](../../../postgresql/pages/phase-4-crud/README.md).

## The problem

A freshly migrated database is empty, and empty is useless three ways: the
storefront renders nothing in development, tests have nothing to assert
against, and a new teammate's first hour becomes data entry. Seeds solve all
three — but they are three *different* problems, and mixing them is the
classic mistake.

## The design choices

**Three kinds of data, three owners:**

| Kind | Example | Lives | Runs |
|---|---|---|---|
| **Reference data** | The root categories; the admin account | In a **migration** — it is schema-adjacent truth every environment needs | Always, everywhere |
| **Development seed** | 200 products, users, carts, orders in every status | `db/seed.js` | On demand, never in production |
| **Test fixtures** | The two products *this test* needs | Factory functions in the test suite | Per test |

The line that matters: if production needs it, it is a migration; if a demo
needs it, it is the seed; if an assertion needs it, the test builds it itself.
Seeding production from `seed.js` is the failure mode — the guard below makes
it a deliberate act.

**Deterministic, not random.** The seed uses fixed data with fixed IDs, so
"product 42" means the same thing on every laptop and in every bug report.
Faker-style random seeds demo nicely and reproduce nothing.

**Idempotent by upsert.** Re-running the seed converges instead of duplicating
— `on conflict` on the natural keys (slugs, emails) makes it a reset button.

## The implementation

```js
// db/seed.js
import pg from 'pg';

export async function seed(databaseUrl) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed refuses to run in production');
  }
  const client = new pg.Client({connectionString: databaseUrl});
  await client.connect();
  try {
    await client.query('begin');

    const {rows: cats} = await client.query(
      `insert into categories (name, slug)
       values ('Audio', 'audio'), ('Keyboards', 'keyboards'), ('Desks', 'desks')
       on conflict (slug) do update set name = excluded.name
       returning id, slug`,
    );
    const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

    // products: deterministic names, prices and stock
    for (let i = 1; i <= 200; i++) {
      const slug = `demo-product-${i}`;
      await client.query(
        `insert into products
           (category_id, name, slug, description, price_cents, attributes, stock)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (slug) do update
           set price_cents = excluded.price_cents, stock = excluded.stock`,
        [
          catId[['audio', 'keyboards', 'desks'][i % 3]],
          `Demo product ${i}`,
          slug,
          `Long enough description for product ${i} to exercise search.`,
          1000 + (i % 50) * 500,          // 10.00 … 254.50, spread for filters
          {colour: ['black', 'silver', 'walnut'][i % 3]},
          i % 10 === 0 ? 0 : 25,          // every 10th product is out of stock
        ],
      );
    }

    // one known customer with a known password hash (chapter: Phase 3 auth)
    await client.query(
      `insert into users (email, password_hash, role)
       values ('customer@example.com', $1, 'customer')
       on conflict (email) do nothing`,
      [process.env.SEED_PASSWORD_HASH],
    );

    await client.query('commit');
    console.log('seeded: 3 categories, 200 products, 1 customer');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    await client.end();
  }
}
```

The admin account is *not* here — it is reference data, created in a migration
with its password hash supplied by environment variable, because production
needs an admin and the seed never runs there.

A test factory, by contrast, makes rows to order and returns what it made:

```js
// test/factories.js — used by Phase 3's endpoint tests
export async function createProduct(client, overrides = {}) {
  const defaults = {
    name: 'Test product', slug: `test-${crypto.randomUUID()}`,
    price_cents: 1999, stock: 5, category_slug: 'audio',
  };
  const p = {...defaults, ...overrides};
  const {rows: [row]} = await client.query(
    `insert into products (category_id, name, slug, price_cents, stock, description)
     select id, $2, $3, $4, $5, '' from categories where slug = $1
     returning *`,
    [p.category_slug, p.name, p.slug, p.price_cents, p.stock],
  );
  return row;
}
```

Random slugs are correct *here* — tests must not collide with each other, and
no human ever reads a fixture slug. Determinism serves the seed's consumers;
isolation serves the tests'. Same technique, opposite choices, both deliberate.

## Using it in the app

`cli seed` (Phase 2's ops CLI) wraps `seed()`; the dev-container setup in
[Docker phase 9's migrations-and-seeds page](../../../docker/pages/phase-9-mern-pern-stack/10-migrations-and-seeds.md)
runs migrate-then-seed behind a profile. Every tenth product being
out-of-stock is what lets Phase 4's UI show the sold-out state without
hand-editing data.

## Gotchas

- **Symptom:** the seed dies with *null value in column "password_hash"*.
  **Cause:** `SEED_PASSWORD_HASH` unset — the seed refuses to invent
  credentials, even fake ones, so there is no default. **Fix:** the dev env
  file sets it; the value is the argon2 hash of `password` and exists only in
  development configuration.
- **Symptom:** re-seeding doubled every product. **Cause:** an upsert keyed on
  the wrong column — `on conflict (id)` never fires when IDs are generated
  fresh each run. **Fix:** conflict targets are the *natural* keys the seed
  controls: `slug`, `email`.
- **Symptom:** tests pass alone, fail together with unique-violation errors.
  **Cause:** fixtures used fixed slugs, so parallel tests collided. **Fix:**
  the factory's `randomUUID()` slug — test isolation beats test determinism
  on identifiers; determinism belongs to the *asserted* fields.

## Interview questions

1. **★ Why does the admin account live in a migration but the demo customer in
   the seed?** Production needs the admin — and the seed never runs in
   production, by guard. Anything every environment needs is reference data,
   which is what migrations are for. The demo customer exists only for
   development logins.
2. **★ Why upserts instead of `truncate` + insert?** Truncate-based seeds
   destroy whatever state a developer was in the middle of examining, and
   cascade through FKs in surprising ways. Upserts converge: existing rows
   are corrected, missing ones appear, and unrelated local data survives.
   The trade-off — deleted seed rows resurrect on re-run — is acceptable for
   demo data.
3. **Why do test factories not just call the seed?** A test that depends on
   "product 42 from the seed" breaks the moment the seed changes, and reads
   as an assertion about nothing. Factories give each test exactly the rows
   it names, with the values the assertion is about — the
   [test-data concept page](../../../nodejs/pages/phase-9-testing/10-fixtures-and-factories.md)
   carries the full argument.
4. **Why is the production guard an env check inside `seed()` rather than
   just not shipping the file?** The file ships regardless — it sits next to
   the runner in the image. Defense against "wrong DATABASE_URL in the shell"
   has to live where the damage happens, and one thrown error is the whole
   cost.

---

← Prev: [Migrations as plain SQL](02-migrations.md) ·
Next → [The catalog query](04-the-catalog-query.md)
