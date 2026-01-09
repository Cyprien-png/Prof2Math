<script setup lang="ts">
import { ref, onMounted } from 'vue';

const props = defineProps<{
    isOpen: boolean;
    currentDirectory?: string | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'set-root-directory', handle: FileSystemDirectoryHandle): void;
}>();

const isDark = ref(false);
const autosaveEnabled = ref(false);
const activeTab = ref<'general' | 'files' | 'ai'>('general');
// const currentDirectoryName = ref<string | null>(null); // Use prop instead

// AI Settings
const aiProvider = ref('openai');
const aiApiKey = ref('');

const handleSelectDirectory = async () => {
    try {
        // @ts-ignore
        const handle = await window.showDirectoryPicker();
        if (handle) {
            // currentDirectoryName.value = handle.name;
            emit('set-root-directory', handle);
        }
    } catch (err: any) {
        if (err.name !== 'AbortError') {
            console.error('Failed to select directory:', err);
            alert('Failed to select directory');
        }
    }
}

const toggleDark = () => {
    isDark.value = !isDark.value;
    if (isDark.value) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }
};

const toggleAutosave = () => {
    autosaveEnabled.value = !autosaveEnabled.value;
    localStorage.setItem('mathdown_autosave', String(autosaveEnabled.value));
};

onMounted(() => {
    // initialize from localstorage or system pref
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        isDark.value = true;
        document.documentElement.classList.add('dark');
    } else {
        isDark.value = false;
        document.documentElement.classList.remove('dark');
    }

    if (localStorage.getItem('mathdown_autosave') === 'true') {
        autosaveEnabled.value = true;
    }

    if (localStorage.getItem('mathdown_ai_provider')) {
        aiProvider.value = localStorage.getItem('mathdown_ai_provider') || 'openai';
    }
    if (localStorage.getItem('mathdown_ai_api_key')) {
        aiApiKey.value = localStorage.getItem('mathdown_ai_api_key') || '';
    }
});

const saveAiSettings = () => {
    localStorage.setItem('mathdown_ai_provider', aiProvider.value);
    localStorage.setItem('mathdown_ai_api_key', aiApiKey.value);
};
</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>

        <!-- Dialog -->
        <div
            class="relative bg-white dark:bg-neutral-800 rounded-lg shadow-xl w-full max-w-2xl h-[500px] flex overflow-hidden border border-neutral-200 dark:border-neutral-700">

            <!-- Sidebar -->
            <div class="w-48 bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700 p-4">
                <h2 class="text-lg font-bold text-neutral-800 dark:text-neutral-100 mb-4">Settings</h2>
                <nav class="space-y-1">
                    <button @click="activeTab = 'general'"
                        class="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors"
                        :class="activeTab === 'general' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'">
                        General
                    </button>
                    <button @click="activeTab = 'files'"
                        class="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors"
                        :class="activeTab === 'files' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'">
                        Local Files
                    </button>
                    <button @click="activeTab = 'ai'"
                        class="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors"
                        :class="activeTab === 'ai' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'">
                        AI Integration
                    </button>
                </nav>
            </div>

            <!-- Content -->
            <div class="flex-1 flex flex-col min-w-0">
                <!-- Header -->
                <div class="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
                    <h3 class="text-lg font-medium text-neutral-800 dark:text-neutral-100">
                        {{ activeTab === 'general' ? 'General Settings' : activeTab === 'files' ? 'Local Files' : 'AI
                        Integration' }}
                    </h3>
                    <button @click="emit('close')"
                        class="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                            stroke="currentColor" class="size-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Scrollable Content -->
                <div class="flex-1 overflow-y-auto p-6 space-y-6">

                    <!-- General Tab -->
                    <div v-if="activeTab === 'general'" class="space-y-4">
                        <div class="flex items-center justify-between">
                            <span class="text-neutral-700 dark:text-neutral-300 font-medium">Dark Mode</span>
                            <button @click="toggleDark"
                                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                :class="isDark ? 'bg-blue-600' : 'bg-neutral-200 dark:bg-neutral-400'">
                                <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                                    :class="isDark ? 'translate-x-6' : 'translate-x-1'" />
                            </button>
                        </div>

                        <div class="flex items-center justify-between">
                            <div class="flex flex-col">
                                <span class="text-neutral-700 dark:text-neutral-300 font-medium">Autosave</span>
                            </div>
                            <button @click="toggleAutosave"
                                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                :class="autosaveEnabled ? 'bg-blue-600' : 'bg-neutral-200 dark:bg-neutral-400'">
                                <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                                    :class="autosaveEnabled ? 'translate-x-6' : 'translate-x-1'" />
                            </button>
                        </div>
                    </div>

                    <!-- Files Tab -->
                    <div v-if="activeTab === 'files'" class="space-y-4">
                        <p class="text-sm text-neutral-500 dark:text-neutral-400">
                            Select a local directory to manage your markdown files directly from the sidebar.
                        </p>

                        <button @click="handleSelectDirectory"
                            class="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-900 dark:text-neutral-100 rounded-md font-medium transition-colors flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                                stroke="currentColor" class="size-5">
                                <path stroke-linecap="round" stroke-linejoin="round"
                                    d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                            </svg>
                            Select Working Directory
                        </button>

                        <p v-if="currentDirectory" class="text-sm text-green-600 dark:text-green-400">
                            Current: <span class="font-mono bg-neutral-100 dark:bg-neutral-900 px-1 rounded">{{
                                currentDirectory }}</span>
                        </p>
                    </div>

                    <!-- AI Tab -->
                    <div v-if="activeTab === 'ai'" class="space-y-4">
                        <div class="space-y-2">
                            <label
                                class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Provider</label>
                            <select v-model="aiProvider" @change="saveAiSettings"
                                class="w-full px-3 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-neutral-900 dark:text-neutral-100">
                                <option value="openai">OpenAI (ChatGPT)</option>
                                <option value="google">Google (Gemini)</option>
                                <option value="anthropic">Anthropic (Claude)</option>
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">API
                                Key</label>
                            <input type="password" v-model="aiApiKey" @input="saveAiSettings" placeholder="sk-..."
                                class="w-full px-3 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500" />
                            <p class="text-xs text-neutral-500 dark:text-neutral-400">
                                Your API key is stored locally in your browser and never sent to our servers.
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
</template>
