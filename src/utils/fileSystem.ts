import { FileNode } from '../store/types';

export function findNodeById(tree: FileNode[], id: string): FileNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function flattenFiles(nodes: FileNode[]): FileNode[] {
  let result: FileNode[] = [];
  for (const node of nodes) {
    if (node.type === 'file') {
      result.push(node);
    }
    if (node.children) {
      result = result.concat(flattenFiles(node.children));
    }
  }
  return result;
}
