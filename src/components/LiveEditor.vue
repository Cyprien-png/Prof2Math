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

// File State
const fileName = ref('untitled');
const isDirty = ref(false);
const currentFileHandle = ref<FileSystemFileHandle | null>(null);
const savedContent = ref('');

// Initialize content
const rawContent = ref(props.initialContent || '<!-- block -->\n# New file\n\nHello world!');

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
            block.markdown = result.markdown;
        }
        saveBlock(index);
    }

    closeCommandMenu();
    // Focus back?
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
                block.markdown = `${before}![${filename}](${relativeMarkdownPath})${after}`;
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

                    const el = document.getElementById(`textarea-${index}`);
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        commandMenuPosition.value = {
                            x: rect.left, // Can optimize to be near cursor but block left is ok for now
                            y: rect.top
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
    const newBlock = blockService.createBlock('', undefined, false);
    newBlock.isEditing = true;
    blocks.value.push(newBlock);

    pushHistory();
}

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

const handleDeleteRootItem = async (node: FileTreeNode) => {
    if (!rootDirectoryHandle.value) return;

    if (!confirm(`Are you sure you want to delete "${node.name}"?`)) {
        return;
    }

    try {
        await fileService.deleteEntry(rootDirectoryHandle.value, node.name);
        // Remove from local list
        const idx = fileTree.value.findIndex(c => c.name === node.name);
        if (idx !== -1) {
            fileTree.value.splice(idx, 1);
        }
    } catch (err) {
        console.error('Failed to delete root entry:', err);
        alert('Failed to delete item.');
    }
};

const handleRenameRootItem = async (node: FileTreeNode) => {
    if (!rootDirectoryHandle.value) return;

    const currentName = node.name;
    const editableName = node.kind === 'file' ? currentName.replace(/\.mthd$/, '') : currentName;

    const newNameInput = prompt('Enter new name:', editableName);
    if (!newNameInput || newNameInput === editableName) return;

    const newName = node.kind === 'file' ? `${newNameInput}.mthd` : newNameInput;

    try {
        await fileService.renameEntry(
            rootDirectoryHandle.value,
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
                    rootDirectoryHandle.value,
                    oldImagesDir,
                    newImagesDir,
                    'directory'
                );
            } catch (e) {
                // Ignore if image folder doesn't exist
            }
        }

        // Refresh entire tree
        await loadDirectory();
    } catch (err) {
        console.error('Failed to rename root entry:', err);
        alert(`Failed to rename: ${err}`);
    }
};

const handleDuplicateRootItem = async (node: FileTreeNode) => {
    if (!rootDirectoryHandle.value) return;

    try {
        await fileService.duplicateEntry(rootDirectoryHandle.value, node.name);
        // Refresh entire tree
        await loadDirectory();
    } catch (err) {
        console.error('Failed to duplicate root entry:', err);
        alert(`Failed to duplicate: ${err}`);
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

</script>

<template>
    <div
        class="flex h-screen w-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-sans overflow-hidden">
        <!-- Sidebar -->
        <SideMenu :file-tree="fileTree" :is-restoring="isRestoringPermission" @open-settings="showSettings = true"
            :active-file-handle="currentFileHandle" :root-handle="rootDirectoryHandle"
            @open-file="handleOpenFileFromTree" @toggle-folder="handleToggleFolder"
            @restore-access="handleRestoreAccess" @delete-item="handleDeleteRootItem"
            @rename-item="handleRenameRootItem" @duplicate-item="handleDuplicateRootItem"
            @file-moved="handleFileMoved" />

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
                                @keydown="handleKeydown($event, index)" @paste="handlePaste($event, index)" />

                            <!-- Add New Block Area -->
                            <div @click="addNextBlock"
                                class="h-12 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded flex items-center justify-center text-neutral-400 opacity-0 hover:opacity-100 transition-all duration-200">
                                <span class="text-sm">+ Add a new block</span>
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