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
            b.isEditing = false; // Close others
        }
    });

    nextTick(() => {
        const textarea = document.getElementById(`textarea-${index}`);
        if (textarea) {
            textarea.focus();
            // Auto-resize
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }
    });
};

const saveBlock = (index: number) => {
    const block = blocks.value[index];
    if (!block) return;

    block.html = DOMPurify.sanitize(md.render(block.markdown));
    block.isEditing = false;
};

const updateBlockHeight = (event: Event) => {
    const target = event.target as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
};

// Handle special keys in textarea
const handleKeydown = (e: KeyboardEvent, index: number) => {
    if (e.key === 'Enter' && e.shiftKey) {
        // Normal newline, let it happen
        return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
        // Ctrl+Enter or Command+Enter to "Submit" (Close) block?
        if (e.metaKey || e.ctrlKey) {
            saveBlock(index);
            e.preventDefault();
        }
    }
};
</script>

<template>
    <div class="max-w-3xl mx-auto py-12 px-6 min-h-screen">
        <div class="space-y-2">
            <div v-for="(block, index) in blocks" :key="block.id" class="relative group min-h-[1.5rem]">
                <!-- Preview Mode -->
                <div v-if="!block.isEditing" @click="editBlock(index)"
                    class="prose prose-slate dark:prose-invert max-w-none cursor-text p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    v-html="block.html"></div>

                <!-- Edit Mode -->
                <textarea v-else :id="`textarea-${index}`" v-model="block.markdown" @blur="saveBlock(index)"
                    @input="updateBlockHeight" @keydown="handleKeydown($event, index)"
                    class="w-full p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-base border border-blue-500 rounded focus:outline-none resize-none overflow-hidden block"></textarea>
            </div>

            <!-- Empty block at the end to allow appending -->
            <div @click="() => {
                blocks.push({ id: `new-${Date.now()}`, markdown: '', html: '', isEditing: true });
                nextTick(() => editBlock(blocks.length - 1));
            }" class="h-24 cursor-text hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded flex items-center justify-center text-gray-400 opacity-0 hover:opacity-100 transition-opacity">
                Click to add new block...
            </div>
        </div>
    </div>
</template>
