import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),
  scanFolder: (folderPath: string) => ipcRenderer.invoke('scan-folder', folderPath),
  watchFolder: (folderPath: string) => ipcRenderer.invoke('watch-folder', folderPath),
  stopWatch: () => ipcRenderer.invoke('stop-watch'),
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
});
