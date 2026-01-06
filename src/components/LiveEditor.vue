<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import MarkdownIt from 'markdown-it';
import mkKatex from 'markdown-it-katex';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';
import type { Block } from '../types';
import EditorBlock from './editor/EditorBlock.vue';

// --- Props ---
const props = defineProps<{
    initialContent?: string;
}>();

// --- Markdown Setup ---
const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
});
md.use(mkKatex);

// --- State ---
const blocks = ref<Block[]>([]);
const activeMenuBlockId = ref<string | null>(null);

// History State
const history = ref<Block[][]>([]);
const historyIndex = ref(-1);
const isHistoryNavigating = ref(false);

// Initialize content
const rawContent = ref(props.initialContent || '# New file\n\nHello world!');

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
    }
};

// --- Logic ---
const parseBlocks = (content: string) => {
    const rawBlocks = content.split(/\n*<!-- block -->\n*/);

    return rawBlocks.map((text, index) => {
        return {
            id: `block-${index}-${Date.now()}`,
            markdown: text,
            html: DOMPurify.sanitize(md.render(text)),
            isEditing: false,
        };
    });
};

// Initial parse
blocks.value = parseBlocks(rawContent.value);
pushHistory();

// --- Actions ---
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

    block.html = DOMPurify.sanitize(md.render(block.markdown));
    block.isEditing = false;
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
    <div class="max-w-3xl mx-auto py-12 px-6 min-h-screen text-gray-800 dark:text-gray-100">
        <div class="space-y-4">
            <EditorBlock v-for="(block, index) in blocks" :key="block.id" :block="block" :index="index"
                :active-menu-block-id="activeMenuBlockId" @edit="editBlock" @save="saveBlock"
                @duplicate="duplicateBlock" @rename="promptRenameBlock" @remove="removeBlock" @menu-toggle="toggleMenu"
                @keydown="handleKeydown" @mouseleave="activeMenuBlockId = null" />

            <!-- Add New Block Area -->
            <div @click="addNextBlock"
                class="h-12 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center justify-center text-gray-400 opacity-0 hover:opacity-100 transition-all duration-200">
                <span class="text-sm">+ Add a new block</span>
            </div>
        </div>
    </div>
</template>
