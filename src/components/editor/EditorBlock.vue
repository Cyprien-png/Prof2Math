<script setup lang="ts">
import { nextTick, ref, watch, onMounted } from 'vue';
import type { Block } from '../../types';
import BlockActionsMenu from './BlockActionsMenu.vue';
import { fileService } from '../../services/FileService';
import { getCaretCoordinates } from '../../utils/caret';

const props = defineProps<{
    block: Block;
    index: number;
    activeMenuBlockId: string | null;
    rootHandle: FileSystemDirectoryHandle | null;
    currentFilePath: string | null;
}>();

const emit = defineEmits<{
    (e: 'update:block', block: Block): void;
    (e: 'edit', index: number): void;
    (e: 'save', index: number): void;
    (e: 'duplicate', index: number): void;
    (e: 'rename', index: number): void;
    (e: 'remove', index: number): void;
    (e: 'menu-toggle', id: string | null): void;
    (e: 'input', event: Event): void;
    (e: 'keydown', event: KeyboardEvent, index: number): void;
    (e: 'mouseleave'): void;
    (e: 'paste', event: ClipboardEvent): void;
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const targetLine = ref<number | null>(null);
const targetClickY = ref<number | null>(null);

const onPreviewClick = (e: MouseEvent) => {
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


defineExpose({ focusTextarea });

// Watch for edit mode to focus and resize
watch(() => props.block.isEditing, (newVal) => {
    if (newVal) {
        focusTextarea();
    } else {
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

const contentRef = ref<HTMLElement | null>(null);
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
                const decodedSrc = decodeURIComponent(src);
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

watch(() => props.block.html, () => {
    if (!props.block.isEditing) {
        nextTick(renderImages);
    }
});

watch(() => props.currentFilePath, () => {
    if (!props.block.isEditing) {
        nextTick(renderImages);
    }
});

const onInput = (e: Event) => {
    // We update the local block's markdown in the parent via v-model or direct mutation reference
    // Since block is an object prop, mutating it directly is technically possible but prop-mutation is anti-pattern.
    // However, LiveEditor binds :block="block", so the object reference is shared.
    // Vue 3 reactive objects can be mutated.
    // But let's follow the contract if possible.
    // Actually, v-model on component usually expects update:modelValue.
    // Here we are just using the object reference for simplicity as refactoring step 1.
    // We will emit events for input though if needed.

    // For now, assume parent passed a reactive object that we can mutate properties on.
    // Wait, let's keep it safe. The parent's v-for loop provides the block object.

    // Just emitting input for now if parent needs to know.
    emit('input', e);
};

// Menu Logic
const menuPosition = ref<{ x: number, y: number } | undefined>(undefined);
const menuTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

const onMenuToggle = (e: MouseEvent) => {
    e.stopPropagation();

    // Toggle logic is handled by parent (id state), but we need to supply position
    if (props.activeMenuBlockId !== props.block.id) {
        // Opening
        menuPosition.value = {
            x: e.clientX - 10,
            y: e.clientY - 10
        };
        emit('menu-toggle', props.block.id);
    } else {
        // Closing
        emit('menu-toggle', null);
    }
};

const onMenuMouseEnter = () => {
    if (menuTimeout.value) {
        clearTimeout(menuTimeout.value);
        menuTimeout.value = null;
    }
};

const onMenuMouseLeave = () => {
    menuTimeout.value = setTimeout(() => {
        if (props.activeMenuBlockId === props.block.id) {
            emit('menu-toggle', null);
        }
    }, 10);
};

const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    onMenuToggle(e);
}
</script>

<template>
    <div class="relative group rounded-md transition-all duration-200"
        :class="{ 'dark:bg-neutral-50/10 bg-neutral-400/10': block.isEditing, 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50 block-hover-effect': !block.isEditing }"
        @mouseleave="emit('mouseleave')" @contextmenu="onContextMenu">

        <!-- Block Name Label -->
        <div v-if="block.name"
            class="absolute -top-3 left-0 mx-2 px-2 py-1 bg-neutral-50 dark:bg-neutral-900 text-xs font-mono text-neutral-500 select-none z-10">
            {{ block.name }}
        </div>

        <!-- Action Menu Button (Top Right) -->
        <div class="absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <BlockActionsMenu :is-open="activeMenuBlockId === block.id" :position="menuPosition" @toggle="onMenuToggle"
                @mouseenter="onMenuMouseEnter" @mouseleave="onMenuMouseLeave" @duplicate="emit('duplicate', index)"
                @rename="emit('rename', index)" @delete="emit('remove', index)" />
        </div>

        <!-- Preview Mode -->
        <div v-if="!block.isEditing" @click="onPreviewClick" ref="contentRef"
            class="prose prose-slate dark:prose-invert max-w-none cursor-text px-8 py-4 rounded min-h-[2rem] border border-neutral-200 dark:border-neutral-700"
            v-html="block.html"></div>

        <!-- Edit Mode -->
        <div v-else class="relative w-full">
            <!-- Shadow div for height calculation -->
            <div ref="shadowRef"
                class="w-full p-4 font-mono text-base border border-transparent overflow-hidden invisible pointer-events-none whitespace-pre-wrap break-words"
                aria-hidden="true">{{ block.markdown + '\n' }}</div>

            <textarea ref="textareaRef" :id="`textarea-${index}`" v-model="block.markdown" @blur="emit('save', index)"
                @input="onInput" @keydown="emit('keydown', $event, index)" @paste="emit('paste', $event)" rows="1"
                class="w-full p-4 bg-transparent font-mono text-base focus:outline-none focus:border-neutral-500 resize-none overflow-hidden block absolute top-0 left-0 h-full"
                placeholder="Empty block...">
            </textarea>
        </div>
    </div>
</template>
