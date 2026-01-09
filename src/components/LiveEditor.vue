<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import type { Block, FileTreeNode } from '../types';
import EditorBlock from './editor/EditorBlock.vue';
import TopBar from './TopBar.vue';
import SideMenu from './SideMenu.vue';
import Home from './Home.vue'; // Import Home
import SettingsDialog from './SettingsDialog.vue';
import { fileService } from '../services/FileService';
import { blockService } from '../services/BlockService';
import { commandService } from '../services/CommandService';
import CommandMenu from './editor/CommandMenu.vue';
import H1Icon from './icons/H1Icon.vue';
import PencilIcon from './icons/PencilIcon.vue';

import { DEFAULT_FILE_CONTENT } from '../constants';
import { getCaretCoordinates } from '../utils/caret';

// --- Props ---
const props = defineProps<{
    initialContent?: string;
}>();

// --- State ---
const blocks = ref<Block[]>([]);
const activeMenuBlockId = ref<string | null>(null);

// History State
const history = ref<Block[][]>([]);
const historyIndex = ref(-1);
const isHistoryNavigating = ref(false);
const showSettings = ref(false);
const autosaveEnabled = ref(false);
const autosaveTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

// Command Menu State
const showCommandMenu = ref(false);
const commandMenuPosition = ref<{ x: number, y: number } | undefined>(undefined);
const commandSuggestions = ref<any[]>([]);
const commandMenuIndex = ref(0);
const commandRange = ref<{ start: number, end: number } | null>(null);

// Rename Dialog State
import RenameDialog from './RenameDialog.vue';
const showRenameDialog = ref(false);
const renameInitialName = ref('');
const renameItemNode = ref<FileTreeNode | null>(null);

// File State
const fileName = ref('untitled');
const isDirty = ref(false);
const currentFileHandle = ref<FileSystemFileHandle | null>(null);
const savedContent = ref('');

// Initialize content
const rawContent = ref(props.initialContent || DEFAULT_FILE_CONTENT);

// --- Logic ---
const checkDirty = () => {
    isDirty.value = blockService.serializeBlocks(blocks.value) !== savedContent.value;
};

// --- History Logic ---
const cloneBlocks = (blocks: Block[]): Block[] => {
    return blocks.map(b => ({ ...b }));
};

const pushHistory = () => {
    if (isHistoryNavigating.value) return;

    if (historyIndex.value < history.value.length - 1) {
        history.value = history.value.slice(0, historyIndex.value + 1);
    }

    history.value.push(cloneBlocks(blocks.value));
    historyIndex.value++;

    if (history.value.length > 50) {
        history.value.shift();
        historyIndex.value--;
    }
};

const undo = () => {
    if (historyIndex.value > 0) {
        isHistoryNavigating.value = true;
        historyIndex.value--;
        const snapshot = history.value[historyIndex.value];
        if (snapshot) {
            blocks.value = cloneBlocks(snapshot);
        }
        isHistoryNavigating.value = false;
    }
};

const redo = () => {
    if (historyIndex.value < history.value.length - 1) {
        isHistoryNavigating.value = true;
        historyIndex.value++;
        const snapshot = history.value[historyIndex.value];
        if (snapshot) {
            blocks.value = cloneBlocks(snapshot);
        }
        isHistoryNavigating.value = false;
    }
};


// Initial parse
blocks.value = blockService.parseBlocks(rawContent.value);
pushHistory();

// Initialize saved content
savedContent.value = blockService.serializeBlocks(blocks.value);
checkDirty();

// Watch blocks deeply to check dirty status
watch(blocks, () => {
    checkDirty();
}, { deep: true });

// --- Actions ---

// Expanded paths persistence
const EXPANDED_PATHS_KEY = 'mathdown_expanded_paths';
const expandedPaths = ref<Set<string>>(new Set());

// Load expanded paths
try {
    const saved = localStorage.getItem(EXPANDED_PATHS_KEY);
    if (saved) {
        expandedPaths.value = new Set(JSON.parse(saved));
    }
} catch (e) {
    console.warn('Failed to load expanded paths:', e);
}

const saveExpandedPaths = () => {
    localStorage.setItem(EXPANDED_PATHS_KEY, JSON.stringify(Array.from(expandedPaths.value)));
};


const handleSaveFile = async () => {
    const content = blockService.serializeBlocks(blocks.value);

    try {
        if (currentFileHandle.value) {
            await fileService.saveFile(currentFileHandle.value, content);
            savedContent.value = content;
            checkDirty();
        } else {
            // Only 'Save As' if explicit user action? 
            // Autosave shouldn't trigger Save As dialog unexpectedly.
            // But for now keeping behavior consistent.
            const result = await fileService.saveFileAs(content, fileName.value);
            if (result) {
                currentFileHandle.value = result.handle;
                fileName.value = result.name;
                savedContent.value = content;
                checkDirty();
            }
        }
    } catch (err) {
        console.error('Save failed', err);
    }
};

