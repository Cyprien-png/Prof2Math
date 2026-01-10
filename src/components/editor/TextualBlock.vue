<script setup lang="ts">
import { nextTick, ref, watch, onMounted } from 'vue';
import type { Block } from '../../types';
import { fileService } from '../../services/FileService';
import { getCaretCoordinates } from '../../utils/caret';

import EyeIcon from '../icons/EyeIcon.vue';
import HiddenIcon from '../icons/HiddenIcon.vue';

const props = defineProps<{
    block: Block;
    index: number;
    rootHandle: FileSystemDirectoryHandle | null;
    currentFilePath: string | null;
    isSpoiler?: boolean;
    isRevealed?: boolean;
}>();

const emit = defineEmits<{
    (e: 'edit', index: number): void;
    (e: 'save', index: number): void;
    (e: 'input', event: Event): void;
    (e: 'keydown', event: KeyboardEvent, index: number): void;
    (e: 'paste', event: ClipboardEvent): void;
    (e: 'reveal'): void;
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const contentRef = ref<HTMLDivElement | null>(null);
const targetLine = ref<number | null>(null);
const targetClickY = ref<number | null>(null);

const onPreviewClick = (e: MouseEvent) => {
    if (props.isSpoiler && !props.isRevealed) {
        emit('reveal');
        return;
    }
    // Try to find the clicked element or its parent with data-source-line
    const target = e.target as HTMLElement;
    const lineEl = target.closest('[data-source-line]');

    if (lineEl) {
        const line = parseInt(lineEl.getAttribute('data-source-line') || '', 10);
        if (!isNaN(line)) {
            targetLine.value = line;
        }
    } else {
        // Clicked on a gap (margin/padding/empty line)
        // Find the closest preceding element
        if (contentRef.value) {
            const children = Array.from(contentRef.value.querySelectorAll('[data-source-line]'));
            let closestPrev: HTMLElement | null = null;
            let minDistance = Infinity; // Find closest bottom to click Y

            // We look for element visually above the click
            for (const child of children) {
                const rect = child.getBoundingClientRect();
                // Check if element is above click
                if (rect.bottom <= e.clientY) {
                    const dist = e.clientY - rect.bottom;
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestPrev = child as HTMLElement;
                    }
                }
            }

            if (closestPrev) {
                // Use the END line of the previous element as the target
                // markdown-it map is [start, end) so end index is the first line of the NEXT block (or the gap)
                const endLine = parseInt(closestPrev.getAttribute('data-source-line-end') || '', 10);
                if (!isNaN(endLine)) {
                    targetLine.value = endLine;
                }
            } else {
                // Clicked above the first element
                targetLine.value = 0;
            }
        }
    }

    targetClickY.value = e.clientY;

    emit('edit', props.index);
};

// Expose focus method
const focusTextarea = () => {
    nextTick(() => {
        if (textareaRef.value) {
            textareaRef.value.focus({ preventScroll: true });

            // Smart cursor positioning
            if (targetLine.value !== null) {
                const lines = props.block.markdown.split('\n');
                let charIndex = 0;

                // MarkdownIt lines are 0-indexed
                for (let i = 0; i < targetLine.value && i < lines.length; i++) {
                    const lineStr = lines[i];
                    if (lineStr !== undefined) {
                        charIndex += lineStr.length + 1; // +1 for newline
                    }
                }

                // Clamp to length
                if (charIndex > props.block.markdown.length) {
                    charIndex = props.block.markdown.length;
                }

                textareaRef.value.setSelectionRange(charIndex, charIndex);

                // Scroll to center logic
                // Use requestAnimationFrame to ensure layout is fully stable
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (textareaRef.value && targetClickY.value !== null) {
                            const caret = getCaretCoordinates(textareaRef.value, charIndex);
                            const rect = textareaRef.value.getBoundingClientRect();

                            // Find the scroll container (closest parent with overflow-y-auto)
                            // In LiveEditor, this is the div with class "overflow-y-auto"
                            let scrollContainer: HTMLElement | null = textareaRef.value.closest('.overflow-y-auto');
                            // Fallback to window/body if no specific container found (though in this app we know there is one)
                            const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;

                            // 1. Measure y of caret relatively to document/scroll-container top
                            // rect.top is relative to viewport. 
                            const caretBodyY = scrollTop + rect.top + caret.top;

                            // 2. We have cursor screen y saved in targetClickY.value
                            const cursorScreenY = targetClickY.value;

                            // 3. Compute difference (caret body y - cursor screen y)
                            const targetScrollY = caretBodyY - cursorScreenY;

                            // 4. Scroll to that new y
                            if (scrollContainer) {
                                scrollContainer.scrollTo({
                                    top: targetScrollY,
                                    behavior: 'auto'
                                });
                            } else {
                                window.scrollTo({
                                    top: targetScrollY,
                                    behavior: 'auto'
                                });
                            }

                            targetClickY.value = null;
                            targetLine.value = null;
                        } else if (targetLine.value !== null && textareaRef.value) {
                            // Fallback centered scroll
                            const caret = getCaretCoordinates(textareaRef.value, charIndex);
                            const rect = textareaRef.value.getBoundingClientRect();

                            let scrollContainer: HTMLElement | null = textareaRef.value.closest('.overflow-y-auto');
                            const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;

                            const absoluteCaretY = scrollTop + rect.top + caret.top;
                            const viewportHeight = scrollContainer ? scrollContainer.clientHeight : window.innerHeight;

                            const targetScrollY = absoluteCaretY - (viewportHeight / 2);

                            if (scrollContainer) {
                                scrollContainer.scrollTo({
                                    top: targetScrollY,
                                    behavior: 'smooth'
                                });
                            } else {
                                window.scrollTo({
                                    top: targetScrollY,
                                    behavior: 'smooth'
                                });
                            }
                            targetLine.value = null;
                        }
                    });
                });
            }
        }
    });
};

