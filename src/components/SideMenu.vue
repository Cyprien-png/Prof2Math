<script setup lang="ts">
import { ref, watch } from 'vue';

import FileTree from './FileTree.vue';
import type { FileTreeNode } from '../types';
import CogIcon from './icons/CogIcon.vue';
import vClickOutside from '../directives/click-outside';

// Messages
import NoWorkspaceFound from './messages/sidemenu/NoWorkspaceFound.vue';
import NoLocalStorage from './messages/sidemenu/NoLocalStorage.vue';

const STORAGE_KEY_COLLAPSED = 'mathdown_sidemenu_collapsed';
const storedCollapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED);
const isCollapsed = ref(storedCollapsed !== null ? storedCollapsed === 'true' : true);

watch(isCollapsed, (val) => {
    localStorage.setItem(STORAGE_KEY_COLLAPSED, String(val));
});

const props = defineProps<{
    fileTree: FileTreeNode[]; isRestoring?: boolean; activeFileHandle?: FileSystemFileHandle |
    null; rootHandle?: FileSystemDirectoryHandle | null;
}>();

import { globalDragState, globalDropTargetPath } from '../services/DragState';
import { fileService } from '../services/FileService';

// ... props ...

const emit = defineEmits<{
    (e: 'open-settings'): void; (e: 'open-file', node: FileTreeNode): void;
    (e: 'toggle-folder', node: FileTreeNode): void; (e: 'restore-access'): void; (e: 'delete-item', node:
        FileTreeNode): void; (e: 'rename-item', node: FileTreeNode): void; (e: 'duplicate-item', node: FileTreeNode):
        void; (e: 'file-moved', event: { sourcePath: string; newPath: string }): void;
    (e: 'create-file', node: FileTreeNode): void; (e: 'create-folder', node: FileTreeNode): void;
}>();

const isDragOver = ref(false);

const onDragOver = (e: DragEvent) => {
    // Only allow if dragging a file
    if (!globalDragState.value) return;

    // Check if dragging from somewhere that isn't already root handle
    // If props.rootHandle is missing, we can't move to root.
    if (!props.rootHandle) return;

    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    isDragOver.value = true;

    // Clear any specific folder target highlight from FileTree because we are targeting the "empty space" (root)
    globalDropTargetPath.value = null;
};

const onDragLeave = () => {
    isDragOver.value = false;
};

const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    isDragOver.value = false;

    if (!globalDragState.value || !props.rootHandle) return;

    const dragged = globalDragState.value;

    try {
        // Check for duplicates
        try {
            if (dragged.node.kind === 'file') {
                // @ts-ignore
                await props.rootHandle.getFileHandle(dragged.node.name, { create: false });
            } else {
                // @ts-ignore
                await props.rootHandle.getDirectoryHandle(dragged.node.name, { create: false });
            }
            // If we get here, it exists
            alert(`A ${dragged.node.kind} with the name "${dragged.node.name}" already exists in the root directory.`);
            globalDragState.value = null;
            return;
        } catch (e: any) {
            // NotFoundError means it doesn't exist, which is good.
            if (e.name !== 'NotFoundError') {
                throw e; // Rethrow real errors
            }
        }

        await fileService.moveEntry(
            dragged.parentHandle!,
            dragged.node.name,
            props.rootHandle
        );

        const sourcePath = dragged.node.path;
        const newPath = dragged.node.name; // Root path is just name

        if (sourcePath && newPath) {
            emit('file-moved', { sourcePath, newPath });
        } else {
            emit('file-moved', { sourcePath: sourcePath || '', newPath: newPath || '' });
        }
    } catch (err) {
        console.error('Failed to move to root:', err);
    }

    globalDragState.value = null;
    globalDragState.value = null;
};

// --- Root Context Menu ---
const showRootMenu = ref(false);
const rootMenuPosition = ref({ x: 0, y: 0 });

const handleRootContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!props.rootHandle) return;

    showRootMenu.value = true;
    rootMenuPosition.value = {
        x: e.clientX - 10,
        y: e.clientY - 10
    };
};

const onRootAction = (action: 'new-file' | 'new-folder') => {
    showRootMenu.value = false;
    if (!props.rootHandle) return;

    // Create a synthetic root node to pass to creating logic
    // This mocks a FileTreeNode that represents the root directory
    const rootNode: FileTreeNode = {
        name: props.rootHandle.name,
        kind: 'directory',
        path: props.rootHandle.name, // Or undefined/empty? LiveEditor uses path to find parent.
        // LiveEditor create logic: if directory, uses node.handle. 
        // path is used if resolving parent from strings.
        handle: props.rootHandle,
        isOpen: true
    };

    if (action === 'new-file') {
        emit('create-file', rootNode);
    } else {
        emit('create-folder', rootNode);
    }
};

const closeRootMenu = () => {
    showRootMenu.value = false;
};
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
                <NoWorkspaceFound v-if="isRestoring" />

                <FileTree v-else-if="fileTree && fileTree.length > 0" v-for="node in fileTree" :key="node.name"
                    :node="node" :active-file-handle="activeFileHandle" :parent-handle="rootHandle || undefined"
                    @open-file="emit('open-file', $event)" @toggle-folder="emit('toggle-folder', $event)"
                    @delete="emit('delete-item', $event)" @rename="emit('rename-item', $event)"
                    @duplicate="emit('duplicate-item', $event)" @file-moved="emit('file-moved', $event)"
                    @create-file="emit('create-file', $event)" @create-folder="emit('create-folder', $event)" />

                <NoLocalStorage v-else />

                <!-- Drop zone for root (filling remaining space) -->
                <div v-if="fileTree && fileTree.length > 0" class="flex-1 min-h-[50px] transition-colors rounded"
                    :class="{ 'bg-blue-50 dark:bg-blue-900/10 ring-inset ring-2 ring-blue-500/50': isDragOver }"
                    @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop" @contextmenu="handleRootContextMenu">
                </div>
            </template>
        </div>

        <!-- Bottom Actions -->
        <div class="p-2 border-t border-neutral-200 dark:border-neutral-800">
            <button @click="emit('open-settings')"
                class="w-full flex items-center p-2 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
                :class="isCollapsed ? 'justify-center' : 'justify-start gap-3'">
                <CogIcon class="size-6" />
                <span v-if="!isCollapsed" class="whitespace-nowrap font-medium">Settings</span>
            </button>
        </div>

        <!-- Root Context Menu -->
        <Teleport to="body">
            <div v-if="showRootMenu"
                class="fixed w-32 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg z-[9999] py-1"
                :style="{ left: `${rootMenuPosition.x}px`, top: `${rootMenuPosition.y}px` }" @click.stop
                v-click-outside="closeRootMenu" @mouseleave="closeRootMenu">

                <div class="relative group/newfile">
                    <button
                        class="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                        New File
                        <svg class="w-2.5 h-2.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <!-- Submenu -->
                    <div
                        class="absolute left-full top-0 py-1 w-40 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg hidden group-hover/newfile:block">
                        <button @click="onRootAction('new-file')"
                            class="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                            New empty file
                        </button>
                        <button
                            class="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400">
                            New file from template
                        </button>
                    </div>
                </div>
                <button @click="onRootAction('new-folder')"
                    class="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                    New Folder
                </button>
            </div>
        </Teleport>
    </div>
</template>
