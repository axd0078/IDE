/// <reference types="vite/client" />

declare global {
  interface FileNode {
    id: string;
    name: string;
    type: 'file' | 'folder';
    children?: FileNode[];
    language?: string;
  }

  interface TokenInfo {
    type: number;
    text: string;
    from: number;
    to: number;
    line: number;
  }

  interface ScannerError {
    line: number;
    code: string;
  }

  interface ElectronAPI {
    openFolder: () => Promise<{ folderPath: string; tree: FileNode[] } | null>;
    getLastWorkspace: () => Promise<{ folderPath: string; tree: FileNode[] } | null>;
    readFile: (filePath: string) => Promise<{ success: boolean; content?: string; encoding?: string; error?: string }>;
    readFileWithEncoding: (filePath: string, encoding: string) => Promise<{ success: boolean; content?: string; encoding?: string; error?: string }>;
    scanCode: (code: string) => Promise<{ tokens: TokenInfo[]; errors: ScannerError[] }>;
    writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
    scanFolder: (folderPath: string) => Promise<{ success: boolean; tree?: FileNode[]; error?: string }>;
    watchFolder: (folderPath: string) => Promise<void>;
    stopWatch: () => Promise<void>;
    setDirtyState: (dirty: boolean) => Promise<void>;
    confirmQuit: () => Promise<void>;
    onFileChanged: (callback: () => void) => () => void;
    onMenuOpenFolder: (callback: () => void) => () => void;
    onMenuSave: (callback: () => void) => () => void;
    onSaveAllAndClose: (callback: () => void) => () => void;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