const objectUrls = ref<string[]>([]);
const renderImages = async () => {
    if (!contentRef.value || !props.rootHandle || !props.currentFilePath) return;

    // Cleanup old URLs
    objectUrls.value.forEach(url => URL.revokeObjectURL(url));
    objectUrls.value = [];

    const imgs = contentRef.value.querySelectorAll('img');
    for (const img of Array.from(imgs)) {
        const src = img.getAttribute('src');
        // If it's a relative path (not data:, http:, or blob:)
        if (src && !src.startsWith('data:') && !src.startsWith('http') && !src.startsWith('blob:')) {
            try {
                // Resolve path
                // Simple resolution: relative to current file's directory
                const fileDir = props.currentFilePath.substring(0, props.currentFilePath.lastIndexOf('/'));
                const decodedSrc = decodeURIComponent(src).split('?')[0] || '';
                const targetPath = fileDir ? `${fileDir}/${decodedSrc}` : decodedSrc;

                const fileHandle = await fileService.getFileHandleByPath(props.rootHandle, targetPath);
                const file = await fileHandle.getFile();
                const url = URL.createObjectURL(file);
                objectUrls.value.push(url);
                img.src = url;
            } catch (err) {
                console.error('Failed to load image:', src, err);
            }
        }
    }
};

// Watchers
watch(() => props.block.isEditing, (newVal) => {
    if (newVal) {
        focusTextarea();
    } else {
        nextTick(renderImages);
    }
});

watch(() => props.block.html, () => {
    if (!props.block.isEditing) {
        nextTick(renderImages);
    }
});

onMounted(() => {
    if (props.block.isEditing) {
        focusTextarea();
    } else {
        renderImages();
    }
});

defineExpose({ focusTextarea, contentRef });
</script>

<template>
    <!-- Preview Mode -->
    <div v-if="!block.isEditing" class="relative w-full group">
        <div @click="onPreviewClick" ref="contentRef"
            class="prose prose-slate dark:prose-invert max-w-none px-8 py-4 rounded min-h-[2rem] border border-neutral-200 dark:border-neutral-700 cursor-text"
            :class="{ 'opacity-50 blur-md select-none': isSpoiler && !isRevealed }" v-html="block.html"></div>

        <!-- Spoiler Overlay -->
        <div v-if="isSpoiler && !isRevealed"
            class="absolute group inset-0 z-10 flex items-center justify-center cursor-pointer transition-colors hover:bg-neutral-100/10"
            @click.stop="emit('reveal')">
            <EyeIcon
                class="absolute size-6 text-neutral-600 dark:text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            <HiddenIcon
                class="absolute size-6 text-neutral-600 dark:text-neutral-300 opacity-100 group-hover:opacity-0 transition-opacity" />
        </div>
    </div>

    <!-- Edit Mode -->
    <div v-else class="relative w-full">
        <!-- Shadow div for height calculation -->
        <!-- Note: shadowRef was used in logic?? No, duplicate of textarea content usually for auto-height
         But in my pasted logic form EditorBlock, I didn't see shadowRef usage in script? 
         Checking EditorBlock step 980 lines 343 "shadowRef"
         It's effectively unused in script unless I missed it.
         Ah, textarea usually is rows="1", height calculated via CSS or JS. 
         In EditorBlock template it's just there. 
         Wait, `textarea` logic in EditorBlock uses `absolute top-0 left-0 h-full` and `shadowRef` gives the height to the parent div.
         Yes, standard auto-height trick without JS resizing.
         -->
        <div ref="shadowRef"
            class="w-full p-4 font-mono text-base border border-transparent overflow-hidden invisible pointer-events-none whitespace-pre-wrap break-words"
            aria-hidden="true">{{ block.markdown + '\n' }}</div>

        <textarea ref="textareaRef" :id="`textarea-${index}`" v-model="block.markdown" @blur="emit('save', index)"
            @input="emit('input', $event)" @keydown="emit('keydown', $event, index)" @paste="emit('paste', $event)"
            rows="1"
            class="w-full p-4 bg-transparent font-mono text-base focus:outline-none focus:border-neutral-500 resize-none overflow-hidden block absolute top-0 left-0 h-full"
            placeholder="Empty block...">
        </textarea>
    </div>
</template>
