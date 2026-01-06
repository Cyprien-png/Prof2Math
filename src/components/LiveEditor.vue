<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';
import type { Block } from '../types';
import EditorBlock from './editor/EditorBlock.vue';
import TopBar from './TopBar.vue';
import SideMenu from './SideMenu.vue';
import SettingsDialog from './SettingsDialog.vue';

// --- Props ---
const props = defineProps<{
    initialContent?: string;
}>();

// --- Markdown Setup ---
const md = new MarkdownIt();
md.use(texmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: { macros: { "\\RR": "\\mathbb{R}" } }
});

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
const currentFileHandle = ref<any>(null);
const savedContent = ref('');

// Navigate / Undo / Redo logic...

// Initialize content
const rawContent = ref(props.initialContent || '<!-- block -->\n# New file\n\nHello world!');

// --- Logic ---
const parseBlocks = (content: string) => {
    // Regex to split by delimiters, capturing optional name
    // Matches: <!-- block --> OR <!-- block: Name -->
    const regex = /\n*<!--\s*block(?::\s*(.*?))?\s*-->\n*/g;
    const rawParts = content.split(regex);

    // rawParts will be: [text0, name1, text1, name2, text2, ...]

    const newBlocks: Block[] = [];

    let startIndex = 0;

    // If the file starts with a delimiter, text0 (rawParts[0]) will be empty (or whitespace).
    // In our new format, we expect files to start with a delimiter.
    // If it DOESN'T (legacy file), we treat text0 as the first block (Untitled).

    if (rawParts.length > 0) {
        const firstChunk = rawParts[0];
        if (firstChunk && firstChunk.trim().length > 0) {
            // Legacy format: content before first delimiter
            newBlocks.push({
                id: `block-legacy-${Date.now()}`,
                markdown: firstChunk,
                html: DOMPurify.sanitize(md.render(firstChunk)),
                isEditing: false,
                name: undefined
            });
        }
        // If empty, we skip it (it's the empty space before the first delimiter)
        startIndex = 1;
    }

    // Iterate the rest in pairs [name, content]
    // If we started with a delimiter, rawParts[1] is Name of first block, rawParts[2] is Content.
    for (let i = startIndex; i < rawParts.length; i += 2) {
        const name = rawParts[i];
        // Ensure we don't go out of bounds
        if (i + 1 >= rawParts.length) break;

        const markdown = rawParts[i + 1] || '';

        newBlocks.push({
            id: `block-${(i + 1) / 2}-${Date.now()}`,
            markdown: markdown,
            html: DOMPurify.sanitize(md.render(markdown)),
            isEditing: false,
            name: name ? name.trim() : undefined
        });
    }

    return newBlocks;
};

const serializeContent = () => {
    // Always map each block to "Delimiter + Content"
    return blocks.value.map(b => {
        const namePart = b.name ? `: ${b.name}` : '';
        return `<!-- block${namePart} -->\n${b.markdown}`;
    }).join('\n\n');
};

const checkDirty = () => {
    isDirty.value = serializeContent() !== savedContent.value;
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
    console.log(`History Pushed: Index ${historyIndex.value}, Length ${history.value.length}`);
    // watcher handles dirty check
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
        console.log(`Undo: Index ${historyIndex.value}`);
        // watcher handles dirty check
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
        console.log(`Redo: Index ${historyIndex.value}`);
        // watcher handles dirty check
    }
};


// Initial parse
blocks.value = parseBlocks(rawContent.value);
pushHistory();

// Initialize saved content
savedContent.value = serializeContent();
checkDirty(); // Should be false initially

// Watch blocks deeply to check dirty status
watch(blocks, () => {
    checkDirty();
}, { deep: true });

// --- Actions ---

