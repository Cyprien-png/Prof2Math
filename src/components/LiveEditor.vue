<script setup lang="ts">
import { ref, nextTick } from 'vue';
import MarkdownIt from 'markdown-it';
import mkKatex from 'markdown-it-katex';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';

// --- Types ---
interface Block {
    id: string;
    markdown: string;
    html: string;
    isEditing: boolean;
    name?: string; // New: Block name
}

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
const activeMenuBlockId = ref<string | null>(null); // For handling menu state

// Initialize content
const rawContent = ref(props.initialContent || '# Welcome to MathDown\n\nClick this text to edit it.\n\n$E=mc^2$ works too!');

// --- Logic ---
const parseBlocks = (content: string) => {
    const rawBlocks = content.split(/\n{2,}/);

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

// --- Actions ---
const editBlock = (index: number) => {
    blocks.value.forEach((b, i) => {
        if (i === index) {
            b.isEditing = true;
        } else {
            b.isEditing = false;
        }
    });

    nextTick(() => {
        const textarea = document.getElementById(`textarea-${index}`);
        if (textarea) {
            textarea.focus();
            resizeTextarea(textarea as HTMLTextAreaElement);
        }
    });
};

const saveBlock = (index: number) => {
    const block = blocks.value[index];
    if (!block) return;

    // Auto-remove if empty
    if (!block.markdown.trim()) {
        blocks.value.splice(index, 1);
        return;
    }

    block.html = DOMPurify.sanitize(md.render(block.markdown));
    block.isEditing = false;
};

const duplicateBlock = (index: number) => {
    const original = blocks.value[index];
    if (!original) return;

    const newBlock: Block = {
        ...original,
        id: `block-${Date.now()}-dup`, // New ID
        isEditing: false,
        name: original.name ? `${original.name} (Copy)` : undefined,
        markdown: original.markdown,
        html: original.html
    };
    blocks.value.splice(index + 1, 0, newBlock);
    activeMenuBlockId.value = null; // Close menu
};

const removeBlock = (index: number) => {
    blocks.value.splice(index, 1);
    activeMenuBlockId.value = null; // Close menu
};

const promptRenameBlock = (index: number) => {
    const block = blocks.value[index];
    if (!block) return;

    const newName = prompt('Enter block name:', block.name || '');
    if (newName !== null) {
        block.name = newName;
    }
    activeMenuBlockId.value = null;
};


const updateBlockHeight = (event: Event) => {
    const target = event.target as HTMLTextAreaElement;
    resizeTextarea(target);
};

const resizeTextarea = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
}

// Handle special keys in textarea
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
</script>

<template>
    <div class="max-w-3xl mx-auto py-12 px-6 min-h-screen text-gray-800 dark:text-gray-100">
        <div class="space-y-4">
            <div v-for="(block, index) in blocks" :key="block.id"
                class="relative group rounded-md transition-all duration-200"
                :class="{ 'ring-1 ring-blue-500/20 bg-blue-50/10': block.isEditing, 'hover:bg-gray-50 dark:hover:bg-gray-800/50 block-hover-effect': !block.isEditing }"
                @mouseleave="activeMenuBlockId = null">
                <!-- Block Name Label -->
                <div v-if="block.name"
                    class="absolute -top-3 left-2 px-2 py-0.5 text-xs font-mono text-gray-500 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded select-none z-10">
                    {{ block.name }}
                </div>

                <!-- Action Menu Button (Top Right) -->
                <div class="absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div class="relative">
                        <button @click.stop="activeMenuBlockId = activeMenuBlockId === block.id ? null : block.id"
                            class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="19" cy="12" r="1" />
                                <circle cx="5" cy="12" r="1" />
                            </svg>
                        </button>

                        <!-- Dropbox Menu -->
                        <div v-if="activeMenuBlockId === block.id"
                            class="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 text-sm z-30">
                            <button @click.stop="duplicateBlock(index)"
                                class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                                <span>Duplicate</span>
                            </button>
                            <button @click.stop="promptRenameBlock(index)"
                                class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                                <span>Name</span>
                            </button>
                            <button @click.stop="removeBlock(index)"
                                class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500 hover:text-red-600 flex items-center gap-2">
                                <span>Delete</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Preview Mode -->
                <div v-if="!block.isEditing" @click="editBlock(index)"
                    class="prose prose-slate dark:prose-invert max-w-none cursor-text p-4 rounded min-h-[2rem]"
                    v-html="block.html"></div>

                <!-- Edit Mode -->
                <textarea v-else :id="`textarea-${index}`" v-model="block.markdown" @blur="saveBlock(index)"
                    @input="updateBlockHeight" @keydown="handleKeydown($event, index)"
                    class="w-full p-4 bg-transparent font-mono text-base focus:outline-none resize-none overflow-hidden block"
                    placeholder="Empty block..."></textarea>
            </div>

            <!-- Add New Block Area -->
            <div @click="() => {
                blocks.push({ id: `new-${Date.now()}`, markdown: '', html: '', isEditing: true });
                nextTick(() => editBlock(blocks.length - 1));
            }" class="h-12 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-center justify-center text-gray-400 opacity-0 hover:opacity-100 transition-all duration-200">
                <span class="text-sm">+ Add Text</span>
            </div>
        </div>
    </div>
</template>
