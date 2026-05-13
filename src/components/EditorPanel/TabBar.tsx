import { useEditorStore } from '../../store/useEditorStore';
import styles from './TabBar.module.css';

export function TabBar() {
  const openTabs = useEditorStore(s => s.openTabs);
  const activeTabId = useEditorStore(s => s.activeTabId);
  const switchTab = useEditorStore(s => s.switchTab);
  const closeTab = useEditorStore(s => s.closeTab);

  if (openTabs.length === 0) return null;

  return (
    <div className={styles.tabBar}>
      {openTabs.map(tab => (
        <div
          key={tab.id}
          className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''}`}
          onClick={() => switchTab(tab.id)}
        >
          <span className={styles.tabName}>{tab.name}</span>
          {tab.isDirty && <span className={styles.dirtyDot} />}
          <span
            className={styles.closeButton}
            onClick={e => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
          >
            x
          </span>
        </div>
      ))}
    </div>
  );
}
