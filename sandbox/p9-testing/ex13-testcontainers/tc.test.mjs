import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';

let container, pool;

before(async () => {
  const t0 = Date.now();
  container = await new PostgreSqlContainer('postgres:18-alpine').start();
  console.log(`  container start: ${Date.now() - t0} ms`);
  console.log(`  uri: ${container.getConnectionUri().replace(/:[^:@]+@/, ':***@')}`);
  pool = new pg.Pool({ connectionString: container.getConnectionUri() });
  await pool.query(`create table orders (id bigint generated always as identity primary key,
                                         sku text not null unique, qty int not null check (qty > 0))`);
}, { timeout: 180_000 });

after(async () => { await pool?.end(); await container?.stop(); });

test('a real unique violation, with a real SQLSTATE', async () => {
  await pool.query('insert into orders (sku, qty) values ($1, $2)', ['ABC', 2]);
  const err = await pool.query('insert into orders (sku, qty) values ($1, $2)', ['ABC', 3]).catch((e) => e);
  console.log(`  code=${err.code} constraint=${err.constraint}`);
  assert.equal(err.code, '23505');
});

test('a real check constraint', async () => {
  const err = await pool.query('insert into orders (sku, qty) values ($1, $2)', ['XYZ', 0]).catch((e) => e);
  console.log(`  code=${err.code} constraint=${err.constraint}`);
  assert.equal(err.code, '23514');
});

test('per-test rollback keeps tests isolated', async () => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("insert into orders (sku, qty) values ('TEMP', 1)");
    assert.equal((await client.query('select count(*)::int c from orders')).rows[0].c, 2);  // ABC + TEMP
    await client.query('rollback');
  } finally { client.release(); }
  assert.equal((await pool.query('select count(*)::int c from orders')).rows[0].c, 1);  // TEMP rolled back
});
