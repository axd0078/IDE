import { create } from 'zustand';
import { EditorState, FileNode } from './types';
import { sampleFiles } from '../data/sampleFiles';
import { findNodeById, flattenFiles } from '../utils/fileSystem';

function buildInitialContents(files: FileNode[]): Record<string, string> {
  const contents: Record<string, string> = {};
  for (const file of flattenFiles(files)) {
    contents[file.id] = file.content ?? '';
  }
  return contents;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  fileTree: sampleFiles,
  expandedFolders: new Set<string>(['src']),
  openTabs: [],
  activeTabId: null,
  fileContents: buildInitialContents(sampleFiles),
  cursorPosition: { line: 1, column: 1 },
  sidebarVisible: true,

  openFile: (fileId: string) => {
    const { openTabs, fileTree } = get();
    const alreadyOpen = openTabs.find(t => t.id === fileId);
    if (alreadyOpen) {
      set({ activeTabId: fileId });
      return;
    }
    const node = findNodeById(fileTree, fileId);
    if (!node || node.type !== 'file') return;
    set({
      openTabs: [...openTabs, { id: fileId, name: node.name, isDirty: false }],
      activeTabId: fileId,
    });
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
        t.id === fileId ? { ...t, isDirty: true } : t
      ),
    }));
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
}));
