<script setup lang="ts">
defineProps<{
    filename: string;
    isDirty: boolean;
}>();

const emit = defineEmits<{
    (e: 'save'): void;
    (e: 'open'): void;
}>();
</script>

<template>
    <div
        class="sticky top-0 z-40 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 min-h-16 flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-2 flex-1 max-w-2xl">
            <h1 class="font-medium text-gray-700 dark:text-gray-200 text-sm">
                <span>{{ filename || 'untitled' }}</span>
                <span class="text-gray-400">.mthd</span>
            </h1>
        </div>

        <div class="flex items-center gap-2">
            <!-- Open Button -->
            <button @click="emit('open')"
                class="flex items-center gap-2 px-4 py-2 pr-5 text-sm font-medium rounded-lg transition-all duration-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                    stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round"
                        d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
                </svg>
                Open
            </button>

            <!-- Save Button -->
            <button @click="emit('save')" :disabled="!isDirty"
                class="px-6 py-2 rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-2"
                :class="isDirty
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'">
                <span>Save</span>
                <span v-if="isDirty" class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            </button>
        </div>
    </div>
</template>
