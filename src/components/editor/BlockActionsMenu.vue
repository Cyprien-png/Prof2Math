<script setup lang="ts">
import { computed } from 'vue';
import RobotIcon from '../icons/RobotIcon.vue';
import HiddenIcon from '../icons/HiddenIcon.vue';

const props = defineProps<{
    isOpen: boolean;
    position?: { x: number, y: number };
    blockType: 'text' | 'handwriting';
    isSpoiler?: boolean;
}>();

const emit = defineEmits<{
    (e: 'toggle', event: MouseEvent): void;
    (e: 'duplicate'): void;
    (e: 'rename'): void;
    (e: 'delete'): void;
    (e: 'convert'): void;
    (e: 'convertToTextual'): void;
    (e: 'toggleSpoiler'): void;
    (e: 'mouseenter'): void;
    (e: 'mouseleave'): void;
}>();

const style = computed(() => {
    if (!props.position) return {};
    return {
        left: `${props.position.x}px`,
        top: `${props.position.y}px`
    };
});
</script>

<template>
    <div class="relative">
        <button @click.stop="emit('toggle', $event)"
            class="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            :class="{ 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-200': isOpen }">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
            </svg>
        </button>

        <!-- Dropdown Menu -->
        <Teleport to="body">
            <div v-if="isOpen"
                class="fixed w-32 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg z-[9999] py-1 text-sm font-sans"
                :style="style" @click.stop @mouseenter="emit('mouseenter')" @mouseleave="emit('mouseleave')">

                <button @click.stop="emit('rename')"
                    class="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                    Rename
                </button>

                <button @click.stop="emit('duplicate')"
                    class="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                    Duplicate
                </button>

                <button v-if="blockType === 'text'" @click.stop="emit('convert')"
                    class="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                    Convert to handwriting
                </button>

                <button v-if="blockType === 'handwriting'" @click.stop="emit('convertToTextual')"
                    class="w-full flex items-center gap-1 bg-gradient-to-br from-purple-500 hover:to-purple-700 to-blue-500 text-white text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700">
                    <RobotIcon class="size-3" />
                    Convert to textual
                </button>

                <div class="h-px bg-neutral-100 dark:bg-neutral-700 my-1"></div>

                <button @click.stop="emit('toggleSpoiler')"
                    class="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 flex items-center justify-between group">
                    <span class="flex items-center gap-2">
                        <!-- Custom Checkbox -->
                        <div class="w-3 h-3 border border-neutral-400 rounded flex items-center justify-center"
                            :class="{ 'bg-neutral-800 border-neutral-800 dark:bg-neutral-200 dark:border-neutral-200': isSpoiler }">
                            <svg v-if="isSpoiler" class="w-2 h-2 text-white dark:text-neutral-900" viewBox="0 0 12 12"
                                fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2.5 6L4.5 8L9.5 3" stroke="currentColor" stroke-width="2"
                                    stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </div>
                        Spoiler
                    </span>
                    <HiddenIcon
                        class="size-3 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />
                </button>

                <div class="h-px bg-neutral-100 dark:bg-neutral-700 my-1"></div>

                <button @click.stop="emit('delete')"
                    class="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400">
                    Delete
                </button>
            </div>
        </Teleport>
    </div>
</template>