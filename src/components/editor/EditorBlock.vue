<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Block, Tag } from '../../types';
import BlockActionsMenu from './BlockActionsMenu.vue';
import HandwrittenBlock from '../HandwrittenBlock.vue';
import TextualBlock from './TextualBlock.vue';

const props = defineProps<{
    block: Block;
    index: number;
    activeMenuBlockId: string | null;
    rootHandle: FileSystemDirectoryHandle | null;
    currentFilePath: string | null;
    availableTags?: Tag[];
}>();

const emit = defineEmits<{
    (e: 'update:block', block: Block): void;
    (e: 'edit', index: number): void;
    (e: 'save', index: number): void;
    (e: 'duplicate', index: number): void;
    (e: 'rename', index: number): void;
    (e: 'remove', index: number): void;
    (e: 'convert', index: number): void;
    (e: 'convertToTextual', index: number): void;
    (e: 'menu-toggle', id: string | null): void;
    (e: 'input', event: Event): void;
    (e: 'keydown', event: KeyboardEvent, index: number): void;
    (e: 'mouseleave'): void;
    (e: 'paste', event: ClipboardEvent): void;
    (e: 'toggle-spoiler', index: number): void;
    (e: 'reveal', index: number): void;
    (e: 'set-tag', tagName: string): void;
}>();

const tagColor = computed(() => {
    if (!props.block.tag || !props.availableTags) return null;
    const found = props.availableTags.find(t => t.name === props.block.tag);
    return found ? found.color : null;
});

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

// Common Refs for Expose (if needed by parent)
const textualBlockRef = ref<InstanceType<typeof TextualBlock> | null>(null);

const focusTextarea = () => {
    if (textualBlockRef.value) {
        textualBlockRef.value.focusTextarea();
    }
};

// ContentRef is complicated because it could be textual or handwritten.
// LiveEditor uses contentRef to take screenshot. We must expose the underlying content element.


const handwrittenBlockRef = ref<InstanceType<typeof HandwrittenBlock> | null>(null);

// Update expose logic
defineExpose({
    focusTextarea,
    get contentRef() {
        if (props.block.type === 'text') {
            return textualBlockRef.value?.contentRef;
        } else {
            // HandwrittenBlock now exposes contentRef (either preview or container).
            return handwrittenBlockRef.value?.contentRef;
        }
    }
});
</script>

<template>
    <div class="relative group rounded-md transition-all duration-200 border-2"
        :class="{ 'dark:bg-neutral-50/10 bg-neutral-400/10': block.isEditing, 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50 block-hover-effect': !block.isEditing }"
        :style="{ borderColor: tagColor || 'transparent' }" @mouseleave="emit('mouseleave')"
        @contextmenu="onContextMenu">

        <!-- Block Name Label -->
        <div v-if="block.name"
            class="absolute -top-3 left-0 mx-2 px-2 py-1 bg-white rounded-md dark:bg-neutral-900 text-xs font-mono text-neutral-500 select-none z-10">
            {{ block.name }}
        </div>

        <!-- Action Menu Button (Top Right) -->
        <div class="absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <BlockActionsMenu :is-open="activeMenuBlockId === block.id" :position="menuPosition"
                :block-type="block.type || 'text'" @toggle="onMenuToggle" @mouseenter="onMenuMouseEnter"
                @mouseleave="onMenuMouseLeave" @duplicate="emit('duplicate', index)" @rename="emit('rename', index)"
                @delete="emit('remove', index)" @convert="emit('convert', index)"
                @convert-to-textual="emit('convertToTextual', index)" @toggleSpoiler="emit('toggle-spoiler', index)"
                :isSpoiler="block.isSpoiler" :available-tags="availableTags" @setTag="(tag) => emit('set-tag', tag)" />
        </div>

        <template v-if="block.type === 'handwriting'">
            <HandwrittenBlock ref="handwrittenBlockRef" :block="block" :root-handle="rootHandle"
                :current-file-path="currentFilePath" @save="emit('save', index)" @cancel="emit('save', index)"
                @preview-click="emit('edit', index)" :is-spoiler="block.isSpoiler" :is-revealed="block.isRevealed"
                @reveal="emit('reveal', index)" />
        </template>
        <template v-else>
            <TextualBlock ref="textualBlockRef" :block="block" :index="index" :root-handle="rootHandle"
                :current-file-path="currentFilePath" @edit="emit('edit', index)" @save="emit('save', index)"
                @input="emit('input', $event)" @keydown="(e, idx) => emit('keydown', e, idx)"
                @paste="emit('paste', $event)" :is-spoiler="block.isSpoiler" :is-revealed="block.isRevealed"
                @reveal="emit('reveal', index)" />
        </template>
    </div>
</template>
