import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  getLastWorkspace: () => ipcRenderer.invoke('get-last-workspace'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  readFileWithEncoding: (filePath: string, encoding: string) =>
    ipcRenderer.invoke('read-file-with-encoding', filePath, encoding),
  scanCode: (code: string) => ipcRenderer.invoke('scan-code', code),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),
  scanFolder: (folderPath: string) => ipcRenderer.invoke('scan-folder', folderPath),
  watchFolder: (folderPath: string) => ipcRenderer.invoke('watch-folder', folderPath),
  stopWatch: () => ipcRenderer.invoke('stop-watch'),
  setDirtyState: (dirty: boolean) => ipcRenderer.invoke('set-dirty-state', dirty),
  confirmQuit: () => ipcRenderer.invoke('confirm-quit'),
  onFileChanged: (callback: () => void) => {
    ipcRenderer.on('file-changed', callback);
    return () => ipcRenderer.removeListener('file-changed', callback);
  },
  onMenuOpenFolder: (callback: () => void) => {
    ipcRenderer.on('menu-open-folder', callback);
    return () => ipcRenderer.removeListener('menu-open-folder', callback);
  },
  onMenuSave: (callback: () => void) => {
    ipcRenderer.on('menu-save', callback);
    return () => ipcRenderer.removeListener('menu-save', callback);
  },
  onSaveAllAndClose: (callback: () => void) => {
    ipcRenderer.on('save-all-and-close', callback);
    return () => ipcRenderer.removeListener('save-all-and-close', callback);
  },
});
