<script setup lang="ts">
import { computed } from 'vue';
import type { FileTreeNode } from '../types';

const props = defineProps<{
    node: FileTreeNode;
    depth?: number;
}>();

const emit = defineEmits<{
    (e: 'open-file', handle: FileSystemFileHandle): void;
    (e: 'toggle-folder', node: FileTreeNode): void;
}>();

const currentDepth = computed(() => props.depth || 0);

const handleClick = () => {
    if (props.node.kind === 'directory') {
        emit('toggle-folder', props.node);
    } else {
        // It's a file
        emit('open-file', props.node.handle as FileSystemFileHandle);
    }
};
</script>

<template>
    <div class="select-none text-sm">
        <div @click="handleClick"
            class="flex items-center py-1 px-2 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors truncate"
            :style="{ paddingLeft: `${currentDepth * 12 + 8}px` }">

            <!-- Icon -->
            <span class="mr-2 text-neutral-400">
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
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4">
                        <path
                            d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                    </svg>
                </template>
            </span>

            <span class="truncate">{{ node.name }}</span>
        </div>

        <!-- Children -->
        <div v-if="node.kind === 'directory' && node.isOpen">
            <FileTree v-for="child in node.children" :key="child.name" :node="child" :depth="currentDepth + 1"
                @open-file="$emit('open-file', $event)" @toggle-folder="$emit('toggle-folder', $event)" />
        </div>
    </div>
</template>
