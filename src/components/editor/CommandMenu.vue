<script setup lang="ts">
import { computed } from 'vue';

interface CommandItem {
    name: string;
    description: string;
}

const props = defineProps<{
    items: CommandItem[];
    selectedIndex: number;
    position: { x: number; y: number } | undefined;
}>();

const emit = defineEmits<{
    (e: 'select', index: number): void;
}>();

const style = computed(() => {
    if (!props.position) return {};
    return {
        left: `${props.position.x}px`,
        bottom: `${window.innerHeight - props.position.y + 4}px`, // Position above the cursor
    };
});
</script>

<template>
    <Teleport to="body">
        <div v-if="position && items.length > 0"
            class="fixed z-[9999] w-64 bg-white dark:bg-neutral-800 rounded-lg shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden"
            :style="style">
            <div class="py-1 max-h-60 overflow-y-auto">
                <button v-for="(item, index) in items" :key="item.name"
                    class="w-full text-left px-3 py-2 flex items-center justify-between group transition-colors"
                    :class="{ 'bg-blue-50 dark:bg-blue-900/20': index === selectedIndex, 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50': index !== selectedIndex }"
                    @mousedown.prevent.stop="emit('select', index)">
                    <div class="flex flex-col">
                        <span class="font-mono text-sm font-medium text-neutral-900 dark:text-neutral-100"
                            :class="{ 'text-blue-600 dark:text-blue-400': index === selectedIndex }">
                            {{ item.name }}
                        </span>
                        <span class="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                            {{ item.description }}
                        </span>
                    </div>
                </button>
            </div>
        </div>
    </Teleport>
</template>
