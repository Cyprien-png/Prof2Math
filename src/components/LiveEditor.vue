<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import type { Block, FileTreeNode } from '../types';
import EditorBlock from './editor/EditorBlock.vue';
import TopBar from './TopBar.vue';
import SideMenu from './SideMenu.vue';
import SettingsDialog from './SettingsDialog.vue';
import { fileService } from '../services/FileService';
import { blockService } from '../services/BlockService';

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
    // console.log(`History Pushed: Index ${historyIndex.value}, Length ${history.value.length}`);
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
        // console.log(`Undo: Index ${historyIndex.value}`);
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
        // console.log(`Redo: Index ${historyIndex.value}`);
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

const handleSaveFile = async () => {
    const content = blockService.serializeBlocks(blocks.value);

    try {
        if (currentFileHandle.value) {
            await fileService.saveFile(currentFileHandle.value, content);
            savedContent.value = content;
            checkDirty();
            console.log(`Saved to ${fileName.value}.mthd`);
        } else {
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

const handleOpenFile = async () => {
    const result = await fileService.openFile();
    if (result) {
        currentFileHandle.value = result.handle;
        fileName.value = result.name;
        blocks.value = blockService.parseBlocks(result.content);

        // Reset History & State
        history.value = [];
        historyIndex.value = -1;
        pushHistory();
        pushHistory();
        savedContent.value = blockService.serializeBlocks(blocks.value); // Normalize saved state to match serialization
        checkDirty();
    }
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
    block.isEditing = false;

    pushHistory();
};

const duplicateBlock = (index: number) => {
    const original = blocks.value[index];
    if (!original) return;

    const newBlock = blockService.duplicateBlock(original);
    blocks.value.splice(index + 1, 0, newBlock);
    activeMenuBlockId.value = null;
    pushHistory();
};

const removeBlock = (index: number) => {
    blocks.value.splice(index, 1);
    activeMenuBlockId.value = null;
    pushHistory();
};

const promptRenameBlock = (index: number) => {
    const block = blocks.value[index];
    if (!block) return;

    const newName = prompt('Enter block name:', block.name || '');
    if (newName !== null) {
        block.name = newName;
        pushHistory();
    }
    activeMenuBlockId.value = null;
};

// Handle special keys passed from child
const handleKeydown = (e: KeyboardEvent, index: number) => {
    if (e.key === 'Enter' && e.shiftKey) {
        return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
        if (e.metaKey || e.ctrlKey) {
            saveBlock(index);
            e.preventDefault();
        }
    }
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
    fileTree.value = await fileService.readDirectory(handle);
    await fileService.setStoredRootHandle(handle);
    isRestoringPermission.value = false;
};

const handleRestoreAccess = async () => {
    if (!rootDirectoryHandle.value) return;
    const granted = await fileService.verifyPermission(rootDirectoryHandle.value, false);
    if (granted) {
        fileTree.value = await fileService.readDirectory(rootDirectoryHandle.value);
        isRestoringPermission.value = false;
    }
};

onMounted(async () => {
    window.addEventListener('keydown', handleGlobalKeydown);

    // Attempt to restore session
    const storedHandle = await fileService.getStoredRootHandle();
    if (storedHandle) {
        rootDirectoryHandle.value = storedHandle;
        // Check permission without user gesture first
        // @ts-ignore
        const permission = await storedHandle.queryPermission({ mode: 'read' });
        if (permission === 'granted') {
            fileTree.value = await fileService.readDirectory(storedHandle);
        } else {
            // Needs restoration
            isRestoringPermission.value = true;
        }
    }
});

const handleToggleFolder = (node: FileTreeNode) => {
    node.isOpen = !node.isOpen;
};

const handleOpenFileFromTree = async (handle: FileSystemFileHandle) => {
    try {
        const content = await fileService.readFile(handle);

        currentFileHandle.value = handle;
        fileName.value = handle.name.replace(/\.mthd$/, '');
        blocks.value = blockService.parseBlocks(content);

        // Reset History
        history.value = [];
        historyIndex.value = -1;
        pushHistory();

        // Reset Dirty
        savedContent.value = blockService.serializeBlocks(blocks.value);
        checkDirty();

        console.log(`Opened file from tree: ${fileName.value}`);
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

</script>

<template>
    <div
        class="flex h-screen w-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-sans overflow-hidden">
        <!-- Sidebar -->
        <SideMenu :file-tree="fileTree" :is-restoring="isRestoringPermission" @open-settings="showSettings = true"
            :active-file-handle="currentFileHandle" @open-file="handleOpenFileFromTree"
            @toggle-folder="handleToggleFolder" @restore-access="handleRestoreAccess"
            @delete-item="handleDeleteRootItem" />

        <!-- Main Content (Flex Column) -->
        <div class="flex-1 flex flex-col min-w-0 relative">
            <!-- Top Bar -->
            <TopBar :filename="fileName" :is-dirty="isDirty" @save="handleSaveFile" />

            <div class="flex-1 overflow-y-auto w-full">
                <div class="max-w-3xl mx-auto py-12 px-6">
                    <div class="space-y-4">
                        <EditorBlock v-for="(block, index) in blocks" :key="block.id" :block="block" :index="index"
                            :active-menu-block-id="activeMenuBlockId" @update:block="saveBlock(index)"
                            @save="saveBlock(index)" @menu-toggle="toggleMenu" @duplicate="duplicateBlock(index)"
                            @remove="removeBlock(index)" @edit="editBlock(index)" @rename="promptRenameBlock(index)"
                            @keydown="handleKeydown($event, index)" />

                        <!-- Add New Block Area -->
                        <div @click="addNextBlock"
                            class="h-12 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded flex items-center justify-center text-neutral-400 opacity-0 hover:opacity-100 transition-all duration-200">
                            <span class="text-sm">+ Add a new block</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Dialogs -->
        <SettingsDialog :is-open="showSettings" :current-directory="rootDirectoryHandle?.name"
            @close="showSettings = false" @set-root-directory="handleSetRootDirectory" />
    </div>
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