import { FileTree } from './FileTree';
import { useEditorStore } from '../../store/useEditorStore';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const fileTree = useEditorStore(s => s.fileTree);
  const sidebarVisible = useEditorStore(s => s.sidebarVisible);

  if (!sidebarVisible) return null;

  return (
    <div className={styles.sidebar}>
      <div className={styles.activityBar}>
        <div className={`${styles.activityIcon} ${styles.activityIconActive}`} title="资源管理器">
          📁
        </div>
      </div>
      <div className={styles.explorer}>
        <div className={styles.explorerHeader}>资源管理器</div>
        <div className={styles.explorerContent}>
          <FileTree nodes={fileTree} depth={0} />
        </div>
      </div>
    </div>
  );
}
