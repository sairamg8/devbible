import React, {useSyncExternalStore} from 'react';
import clsx from 'clsx';
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  setMode,
} from './store';
import styles from './styles.module.css';

/**
 * Collapse or expand every sidebar category at once.
 *
 * Two explicit buttons rather than one flip-flop: with 60-odd categories the sidebar is
 * rarely all-open or all-shut, so a single toggle would have to guess which way it is
 * going. The pressed state shows which action was last applied.
 */
export default function SidebarCollapseAll() {
  const {mode} = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className={styles.bar} role="group" aria-label="Sidebar categories">
      <button
        type="button"
        className={clsx('clean-btn', styles.button, mode === 'collapsed' && styles.active)}
        aria-pressed={mode === 'collapsed'}
        onClick={() => setMode('collapsed')}>
        Collapse all
      </button>
      <span className={styles.divider} aria-hidden="true" />
      <button
        type="button"
        className={clsx('clean-btn', styles.button, mode === 'expanded' && styles.active)}
        aria-pressed={mode === 'expanded'}
        onClick={() => setMode('expanded')}>
        Expand all
      </button>
    </div>
  );
}