const triggerAutosave = () => {
    if (!autosaveEnabled.value) return;

    // Clear existing timeout
    if (autosaveTimeout.value) {
        clearTimeout(autosaveTimeout.value);
    }

    // Debounce 3s
    autosaveTimeout.value = setTimeout(() => {
        if (isDirty.value) {
            handleSaveFile();
        }
    }, 3000);
};



const editBlock = (index: number) => {
    blocks.value.forEach((b, i) => {
        b.isEditing = i === index;
    });
};

const saveBlock = (index: number) => {
    const block = blocks.value[index];
    if (!block) return;

    // Auto-remove if empty
    if (!block.markdown.trim()) {
        blocks.value.splice(index, 1);
        pushHistory();
        return;
    }

    // Trim content and normalize newlines (max 2)
    const newMarkdown = block.markdown.trim().replace(/\n{3,}/g, '\n\n');

    if (newMarkdown !== block.markdown) {
        block.markdown = newMarkdown;
    }

    block.html = blockService.renderHtml(block.markdown);
    block.isEditing = false; // "Leave editor mode"

    pushHistory();

    // Trigger 1: Leave editor mode
    // Also clear any pending debounce since we are saving now? 
    // Wait, requirement is "save when leave editor mode".

    checkDirty(); // Force synchronous check

    if (autosaveEnabled.value && isDirty.value) {
        handleSaveFile();
        if (autosaveTimeout.value) clearTimeout(autosaveTimeout.value);
    }

    closeCommandMenu();
};

const duplicateBlock = (index: number) => {
    const original = blocks.value[index];
    if (!original) return;

    const newBlock = blockService.duplicateBlock(original);
    blocks.value.splice(index + 1, 0, newBlock);
    activeMenuBlockId.value = null;
    pushHistory();

    checkDirty();
    if (autosaveEnabled.value && isDirty.value) {
        handleSaveFile();
    }
};

const removeBlock = (index: number) => {
    blocks.value.splice(index, 1);
    activeMenuBlockId.value = null;
    pushHistory();

    checkDirty();
    if (autosaveEnabled.value && isDirty.value) {
        handleSaveFile();
    }
};

const promptRenameBlock = (index: number) => {
    const block = blocks.value[index];
    if (!block) return;

    const newName = prompt('Enter block name:', block.name || '');
    if (newName !== null) {
        block.name = newName;
        pushHistory();

        checkDirty();
        if (autosaveEnabled.value && isDirty.value) {
            handleSaveFile();
        }
    }
    activeMenuBlockId.value = null;
};

// Handle special keys passed from child
const handleKeydown = async (e: KeyboardEvent, index: number) => {
    const isCommandKey = e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape';

    // Command Menu Navigation
    if (showCommandMenu.value && isCommandKey) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            commandMenuIndex.value = Math.max(0, commandMenuIndex.value - 1);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            commandMenuIndex.value = Math.min(commandSuggestions.value.length - 1, commandMenuIndex.value + 1);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            executeSelectedCommand(index);
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            closeCommandMenu();
            return;
        }
    }

    if (e.key === 'Enter' && e.shiftKey) {
        return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
        if (e.metaKey || e.ctrlKey) {
            saveBlock(index);
            e.preventDefault();
        } else {
            // Check for command
            const block = blocks.value[index];
            if (block && commandService.isCommand(block.markdown)) {
                e.preventDefault(); // Prevent newline

                const result = await commandService.executeCommand(block.markdown, {
                    rootHandle: rootDirectoryHandle.value,
                    currentFilePath: currentFilePath.value
                });

                if (result.success && result.markdown) {
                    block.markdown = result.markdown;
                    saveBlock(index);
                } else if (!result.success && result.message) {
                    // Show error or just alert for now?
                    // Or keep text as is?
                    console.warn(result.message);
                    if (result.message !== 'Cancelled') {
                        alert(result.message);
                    }
                }
            }
        }
    }
};

const closeCommandMenu = () => {
    showCommandMenu.value = false;
    commandSuggestions.value = [];
    commandMenuIndex.value = 0;
};

