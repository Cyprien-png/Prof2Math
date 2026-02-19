<script setup lang="ts">
defineProps<{
    folderName?: string;
}>();

defineEmits<{
    (e: 'restore'): void;
}>();
</script>

<template>
    <div class="p-4 flex flex-col items-center justify-center text-center space-y-3">
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
            <span v-if="folderName" class="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                {{ folderName }}
            </span>
            Permission needed to access this folder.
        </p>
        <button @click="$emit('restore')"
            class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors">
            Restore Access
        </button>
    </div>
</template>
