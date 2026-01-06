<script setup lang="ts">
defineProps<{
    isOpen: boolean;
}>();

const emit = defineEmits<{
    (e: 'toggle'): void;
    (e: 'duplicate'): void;
    (e: 'rename'): void;
    (e: 'delete'): void;
}>();
</script>

<template>
    <div class="relative">
        <button @click.stop="emit('toggle')"
            class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
            </svg>
        </button>

        <!-- Dropdown Menu -->
        <div v-if="isOpen"
            class="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg text-sm z-30">
            <button @click.stop="emit('duplicate')"
                class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                <span>Duplicate</span>
            </button>
            <button @click.stop="emit('rename')"
                class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                <span>Rename</span>
            </button>
            <button @click.stop="emit('delete')"
                class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500 hover:text-red-600 flex items-center gap-2">
                <span>Delete</span>
            </button>
        </div>
    </div>
</template>