const executeSelectedCommand = async (index: number) => {
    const suggestion = commandSuggestions.value[commandMenuIndex.value];
    if (!suggestion) return;

    const block = blocks.value[index];
    if (!block) return;

    const result = await commandService.executeCommand(suggestion.name, {
        rootHandle: rootDirectoryHandle.value,
        currentFilePath: currentFilePath.value
    });

    if (result.success && result.markdown) {
        if (commandRange.value) {
            const before = block.markdown.slice(0, commandRange.value.start);
            const after = block.markdown.slice(commandRange.value.end);
            block.markdown = before + result.markdown + after;
        } else {
            // Fallback
            // Fallback
            block.markdown = result.markdown;
        }
        // Don't call saveBlock(index) because it exits edit mode.
        // Instead, just push history and check dirty state.
        pushHistory();
        checkDirty();

        // If autosave is enabled, trigger it manually
        if (autosaveEnabled.value) {
            triggerAutosave();
        }

        // Force keep editing and focus
        if (!block.isEditing) {
            block.isEditing = true;
        }

        // Calculate new cursor position
        // If we replaced a range, cursor should be after the inserted markdown
        let newCursorPos = block.markdown.length;
        if (commandRange.value) {
            newCursorPos = commandRange.value.start + result.markdown.length;
        }

        nextTick(() => {
            const el = document.getElementById(`textarea-${index}`) as HTMLTextAreaElement;
            if (el) {
                el.focus();
                el.setSelectionRange(newCursorPos, newCursorPos);
            }
        });
    }

    closeCommandMenu();
};

const handlePaste = async (e: ClipboardEvent, index: number) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
        if (item.type.startsWith('image/')) {
            e.preventDefault();

            if (!rootDirectoryHandle.value || !currentFilePath.value) {
                alert('Please save the file or open a folder to paste images.');
                return;
            }

            const file = item.getAsFile();
            if (!file) continue;

            const timestamp = new Date().getTime();
            const ext = file.name.split('.').pop() || 'png';
            const filename = `pasted_image_${timestamp}.${ext}`;

            // Save relative to current file
            const fileDir = currentFilePath.value.substring(0, currentFilePath.value.lastIndexOf('/'));
            const currentFileName = currentFilePath.value.split('/').pop()?.replace('.mthd', '') || 'untitled';
            const imagesDirName = `${currentFileName}___images`;

            const targetPath = fileDir
                ? `${fileDir}/${imagesDirName}/${filename}`
                : `${imagesDirName}/${filename}`;

            try {
                await fileService.saveAsset(rootDirectoryHandle.value, targetPath, file);

                const block = blocks.value[index];
                if (!block) return;

                const cursor = (e.target as HTMLTextAreaElement).selectionStart || block.markdown.length;

                const before = block.markdown.slice(0, cursor);
                const after = block.markdown.slice(cursor);

                const relativeMarkdownPath = `${imagesDirName}/${filename}`;
                const encodedPath = encodeURI(relativeMarkdownPath);
                block.markdown = `${before}![${filename}](${encodedPath})${after}`;
                saveBlock(index);

            } catch (err) {
                console.error('Failed to paste image:', err);
                alert('Failed to save pasted image.');
            }
            return; // Handle first image only
        }
    }
};

const updateCommandMenu = (index: number, e?: Event) => {
    nextTick(() => {
        // Prefer event value if available for immediate feedback
        let content = blocks.value[index]?.markdown || '';
        let cursor = 0;

        if (e && e.target instanceof HTMLTextAreaElement) {
            content = e.target.value;
            cursor = e.target.selectionStart;

            // Update block model immediately to ensure sync
            if (blocks.value[index]) {
                blocks.value[index].markdown = content;
            }
        } else {
            // Fallback if no event field (shouldn't happen with @input)
            const el = document.getElementById(`textarea-${index}`) as HTMLTextAreaElement;
            if (el) cursor = el.selectionStart;
        }

        const block = blocks.value[index];
        if (!block) return;

        // Find word range before cursor
        const textBeforeCursor = content.slice(0, cursor);
        const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

        if (lastSlashIndex !== -1) {
            const potentialCommand = textBeforeCursor.slice(lastSlashIndex);
            // Check if it's a valid command part (up to cursor, no spaces)
            // e.g. "/im" -> valid. "/im age" -> invalid (space)
            // If there is a space *after* the slash before the cursor, it's not a command being typed

            if (!/\s/.test(potentialCommand)) {
                const query = potentialCommand;
                const suggestions = commandService.getSuggestions(query);

                if (suggestions.length > 0) {
                    commandSuggestions.value = suggestions;
                    commandMenuIndex.value = 0;
                    showCommandMenu.value = true;
                    commandRange.value = { start: lastSlashIndex, end: cursor };

                    // Use type assertion for now since we know it's a textarea in this context (EditorBlock)
                    const el = document.getElementById(`textarea-${index}`) as HTMLTextAreaElement;
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        const caret = getCaretCoordinates(el, cursor);
                        commandMenuPosition.value = {
                            x: rect.left + caret.left,
                            y: rect.top + caret.top
                        };
                    }
                    return;
                }
            }
        }

        closeCommandMenu();
    });
};

