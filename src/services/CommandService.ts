import { fileService } from './FileService';

export interface CommandContext {
    rootHandle: FileSystemDirectoryHandle | null;
    currentFilePath: string | null;
}

export interface CommandResult {
    success: boolean;
    markdown?: string;
    message?: string;
}

interface CommandDefinition {
    name: string;
    description: string;
    execute: (context: CommandContext) => Promise<CommandResult>;
}

export class CommandService {
    private commands: CommandDefinition[] = [
        {
            name: '/image',
            description: 'Import an image from your computer',
            execute: this.handleImageCommand.bind(this)
        }
    ];

    getSuggestions(query: string): CommandDefinition[] {
        const normalizedQuery = query.toLowerCase();
        return this.commands.filter(cmd =>
            cmd.name.startsWith(normalizedQuery)
        );
    }

    isCommand(text: string): boolean {
        return text.trim().startsWith('/');
    }

    async executeCommand(commandText: string, context: CommandContext): Promise<CommandResult> {
        const parts = commandText.trim().split(' ');
        const commandName = (parts[0] || '').toLowerCase();

        const command = this.commands.find(c => c.name === commandName);
        if (command) {
            return await command.execute(context);
        }

        return { success: false, message: 'Unknown command' };
    }

    private async handleImageCommand(context: CommandContext): Promise<CommandResult> {
        if (!context.rootHandle || !context.currentFilePath) {
            return { success: false, message: 'File system access required for this command.' };
        }

        try {
            // 1. Pick file
            // @ts-ignore
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Images',
                    accept: {
                        'image/*': ['.png', '.gif', '.jpeg', '.jpg', '.webp']
                    }
                }],
                multiple: false
            });

            const file = await fileHandle.getFile();

            // 2. Determine save path
            // Save to relative folder {filename}___images
            const currentPath = context.currentFilePath;
            const fileDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
            const currentFileName = currentPath.split('/').pop()?.replace('.mthd', '') || 'untitled';
            const imagesDirName = `${currentFileName}___images`;

            const targetPath = fileDir
                ? `${fileDir}/${imagesDirName}/${file.name}`
                : `${imagesDirName}/${file.name}`;

            // 3. Save Asset
            await fileService.saveAsset(context.rootHandle, targetPath, file);

            // 4. Return Markdown
            // Image path in markdown should be relative to the markdown file?
            // If markdown is "foo/bar.md" and image is "foo/bar___images/image.png", relative is "bar___images/image.png".
            // Since we save relative to the file's dir, we just need the subpath.

            const relativeMarkdownPath = `${imagesDirName}/${file.name}`;

            return {
                success: true,
                markdown: `![${file.name}](${relativeMarkdownPath})`
            };

        } catch (err: any) {
            if (err.name === 'AbortError') {
                return { success: false, message: 'Cancelled' };
            }
            console.error('Image command failed:', err);
            return { success: false, message: 'Failed to import image.' };
        }
    }
}

export const commandService = new CommandService();
