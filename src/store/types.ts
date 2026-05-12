export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  language?: string;
}

export interface OpenTab {
  id: string;
  name: string;
  isDirty: boolean;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface EditorState {
  fileTree: FileNode[];
  expandedFolders: Set<string>;
  openTabs: OpenTab[];
  activeTabId: string | null;
  fileContents: Record<string, string>;
  cursorPosition: CursorPosition;
  sidebarVisible: boolean;

  openFile: (fileId: string) => void;
  closeTab: (fileId: string) => void;
  switchTab: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  updateCursorPosition: (pos: CursorPosition) => void;
  toggleFolder: (folderId: string) => void;
  toggleSidebar: () => void;
}
