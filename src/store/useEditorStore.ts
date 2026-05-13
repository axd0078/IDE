import { create } from 'zustand';
import { EditorState } from './types';

const api = () => window.electronAPI;

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
  folderPath: null,
  fileTree: [],
  expandedFolders: new Set<string>(),
  openTabs: [],
  activeTabId: null,
  fileContents: {},
  fileEncodings: {},
  cursorPosition: { line: 1, column: 1 },
  sidebarVisible: true,

  openFolder: async () => {
    const result = await api()?.openFolder();
    if (!result) return;

    const { folderPath, tree } = result;

    // Auto-expand first level
    const firstLevel = new Set<string>();
    for (const node of tree) {
      if (node.type === 'folder') firstLevel.add(node.id);
    }

    set({
      folderPath,
      fileTree: tree,
      expandedFolders: firstLevel,
      openTabs: [],
      activeTabId: null,
      fileContents: {},
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

  openFile: (fileId: string) => {
    const { openTabs, fileTree, fileContents } = get();
    const alreadyOpen = openTabs.find(t => t.id === fileId);
    if (alreadyOpen) {
      set({ activeTabId: fileId });
      return;
    }
    const node = findNodeById(fileTree, fileId);
    if (!node || node.type !== 'file') return;

    set({
      openTabs: [...openTabs, { id: fileId, name: node.name, isDirty: false, savedContent: '' }],
      activeTabId: fileId,
    });

    // Load content asynchronously if not cached
    if (!fileContents[fileId]) {
      api()?.readFile(fileId).then(result => {
        if (result.success && result.content !== undefined) {
          set(s => ({
            fileContents: { ...s.fileContents, [fileId]: result.content! },
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

  closeTab: (fileId: string) => {
    const { openTabs, activeTabId } = get();
    const idx = openTabs.findIndex(t => t.id === fileId);
    if (idx === -1) return;
    const newTabs = openTabs.filter(t => t.id !== fileId);
    let newActive = activeTabId;
    if (activeTabId === fileId) {
      if (idx < newTabs.length) {
        newActive = newTabs[idx].id;
      } else if (newTabs.length > 0) {
        newActive = newTabs[newTabs.length - 1].id;
      } else {
        newActive = null;
      }
    }
    set({ openTabs: newTabs, activeTabId: newActive });
  },

  switchTab: (fileId: string) => set({ activeTabId: fileId }),

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

  updateCursorPosition: (pos) => set({ cursorPosition: pos }),

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
    set(s => ({
      openTabs: s.openTabs.map(t => ({ ...t, isDirty: false, savedContent: s.fileContents[t.id] ?? t.savedContent })),
    }));
  },

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
}));
