export interface Block {
    id: string;
    markdown: string;
    html: string;
    isEditing: boolean;
    name?: string;
    type?: 'text' | 'handwriting'; // defaults to 'text'
    isSpoiler?: boolean;
    isRevealed?: boolean;
}

export interface Tag {
    name: string;
    color: string;
    isDefault?: boolean;
}

export interface FileTreeNode {
    name: string;
    kind: 'file' | 'directory';
    handle: FileSystemFileHandle | FileSystemDirectoryHandle;
    children?: FileTreeNode[];
    isOpen?: boolean;
    path?: string;
}
