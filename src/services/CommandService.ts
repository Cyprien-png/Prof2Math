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
            // Save relative to current file
            const fileDir = context.currentFilePath.substring(0, context.currentFilePath.lastIndexOf('/'));
            const targetPath = fileDir ? `${fileDir}/${file.name}` : file.name;

            // 3. Save Asset
            await fileService.saveAsset(context.rootHandle, targetPath, file);

            // 4. Return Markdown
            // Image path in markdown should be relative to the markdown file?
            // If they are in the same folder, just filename is enough.
            // If markdown is "foo/bar.md" and image is "foo/image.png", relative is "image.png".
            // If markdown is "doc/foo/bar.md" and image is "doc/foo/image.png", relative is "image.png".

            // For now, assume we save in the same directory, so just filename.
            return {
                success: true,
                markdown: `![${file.name}](${file.name})`
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
