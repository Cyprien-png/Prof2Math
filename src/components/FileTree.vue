<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { FileTreeNode } from '../types';
import FileIcon from './icons/FileIcon.vue';
import EllipsisIcon from './icons/EllipsisIcon.vue';
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
    (e: 'rename', node: FileTreeNode): void;
    (e: 'duplicate', node: FileTreeNode): void;
}>();

const currentDepth = computed(() => props.depth || 0);
const isActive = ref(false);
const showMenu = ref(false);
const menuRef = ref<HTMLElement | null>(null);

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

const menuPosition = ref({ x: 0, y: 0 });

const handleMenuToggle = (e: Event) => {
    e.stopPropagation();

    if (!showMenu.value) {
        // Opening
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        menuPosition.value = {
            x: rect.right - 128, // Align right (w-32 is 128px)
            y: rect.bottom + 4
        };
        showMenu.value = true;
    } else {
        // Closing
        showMenu.value = false;
    }
};

// Close menu on click outside
const closeMenu = () => {
    showMenu.value = false;
};

// Global click listener to close menu
watch(showMenu, (val) => {
    if (val) {
        setTimeout(() => {
            window.addEventListener('click', closeMenu);
        }, 0);
    } else {
        window.removeEventListener('click', closeMenu);
    }
});

const onAction = async (action: 'rename' | 'duplicate' | 'delete' | 'edit') => {
    showMenu.value = false;

    if (action === 'delete') {
        emit('delete', props.node);
        return;
    }

    if (action === 'edit') {
        emit('open-file', props.node.handle as FileSystemFileHandle);
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

const onChildAction = async (action: 'delete' | 'rename' | 'duplicate', childNode: FileTreeNode) => {
    if (action === 'delete') {
        if (!confirm(`Are you sure you want to delete "${childNode.name}"?`)) {
            return;
        }
        try {
            await fileService.deleteEntry(props.node.handle as FileSystemDirectoryHandle, childNode.name);
            const idx = props.node.children?.findIndex(c => c.name === childNode.name);
            if (idx !== undefined && idx !== -1) {
                props.node.children?.splice(idx, 1);
            }
        } catch (err) {
            console.error('Failed to delete entry:', err);
            alert('Failed to delete item.');
        }
    } else if (action === 'rename') {
        const currentName = childNode.name;
        // Strip extension for prompt if it's a file
        const editableName = childNode.kind === 'file' ? currentName.replace(/\.mthd$/, '') : currentName;

        const newNameInput = prompt('Enter new name:', editableName);
        if (!newNameInput || newNameInput === editableName) return;

        // Append extension back
        const newName = childNode.kind === 'file' ? `${newNameInput}.mthd` : newNameInput;

        try {
            await fileService.renameEntry(
                props.node.handle as FileSystemDirectoryHandle,
                childNode.name,
                newName,
                childNode.kind
            );
            // Refresh children handles
            props.node.children = await fileService.readDirectory(props.node.handle as FileSystemDirectoryHandle);
        } catch (err) {
            console.error('Failed to rename:', err);
            alert(`Failed to rename: ${err}`);
        }
    } else if (action === 'duplicate') {
        try {
            await fileService.duplicateEntry(props.node.handle as FileSystemDirectoryHandle, childNode.name);
            // Refresh children to show new file
            props.node.children = await fileService.readDirectory(props.node.handle as FileSystemDirectoryHandle);
        } catch (err) {
            console.error('Failed to duplicate:', err);
            alert(`Failed to duplicate: ${err}`);
        }
    }
};
const displayName = computed(() => {
    return props.node.kind === 'file' ? props.node.name.replace(/\.mthd$/, '') : props.node.name;
});
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

            <span class="truncate">{{ displayName }}</span>

            <!-- Actions -->
            <button @click="handleMenuToggle" ref="menuRef"
                class="ml-auto p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 opacity-0 group-hover/row:opacity-100 transition-all rounded"
                :class="{ 'opacity-100 bg-neutral-200 dark:bg-neutral-800': showMenu }" title="More actions">
                <EllipsisIcon class="size-4" />
            </button>

            <!-- Context Menu -->
            <Teleport to="body">
                <div v-if="showMenu"
                    class="fixed w-32 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg z-[9999] py-1"
                    :style="{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }" @click.stop>



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
                :active-file-handle="activeFileHandle" @open-file="$emit('open-file', $event)"
                @toggle-folder="$emit('toggle-folder', $event)" @delete="onChildAction('delete', $event)"
                @rename="onChildAction('rename', $event)" @duplicate="onChildAction('duplicate', $event)" />
        </div>
    </div>
</template>
