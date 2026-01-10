<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { generateText } from 'ai';
import { PROMPTS } from '../prompts';
import { aiService } from '../services/AiService';
import type { Tag } from '../types';
import TrashIcon from './icons/TrashIcon.vue';

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
const activeTab = ref<'general' | 'files' | 'ai' | 'theme'>('general');
// const currentDirectoryName = ref<string | null>(null); // Use prop instead

// Theme & Tags
const tags = ref<Tag[]>([
    { name: 'Explanations', color: '#60a5fa', isDefault: true },
    { name: 'Exercises', color: '#4ade80', isDefault: true },
    { name: 'Answers', color: '#f87171', isDefault: true }
]);
const newTagName = ref('');
const newTagColor = ref('#000000');

const addTag = () => {
    if (!newTagName.value) return;
    tags.value.push({
        name: newTagName.value,
        color: newTagColor.value,
        isDefault: false
    });
    newTagName.value = '';
    newTagColor.value = '#000000';
    saveTags();
};

const removeTag = (index: number) => {
    const tag = tags.value[index];
    if (!tag || tag.isDefault) return;
    tags.value.splice(index, 1);
    saveTags();
};

const saveTags = () => {
    localStorage.setItem('mathdown_tags', JSON.stringify(tags.value));
};

// AI Settings
const aiProvider = ref('openai');
const aiApiKey = ref('');
const isTestingAi = ref(false);
const aiTestResult = ref<string | null>(null);
const aiTestError = ref<string | null>(null);

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

const language = ref('English');

const saveLanguage = () => {
    localStorage.setItem('mathdown_language', language.value);
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

    if (localStorage.getItem('mathdown_language')) {
        language.value = localStorage.getItem('mathdown_language') || 'English';
    }

    if (localStorage.getItem('mathdown_ai_provider')) {
        aiProvider.value = localStorage.getItem('mathdown_ai_provider') || 'openai';
    }
    if (localStorage.getItem('mathdown_ai_api_key')) {
        aiApiKey.value = localStorage.getItem('mathdown_ai_api_key') || '';
    }

    // Load tags
    const savedTags = localStorage.getItem('mathdown_tags');
    if (savedTags) {
        try {
            tags.value = JSON.parse(savedTags);
        } catch (e) {
            console.error('Failed to parse tags', e);
        }
    }
});

const saveAiSettings = () => {
    localStorage.setItem('mathdown_ai_provider', aiProvider.value);
    localStorage.setItem('mathdown_ai_api_key', aiApiKey.value);
};

const testAiConnection = async () => {
    if (!aiApiKey.value) {
        aiTestError.value = "Please enter an API key first.";
        return;
    }

    isTestingAi.value = true;
    aiTestResult.value = null;
    aiTestError.value = null;

    try {
        const model = aiService.getModel();

        // Note: We don't check !model here because aiService throws if invalid.

        const { text } = await generateText({
            model,
            prompt: PROMPTS.TEST_JOKE,
        });

        aiTestResult.value = text;
    } catch (e: any) {
        console.error("AI Test Failed", e);
        aiTestError.value = e.message || "Failed to connect to AI provider.";
    } finally {
        isTestingAi.value = false;
    }
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
                    <button @click="activeTab = 'theme'"
                        class="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors"
                        :class="activeTab === 'theme' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'">
                        Theme & Tags
                    </button>
                </nav>
            </div>

            <!-- Content -->
            <div class="flex-1 flex flex-col min-w-0">
                <!-- Header -->
                <div class="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
                    <h3 class="text-lg font-medium text-neutral-800 dark:text-neutral-100">
                        {{ activeTab === 'general' ? 'General Settings' :
                            activeTab === 'files' ? 'Local Files' : 'AI Integration' }}
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

                        <div class="h-px bg-neutral-200 dark:bg-neutral-700"></div>

                        <div class="flex items-center justify-between">
                            <span class="text-neutral-700 dark:text-neutral-300 font-medium">Language</span>
                            <select v-model="language" @change="saveLanguage"
                                class="px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                                <option value="English">English</option>
                                <option value="French">Français</option>
                                <option value="Italiano">Italiano</option>
                                <option value="German">Deutsch</option>
                            </select>
                        </div>
                    </div>

                    <!-- Theme Tab -->
                    <div v-if="activeTab === 'theme'" class="space-y-6">
                        <!-- Dark Mode Section -->
                        <div class="flex items-center justify-between">
                            <span class="text-neutral-700 dark:text-neutral-300 font-medium">Dark Mode</span>
                            <button @click="toggleDark"
                                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                :class="isDark ? 'bg-blue-600' : 'bg-neutral-200 dark:bg-neutral-400'">
                                <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                                    :class="isDark ? 'translate-x-6' : 'translate-x-1'" />
                            </button>
                        </div>

                        <div class="h-px bg-neutral-200 dark:bg-neutral-700"></div>

                        <!-- Tags Section -->
                        <div class="space-y-4">
                            <h3
                                class="text-sm font-medium text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
                                Tags
                            </h3>

                            <div class="space-y-2">
                                <div v-for="(tag, index) in tags" :key="index"
                                    class="flex items-center justify-between p-2 rounded bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50">
                                    <div class="flex items-center gap-3">
                                        <div class="w-4 h-4 rounded-full shadow-sm"
                                            :style="{ backgroundColor: tag.color }"></div>
                                        <span class="text-sm text-neutral-700 dark:text-neutral-300">{{ tag.name
                                            }}</span>
                                    </div>
                                    <button v-if="!tag.isDefault" @click="removeTag(index)"
                                        class="p-1 text-neutral-400 hover:text-red-500 transition-colors">
                                        <TrashIcon class="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <!-- Add Tag Form -->
                            <div class="flex items-center gap-2 pt-2">
                                <input type="color" v-model="newTagColor"
                                    class="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0" />
                                <input type="text" v-model="newTagName" placeholder="New tag name"
                                    @keydown.enter="addTag"
                                    class="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-neutral-900 dark:text-neutral-100" />
                                <button @click="addTag" :disabled="!newTagName"
                                    class="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                    Add
                                </button>
                            </div>
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

                        <div class="pt-2">
                            <button @click="testAiConnection" :disabled="isTestingAi || !aiApiKey"
                                class="w-full px-4 py-2 bg-neutral-900 dark:bg-neutral-100/10 text-white dark:text-neutral-100 rounded-md shadow hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed">
                                {{ isTestingAi ? 'Testing Connection...' : 'Test Connection (Tell a joke)' }}
                            </button>
                        </div>

                        <!-- Test Result -->
                        <div v-if="aiTestResult"
                            class="p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded border border-green-200 dark:border-green-800 text-sm">
                            <strong>AI Says:</strong> {{ aiTestResult }}
                        </div>
                        <div v-if="aiTestError"
                            class="p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded border border-red-200 dark:border-red-800 text-sm">
                            <strong>Error:</strong> {{ aiTestError }}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
</template>
