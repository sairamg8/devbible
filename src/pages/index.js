import React, {useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import {summarise, recentlyUpdated} from '@site/src/data/progress';
import styles from './index.module.css';

/** Live counts, so the homepage can never drift from what is actually written. */
const css = summarise('css');
const javascript = summarise('javascript');
const typescript = summarise('typescript');
const node = summarise('nodejs');
const express = summarise('expressjs');
const react = summarise('react');
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

/** The three languages whose pages changed most recently — derived, not written. */
const RECENT = recentlyUpdated(3);

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
 * `stats` is not a string any more. Each card is handed its `summarise()`
 * result and lays the numbers out itself, so every card counts the same things
 * in the same order and a new language cannot invent its own format.
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
    note: 'Imported corpus — moved in, not yet validated. Storybook is the exception: it has a written syllabus and verified pages',
    items: [
      {name: 'Vite', desc: 'Dual-engine dev server, HMR, plugins, code-splitting', to: '/docs/vite', imported: true},
      {name: 'Webpack', desc: 'Module Federation, loaders, plugins, Tapable hooks, chunks', to: '/docs/webpack', imported: true},
      {name: 'Babel', desc: 'Compiler pipeline, presets/plugins, macros, SWC/esbuild migration', to: '/docs/babel', imported: true},
      {name: 'ESLint & Oxlint', desc: 'Flat config, typescript-eslint, Oxlint, dual-run, CI', to: '/docs/eslint-oxlint', imported: true},
      {name: 'Jest & RTL', desc: 'JSDOM, async queries, module mocking, userEvent, coverage', to: '/docs/jest-rtl', imported: true},
      {name: 'Playwright', desc: 'Cross-browser E2E, visual regression, network interception, CI', to: '/docs/playwright', imported: true},
      {
        name: 'Storybook',
        desc: 'CSF, args and controls, decorators, interaction and a11y testing — written to full depth from phase 0, alongside 22 imported pages',
        to: '/docs/storybook',
        data: storybook,
      },
      {name: 'Redux Toolkit', desc: 'RTK Query, Immer, entity adapters, custom middleware', to: '/docs/redux-toolkit', imported: true},
      {name: 'TanStack Query', desc: 'QueryCache internals, mutations, optimistic updates, SSR', to: '/docs/tanstack-query', imported: true},
      {name: 'Framer Motion', desc: 'Layout animations, FLIP, AnimatePresence, scroll and gestures', to: '/docs/framer-motion', imported: true},
      {name: 'Web Vitals & Performance', desc: 'LCP, INP, CLS, critical rendering path, budgets', to: '/docs/web-vitals-performance', imported: true},
      {name: 'Frontend Architecture', desc: 'Micro-frontends, monorepos, state machines, observability', to: '/docs/frontend-architecture', imported: true},
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

/** Rolled-up totals across every card that carries real progress data. */
function rollUp(layers) {
  let topics = 0;
  let topicsDone = 0;
  let pages = 0;
  let tracked = 0;
  let complete = 0;
  for (const layer of layers) {
    for (const item of layer.items) {
      if (item.to) tracked += 1;
      if (statusOf(item, layer) === 'complete') complete += 1;
      if (!item.data) continue;
      topics += item.data.topicsTotal;
      topicsDone += item.data.topicsDone;
      pages += item.data.pagesWritten;
    }
  }
  return {
    topics,
    topicsDone,
    pages,
    tracked,
    complete,
    percent: Math.round((topicsDone / topics) * 100),
  };
}

const TOTALS = rollUp(LAYERS);

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
          <span className={styles.cardPercent}>{data.percent}%</span>
        ) : (
          <span className={styles.cardTag}>{STATUS_LABEL[status]}</span>
        )}
      </div>
      <p className={styles.cardDesc}>{item.desc}</p>
      {data && <Bar percent={data.percent} tone={status} />}
      {data && (
        <p className={styles.cardMeta}>
          <span>
            {data.phasesDone}/{data.phasesTotal} phases
          </span>
          <span>{data.topicsTotal} topics</span>
          <span>
            {data.pagesWritten} {data.pagesWritten === 1 ? 'page' : 'pages'}
          </span>
        </p>
      )}
      {data?.inFlight && (
        <p className={styles.cardNow}>Writing · {data.inFlight.name}</p>
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

function Recent() {
  return (
    <section className={styles.recent} aria-labelledby="recent-heading">
      <p className={styles.sectionLabel} id="recent-heading">
        Moved most recently
      </p>
      <div className={styles.recentRow}>
        {RECENT.map((lang) => (
          <Link key={lang.key} to={lang.docsPath} className={styles.recentCard}>
            <span className={styles.recentStamp}>
              <time dateTime={lang.stamp.replace(' ', 'T')}>
                {lang.date} · {lang.time}
              </time>
            </span>
            <span className={styles.recentName}>{lang.label}</span>
            <span className={styles.recentWhat}>
              {lang.inFlight
                ? `Phase ${lang.inFlight.n} · ${lang.inFlight.name}`
                : lang.nextPhase
                  ? `Next up · ${lang.nextPhase.name}`
                  : 'Every scheduled phase written'}
            </span>
            <Bar percent={lang.percent} tone={lang.nextPhase ? '' : 'complete'} />
            <span className={styles.recentMeta}>
              {lang.percent}% · {lang.pagesWritten} pages
            </span>
          </Link>
        ))}
      </div>
    </section>
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

          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>Coverage</dt>
              <dd>{TOTALS.percent}%</dd>
            </div>
            <div className={styles.stat}>
              <dt>Technologies</dt>
              <dd>
                {TOTALS.tracked}
                <span className={styles.statSub}>
                  {TOTALS.complete} complete
                </span>
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>Topics</dt>
              <dd>
                {TOTALS.topics.toLocaleString('en-GB')}
                <span className={styles.statSub}>
                  {TOTALS.topicsDone.toLocaleString('en-GB')} explained
                </span>
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>Pages written</dt>
              <dd>{TOTALS.pages.toLocaleString('en-GB')}</dd>
            </div>
          </dl>
        </header>

        <Recent />

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
