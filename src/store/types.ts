export interface OpenTab {
  id: string;
  name: string;
  isDirty: boolean;
  savedContent: string;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface EditorState {
  folderPath: string | null;
  fileTree: FileNode[];
  expandedFolders: Set<string>;
  openTabs: OpenTab[];
  activeTabId: string | null;
  fileContents: Record<string, string>;
  cursorPosition: CursorPosition;
  sidebarVisible: boolean;

  openFolder: () => Promise<void>;
  openFile: (fileId: string) => void;
  closeTab: (fileId: string) => void;
  switchTab: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  saveFile: (fileId: string) => Promise<void>;
  updateCursorPosition: (pos: CursorPosition) => void;
  toggleFolder: (folderId: string) => void;
  toggleSidebar: () => void;
  reScanFolder: () => Promise<void>;
  restoreLastWorkspace: () => Promise<void>;
  saveAllDirtyFiles: () => Promise<void>;
}
