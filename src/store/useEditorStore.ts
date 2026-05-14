/**
 * C IDE — Zustand 全局状态管理
 *
 * 这个 store 是整个 IDE 的"大脑"，管理所有应用状态。
 * 所有 React 组件通过 selector 读取状态，通过 action 方法修改状态。
 *
 * 关键设计：
 * - 文件 id 就是文件的绝对路径（天然唯一）
 * - 文件内容缓存在 fileContents 中，避免重复读磁盘
 * - 保存时对比 savedContent 判断是否脏（isDirty）
 * - 编码和语言模式按文件存储（fileEncodings / fileLanguageModes）
 */

import { create } from 'zustand';
import { EditorState } from './types';

const api = () => window.electronAPI;

/** 在 FileNode 树中按 id 查找节点 */
function findNodeById(tree: FileNode[], id: string): FileNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // === 初始状态 ===
  folderPath: null,
  fileTree: [],
  expandedFolders: new Set<string>(),
  openTabs: [],
  activeTabId: null,
  fileContents: {},           // key=文件路径, value=文件文本内容
  fileEncodings: {},          // key=文件路径, value=编码名
  fileLanguageModes: {},      // key=文件路径, value='c'|'text'
  cursorPosition: { line: 1, column: 1 },
  sidebarVisible: true,

  // === 文件夹操作 ===

  /**
   * 打开文件夹：弹出原生对话框 → 扫描目录 → 启动文件监听
   * 切换文件夹时清空之前的标签页和缓存
   */
  openFolder: async () => {
    const result = await api()?.openFolder();
    if (!result) return;

    const { folderPath, tree } = result;

    // 自动展开第一层文件夹
    const firstLevel = new Set<string>();
    for (const node of tree) {
      if (node.type === 'folder') firstLevel.add(node.id);
    }

    // 切换文件夹 → 清空标签页和缓存
    set({
      folderPath,
      fileTree: tree,
      expandedFolders: firstLevel,
      openTabs: [],
      activeTabId: null,
      fileContents: {},
    });

    // 启动文件监听（外部程序修改文件时自动刷新文件树）
    api()?.watchFolder(folderPath);

    api()?.onFileChanged(async () => {
      const { folderPath: fp } = get();
      if (fp) {
        const scan = await api()?.scanFolder(fp);
        if (scan?.success && scan.tree) {
          set({ fileTree: scan.tree });
        }
      }
    });
  },

  // === 标签页操作 ===

  /**
   * 打开文件：如果已在标签页中则直接激活，否则新建标签 + 异步读盘
   *
   * 注意：读盘是异步的，先显示标签，内容加载完成后更新。
   * 这样 UI 不会卡住，大文件也能快速响应。
   */
  openFile: (fileId: string) => {
    const { openTabs, fileTree, fileContents } = get();
    const alreadyOpen = openTabs.find(t => t.id === fileId);
    if (alreadyOpen) {
      set({ activeTabId: fileId });
      return;
    }
    const node = findNodeById(fileTree, fileId);
    if (!node || node.type !== 'file') return;

    // 先创建标签（标记为未脏），内容稍后异步加载
    set({
      openTabs: [...openTabs, { id: fileId, name: node.name, isDirty: false, savedContent: '' }],
      activeTabId: fileId,
    });

    // 异步从磁盘加载文件内容
    if (!fileContents[fileId]) {
      api()?.readFile(fileId).then(result => {
        if (result.success && result.content !== undefined) {
          set(s => ({
            fileContents: { ...s.fileContents, [fileId]: result.content! },
            // 记录编码（状态栏显示用）+ savedContent（脏判断基准）
            fileEncodings: { ...s.fileEncodings, [fileId]: result.encoding || 'UTF-8' },
            openTabs: s.openTabs.map(t =>
              t.id === fileId
                ? { ...t, savedContent: result.content! }
                : t
            ),
          }));
        }
      });
    }
  },

  /**
   * 关闭标签：从 openTabs 中移除，智能选择新的活动标签
   * 优先激活被关闭标签的右侧邻居，否则左侧邻居，都无则置空
   */
  closeTab: (fileId: string) => {
    const { openTabs, activeTabId } = get();
    const idx = openTabs.findIndex(t => t.id === fileId);
    if (idx === -1) return;
    const newTabs = openTabs.filter(t => t.id !== fileId);
    let newActive = activeTabId;
    if (activeTabId === fileId) {
      if (idx < newTabs.length) {
        newActive = newTabs[idx].id;          // 优先右邻居
      } else if (newTabs.length > 0) {
        newActive = newTabs[newTabs.length - 1].id;  // 否则最后一个
      } else {
        newActive = null;  // 全部关闭
      }
    }
    set({ openTabs: newTabs, activeTabId: newActive });
  },

  switchTab: (fileId: string) => set({ activeTabId: fileId }),

  // === 编辑操作 ===

  /**
   * 更新文件内容（每次按键都会触发）
   * 同时更新 isDirty：当前内容 ≠ 保存时的内容 → 脏
   */
  updateFileContent: (fileId: string, content: string) => {
    set(s => ({
      fileContents: { ...s.fileContents, [fileId]: content },
      openTabs: s.openTabs.map(t =>
        t.id === fileId
          ? { ...t, isDirty: content !== t.savedContent }
          : t
      ),
    }));
  },

  /**
   * 保存文件到磁盘
   * 成功后更新 savedContent = content，isDirty 自动变为 false
   */
  saveFile: async (fileId: string) => {
    const { fileContents } = get();
    const content = fileContents[fileId];
    if (content === undefined) return;

    const result = await api()?.writeFile(fileId, content);
    if (result?.success) {
      set(s => ({
        openTabs: s.openTabs.map(t =>
          t.id === fileId
            ? { ...t, isDirty: false, savedContent: content }
            : t
        ),
      }));
    }
  },

  // === 光标 ===

  updateCursorPosition: (pos) => set({ cursorPosition: pos }),

  // === 文件树展开/折叠 ===

  toggleFolder: (folderId: string) => {
    set(s => {
      const next = new Set(s.expandedFolders);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return { expandedFolders: next };
    });
  },

  toggleSidebar: () => set(s => ({ sidebarVisible: !s.sidebarVisible })),

  reScanFolder: async () => {
    const { folderPath } = get();
    if (!folderPath) return;
    const scan = await api()?.scanFolder(folderPath);
    if (scan?.success && scan.tree) {
      set({ fileTree: scan.tree });
    }
  },

  /**
   * 恢复上次工作区：启动时调用
   * 如果上次目录仍存在 → 恢复文件树并启动监听
   * 如果目录已被删除/移动 → 静默跳过
   */
  restoreLastWorkspace: async () => {
    const result = await api()?.getLastWorkspace();
    if (!result) return;

    const { folderPath, tree } = result;
    const firstLevel = new Set<string>();
    for (const node of tree) {
      if (node.type === 'folder') firstLevel.add(node.id);
    }

    set({
      folderPath,
      fileTree: tree,
      expandedFolders: firstLevel,
    });

    api()?.watchFolder(folderPath);

    api()?.onFileChanged(async () => {
      const { folderPath: fp } = get();
      if (fp) {
        const scan = await api()?.scanFolder(fp);
        if (scan?.success && scan.tree) {
          set({ fileTree: scan.tree });
        }
      }
    });
  },

  /**
   * 保存所有脏文件：关闭前的批量保存
   * 遍历 openTabs，对每个脏标签调用 writeFile
   */
  saveAllDirtyFiles: async () => {
    const { openTabs, fileContents } = get();
    for (const tab of openTabs) {
      if (tab.isDirty) {
        const content = fileContents[tab.id];
        if (content !== undefined) {
          await api()?.writeFile(tab.id, content);
        }
      }
    }
    // 批量更新 savedContent
    set(s => ({
      openTabs: s.openTabs.map(t => ({
        ...t,
        isDirty: false,
        savedContent: s.fileContents[t.id] ?? t.savedContent,
      })),
    }));
  },

  /**
   * 以指定编码重新打开文件
   * 用户从状态栏切换编码时调用
   */
  reopenWithEncoding: async (fileId: string, encoding: string) => {
    const result = await api()?.readFileWithEncoding(fileId, encoding);
    if (result?.success && result.content !== undefined) {
      set(s => ({
        fileContents: { ...s.fileContents, [fileId]: result.content! },
        fileEncodings: { ...s.fileEncodings, [fileId]: encoding },
        openTabs: s.openTabs.map(t =>
          t.id === fileId
            ? { ...t, savedContent: result.content!, isDirty: false }
            : t
        ),
      }));
    }
  },

  /**
   * 切换单个文件的 C/纯文本 语法高亮模式
   * 状态栏"C"/"文本"按钮点击时调用
   */
  toggleCLanguage: (fileId: string) => {
    set(s => ({
      fileLanguageModes: {
        ...s.fileLanguageModes,
        [fileId]: s.fileLanguageModes[fileId] === 'c' ? 'text' : 'c',
      },
    }));
  },
}));