const handleSaveFile = async () => {
    const content = serializeContent();
    const fullFileName = `${fileName.value}.mthd`;

    try {
        // @ts-ignore - File System Access API types might be missing
        if (window.showSaveFilePicker) {
            let handle = currentFileHandle.value;

            if (!handle) {
                // @ts-ignore
                handle = await window.showSaveFilePicker({
                    suggestedName: fullFileName,
                    types: [{
                        description: 'MathDown File',
                        accept: { 'text/markdown': ['.mthd'] },
                    }],
                });
                currentFileHandle.value = handle;
                // Update filename from handle
                if (handle.name) {
                    fileName.value = handle.name.replace('.mthd', '');
                }
            }

            // @ts-ignore
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();

        } else {
            // Fallback: Download
            const blob = new Blob([content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fullFileName;
            a.click();
            URL.revokeObjectURL(url);
        }

        savedContent.value = serializeContent();
        checkDirty();
        console.log(`Saved to ${fileName.value}.mthd`);
    } catch (err: any) {
        if (err.name !== 'AbortError') {
            console.error('Failed to save file:', err);
            alert('Failed to save file');
        }
    }
};

const handleOpenFile = async () => {
    try {
        // @ts-ignore
        if (window.showOpenFilePicker) {
            // @ts-ignore
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'MathDown File',
                    accept: { 'text/markdown': ['.mthd'] },
                }],
                multiple: false
            });

            // @ts-ignore
            const file = await handle.getFile();
            const content = await file.text();

            // Reset state
            currentFileHandle.value = handle;
            fileName.value = handle.name.replace(/\.mthd$/, '');

            // Parse content
            blocks.value = parseBlocks(content);

            // Reset History
            history.value = [];
            historyIndex.value = -1;
            pushHistory(); // Push initial state

            // Reset Dirty
            savedContent.value = serializeContent(); // Should match exactly
            checkDirty();

            console.log(`Opened file: ${fileName.value}`);
        } else {
            alert('Your browser does not support opening files directly.');
        }
    } catch (err: any) {
        if (err.name !== 'AbortError') {
            console.error('Failed to open file:', err);
            alert('Failed to open file');
        }
    }
};

const editBlock = (index: number) => {
    blocks.value.forEach((b, i) => {
        b.isEditing = i === index;
    });
    // Focus logic is handled by EditorBlock watching isEditing
};

const saveBlock = (index: number) => {
    const block = blocks.value[index];
    if (!block) return;

    const oldMarkdown = block.markdown;

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

    block.html = DOMPurify.sanitize(md.render(block.markdown), {
        ADD_TAGS: ["math", "annotation", "semantics", "mtext", "mn", "mo", "mi", "mspace", "mover", "mstyle", "msub", "msup", "msubsup", "mfrac", "msqrt", "mroot", "mtable", "mtr", "mtd", "merror", "mpadded", "mphantom", "mglyph", "maligngroup", "malignmark", "menclose", "mfenced", "mscarry", "mscarry", "msgroup", "msline", "msrow", "mstack", "mlongdiv"],
        ADD_ATTR: ['encoding', 'display']
    });
    block.isEditing = false;

    // Only push history if it was editing? usage of saveBlock implies it was
    pushHistory();
};

const duplicateBlock = (index: number) => {
    const original = blocks.value[index];
    if (!original) return;

    const newBlock: Block = {
        ...original,
        id: `block-${Date.now()}-dup`,
        isEditing: false,
        name: original.name ? `${original.name} (Copy)` : undefined,
        markdown: original.markdown,
        html: original.html
    };
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
    blocks.value.push({ id: `new-${Date.now()}`, markdown: '', html: '', isEditing: true });
    // EditorBlock will auto-focus when it renders with isEditing=true
    pushHistory();
}

const toggleMenu = (id: string | null) => {
    activeMenuBlockId.value = id;
}

</script>

<template>
    <div
        class="flex h-screen w-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-sans overflow-hidden">
        <!-- Sidebar -->
        <SideMenu @open-settings="showSettings = true" />

        <!-- Main Content (Flex Column) -->
        <div class="flex-1 flex flex-col min-w-0 relative">
            <!-- Top Bar -->
            <TopBar :filename="fileName" :is-dirty="isDirty" @save="handleSaveFile" @open="handleOpenFile" />

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
        <SettingsDialog :is-open="showSettings" @close="showSettings = false" />
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