<script setup lang="ts">
import { ref } from 'vue';

import FileTree from './FileTree.vue';
import type { FileTreeNode } from '../types';

const isCollapsed = ref(true);

defineProps<{
    fileTree: FileTreeNode[];
    isRestoring?: boolean;
}>();

const emit = defineEmits<{
    (e: 'open-settings'): void;
    (e: 'open-file', handle: FileSystemFileHandle): void;
    (e: 'toggle-folder', node: FileTreeNode): void;
    (e: 'restore-access'): void;
}>();
</script>

<template>
    <div class="h-screen bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-all duration-300 relative group z-50"
        :class="isCollapsed ? 'w-16' : 'w-64'">
        <!-- Logo / Brand & Toggle -->
        <div class="h-16 flex items-center px-4 border-b border-neutral-200 dark:border-neutral-800"
            :class="isCollapsed ? 'justify-center' : 'justify-between'">

            <span v-if="!isCollapsed" class="font-bold text-xl text-blue-600 dark:text-blue-400 truncate">
                MathDown
            </span>

            <button @click="isCollapsed = !isCollapsed"
                class="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 transition-colors"
                title="Toggle Sidebar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                    stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round"
                        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
            </button>
        </div>

        <!-- Menu Items -->
        <div class="flex-1 py-4 flex flex-col gap-1 px-2 overflow-y-auto">
            <template v-if="!isCollapsed">
                <div v-if="isRestoring" class="p-4 flex flex-col items-center justify-center text-center space-y-3">
                    <p class="text-sm text-neutral-500 dark:text-neutral-400">
                        Access to your recent workspace needs to be restored.
                    </p>
                    <button @click="emit('restore-access')"
                        class="px-3 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors w-full">
                        Restore Access
                    </button>
                </div>

                <FileTree v-else v-for="node in fileTree" :key="node.name" :node="node"
                    @open-file="emit('open-file', $event)" @toggle-folder="emit('toggle-folder', $event)" />
            </template>
        </div>

        <!-- Bottom Actions -->
        <div class="p-2 border-t border-neutral-200 dark:border-neutral-800">
            <button @click="emit('open-settings')"
                class="w-full flex items-center p-2 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
                :class="isCollapsed ? 'justify-center' : 'justify-start gap-3'">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                    stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round"
                        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span v-if="!isCollapsed" class="whitespace-nowrap font-medium">Settings</span>
            </button>
        </div>
    </div>
</template>
