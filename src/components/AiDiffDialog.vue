<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const props = defineProps<{
    isOpen: boolean;
    originalImage: string;
    aiText: string;
}>();

const emit = defineEmits<{
    (e: 'confirm', text: string): void;
    (e: 'cancel'): void;
}>();

const editedText = ref('');
const mode = ref<'preview' | 'edit'>('preview');

// Initialize markdown-it
const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
});

md.use(texmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: { macros: { "\\RR": "\\mathbb{R}" } }
});

const renderedHtml = computed(() => {
    return md.render(editedText.value);
});

watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        editedText.value = props.aiText;
        mode.value = 'preview'; // Reset to preview on open
    }
});

const handleConfirm = () => {
    emit('confirm', editedText.value);
};
</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div
            class="bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-neutral-200 dark:border-neutral-700">
            <!-- Header -->
            <div
                class="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex justify-between items-center bg-neutral-50 dark:bg-neutral-800">
                <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Review AI Conversion</h3>
                <button @click="emit('cancel')"
                    class="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-hidden flex flex-col md:flex-row">
                <!-- Left: Original Image -->
                <div
                    class="flex-1 p-4 bg-neutral-100 dark:bg-neutral-800 flex flex-col border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-700 overflow-y-auto">
                    <h4 class="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Original
                        Handwriting</h4>
                    <div class="flex-1 flex items-center justify-center min-h-[200px]">
                        <!-- Image container with checkered background for transparency -->
                        <div
                            class="relative rounded border border-neutral-300 dark:border-neutral-600 p-2 bg-white dark:bg-neutral-900 overflow-hidden">
                            <!-- Background Layer (Checkerboard) -->
                            <!-- Always Light Grid (Removed dark:invert) -->
                            <div
                                class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMCAwSDRWMHoiIGZpbGw9IiNlZWVlZWUiLz48cGF0aCBkPSZNNDAgNDhWNHoiIGZpbGw9IiNlZWVlZWUiLz48L3N2Zz4=')] opacity-100">
                            </div>

                            <!-- Image Layer -->
                            <!-- Inverts White Ink (Dark Mode Capture) to Black Ink -->
                            <img :src="originalImage" class="relative z-10 max-w-full h-auto object-contain dark:invert"
                                alt="Original Handwriting" />
                        </div>
                    </div>
                </div>

                <!-- Right: AI Text (Preview/Edit) -->
                <div class="flex-1 flex flex-col bg-white dark:bg-neutral-900 overflow-hidden">
                    <div
                        class="px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 flex justify-between items-center bg-neutral-50 dark:bg-neutral-800">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-neutral-500">AI Transcription
                        </h4>
                        <!-- View Toggle -->
                        <div class="flex bg-neutral-200 dark:bg-neutral-700 rounded p-1 text-xs">
                            <button @click="mode = 'preview'"
                                :class="mode === 'preview' ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'"
                                class="px-3 py-1 rounded transition-all font-medium">Preview</button>
                            <button @click="mode = 'edit'"
                                :class="mode === 'edit' ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'"
                                class="px-3 py-1 rounded transition-all font-medium">Source</button>
                        </div>
                    </div>

                    <div class="flex-1 overflow-y-auto p-4 relative">
                        <div v-if="mode === 'preview'" class="prose prose-slate dark:prose-invert max-w-none"
                            v-html="renderedHtml"></div>
                        <textarea v-else v-model="editedText"
                            class="w-full h-full p-4 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono text-sm resize-none focus:ring-2 focus:ring-neutral-500 focus:outline-none"
                            placeholder="AI text will appear here..."></textarea>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div
                class="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-3 bg-neutral-50 dark:bg-neutral-800">
                <button @click="emit('cancel')"
                    class="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors">
                    Discard
                </button>
                <button @click="handleConfirm"
                    class="px-4 py-2 text-sm font-medium text-white bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-md shadow-sm transition-colors flex items-center gap-2">
                    <span>Apply Replacement</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                </button>
            </div>
        </div>
    </div>
</template>
