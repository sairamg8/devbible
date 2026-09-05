import React, {useEffect, useId, useRef, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useLocation} from '@docusaurus/router';
import {LAYERS} from '@site/src/data/stack';
import {summarise} from '@site/src/data/progress';
import styles from './styles.module.css';

/**
 * The technology picker — a navbar dropdown listing every written track, grouped
 * by layer.
 *
 * It exists because the navbar carried no items at all (`navbar.items: []`,
 * deliberately — the homepage is the picker), and the cost only showed up once
 * you were inside a track: from `/docs/java` there was no route to `/docs/react`
 * except back to the homepage and re-pick. On a reference where React, Next.js
 * and TypeScript cite each other constantly, that was the most expensive thing
 * about the old navigation.
 *
 * 🔴 This replaced a permanent left rail (commit 058e4083, removed here). The
 * rail solved the same problem and was rejected on sight for the right reason:
 * it put an all-technologies column inside every technology's docs, spending
 * ~170px of permanent width on a control used a few times a session. A dropdown
 * costs one navbar slot and nothing else.
 *
 * Built from `src/data/stack.js` and `progress.js`, the same two files the
 * homepage reads, so a technology added there appears here without anyone
 * remembering this file exists.
 */

/**
 * Resolved once at module scope — `LAYERS` and `LANGUAGES` are static build-time
 * data, so there is nothing per-render to do.
 *
 * Parked entries (GraphQL, tRPC, Kubernetes) are skipped: they carry no `key`
 * because they have no pages, and this is a list of destinations.
 */
const GROUPS = LAYERS.filter((layer) => !layer.parked)
  .map((layer) => ({
    name: layer.name,
    items: layer.items
      .filter((item) => item.key)
      .map((item) => {
        const data = summarise(item.key);
        return {
          key: item.key,
          label: data.label,
          to: data.docsPath,
          // Generated from disk by `scripts/page-counts.mjs`, so this is the same
          // number the homepage card prints and neither can drift from the files.
          pages: data.pagesWritten,
        };
      }),
  }))
  .filter((layer) => layer.items.length > 0);

export default function TechPicker() {
  const {pathname} = useLocation();
  const docsBase = useBaseUrl('/docs/');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  /**
   * Which technology we are in, from the route rather than component state — it
   * has to be right on a cold load and after a client-side navigation, and the
   * URL is the only thing true in both cases. Splitting on the resolved docs base
   * rather than a literal `/docs/` keeps it working under the deployed `baseUrl`
   * (`/devbible/`), which is not the dev server's.
   */
  const activeKey = pathname.startsWith(docsBase)
    ? pathname.slice(docsBase.length).split('/')[0]
    : null;

  const current = GROUPS.flatMap((g) => g.items).find((i) => i.key === activeKey);

  // Close on outside click and on Escape. Without the first, the menu survives a
  // click on the page behind it; without the second there is no keyboard way out.
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Any navigation closes it — Docusaurus routes client-side, so the component
  // is not remounted and the menu would otherwise stay open over the new page.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}>
        <span className={styles.triggerLabel}>{current ? current.label : 'Technologies'}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.menu} id={menuId}>
          {GROUPS.map((group) => (
            <React.Fragment key={group.name}>
              <div className={styles.group}>{group.name}</div>
              <ul className={styles.list}>
                {group.items.map((item) => {
                  const active = item.key === activeKey;
                  return (
                    <li key={item.key}>
                      <Link
                        to={item.to}
                        className={clsx(styles.item, active && styles.active)}
                        aria-current={active ? 'page' : undefined}>
                        <span className={styles.label}>{item.label}</span>
                        <span className={styles.count}>{item.pages.toLocaleString()}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
