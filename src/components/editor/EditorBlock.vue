<script setup lang="ts">
import { nextTick, ref, watch, onMounted } from 'vue';
import type { Block } from '../../types';
import BlockActionsMenu from './BlockActionsMenu.vue';
import { fileService } from '../../services/FileService';

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

const resizeTextarea = () => {
    const el = textareaRef.value;
    if (el) {
        el.style.height = '1px';
        el.style.height = (el.scrollHeight) + 'px';
    }
};

// Expose focus method
const focusTextarea = () => {
    nextTick(() => {
        if (textareaRef.value) {
            textareaRef.value.focus();
            resizeTextarea();
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
                const targetPath = fileDir ? `${fileDir}/${src}` : src;

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
    resizeTextarea();
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
        <div v-if="!block.isEditing" @click="emit('edit', index)" ref="contentRef"
            class="prose prose-slate dark:prose-invert max-w-none cursor-text px-8 py-4 rounded min-h-[2rem] border border-neutral-200 dark:border-neutral-700"
            v-html="block.html"></div>

        <!-- Edit Mode -->
        <textarea v-else ref="textareaRef" :id="`textarea-${index}`" v-model="block.markdown"
            @blur="emit('save', index)" @input="onInput" @keydown="emit('keydown', $event, index)"
            @paste="emit('paste', $event)" rows="1"
            class="w-full p-4 bg-transparent font-mono text-base focus:outline-none focus:border-neutral-500 resize-none overflow-hidden block"
            placeholder="Empty block...">
        </textarea>
    </div>
</template>
