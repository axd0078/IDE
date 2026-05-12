import { FileTree } from './FileTree';
import { useEditorStore } from '../../store/useEditorStore';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const fileTree = useEditorStore(s => s.fileTree);
  const folderPath = useEditorStore(s => s.folderPath);
  const sidebarVisible = useEditorStore(s => s.sidebarVisible);
  const openFolder = useEditorStore(s => s.openFolder);

  if (!sidebarVisible) return null;

  return (
    <div className={styles.sidebar}>
      <div className={styles.activityBar}>
        <div className={`${styles.activityIcon} ${styles.activityIconActive}`} title="资源管理器">
          📁
        </div>
      </div>
      <div className={styles.explorer}>
        <div className={styles.explorerHeader}>
          <span>资源管理器</span>
        </div>
        <div className={styles.explorerContent}>
          {folderPath ? (
            <>
              <div className={styles.folderLabel}>
                {folderPath.split(/[/\\]/).pop() || folderPath}
              </div>
              <FileTree nodes={fileTree} depth={0} />
            </>
          ) : (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>尚未打开文件夹</p>
              <button className={styles.openBtn} onClick={openFolder}>
                打开文件夹
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
