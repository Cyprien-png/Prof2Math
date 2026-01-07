export interface Block {
    id: string;
    markdown: string;
    html: string;
    isEditing: boolean;
    name?: string;
}

export interface FileTreeNode {
    name: string;
    kind: 'file' | 'directory';
    handle: FileSystemFileHandle | FileSystemDirectoryHandle;
    children?: FileTreeNode[];
    isOpen?: boolean;
    path?: string;
}
