import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Progress from '@site/src/components/Progress';
import {summarise} from '@site/src/data/progress';
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
const docker = summarise('docker');

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
 */
const LAYERS = [
  {
    name: 'Frontend',
    note: 'What the browser runs',
    items: [
      {
        n: '01',
        name: 'CSS',
        desc: 'Flexbox, Grid, container queries, and the 2026 feature set',
        to: '/docs/css',
        active: true,
        stats: `${css.topicsTotal} topics · ${css.phasesTotal} phases · ${css.phasesDone} phases explained · ${css.pagesWritten} pages`,
        progress: css.percent,
      },
      {
        n: '02',
        name: 'JavaScript',
        desc: 'Language core, Web APIs, a full DSA track, and an applied storefront',
        to: '/docs/javascript',
        active: true,
        stats: `${javascript.topicsTotal} topics · ${javascript.phasesTotal} phases · ${javascript.phasesDone} phases explained · ${javascript.pagesWritten} pages`,
        progress: javascript.percent,
      },
      {
        n: '03',
        name: 'TypeScript',
        desc: 'Narrowing, generics, mapped and conditional types, typed at every layer',
        to: '/docs/typescript',
        active: true,
        stats: `${typescript.topicsTotal} topics · ${typescript.phasesTotal} phases · ${typescript.phasesDone} phases explained · ${typescript.pagesWritten} pages`,
        progress: typescript.percent,
      },
      {
        n: '04',
        name: 'React',
        desc: 'Every hook, the render cycle, Suspense, Actions, Server Components',
        to: '/docs/react',
        active: true,
        stats: `${react.topicsTotal} topics · ${react.phasesTotal} phases · ${react.phasesDone} phases explained · ${react.pagesWritten} pages`,
        progress: react.percent,
      },
    ],
  },
  {
    name: 'Backend',
    note: 'What the server runs',
    items: [
      {
        n: '05',
        name: 'Node.js',
        desc: 'Runtime model, event loop, streams, security, production',
        to: '/docs/nodejs',
        active: true,
        done: true,
        stats: `${node.topicsTotal} topics · ${node.phasesTotal} phases · ${node.phasesDone} phases explained · ${node.pagesWritten} pages`,
        progress: node.percent,
      },
      {
        n: '06',
        name: 'Express',
        desc: 'Routing, middleware, error handling, auth, layering',
        to: '/docs/expressjs',
        active: true,
        done: true,
        stats: `${express.topicsTotal} topics · ${express.phasesTotal} phases · ${express.phasesDone} phases explained · ${express.pagesWritten} pages`,
        progress: express.percent,
      },
    ],
  },
  {
    name: 'Data',
    note: 'Where state lives',
    items: [
      {
        n: '07',
        name: 'MongoDB',
        desc: 'Document model, aggregation, indexes, Mongoose',
        to: '/docs/mongodb',
        active: true,
        stats: `${mongodb.topicsTotal} topics · ${mongodb.phasesTotal} phases · ${mongodb.phasesDone} phases explained · ${mongodb.pagesWritten} pages`,
        progress: mongodb.percent,
      },
      {
        n: '08',
        name: 'PostgreSQL',
        desc: 'SQL, indexes, MVCC, raw pg from Node, ops and security',
        to: '/docs/postgresql',
        active: true,
        done: true,
        stats: `${postgres.topicsTotal} topics · ${postgres.phasesTotal} phases · ${postgres.phasesDone} phases explained · ${postgres.pagesWritten} pages`,
        progress: postgres.percent,
      },
      {
        n: '09',
        name: 'Redis',
        desc: 'Data types, caching patterns, sessions, rate limits, locks',
        to: '/docs/redis',
        active: true,
        stats: `${redis.topicsTotal} topics · ${redis.phasesTotal} phases · ${redis.phasesDone} phases explained · ${redis.pagesWritten} pages`,
        progress: redis.percent,
      },
    ],
  },
  {
    name: 'Infrastructure',
    note: 'How it ships and stays up',
    items: [
      {
        n: '10',
        name: 'Docker & Podman',
        desc: 'Namespaces and cgroups, multi-stage builds, Compose, rootless, Quadlet',
        to: '/docs/docker',
        active: true,
        stats: `${docker.topicsTotal} topics · ${docker.phasesTotal} phases · ${docker.phasesDone} phases explained · ${docker.pagesWritten} pages`,
        progress: docker.percent,
      },
      {n: '11', name: 'Nginx', desc: 'Reverse proxy, load balancing, TLS, caching'},
    ],
  },
  {
    name: 'Workflow',
    note: 'How the code gets there',
    items: [
      {
        n: '12',
        name: 'Git',
        desc: 'The object model, rebase vs merge, recovery, review workflow',
        to: '/docs/git',
        active: true,
        stats: `${git.topicsTotal} topics · ${git.phasesTotal} phases · ${git.phasesDone} phases explained · ${git.pagesWritten} pages`,
        progress: git.percent,
      },
    ],
  },
  {
    name: 'Frontend toolchain',
    note: 'Imported corpus — moved in, not yet validated',
    items: [
      {n: '13', name: 'Vite', desc: 'Dual-engine dev server, HMR, plugins, code-splitting', to: '/docs/vite', active: true, imported: true},
      {n: '14', name: 'Webpack', desc: 'Module Federation, loaders, plugins, Tapable hooks, chunks', to: '/docs/webpack', active: true, imported: true},
      {n: '15', name: 'Babel', desc: 'Compiler pipeline, presets/plugins, macros, SWC/esbuild migration', to: '/docs/babel', active: true, imported: true},
      {n: '16', name: 'ESLint & Oxlint', desc: 'Flat config, typescript-eslint, Oxlint, dual-run, CI', to: '/docs/eslint-oxlint', active: true, imported: true},
      {n: '17', name: 'Jest & RTL', desc: 'JSDOM, async queries, module mocking, userEvent, coverage', to: '/docs/jest-rtl', active: true, imported: true},
      {n: '18', name: 'Playwright', desc: 'Cross-browser E2E, visual regression, network interception, CI', to: '/docs/playwright', active: true, imported: true},
      {n: '19', name: 'Storybook', desc: 'CSF, args and controls, decorators, interaction and a11y testing', to: '/docs/storybook', active: true, imported: true},
      {n: '20', name: 'Redux Toolkit', desc: 'RTK Query, Immer, entity adapters, custom middleware', to: '/docs/redux-toolkit', active: true, imported: true},
      {n: '21', name: 'TanStack Query', desc: 'QueryCache internals, mutations, optimistic updates, SSR', to: '/docs/tanstack-query', active: true, imported: true},
      {n: '22', name: 'Framer Motion', desc: 'Layout animations, FLIP, AnimatePresence, scroll and gestures', to: '/docs/framer-motion', active: true, imported: true},
      {n: '23', name: 'Web Vitals & Performance', desc: 'LCP, INP, CLS, critical rendering path, budgets', to: '/docs/web-vitals-performance', active: true, imported: true},
      {n: '24', name: 'Frontend Architecture', desc: 'Micro-frontends, monorepos, state machines, observability', to: '/docs/frontend-architecture', active: true, imported: true},
    ],
  },
  {
    name: 'Beyond the core stack',
    note: 'Not committed — parked for later',
    parked: true,
    items: [
      {n: '13', name: 'GraphQL', desc: 'Schema design, resolvers, N+1 and DataLoader'},
      {n: '14', name: 'tRPC', desc: 'End-to-end typed RPC for TypeScript stacks'},
      {n: '15', name: 'Kubernetes', desc: 'Pods, services, probes, scaling, rollouts'},
    ],
  },
];

