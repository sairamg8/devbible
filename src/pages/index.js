import React, {useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import {summarise} from '@site/src/data/progress';
import styles from './index.module.css';

/** Live counts, so the homepage can never drift from what is actually written. */
const css = summarise('css');
const javascript = summarise('javascript');
const typescript = summarise('typescript');
const node = summarise('nodejs');
const express = summarise('expressjs');
const react = summarise('react');
const angular = summarise('angular');
const nextjs = summarise('nextjs');
const postgres = summarise('postgresql');
const git = summarise('git');
const mongodb = summarise('mongodb');
const redis = summarise('redis');
const nginx = summarise('nginx');
const docker = summarise('docker');
const storybook = summarise('storybook');
const realworld = summarise('realworld');
const java = summarise('java');
const python = summarise('python');
// The eleven tracks moved in from the `frontend-bible` repo on 2026-08-14.
// Their pages all exist, so their percentage measures validation — see the
// `imported` / `verified` note at the top of `src/data/progress.js`.
const vite = summarise('vite');
const webpack = summarise('webpack');
const babel = summarise('babel');
const eslint = summarise('eslint-oxlint');
const jest = summarise('jest-rtl');
const playwright = summarise('playwright');
const redux = summarise('redux-toolkit');
const tanstack = summarise('tanstack-query');
const framer = summarise('framer-motion');
const webVitals = summarise('web-vitals-performance');
const frontendArchitecture = summarise('frontend-architecture');

/**
 * The stack, grouped by the layer it lives in. `to` is set only for
 * technologies that actually have content — everything else renders as a
 * disabled card, so the page never promises a page that isn't there.
 *
 * `done: true` marks a technology whose syllabus is fully explained — every
 * phase written, every syllabus topic covered, no broken links. It is set by
 * hand rather than derived from `percent === 100`, because the percentage only
 * knows that a phase has *pages*; it cannot tell a finished phase from one whose
 * pages are still outlines. Express spent a while in exactly that state — 100%
 * by the counter, a draft in fact — which is why this flag exists at all.
 *
 * `parked: true` marks a layer that is outside the committed eleven in
 * instructions.md §2 — visible so the map is honest about what exists beyond
 * the brief, styled so nobody mistakes it for scheduled work.
 *
 * `data` is each card's `summarise()` result — the card lays the numbers out
 * itself, so every card counts the same things in the same order and a new
 * language cannot invent its own format.
 *
 * There is deliberately no roll-up strip above these cards and no
 * "moved most recently" row. Both were removed on the user's instruction
 * (2026-08-31): a single site-wide coverage percentage averages sixteen
 * unrelated tracks into a number that means nothing, and naming the three
 * freshest languages put whichever one a session happened to touch at the top
 * of the page as if it were the point. The per-card numbers below are the
 * honest version — they say what is written, technology by technology.
 */
const LAYERS = [
  {
    name: 'Frontend',
    note: 'What the browser runs',
    items: [
      {
        name: 'CSS',
        desc: 'Flexbox, Grid, container queries, and the 2026 feature set',
        to: '/docs/css',
        done: true,
        data: css,
      },
      {
        name: 'JavaScript',
        desc: 'Language core, Web APIs, machine coding and an applied storefront — the DSA track is parked at its Master tier',
        to: '/docs/javascript',
        done: true,
        data: javascript,
      },
      {
        name: 'TypeScript',
        desc: 'Narrowing, generics, mapped and conditional types, typed at every layer',
        to: '/docs/typescript',
        data: typescript,
      },
      {
        name: 'React',
        desc: 'Every hook, the render cycle, Suspense, Actions, Server Components, and a patterns layer — phases 12 and 13 dropped by decision',
        to: '/docs/react',
        done: true,
        data: react,
      },
      {
        name: 'Next.js',
        desc: 'App Router, Server Components, the caching model, PPR and Cache Components, deployment — a 19-chapter corpus imported at 16.2 and being refreshed chapter by chapter for 16.3',
        to: '/docs/nextjs',
        data: nextjs,
      },
      {
        name: 'Angular',
        desc: 'Signals, zoneless change detection, the signal component API, signal forms, httpResource and SSR — targeting Angular 22, the current major. Syllabus written; pages not started',
        to: '/docs/angular',
        data: angular,
      },
    ],
  },
  {
    name: 'Backend',
    note: 'What the server runs',
    items: [
      {
        name: 'Node.js',
        desc: 'Runtime model, event loop, streams, security, production',
        to: '/docs/nodejs',
        done: true,
        data: node,
      },
      {
        name: 'Express',
        desc: 'Routing, middleware, error handling, auth, layering',
        to: '/docs/expressjs',
        done: true,
        data: express,
      },
    ],
  },
  {
    name: 'Data',
    note: 'Where state lives',
    items: [
      {
        name: 'MongoDB',
        desc: 'Document model, aggregation, indexes, Mongoose',
        to: '/docs/mongodb',
        data: mongodb,
      },
      {
        name: 'PostgreSQL',
        desc: 'SQL, indexes, MVCC, raw pg from Node, ops and security',
        to: '/docs/postgresql',
        done: true,
        data: postgres,
      },
      {
        name: 'Redis',
        desc: 'Data types, caching patterns, sessions, rate limits, locks',
        to: '/docs/redis',
        data: redis,
      },
    ],
  },
  {
    name: 'Infrastructure',
    note: 'How it ships and stays up',
    items: [
      {
        name: 'Docker & Podman',
        desc: 'Namespaces and cgroups, multi-stage builds, Compose, rootless, Quadlet',
        to: '/docs/docker',
        done: true,
        data: docker,
      },
      {
        name: 'Nginx',
        desc: 'Reverse proxy, load balancing, TLS, caching',
        to: '/docs/nginx',
        data: nginx,
      },
    ],
  },
  {
    name: 'Workflow',
    note: 'How the code gets there',
    items: [
      {
        name: 'Git',
        desc: 'The object model, rebase vs merge, recovery, review workflow — re-scoped to the daily-driver 52',
        to: '/docs/git',
        done: true,
        data: git,
      },
    ],
  },
  {
    name: 'Beyond the JS stack',
    note: 'Second backend languages',
    items: [
      {
        name: 'Java',
        desc: 'JVM model, collections, virtual threads, Spring Boot, JPA, JUnit 5, GC and JFR — targeting JDK 25 LTS',
        to: '/docs/java',
        data: java,
      },
      {
        name: 'Python',
        desc: 'CPython and the GIL, the data model, typing, uv and ruff, asyncio, FastAPI, pytest — targeting 3.14',
        to: '/docs/python',
        data: python,
      },
    ],
  },
  {
    name: 'Real world',
    note: 'One storefront, implemented across the whole stack',
    items: [
      {
        name: 'Real World',
        desc: 'The storefront: raw pg schema, Node services, the Express API, React hooks and screens, typed end to end',
        to: '/docs/real-world',
        data: realworld,
      },
    ],
  },
  {
    name: 'Frontend toolchain',
    note: 'Moved in from the frontend-bible repo on 2026-08-14. Every page here already exists, so the percentage counts pages validated against this bible’s contract — a tier badge and a dated “Verified” line — not pages written. Jest & RTL is through that pass; Storybook was written here from phase 0',
    items: [
      {
        name: 'Vite',
        desc: 'Dual-engine dev server, HMR, plugins, code-splitting — the draft predates Rolldown and the Environment API',
        to: '/docs/vite',
        imported: true,
        data: vite,
      },
      {
        name: 'Webpack',
        desc: 'Module Federation, loaders, plugins, Tapable hooks, chunks — the draft never mentions Rspack',
        to: '/docs/webpack',
        imported: true,
        data: webpack,
      },
      {
        name: 'Babel',
        desc: 'Compiler pipeline, presets/plugins, macros, SWC/esbuild migration — written against 7.x, before Babel 8',
        to: '/docs/babel',
        imported: true,
        data: babel,
      },
      {
        name: 'ESLint & Oxlint',
        desc: 'Flat config, typescript-eslint, Oxlint, dual-run, CI — three pages still reference .eslintrc, and none name ESLint 10',
        to: '/docs/eslint-oxlint',
        imported: true,
        data: eslint,
      },
      {
        name: 'Jest & RTL',
        desc: 'JSDOM, async queries, module mocking, userEvent, coverage — validated end to end, with a syllabus and a 14-page configs reference; the version pass to Jest 30 is still owed',
        to: '/docs/jest-rtl',
        imported: true,
        data: jest,
      },
      {
        name: 'Playwright',
        desc: 'Cross-browser E2E, visual regression, network interception, CI — the draft names no Playwright version anywhere',
        to: '/docs/playwright',
        imported: true,
        data: playwright,
      },
      {
        name: 'Storybook',
        desc: 'CSF, args and controls, decorators, interaction and a11y testing — written to full depth from phase 0, alongside 22 imported pages',
        to: '/docs/storybook',
        data: storybook,
      },
      {
        name: 'Redux Toolkit',
        desc: 'RTK Query, Immer, entity adapters, custom middleware — the least version drift of the eleven, so the draft is the closest to current',
        to: '/docs/redux-toolkit',
        imported: true,
        data: redux,
      },
      {
        name: 'TanStack Query',
        desc: 'QueryCache internals, mutations, optimistic updates, SSR — the draft predates v5',
        to: '/docs/tanstack-query',
        imported: true,
        data: tanstack,
      },
      {
        name: 'Framer Motion',
        desc: 'Layout animations, FLIP, AnimatePresence, scroll and gestures — every import in the draft is the old framer-motion package, now motion/react',
        to: '/docs/framer-motion',
        imported: true,
        data: framer,
      },
      {
        name: 'Web Vitals & Performance',
        desc: 'LCP, INP, CLS, critical rendering path, budgets — two pages still teach FID, retired in 2024',
        to: '/docs/web-vitals-performance',
        imported: true,
        data: webVitals,
      },
      {
        name: 'Frontend Architecture',
        desc: 'Micro-frontends, monorepos, state machines, observability — not version-pinned by nature; the risk here is stale practice',
        to: '/docs/frontend-architecture',
        imported: true,
        data: frontendArchitecture,
      },
    ],
  },
  {
    name: 'Beyond the core stack',
    note: 'Not committed — parked for later',
    parked: true,
    items: [
      {name: 'GraphQL', desc: 'Schema design, resolvers, N+1 and DataLoader'},
      {name: 'tRPC', desc: 'End-to-end typed RPC for TypeScript stacks'},
      {name: 'Kubernetes', desc: 'Pods, services, probes, scaling, rollouts'},
    ],
  },
];

/**
 * One word for where a technology stands. This is what the filter chips filter
 * on and what colours the card, so it is computed once, here, rather than
 * re-derived from three different flags at three different call sites.
 *
 * `imported` is provenance, not progress: it stays on a track for as long as its
 * pages came in from the `frontend-bible` import, and the card's percentage says
 * how far the validation pass has got through them. That is why the two are read
 * from different places — the flag from the item, the number from `progress.js`.
 */
function statusOf(item, layer) {
  if (layer.parked) return 'parked';
  if (item.done) return 'complete';
  if (item.imported) return 'imported';
  if (item.data) return 'writing';
  return 'planned';
}

const STATUS_LABEL = {
  complete: 'Complete',
  writing: 'In progress',
  imported: 'Imported',
  parked: 'Someday',
  planned: 'Planned',
};

const FILTERS = [
  {key: 'all', label: 'Everything'},
  {key: 'complete', label: 'Complete'},
  {key: 'writing', label: 'In progress'},
  {key: 'imported', label: 'Imported'},
];

function Bar({percent, tone}) {
  return (
    <div className={styles.bar} aria-hidden="true">
      <div
        className={`${styles.barFill} ${tone === 'complete' ? styles.barDone : ''}`}
        style={{width: `${percent}%`}}
      />
    </div>
  );
}

function Card({item, layer}) {
  const status = statusOf(item, layer);
  const {data} = item;

  const body = (
    <>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{item.name}</h3>
        {data ? (
          // An imported track keeps its provenance tag next to the number: the
          // percentage alone would read as "0% written", which is the one thing
          // it does not mean.
          <span className={styles.cardStat}>
            {status === 'imported' && (
              <span className={styles.cardTag}>{STATUS_LABEL[status]}</span>
            )}
            <span className={styles.cardPercent}>{data.percent}%</span>
          </span>
        ) : (
          <span className={styles.cardTag}>{STATUS_LABEL[status]}</span>
        )}
      </div>
      <p className={styles.cardDesc}>{item.desc}</p>
      {data && <Bar percent={data.percent} tone={status} />}
      {data && (
        // An imported track counts different things, so it says so rather than
        // borrowing the written-track wording: its chapters are not phases, and
        // its pages all exist already — what moves is how many are validated.
        <p className={styles.cardMeta}>
          {data.imported ? (
            <>
              <span>{data.phasesTotal} chapters</span>
              <span>
                {data.pagesWritten} {data.pagesWritten === 1 ? 'page' : 'pages'}
              </span>
              <span>
                {data.pagesValidated}/{data.pagesWritten} validated
              </span>
            </>
          ) : (
            <>
              <span>
                {data.phasesDone}/{data.phasesTotal} phases
              </span>
              <span>{data.topicsTotal} topics</span>
              <span>
                {data.pagesWritten} {data.pagesWritten === 1 ? 'page' : 'pages'}
              </span>
            </>
          )}
        </p>
      )}
      {data?.imported && !data.inFlight && (
        <p className={styles.cardNote}>
          {data.percent === 100
            ? 'Validated to the page contract'
            : 'Draft · validation not started'}
        </p>
      )}
      {data?.inFlight && (
        <p className={styles.cardNow}>
          {data.imported ? 'Validating' : 'Writing'} · {data.inFlight.name}
        </p>
      )}
    </>
  );

  if (item.to) {
    return (
      <Link to={item.to} className={`${styles.card} ${styles[status]}`}>
        {body}
      </Link>
    );
  }
  return (
    <div className={`${styles.card} ${styles[status]}`} aria-disabled="true">
      {body}
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  /**
   * Filtering happens over the whole tree at once so a layer that matches
   * nothing disappears entirely — a page of empty section headings is worse
   * than no sections at all.
   */
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LAYERS.map((layer) => ({
      ...layer,
      items: layer.items.filter((item) => {
        if (filter !== 'all' && statusOf(item, layer) !== filter) return false;
        if (!q) return true;
        return `${item.name} ${item.desc}`.toLowerCase().includes(q);
      }),
    })).filter((layer) => layer.items.length > 0);
  }, [query, filter]);

  const matches = shown.reduce((n, layer) => n + layer.items.length, 0);
  const filtering = filter !== 'all' || query.trim() !== '';

  return (
    <Layout
      title="Dev Bible"
      description="A central reference for building fullstack applications with MERN and PERN.">
      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>MERN · PERN</p>
          <h1 className={styles.title}>Dev Bible</h1>
          <p className={styles.lede}>
            One reference for building fullstack applications — frontend through
            deployment. Every topic carries a priority tier, so you always know
            what to master and what to leave until a project asks for it.
          </p>
        </header>

        <div className={styles.controls} role="search">
          <input
            type="search"
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter — try “grid”, “streams”, “aggregation”"
            aria-label="Filter technologies"
          />
          <div className={styles.chips}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`${styles.chip} ${filter === f.key ? styles.chipOn : ''}`}
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          {filtering && (
            <p className={styles.matchCount} role="status">
              {matches} {matches === 1 ? 'match' : 'matches'}
            </p>
          )}
        </div>

        {shown.length === 0 && (
          <p className={styles.empty}>
            Nothing matches “{query}”. The search box reads the technology name
            and its one-line summary — for anything inside a page, use the site
            search in the header.
          </p>
        )}

        {shown.map((layer) => (
          <section
            key={layer.name}
            className={`${styles.layer} ${layer.parked ? styles.layerParked : ''}`}>
            <div className={styles.layerHead}>
              <h2 className={styles.layerTitle}>{layer.name}</h2>
              <p className={styles.layerNote}>{layer.note}</p>
            </div>
            <div className={styles.grid}>
              {layer.items.map((item) => (
                <Card key={item.name} item={item} layer={layer} />
              ))}
            </div>
          </section>
        ))}

        <section className={styles.tiers}>
          <p className={styles.sectionLabel}>How topics are tiered</p>
          <div className={styles.tierRow}>
            <div className={styles.tierItem}>
              <span className="db-tier t-master">Master</span>
              <span>Use it with no documentation open</span>
            </div>
            <div className={styles.tierItem}>
              <span className="db-tier t-understand">Understand</span>
              <span>Know how it works; look up signatures</span>
            </div>
            <div className={styles.tierItem}>
              <span className="db-tier t-know">Know</span>
              <span>Know what, why, and when</span>
            </div>
            <div className={styles.tierItem}>
              <span className="db-tier t-when">When Needed</span>
              <span>Don't study it upfront</span>
            </div>
          </div>
        </section>

        <footer className={styles.foot}>
          Content verified August 2026 · Node 26.7.0 current, Node 24 active LTS
        </footer>
      </main>
    </Layout>
  );
}