// Global Keyboard Shortcuts
const handleGlobalKeydown = (e: KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod) return;

    if (e.key === 'z') {
        if (e.shiftKey) {
            redo();
        } else {
            undo();
        }
        e.preventDefault();
    } else if (e.key === 'y') {
        redo();
        e.preventDefault();
    } else if (e.key === 's') {
        // Global save
        handleSaveFile();
        e.preventDefault();
    }
};

onMounted(() => {
    window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalKeydown);
});

// Add Block Helper
const addNextBlock = () => {
    const newBlock = blockService.createBlock('', undefined, 'text', false);
    newBlock.isEditing = true;
    blocks.value.push(newBlock);

    pushHistory();
}

const addNextHandwrittenBlock = () => {
    const newBlock = blockService.createBlock('', undefined, 'handwriting', false);
    newBlock.isEditing = true;
    blocks.value.push(newBlock);

    pushHistory();
}

const convertBlockToHandwriting = async (index: number) => {
    const block = blocks.value[index];
    if (!block) return;

    if (!rootDirectoryHandle.value || !currentFilePath.value) {
        alert("Please save the file to disk first.");
        return;
    }

    try {
        // 1. Generate SVG with HTML background
        const width = 800; // Default width
        // Estimate height based on content or default? 
        // For now, let's pick a reasonable default or try to measure?
        // Since we don't have the element rect here easily, let's use a safe default height or try to grab it from DOM if possible?
        // Actually, we can just start with a decent canvas size. 
        // Better: HandwrittenBlock handles resizing usually. 
        // But for background, we want it to match the text.
        // Let's assume a standard height or let the user resize/draw more.
        const height = 200;

        // Serialize HTML for SVG
        // We need to wrap it in foreignObject
        // Ensure styles are somewhat preserved or default to simple text
        const backgroundHtml = `
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: sans-serif; font-size: 16px; color: #333;">
                ${block.html}
            </div>
        `;

        const timestamp = new Date().getTime();
        const filename = `drawing_${timestamp}.svg`;

        // Save relative to current file
        const fileDir = currentFilePath.value.substring(0, currentFilePath.value.lastIndexOf('/'));
        const currentFileName = currentFilePath.value.split('/').pop()?.replace('.mthd', '') || 'untitled';
        const imagesDirName = `${currentFileName}___images`;
        const targetPath = fileDir ? `${fileDir}/${imagesDirName}/${filename}` : `${imagesDirName}/${filename}`;

        // Create initial SVG with background
        // Note: HandwrittenBlock will need to be able to read this 'backgroundHtml' or we store it in desc?
        // Plan said: "Embed backgroundHtml in foreignObject"
        // And "HandwrittenBlock to render backgroundHtml behind canvas"

        // We can create the SVG file content right here:
        const svgContent = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="handwritten-block-svg">
    <foreignObject width="100%" height="100%" x="0" y="0">
        ${backgroundHtml}
    </foreignObject>
    <desc>[]</desc> 
</svg>`;

        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const file = new File([blob], filename, { type: 'image/svg+xml' });

        await fileService.saveAsset(rootDirectoryHandle.value, targetPath, file);

        // 2. Update block
        const relativeMarkdownPath = `${imagesDirName}/${filename}`;
        const encodedPath = encodeURI(relativeMarkdownPath);

        block.type = 'handwriting';
        block.markdown = `![Drawing](${encodedPath}?t=${timestamp})`;
        block.isEditing = true; // Switch to edit mode to show the new handwritten block

        pushHistory();
        checkDirty();
        if (autosaveEnabled.value) {
            handleSaveFile();
        }

    } catch (e) {
        console.error("Failed to convert block", e);
        alert("Failed to convert block to handwriting.");
    }
};

// --- File System Logic ---
const rootDirectoryHandle = ref<FileSystemDirectoryHandle | null>(null);
const fileTree = ref<FileTreeNode[]>([]);
const isRestoringPermission = ref(false);

const handleSetRootDirectory = async (handle: FileSystemDirectoryHandle) => {
    rootDirectoryHandle.value = handle;

    // Clear expanded paths when changing root
    expandedPaths.value.clear();
    saveExpandedPaths();

    fileTree.value = await fileService.readDirectory(handle);
    await fileService.setStoredRootHandle(handle);
    isRestoringPermission.value = false;
};

const handleRestoreAccess = async () => {
    if (rootDirectoryHandle.value) {
        if (await fileService.verifyPermission(rootDirectoryHandle.value)) {
            const tree = await fileService.readDirectory(rootDirectoryHandle.value);
            restoreTreeState(tree);
            fileTree.value = tree;
        } else {
            isRestoringPermission.value = true;
        }
    }
};

const restoreTreeState = (nodes: FileTreeNode[]) => {
    for (const node of nodes) {
        if (node.kind === 'directory' && node.path && expandedPaths.value.has(node.path)) {
            node.isOpen = true;
            if (node.children) {
                restoreTreeState(node.children);
            }
        }
    }
};

const loadDirectory = async () => {
    if (!rootDirectoryHandle.value) return;
    const tree = await fileService.readDirectory(rootDirectoryHandle.value);
    restoreTreeState(tree);
    fileTree.value = tree;
};

// --- Lifecycle ---
onMounted(async () => {
    window.addEventListener('keydown', handleGlobalKeydown);

    // Load Autosave Setting
    if (localStorage.getItem('mathdown_autosave') === 'true') {
        autosaveEnabled.value = true;
    }

    // Attempt to restore session
    const storedHandle = await fileService.getStoredRootHandle();
    if (storedHandle) {
        rootDirectoryHandle.value = storedHandle;
        // Check permission without user gesture first
        // @ts-ignore
        const permission = await storedHandle.queryPermission({ mode: 'read' });
        if (permission === 'granted') {
            await loadDirectory();
        } else {
            // Needs restoration
            isRestoringPermission.value = true;
        }
    }
});

watch(showSettings, (isOpen) => {
    if (!isOpen) {
        // Refresh settings when dialog closes
        if (localStorage.getItem('mathdown_autosave') === 'true') {
            autosaveEnabled.value = true;
        } else {
            autosaveEnabled.value = false;
        }
    }
});


const handleToggleFolder = (node: FileTreeNode) => {
    node.isOpen = !node.isOpen;
    if (node.path) {
        if (node.isOpen) {
            expandedPaths.value.add(node.path);
        } else {
            expandedPaths.value.delete(node.path);
        }
        saveExpandedPaths();
    }
};

const currentFilePath = ref<string | null>(null);

const handleOpenFileFromTree = async (node: FileTreeNode) => {
    try {
        const handle = node.handle as FileSystemFileHandle;

        // Trigger 3: File Switch
        if (autosaveEnabled.value && isDirty.value) {
            await handleSaveFile();
        }

        const content = await fileService.readFile(handle);

        currentFileHandle.value = handle;
        currentFilePath.value = node.path || null;
        fileName.value = handle.name.replace(/\.mthd$/, '');
        blocks.value = blockService.parseBlocks(content);

        // Reset History
        history.value = [];
        historyIndex.value = -1;
        pushHistory();

        // Reset Dirty
        savedContent.value = blockService.serializeBlocks(blocks.value);
        checkDirty();
    } catch (err) {
        console.error('Failed to open file from tree:', err);
        alert('Failed to open file');
    }
};


const toggleMenu = (id: string | null) => {
    activeMenuBlockId.value = id;
}

const handleDeleteItem = async (node: FileTreeNode) => {
    if (!rootDirectoryHandle.value) return;

    if (!confirm(`Are you sure you want to delete "${node.name}"?`)) {
        return;
    }

    try {
        let parentHandle = rootDirectoryHandle.value;
        if (node.path && node.path !== node.name) {
            const pathParts = node.path.split('/');
            pathParts.pop(); // Remove self
            if (pathParts.length > 0) {
                // @ts-ignore
                parentHandle = await fileService.getDirectoryHandleByPath(rootDirectoryHandle.value, pathParts.join('/'));
            }
        }

        await fileService.deleteEntry(parentHandle, node.name);

        // Also delete sidecar image folder if it exists
        if (node.kind === 'file') {
            const baseName = node.name.replace(/\.mthd$/, '');
            const imagesDir = `${baseName}___images`;
            try {
                await fileService.deleteEntry(parentHandle, imagesDir);
            } catch (e) {
                // Ignore
            }
        }

        // Refresh tree is simplest way to sync everything
        await loadDirectory();

    } catch (err) {
        console.error('Failed to delete entry:', err);
        alert('Failed to delete item.');
    }
};

const handleDuplicateItem = async (node: FileTreeNode) => {
    if (!rootDirectoryHandle.value) return;

    try {
        let parentHandle = rootDirectoryHandle.value;
        if (node.path && node.path !== node.name) {
            const pathParts = node.path.split('/');
            pathParts.pop();
            if (pathParts.length > 0) {
                // @ts-ignore
                parentHandle = await fileService.getDirectoryHandleByPath(rootDirectoryHandle.value, pathParts.join('/'));
            }
        }

        await fileService.duplicateEntry(parentHandle, node.name);
        await loadDirectory();
    } catch (err) {
        console.error('Failed to duplicate:', err);
        alert(`Failed to duplicate: ${err}`);
    }
};

const handleRenameItem = (node: FileTreeNode) => {
    renameItemNode.value = node;
    renameInitialName.value = node.kind === 'file' ? node.name.replace(/\.mthd$/, '') : node.name;
    showRenameDialog.value = true;
};

const handleConfirmRename = async (newNameInput: string) => {
    showRenameDialog.value = false;
    const node = renameItemNode.value;
    if (!node || !rootDirectoryHandle.value) return;

    // Sanity check
    const currentName = node.name;
    const editableName = node.kind === 'file' ? currentName.replace(/\.mthd$/, '') : currentName;
    if (!newNameInput || newNameInput === editableName) return;

    const newName = node.kind === 'file' ? `${newNameInput}.mthd` : newNameInput;

    try {
        // Resolve Parent Directory
        let parentHandle = rootDirectoryHandle.value;
        if (node.path && node.path !== node.name) {
            const pathParts = node.path.split('/');
            pathParts.pop(); // Remove self
            if (pathParts.length > 0) {
                const parentPath = pathParts.join('/');
                // @ts-ignore
                parentHandle = await fileService.getDirectoryHandleByPath(rootDirectoryHandle.value, parentPath);
            }
        }

        await fileService.renameEntry(
            parentHandle,
            node.name,
            newName,
            node.kind
        );

        // --- 4. Logic for Sidecar Image Folder ---
        if (node.kind === 'file') {
            const oldBaseName = node.name.replace(/\.mthd$/, '');
            const newBaseName = newName.replace(/\.mthd$/, '');
            const oldImagesDir = `${oldBaseName}___images`;
            const newImagesDir = `${newBaseName}___images`;

            try {
                // Try renaming the images folder too
                await fileService.renameEntry(
                    parentHandle,
                    oldImagesDir,
                    newImagesDir,
                    'directory'
                );
            } catch (e) {
                // Ignore
            }

            // Update Content Links
            try {
                // 1. Get handle to the NEW file file in correct parent
                // @ts-ignore
                const fileHandle = await parentHandle.getFileHandle(newName);
                const content = await fileService.readFile(fileHandle);

                // 2. Replace links
                const escapedOldDir = oldImagesDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const encodedOldDir = encodeURI(oldImagesDir).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                const encodedNewDir = encodeURI(newImagesDir);

                let newContent = content;

                // Replace encoded path
                const regexEncoded = new RegExp(`\\(${encodedOldDir}/`, 'g');
                newContent = newContent.replace(regexEncoded, `(${encodedNewDir}/`);

                // Replace unencoded path
                const regexUnencoded = new RegExp(`\\(${escapedOldDir}/`, 'g');
                newContent = newContent.replace(regexUnencoded, `(${encodedNewDir}/`);

                if (newContent !== content) {
                    await fileService.saveFile(fileHandle, newContent);
                }

                const wasOpen = currentFilePath.value === node.path;

                if (wasOpen) {
                    // Re-resolve currentFilePath
                    // If path was "sub/foo.mthd", new path is "sub/newName"
                    let newPath = newName;
                    if (node.path && node.path.includes('/')) {
                        const p = node.path.split('/');
                        p.pop();
                        p.push(newName);
                        newPath = p.join('/');
                    }

                    currentFilePath.value = newPath;
                    fileName.value = newBaseName;
                    currentFileHandle.value = fileHandle;
                    blocks.value = blockService.parseBlocks(newContent);
                    savedContent.value = newContent;
                }
            } catch (e) {
                console.error('Failed to update content links on rename:', e);
            }
        }

        // Refresh entire tree
        await loadDirectory();
    } catch (err) {
        console.error('Failed to rename root entry:', err);
        alert(`Failed to rename: ${err}`);
    }
};



const findNodeByPath = (nodes: FileTreeNode[], path: string): FileTreeNode | null => {
    for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
            const found = findNodeByPath(node.children, path);
            if (found) return found;
        }
    }
    return null;
    // Not found, ignore
}
const handleFileMoved = async (event: { sourcePath: string, newPath: string }) => {
    if (!rootDirectoryHandle.value) return;

    // --- Sidecar Image Folder Move Logic ---
    try {
        // Only apply if the moved item was a .mthd file
        if (event.sourcePath.endsWith('.mthd')) {
            const getParentPath = (p: string) => {
                const parts = p.split('/');
                parts.pop();
                return parts.join('/');
            };
            const getFileName = (p: string) => p.split('/').pop() || '';

            const sourceParentPath = getParentPath(event.sourcePath);
            const destParentPath = getParentPath(event.newPath);

            const fileName = getFileName(event.sourcePath);
            const baseName = fileName.replace(/\.mthd$/, '');
            const imagesDirName = `${baseName}___images`;

            // Check if source images dir exists
            const sourceParentHandle = sourceParentPath
                ? await fileService.getDirectoryHandleByPath(rootDirectoryHandle.value, sourceParentPath)
                : rootDirectoryHandle.value;

            let imagesHandle: FileSystemDirectoryHandle | null = null;
            try {
                // @ts-ignore
                imagesHandle = await sourceParentHandle.getDirectoryHandle(imagesDirName);
            } catch (e) {
                // Not found, ignore
            }

            if (imagesHandle) {
                const destParentHandle = destParentPath
                    ? await fileService.getDirectoryHandleByPath(rootDirectoryHandle.value, destParentPath)
                    : rootDirectoryHandle.value;

                await fileService.moveEntry(sourceParentHandle, imagesDirName, destParentHandle);
            }
        }
    } catch (err) {
        console.error('Failed to move sidecar images folder:', err);
    }

    // Refresh tree
    await loadDirectory();

    // Check if we need to reopen the moved file
    // Check if we need to reopen the moved file
    if (currentFilePath.value) {
        let newCurrentPath: string | null = null;

        // Case 1: The file itself was moved
        if (currentFilePath.value === event.sourcePath) {
            newCurrentPath = event.newPath;
        }
        // Case 2: A parent directory was moved
        else if (currentFilePath.value.startsWith(event.sourcePath + '/')) {
            newCurrentPath = event.newPath + currentFilePath.value.substring(event.sourcePath.length);
        }

        if (newCurrentPath) {
            const newNode = findNodeByPath(fileTree.value, newCurrentPath);
            if (newNode) {
                currentFileHandle.value = newNode.handle as FileSystemFileHandle;
                currentFilePath.value = newNode.path || null;
            }
        }
    }
};

const handleCreateNewItem = async (node: FileTreeNode, kind: 'file' | 'directory') => {
    if (!rootDirectoryHandle.value) return;

    // If node is a directory, we create INSIDE it.
    // If node is a file, we create as SIBLING (path parts logic).
    let parentHandle = rootDirectoryHandle.value;
    let parentPath = '';

    if (node.kind === 'directory') {
        parentHandle = node.handle as FileSystemDirectoryHandle;
        parentPath = node.path || node.name; // Root might be just name
        // Ensure parentPath is correct full path if possible
        if (node.path) parentPath = node.path;
    } else {
        // Sibling logic for files
        if (node.path && node.path !== node.name) {
            const pathParts = node.path.split('/');
            pathParts.pop();
            if (pathParts.length > 0) {
                parentPath = pathParts.join('/');
                // @ts-ignore
                parentHandle = await fileService.getDirectoryHandleByPath(rootDirectoryHandle.value, parentPath);
            }
        }
    }

    const newNameInput = prompt(`Enter name for new ${kind} in "${node.kind === 'directory' ? node.name : 'current folder'}":`);
    if (!newNameInput) return;

    let finalName = newNameInput;
    if (kind === 'file' && !finalName.endsWith('.mthd')) {
        finalName += '.mthd';
    }

    let newHandle: FileSystemFileHandle | null = null;

    try {
        if (kind === 'file') {
            // @ts-ignore
            const newFileHandle = await parentHandle.getFileHandle(finalName, { create: true });
            newHandle = newFileHandle;
            // @ts-ignore
            const writable = await newFileHandle.createWritable();
            await writable.write(DEFAULT_FILE_CONTENT);
            await writable.close();
        } else {
            // @ts-ignore
            await parentHandle.getDirectoryHandle(finalName, { create: true });
        }

        await loadDirectory();

        // If file, verify logic to auto-open
        if (kind === 'file' && newHandle) {
            // Construct full path for opening
            // If parentPath is empty (root), full path is finalName
            // If parentPath exists, full path is parentPath + '/' + finalName
            const fullPath = parentPath ? `${parentPath}/${finalName}` : finalName;

            // Directly open using the handle we just created
            // This avoids waiting for the tree to index or finding the node
            const newNode: FileTreeNode = {
                kind: 'file',
                name: finalName,
                path: fullPath,
                handle: newHandle
            };
            handleOpenFileFromTree(newNode);
        }

        // If we created inside a folder, we should ensure it's expanded?
        // logic for toggle-folder might be needed or loadDirectory preserves state?
        // loadDirectory currently resets tree state? No, fileService.readDirectory just reads.
        // FileTree component state (isOpen) is internal?
        // FileTreeNode struct has isOpen? Yes.
        // We might need to ensure the parent folder is marked isOpen if we added to it.
        if (node.kind === 'directory') {
            node.isOpen = true;
        }

    } catch (err) {
        console.error('Failed to create item:', err);
        alert(`Failed to create item: ${err}`);
    }
};

</script>

<template>
    <div
        class="flex h-screen w-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-sans overflow-hidden">
        <!-- Sidebar -->
        <SideMenu :file-tree="fileTree" :is-restoring="isRestoringPermission" @open-settings="showSettings = true"
            :active-file-handle="currentFileHandle" :root-handle="rootDirectoryHandle"
            @open-file="handleOpenFileFromTree" @toggle-folder="handleToggleFolder"
            @restore-access="handleRestoreAccess" @delete-item="handleDeleteItem" @rename-item="handleRenameItem"
            @duplicate-item="handleDuplicateItem" @file-moved="handleFileMoved"
            @create-file="handleCreateNewItem($event, 'file')"
            @create-folder="handleCreateNewItem($event, 'directory')" />

        <!-- Main Content (Flex Column) -->
        <div class="flex-1 flex flex-col min-w-0 relative">
            <template v-if="currentFileHandle">
                <!-- Top Bar -->
                <TopBar :filename="fileName" :is-dirty="isDirty" @save="handleSaveFile" />

                <div class="flex-1 overflow-y-auto w-full">
                    <div class="max-w-3xl mx-auto py-12 px-6">
                        <div class="space-y-4">
                            <EditorBlock v-for="(block, index) in blocks" :key="block.id" :block="block" :index="index"
                                :active-menu-block-id="activeMenuBlockId" :root-handle="rootDirectoryHandle"
                                :current-file-path="currentFilePath" @update:block="saveBlock(index)"
                                @input="triggerAutosave(); updateCommandMenu(index, $event);" @save="saveBlock(index)"
                                @menu-toggle="toggleMenu" @duplicate="duplicateBlock(index)"
                                @remove="removeBlock(index)" @edit="editBlock(index)" @rename="promptRenameBlock(index)"
                                @keydown="handleKeydown($event, index)" @paste="handlePaste($event, index)"
                                @convert="convertBlockToHandwriting(index)" />

                            <!-- Add New Block Area -->
                            <div class="flex gap-4 md:opacity-0 hover:opacity-100 transition-all duration-200">
                                <div @click="addNextBlock"
                                    class="flex-1 h-12 gap-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded flex items-center justify-center text-neutral-400">
                                    <H1Icon class="size-3" />
                                    <span class="text-sm">Add textual block</span>
                                </div>
                                <div @click="addNextHandwrittenBlock"
                                    class="flex-1 h-12 gap-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded flex items-center justify-center text-neutral-400">
                                    <PencilIcon class="size-3" />
                                    <span class="text-sm">Add handwritten block</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
            <Home v-else />
        </div>

        <!-- Dialogs -->
        <SettingsDialog :is-open="showSettings" :current-directory="rootDirectoryHandle?.name"
            @close="showSettings = false" @set-root-directory="handleSetRootDirectory" />

        <RenameDialog v-if="showRenameDialog" :is-open="showRenameDialog" :initial-name="renameInitialName"
            :title="`Rename ${renameItemNode?.kind || 'item'}`" @close="showRenameDialog = false"
            @confirm="handleConfirmRename" />
    </div>

    <CommandMenu :items="commandSuggestions" :selected-index="commandMenuIndex" :position="commandMenuPosition"
        @select="(i) => { commandMenuIndex = i; executeSelectedCommand(blocks.findIndex(b => b.isEditing)); }"
        v-if="showCommandMenu" />
</template>

<style>
/* Import direct via CSS pour s'assurer qu'il est chargé par le navigateur */
@import 'katex/dist/katex.min.css';

/* Correction pour les conflits potentiels avec Tailwind ou les styles de base */
.katex-display {
    margin: 1em 0 !important;
    overflow-x: auto;
    overflow-y: hidden;
}

.katex {
    font-size: 1.1em;
    /* Ajustez selon vos besoins */
    text-rendering: auto;
}
</style>