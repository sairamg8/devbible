---
title: "The ops CLI"
sidebar_label: "10 · The ops CLI"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Node.js v24 docs — `util.parseArgs`,
> `process.exitCode`. Concept home:
> [Node — parseArgs](../../../nodejs/pages/phase-5-http-processes/22-parseargs.md)
> and the [process chapter](../../../nodejs/pages/phase-5-http-processes/15-process.md).

## The problem

Four operations keep appearing in this phase with no way to run them by hand:
migrate (chapter [1·02](../phase-1-database/02-migrations.md)), seed
([1·03](../phase-1-database/03-seeds-and-fixtures.md)), requeue dead outbox
rows ([2·04](04-outbox-relay-and-email.md)), and a quick metrics peek without
curl-and-auth ceremony. In an incident, "there's a script for that" beats
"there's a runbook of SQL to paste" — pasted SQL has no guard rails at
2 a.m.

## The design choices

**Zero dependencies — `util.parseArgs` and a command table.** Stable since
Node 20, it parses flags; the CLI has four subcommands and needs no
framework. The [concept page](../../../nodejs/pages/phase-5-http-processes/22-parseargs.md)
draws the line: `commander` earns its keep at nested-subcommand,
generated-help scale — not here.

**The CLI is a fifth caller of existing modules, never a fifth
implementation.** Same config loader (fail-fast env), same pool module, same
functions the services run. If the CLI needs logic the modules don't
export, the modules grow the export — CLI-only code paths are where
incident tools silently rot.

**Destructive operations confirm, or take `--yes`.** Interactive safety for
humans, a flag for CI.

## The implementation

```js
// cli.js — node cli.js <command> [flags]
import {parseArgs} from 'node:util';
import {loadConfig} from './src/config.js';
import {createPool} from './db/pool.js';
import {migrate} from './db/migrate.js';
import {seed} from './db/seed.js';

const commands = {
  async migrate({config}) {
    await migrate(config.DATABASE_URL);
  },

  async seed({config, flags}) {
    if (config.NODE_ENV === 'production') throw new Error('refused in production');
    if (!flags.yes && !(await confirm('Re-seed this database?'))) return;
    await seed(config.DATABASE_URL);
  },

  async requeue({config, flags}) {
    const pool = createPool(config);
    try {
      const {rows} = await pool.query(
        `update outbox
            set attempts = 0, next_attempt_at = now(), last_error = null
          where processed_at is null and attempts >= 8
            and ($1::text is null or topic = $1)
          returning id, topic`,
        [flags.topic ?? null],
      );
      console.log(`requeued ${rows.length} row(s)` +
        (flags.topic ? ` for topic ${flags.topic}` : ''));
    } finally {
      await pool.end();
    }
  },

  async stats({config}) {
    const pool = createPool(config);
    try {
      const {createHealth} = await import('./src/health.js');
      const health = createHealth();
      console.log(JSON.stringify(await health.metrics({pool}), null, 2));
    } finally {
      await pool.end();
    }
  },
};

function confirm(question) {
  process.stdout.write(`${question} [y/N] `);
  return new Promise((resolve) => {
    process.stdin.once('data', (d) =>
      resolve(d.toString().trim().toLowerCase() === 'y'));
  });
}

const {positionals, values: flags} = parseArgs({
  allowPositionals: true,
  options: {
    yes: {type: 'boolean', default: false},
    topic: {type: 'string'},
  },
});

const command = commands[positionals[0]];
if (!command) {
  console.error(`usage: node cli.js <${Object.keys(commands).join('|')}> ` +
                `[--yes] [--topic <name>]`);
  process.exitCode = 2;
} else {
  try {
    await command({config: loadConfig(), flags});
  } catch (err) {
    console.error(String(err));
    process.exitCode = 1;
  }
}
```

## What to notice

- **`requeue` resets state, it does not replay logic** — the relay picks the
  rows up on its next poll with all its usual retry machinery. The CLI
  touches data; the worker owns behaviour. `--topic` scopes the reset when
  only one dependency was down.
- **Exit codes are the contract** — `0` success, `1` failure, `2` usage —
  because CI and shell scripts branch on them
  ([exit-code semantics](../../../nodejs/pages/phase-5-http-processes/15-process.md)).
  `process.exitCode`, not `process.exit()`, so stdout flushes.
- **`stats` reuses `createHealth().metrics()`** — one definition of the
  numbers, whether they arrive by HTTP or by terminal. Divergence between
  "what the endpoint says" and "what the CLI says" is a debugging session
  nobody needs.
- **The production seed guard appears twice** (config check here, env check
  inside `seed()` itself) — defence in depth for the one command whose
  misfire destroys data. The confirm-or-`--yes` pattern covers the rest.

## Gotchas

- **Symptom:** `cli.js stats` works locally, fails in the container with a
  connection error while the API in the same container is fine. **Cause:**
  the CLI ran with a different env (`docker exec` without the env file —
  the container's process env is not the shell's). **Fix:** `docker exec`
  inherits the container's env only for PID 1's children spawned with it;
  run through the entrypoint or pass `--env-file`. The
  [connecting-from-the-host page](../../../docker/pages/phase-9-mern-pern-stack/14-connecting-from-the-host.md)
  owns this.
- **Symptom:** `requeue` "fixed" the dead letters and they died again
  within the hour. **Cause:** requeue is a reset, not a cure — the failing
  dependency or bad payload is still failing. **Fix:** the intended order:
  read `last_error` *first* (it survives until requeue clears it), fix the
  cause, then reset. The command's help text says exactly this.
- **Symptom:** the confirm prompt hangs a CI job forever. **Cause:** no TTY,
  no `--yes`. **Fix:** CI always passes `--yes` — and the prompt's default
  is No, so a headless run without the flag *stalls* rather than proceeding
  destructively; the stall is the safety working, annoyingly.

## Interview questions

1. **★ Why must the CLI call the same modules as the services rather than
   its own SQL?** Because incident tooling is exercised rarely and trusted
   absolutely — a divergent copy of the requeue logic is wrong exactly when
   it matters. One implementation means the CLI is tested by the same suite
   and updated by the same refactors as the code path it mirrors.
2. **Why does `requeue` zero `attempts` instead of deleting and re-inserting
   rows?** The row *is* the delivery's identity — chapter 06's
   `x-store-delivery` dedup key derives from it. Re-inserting would mint a
   new identity and defeat the partner's deduplication; resetting counters
   preserves the at-least-once story end to end.
3. **When does this CLI justify `commander` or a real framework?** When
   subcommands nest (`cli db migrate status`), when generated `--help` per
   command beats a usage line, or when third parties use it. Four verbs for
   the on-call engineer is `parseArgs` territory — the dependency would be
   pure ceremony.

---

← Prev: [The health and metrics kit](09-health-and-metrics.md) ·
Phase index: [Phase 2 — Node services](README.md) ·
Next phase → **Phase 3 · The Express API** *(not written yet)*
