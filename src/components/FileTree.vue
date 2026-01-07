<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { FileTreeNode } from '../types';
import FileIcon from './icons/FileIcon.vue';
import TrashIcon from './icons/TrashIcon.vue';
import { fileService } from '../services/FileService';

const props = defineProps<{
    node: FileTreeNode;
    depth?: number;
    activeFileHandle?: FileSystemFileHandle | null;
}>();

const emit = defineEmits<{
    (e: 'open-file', handle: FileSystemFileHandle): void;
    (e: 'toggle-folder', node: FileTreeNode): void;
    (e: 'delete', node: FileTreeNode): void;
}>();

const currentDepth = computed(() => props.depth || 0);
const isActive = ref(false);

watch(() => [props.node, props.activeFileHandle], async () => {
    if (props.node.kind === 'file' && props.activeFileHandle) {
        if (props.node.name === props.activeFileHandle.name) {
            try {
                isActive.value = await (props.node.handle as FileSystemFileHandle).isSameEntry(props.activeFileHandle);
            } catch (e) {
                // Fallback or error (e.g. permission lost)
                isActive.value = false;
            }
        } else {
            isActive.value = false;
        }
    } else {
        isActive.value = false;
    }
}, { immediate: true });

const handleClick = () => {
    if (props.node.kind === 'directory') {
        emit('toggle-folder', props.node);
    } else {
        // It's a file
        emit('open-file', props.node.handle as FileSystemFileHandle);
    }
};

const handleDeleteClick = (e: Event) => {
    e.stopPropagation();
    emit('delete', props.node);
};

const onChildDelete = async (childNode: FileTreeNode) => {
    if (!confirm(`Are you sure you want to delete "${childNode.name}"?`)) {
        return;
    }

    try {
        await fileService.deleteEntry(props.node.handle as FileSystemDirectoryHandle, childNode.name);
        // Remove from local list
        const idx = props.node.children?.findIndex(c => c.name === childNode.name);
        if (idx !== undefined && idx !== -1) {
            props.node.children?.splice(idx, 1);
        }
    } catch (err) {
        console.error('Failed to delete entry:', err);
        alert('Failed to delete item.');
    }
};
</script>

<template>
    <div class="select-none text-sm font-medium">
        <div @click="handleClick"
            class="group/row flex items-center py-1 px-2 cursor-pointer rounded transition-colors truncate relative"
            :class="isActive ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'"
            :style="{ paddingLeft: `${currentDepth * 12 + 8}px` }">

            <!-- Icon -->
            <span class="mr-2" :class="isActive ? 'text-blue-500 dark:text-blue-400' : 'text-neutral-400'">
                <template v-if="node.kind === 'directory'">
                    <svg v-if="node.isOpen" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                        class="size-4">
                        <path fill-rule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                            clip-rule="evenodd" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                        class="size-4">
                        <path fill-rule="evenodd"
                            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                            clip-rule="evenodd" />
                    </svg>
                </template>
                <template v-else>
                    <FileIcon class="size-[1rem]" />
                </template>
            </span>

            <span class="truncate">{{ node.name }}</span>

            <!-- Actions -->
            <button @click="handleDeleteClick"
                class="ml-auto p-1 text-neutral-400 hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-all"
                title="Delete">
                <TrashIcon class="size-4" />
            </button>
        </div>

        <!-- Children -->
        <div v-if="node.kind === 'directory' && node.isOpen">
            <FileTree v-for="child in node.children" :key="child.name" :node="child" :depth="currentDepth + 1"
                :active-file-handle="activeFileHandle" @open-file="$emit('open-file', $event)"
                @toggle-folder="$emit('toggle-folder', $event)" @delete="onChildDelete" />
        </div>
    </div>
</template>