function Card({item, parked}) {
  const pill = item.done
    ? {className: styles.pillDone, label: 'Complete'}
    : item.active
      ? {className: styles.pillActive, label: 'In progress'}
      : parked
        ? {className: styles.pillParked, label: 'Someday'}
        : {className: styles.pillSoon, label: 'Planned'};

  const inner = (
    <>
      <div className={styles.cardHead}>
        <span className={styles.cardNum}>{item.n}</span>
        <span className={pill.className}>{pill.label}</span>
      </div>
      <h3 className={styles.cardTitle}>{item.name}</h3>
      <p className={styles.cardDesc}>{item.desc}</p>
      {item.progress != null && (
        <div className={styles.cardBar} aria-hidden="true">
          <div className={styles.cardBarFill} style={{width: `${item.progress}%`}} />
        </div>
      )}
      {item.stats && <p className={styles.cardStats}>{item.stats}</p>}
      {item.to && <span className={styles.cardGo}>Open the syllabus →</span>}
    </>
  );

  if (item.to) {
    return (
      <Link to={item.to} className={`${styles.card} ${styles.cardLive}`}>
        {inner}
      </Link>
    );
  }
  return (
    <div
      className={`${styles.card} ${parked ? styles.cardParked : styles.cardDim}`}
      aria-disabled="true">
      {inner}
    </div>
  );
}

export default function Home() {
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

        <section className={styles.focus}>
          <div className={styles.focusBar} />
          <div className={styles.focusBody}>
            <p className={styles.focusLabel}>Current focus</p>
            <h2 className={styles.focusTitle}>JavaScript explanations</h2>
            <p className={styles.focusText}>
              JavaScript: {javascript.topicsTotal} topics across{' '}
              {javascript.phasesTotal} phases ·{' '}
              <strong>
                {javascript.phasesDone} of {javascript.phasesTotal} phases
                explained
              </strong>
              ({javascript.pagesWritten} pages). Node.js is complete at{' '}
              {node.pagesWritten} pages and PostgreSQL at{' '}
              {postgres.pagesWritten}; Express is live too.
            </p>
            <Progress lang="javascript" compact />
            <Progress lang="nodejs" compact />
            <Progress lang="expressjs" compact />
            <Link className={styles.focusCta} to="/docs/javascript">
              JavaScript syllabus →
            </Link>
            <Link className={styles.focusCtaAlt} to="/docs/expressjs">
              Express.js syllabus →
            </Link>
            <Link className={styles.focusCtaAlt} to="/docs/nodejs/pages">
              Node explanations →
            </Link>
          </div>
        </section>

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

        {LAYERS.map((layer) => (
          <section
            key={layer.name}
            className={`${styles.layer} ${layer.parked ? styles.layerParked : ''}`}>
            <div className={styles.layerHead}>
              <h2 className={styles.layerTitle}>{layer.name}</h2>
              <p className={styles.layerNote}>{layer.note}</p>
            </div>
            <div className={styles.grid}>
              {layer.items.map((item) => (
                <Card key={item.name} item={item} parked={layer.parked} />
              ))}
            </div>
          </section>
        ))}

        <footer className={styles.foot}>
          Content verified August 2026 · Node 26.7.0 current, Node 24 active LTS
        </footer>
      </main>
    </Layout>
  );
}
