import { ref } from 'vue';
import type { FileTreeNode } from '../types';

export const globalDragState = ref<{ node: FileTreeNode; parentHandle?: FileSystemDirectoryHandle } | null>(null);
export const globalDropTargetPath = ref<string | null>(null);
