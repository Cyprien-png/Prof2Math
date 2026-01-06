<script setup lang="ts">
defineProps<{
    filename: string;
    isDirty: boolean;
}>();

const emit = defineEmits<{
    (e: 'save'): void;
}>();
</script>

<template>
    <div
        class="sticky top-0 z-40 w-full bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-3 min-h-16 flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-2 flex-1 max-w-2xl">
            <h1 class="font-medium text-neutral-700 dark:text-neutral-200 text-sm">
                <span>{{ filename || 'untitled' }}</span>
                <span class="text-neutral-400">.mthd</span>
            </h1>
        </div>

        <div class="flex items-center gap-2">
            <!-- Save Button -->
            <button @click="emit('save')" :disabled="!isDirty"
                class="px-6 py-2 rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-2"
                :class="isDirty
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'">
                <span>Save</span>
                <span v-if="isDirty" class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            </button>
        </div>
    </div>
</template>
