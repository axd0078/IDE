import { EditorState } from './types';

export const selectActiveTab = (s: EditorState) =>
  s.openTabs.find(t => t.id === s.activeTabId) ?? null;

export const selectIsFileOpen = (fileId: string) => (s: EditorState) =>
  s.openTabs.some(t => t.id === fileId);
