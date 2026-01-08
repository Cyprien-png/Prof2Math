<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { FileTreeNode } from '../types';
import FileIcon from './icons/FileIcon.vue';
import EllipsisIcon from './icons/EllipsisIcon.vue';
import { fileService } from '../services/FileService';
import { globalDragState, globalDropTargetPath } from '../services/DragState';

const props = defineProps<{
    node: FileTreeNode;
    depth?: number;
    activeFileHandle?: FileSystemFileHandle | null;
    parentHandle?: FileSystemDirectoryHandle;
}>();

const emit = defineEmits<{
    (e: 'open-file', node: FileTreeNode): void;
    (e: 'toggle-folder', node: FileTreeNode): void;
    (e: 'delete', node: FileTreeNode): void;
    (e: 'rename', node: FileTreeNode): void;
    (e: 'duplicate', node: FileTreeNode): void;
    (e: 'file-moved', event: { sourcePath: string; newPath: string }): void;
}>();



import { activeMenuPath } from '../services/MenuState';

// ... props ...

const currentDepth = computed(() => props.depth || 0);
const isActive = ref(false);
const showMenu = computed(() => !!props.node.path && activeMenuPath.value === props.node.path);


watch(() => [props.node, props.activeFileHandle], async () => {
    // ... existing isActive logic ... 
    if (props.node.kind === 'file' && props.activeFileHandle) {
        if (props.node.name === props.activeFileHandle.name) {
            try {
                isActive.value = await (props.node.handle as FileSystemFileHandle).isSameEntry(props.activeFileHandle);
            } catch (e) {
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
        emit('open-file', props.node);
    }
};

const menuPosition = ref({ x: 0, y: 0 });

const handleMenuToggle = (e: Event) => {
    e.stopPropagation();

    if (!showMenu.value) {
        // Opening
        const mouseEvent = e as MouseEvent;
        menuPosition.value = {
            x: mouseEvent.clientX - 10,
            y: mouseEvent.clientY - 10
        };
        activeMenuPath.value = props.node.path || null;
    } else {
        // Closing
        activeMenuPath.value = null;
    }
};



const onAction = async (action: 'rename' | 'duplicate' | 'delete' | 'edit') => {
    activeMenuPath.value = null;

    if (action === 'delete') {
        // ... existing implementation ...
        emit('delete', props.node);
        return;
    }

    if (action === 'rename') {
        emit('rename', props.node);
        return;
    }

    if (action === 'duplicate') {
        emit('duplicate', props.node);
        return;
    }
};

// onChildAction removed - events bubble up directly
const onDragStart = (e: DragEvent) => {
    e.stopPropagation();
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        globalDragState.value = { node: props.node, parentHandle: props.parentHandle };
    }
};

const isDragOver = computed(() => {
    // Highlight if:
    // 1. My path matches globalDropTargetPath (I am the target folder)
    if (props.node.kind === 'directory' && props.node.path === globalDropTargetPath.value) return true;

    // 2. My parent path matches globalDropTargetPath (I am a file in the target folder)
    if (props.node.kind === 'file' && globalDropTargetPath.value) {
        // Derive parent path
        let parentPath = '';
        if (props.node.path) {
            const lastSlash = props.node.path.lastIndexOf('/');
            if (lastSlash !== -1) {
                parentPath = props.node.path.substring(0, lastSlash);
            } else {
                parentPath = 'ROOT'; // Special handling for root? 
                // If globalDropTargetPath is null, we don't highlight. 
                // If root target is represented as empty string or specific key?
            }
        } else {
            // Node has no path? Should not happen with new logic, but if root...
            parentPath = 'ROOT';
        }

        // If global target is ROOT (e.g. empty string or special), match.
        // Our 'path' logic: root items have path="name". 
        // So parent of "name" is logically root.

        // Let's standardize root target path as "ROOT" or special string to avoid empty string ambiguity if needed.
        // But let's check how we set it.
        if (globalDropTargetPath.value === 'ROOT' && parentPath === 'ROOT') return true;
        if (parentPath === globalDropTargetPath.value) return true;
    }
    return false;
});

const checkDropValidity = () => {
    const dragged = globalDragState.value;
    if (!dragged || !dragged.parentHandle) return false;
    if (dragged.node === props.node) return false; // Self

    if (props.node.kind === 'directory') {
        // Prevent drop if dragging parent into own child (not fully checked but basic check)
        // Prevent drop if already in this folder (dragged.parentHandle === node.handle)
        if (dragged.parentHandle === props.node.handle) return false;
        return true;
    } else {
        // Properties.node is file
        // Valid if dropping into a different folder than current
        // Destination is props.parentHandle
        if (!props.parentHandle) return false;
        if (dragged.parentHandle === props.parentHandle) return false; // Sibling
        return true;
    }
};

const targetPath = computed(() => {
    if (props.node.kind === 'directory') {
        return props.node.path || 'ROOT';
    } else {
        if (props.node.path) {
            const lastSlash = props.node.path.lastIndexOf('/');
            if (lastSlash !== -1) {
                return props.node.path.substring(0, lastSlash);
            }
        }
        return 'ROOT';
    }
});

const onDragEnter = () => {
    if (checkDropValidity()) {
        globalDropTargetPath.value = targetPath.value;
    }
};

const onDragLeave = (e: DragEvent) => {
    // If we are leaving for another element that shares the same target path, don't clear.
    const related = e.relatedTarget as HTMLElement;
    if (related) {
        const closest = related.closest('[data-drop-target-path]') as HTMLElement;
        if (closest && closest.dataset.dropTargetPath === targetPath.value) {
            return;
        }
    }

    // Otherwise, if we currently own the highlight, clear it.
    if (globalDropTargetPath.value === targetPath.value) {
        globalDropTargetPath.value = null;
    }
};

const onDragOver = (e: DragEvent) => {
    // Consistently allow drop if valid
    if (checkDropValidity()) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
    }
};

const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    globalDropTargetPath.value = null; // Clear highlight on drop

    if (!checkDropValidity()) return;

    const dragged = globalDragState.value!; // Checked in validity

    const destinationHandle = props.node.kind === 'directory'
        ? props.node.handle as FileSystemDirectoryHandle
        : props.parentHandle!;

    try {
        // Check for duplicates
        try {
            if (dragged.node.kind === 'file') {
                // @ts-ignore
                await destinationHandle.getFileHandle(dragged.node.name, { create: false });
            } else {
                // @ts-ignore
                await destinationHandle.getDirectoryHandle(dragged.node.name, { create: false });
            }
            // If we get here, it exists
            alert(`A ${dragged.node.kind} with the name "${dragged.node.name}" already exists in the destination.`);
            globalDragState.value = null; // Clear state
            globalDropTargetPath.value = null;
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
            destinationHandle
        );

        // Calculate paths
        const sourcePath = dragged.node.path;

        // If dropping on directory: new path is dirPath + name
        // If dropping on file: new path is parentPath + name. 
        // ParentPath can be derived from props.node.path by removing filename? Or just props.parentHandle doesn't have path attached.
        // Wait, props.node.path exists.

        let newFolderPath = '';
        if (props.node.kind === 'directory') {
            newFolderPath = props.node.path || ''; // If root item, path might be just name? No, path is full path.
        } else {
            // Sibling file. New path is same folder path + dragged name.
            // Get folder path from target file path
            if (props.node.path) {
                const lastSlash = props.node.path.lastIndexOf('/');
                if (lastSlash !== -1) {
                    newFolderPath = props.node.path.substring(0, lastSlash);
                } else {
                    newFolderPath = ''; // Root
                }
            }
        }

        const newPath = newFolderPath ? `${newFolderPath}/${dragged.node.name}` : dragged.node.name;

        if (sourcePath && newPath) {
            emit('file-moved', { sourcePath, newPath });
        } else {
            // Fallback
            emit('file-moved', { sourcePath: sourcePath || '', newPath: newPath || '' });
        }
        // Clear state
        globalDragState.value = null;
    } catch (err) {
        console.error('Failed to move file:', err);
        alert(`Failed to move file: ${err}`);
    }
};

