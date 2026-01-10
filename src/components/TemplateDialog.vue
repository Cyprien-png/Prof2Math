<script setup lang="ts">
import { ref, computed } from 'vue';
import RobotIcon from './icons/RobotIcon.vue';

const props = defineProps<{
    isOpen: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'create', data: { filename: string; template: string; subject: string; description: string }): void;
}>();

const filename = ref('');
const template = ref('Theory');
const subject = ref('');
const description = ref('');

const isValid = computed(() => {
    return filename.value.trim() !== '' &&
        template.value !== '' &&
        subject.value.trim() !== '' &&
        description.value.trim() !== '';
});

const handleCreate = () => {
    if (!isValid.value) return;
    emit('create', {
        filename: filename.value.trim(),
        template: template.value,
        subject: subject.value.trim(),
        description: description.value.trim()
    });
    resetForm();
};

const handleClose = () => {
    emit('close');
    resetForm();
};

const resetForm = () => {
    filename.value = '';
    template.value = 'Theory';
    subject.value = '';
    description.value = '';
};
</script>

<template>
    <Teleport to="body">
        <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <!-- Backdrop -->
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="handleClose"></div>

            <!-- Dialog -->
            <div
                class="relative bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-md border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh] overflow-y-auto">
                <div class="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                        <RobotIcon class="size-5 text-blue-500" />
                        New File from Template
                    </h2>
                    <button @click="handleClose"
                        class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                            stroke="currentColor" class="size-5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div class="p-6 space-y-4">
                    <!-- Filename -->
                    <div class="space-y-1">
                        <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Filename</label>
                        <input v-model="filename" type="text" placeholder="e.g. specialized-relativity" autofocus
                            class="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm text-neutral-900 dark:text-neutral-100" />
                    </div>

                    <!-- Template Selection -->
                    <div class="space-y-1">
                        <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Template</label>
                        <select v-model="template"
                            class="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm text-neutral-900 dark:text-neutral-100">
                            <option value="Theory">Theory</option>
                            <option value="Exercises">Exercises</option>
                            <option value="Theory + exercises">Theory + exercises</option>
                        </select>
                    </div>

                    <!-- Subject -->
                    <div class="space-y-1">
                        <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Subject</label>
                        <input v-model="subject" type="text" placeholder="e.g. Physics"
                            class="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm text-neutral-900 dark:text-neutral-100" />
                    </div>

                    <!-- Description -->
                    <div class="space-y-1">
                        <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Specific
                            Description</label>
                        <textarea v-model="description" rows="4"
                            placeholder="Describe specifically what you want to cover..."
                            class="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm resize-none text-neutral-900 dark:text-neutral-100"></textarea>
                    </div>
                </div>

                <div class="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3">
                    <button @click="handleClose"
                        class="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors">
                        Cancel
                    </button>
                    <button @click="handleCreate" :disabled="!isValid"
                        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md shadow-sm transition-colors flex items-center gap-2">
                        <RobotIcon class="size-4" />
                        Create
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
