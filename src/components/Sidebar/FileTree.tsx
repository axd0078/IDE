import { useEditorStore } from '../../store/useEditorStore';
import styles from './FileTree.module.css';

interface FileTreeProps {
  nodes: FileNode[];
  depth: number;
}

export function FileTree({ nodes, depth }: FileTreeProps) {
  const expandedFolders = useEditorStore(s => s.expandedFolders);
  const activeTabId = useEditorStore(s => s.activeTabId);
  const openFile = useEditorStore(s => s.openFile);
  const toggleFolder = useEditorStore(s => s.toggleFolder);
  const openTabs = useEditorStore(s => s.openTabs);

  return (
    <div className={styles.tree} role="tree">
      {nodes.map(node => {
        if (node.type === 'folder') {
          const isExpanded = expandedFolders.has(node.id);
          const hasChildren = node.children && node.children.length > 0;

          return (
            <div key={node.id} role="treeitem" aria-expanded={isExpanded}>
              <div
                className={styles.treeItem}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={() => toggleFolder(node.id)}
              >
                <span className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ''}`}>
                  &gt;
                </span>
                <span className={styles.nodeName}>{node.name}</span>
              </div>
              {isExpanded && hasChildren && (
                <FileTree nodes={node.children!} depth={depth + 1} />
              )}
              {isExpanded && !hasChildren && (
                <div
                  className={styles.emptyText}
                  style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
                >
                  空文件夹
                </div>
              )}
            </div>
          );
        }

        const isActive = node.id === activeTabId;
        const isOpen = openTabs.some(t => t.id === node.id);

        return (
          <div
            key={node.id}
            role="treeitem"
            className={`${styles.treeItem} ${isActive ? styles.treeItemActive : ''}`}
            style={{ paddingLeft: `${depth * 16 + 24}px` }}
            onClick={() => openFile(node.id)}
          >
            <span className={styles.nodeName}>{node.name}</span>
            {isOpen && <span className={styles.openDot}>&bull;</span>}
          </div>
        );
      })}
    </div>
  );
}