const handleContextMenu = (e: MouseEvent) => {
    // Prevent browser menu
    e.preventDefault();
    e.stopPropagation();

    // Position at mouse cursor (slightly offset)
    menuPosition.value = {
        x: e.clientX - 10,
        y: e.clientY - 10
    };

    // Open menu
    activeMenuPath.value = props.node.path || null;
};

const menuTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

const onMenuMouseEnter = () => {
    if (menuTimeout.value) {
        clearTimeout(menuTimeout.value);
        menuTimeout.value = null;
    }
};

const onMenuMouseLeave = () => {
    menuTimeout.value = setTimeout(() => {
        if (activeMenuPath.value === props.node.path) {
            activeMenuPath.value = null;
        }
    }, 10);
};

const displayName = computed(() => {
    return props.node.kind === 'file' ? props.node.name.replace(/\.mthd$/, '') : props.node.name;
});
</script>

<template>
    <div class="select-none text-sm font-medium rounded">
        <div @click="handleClick" @contextmenu="handleContextMenu"
            class="group/row flex items-center py-1 px-2 cursor-pointer rounded transition-colors truncate relative"
            :class="[
                isActive ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : (showMenu ? 'bg-neutral-200 dark:bg-neutral-800' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'),
                isDragOver ? 'bg-blue-200 dark:bg-blue-800 rounded-none' : ''
            ]" :style="{ paddingLeft: `${currentDepth * 12 + 8}px` }" draggable="true" @dragstart="onDragStart"
            @dragenter="onDragEnter" @dragleave="onDragLeave" @dragover="onDragOver" @drop="onDrop"
            :data-drop-target-path="targetPath">

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

            <span class="truncate">{{ displayName }}</span>

            <!-- Actions -->
            <button @click="handleMenuToggle"
                class="ml-auto p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 opacity-0 group-hover/row:opacity-100 transition-all rounded"
                :class="{ 'opacity-100 bg-neutral-200 dark:bg-neutral-800': showMenu }" title="More actions">
                <EllipsisIcon class="size-4" />
            </button>

            <!-- Context Menu -->
            <Teleport to="body">
                <div v-if="showMenu"
                    class="fixed w-32 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg z-[9999] py-1"
                    :style="{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }" @click.stop
                    @mouseenter="onMenuMouseEnter" @mouseleave="onMenuMouseLeave">



                    <button @click="onAction('rename')"
                        class="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                        Rename
                    </button>

                    <button v-if="node.kind === 'file'" @click="onAction('duplicate')"
                        class="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                        Duplicate
                    </button>

                    <div class="h-px bg-neutral-200 dark:bg-neutral-700 my-1"></div>

                    <button @click="onAction('delete')"
                        class="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400">
                        Delete
                    </button>
                </div>
            </Teleport>
        </div>

        <!-- Children -->
        <div v-if="node.kind === 'directory' && node.isOpen">
            <FileTree v-for="child in node.children" :key="child.name" :node="child" :depth="currentDepth + 1"
                :active-file-handle="activeFileHandle" :parent-handle="node.handle as FileSystemDirectoryHandle"
                @open-file="$emit('open-file', $event)" @toggle-folder="$emit('toggle-folder', $event)"
                @delete="$emit('delete', $event)" @rename="$emit('rename', $event)"
                @duplicate="$emit('duplicate', $event)" @file-moved="$emit('file-moved', $event)" />
        </div>
    </div>
</template>
