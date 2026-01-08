<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const props = defineProps<{
    isOpen: boolean;
    initialName: string;
    title?: string;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'confirm', newName: string): void;
}>();

const newName = ref(props.initialName);
const inputRef = ref<HTMLInputElement | null>(null);

watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        newName.value = props.initialName;
        nextTick(() => {
            inputRef.value?.focus();
            inputRef.value?.select();
        });
    }
});

const handleConfirm = () => {
    if (!newName.value || newName.value === props.initialName) {
        emit('close');
        return;
    }
    emit('confirm', newName.value);
};

</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @keydown.esc="$emit('close')">
        <div class="bg-white dark:bg-neutral-800 rounded-lg shadow-xl w-96 p-6 border border-neutral-200 dark:border-neutral-700 transform transition-all"
            @click.stop>
            <h3 class="text-lg font-semibold mb-4 text-neutral-900 dark:text-neutral-100">
                {{ title || 'Rename' }}
            </h3>

            <input ref="inputRef" v-model="newName" type="text"
                class="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-neutral-900 dark:text-neutral-100 mb-6"
                @keydown.enter="handleConfirm" />

            <div class="flex justify-end space-x-3">
                <button @click="$emit('close')"
                    class="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors">
                    Cancel
                </button>
                <button @click="handleConfirm"
                    class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium shadow-sm">
                    Rename
                </button>
            </div>
        </div>
    </div>
</template>
