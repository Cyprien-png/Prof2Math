import type { FileTreeNode } from '../types';

export interface FileServiceOptions {
    types: {
        description: string;
        accept: Record<string, string[]>;
    }[];
}

const DEFAULT_OPTIONS: FileServiceOptions = {
    types: [{
        description: 'MathDown File',
        accept: { 'text/markdown': ['.mthd'] },
    }],
};

export class FileService {
    async openFile(): Promise<{ handle: FileSystemFileHandle, content: string, name: string } | null> {
        // @ts-ignore
        if (!window.showOpenFilePicker) {
            alert('Your browser does not support the File System Access API.');
            return null;
        }

        try {
            // @ts-ignore
            const [handle] = await window.showOpenFilePicker({
                ...DEFAULT_OPTIONS,
                multiple: false
            });

            const file = await handle.getFile();
            const content = await file.text();

            return {
                handle,
                content,
                name: handle.name.replace(/\.mthd$/, '')
            };
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error('Failed to open file:', err);
                throw err;
            }
            return null;
        }
    }

    async saveFile(handle: FileSystemFileHandle, content: string): Promise<void> {
        // @ts-ignore
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
    }

    async saveFileAs(content: string, suggestedName: string): Promise<{ handle: FileSystemFileHandle, name: string } | null> {
        // @ts-ignore
        if (!window.showSaveFilePicker) {
            // Fallback for Save As not fully supported in service yet (needs to return something else or handle download)
            // But for now let's assume modern browser or handle fallback in UI?
            // User requested service logic.
            // Let's implement fallback here? NO, service should ideally return the handle or specific result.
            // If fallback is needed, maybe return null and let UI handle? Or handle download here.
            this.downloadFile(content, suggestedName);
            return null;
        }

        try {
            // @ts-ignore
            const handle = await window.showSaveFilePicker({
                suggestedName: suggestedName.endsWith('.mthd') ? suggestedName : `${suggestedName}.mthd`,
                ...DEFAULT_OPTIONS
            });

            await this.saveFile(handle, content);

            return {
                handle,
                name: handle.name.replace(/\.mthd$/, '')
            };
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error('Failed to save file:', err);
                throw err;
            }
            return null;
        }
    }

    downloadFile(content: string, fileName: string) {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.mthd') ? fileName : `${fileName}.mthd`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async readDirectory(dirHandle: FileSystemDirectoryHandle): Promise<FileTreeNode[]> {
        const nodes: FileTreeNode[] = [];
        // @ts-ignore
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                if (entry.name.endsWith('.mthd')) {
                    nodes.push({
                        name: entry.name,
                        kind: 'file',
                        handle: entry,
                    });
                }
            } else if (entry.kind === 'directory') {
                const children = await this.readDirectory(entry);
                nodes.push({
                    name: entry.name,
                    kind: 'directory',
                    handle: entry,
                    children: children,
                    isOpen: false
                });
            }
        }

        return nodes.sort((a, b) => {
            if (a.kind === b.kind) return a.name.localeCompare(b.name);
            return a.kind === 'directory' ? -1 : 1;
        });
    }

    async readFile(handle: FileSystemFileHandle): Promise<string> {
        const file = await handle.getFile();
        return await file.text();
    }
}

export const fileService = new FileService();
