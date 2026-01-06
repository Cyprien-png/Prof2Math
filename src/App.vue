<script setup lang="ts">
import { ref, computed } from 'vue';
import MarkdownIt from 'markdown-it';
import mkKatex from 'markdown-it-katex';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

md.use(mkKatex);

const input = ref<string>('# Hello MathDown\n\nWrite some **Markdown** or LaTeX: $E=mc^2$\n\n$$\n\\int_0^\\infty x^2 dx\n$$');

const output = computed(() => {
  const raw = md.render(input.value);
  return DOMPurify.sanitize(raw);
});
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
    <!-- Editor Pane -->
    <div class="w-1/2 h-full border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div class="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 font-medium text-sm text-gray-500 uppercase tracking-wider">
        Editor
      </div>
      <textarea
        v-model="input"
        class="flex-1 w-full h-full p-6 resize-none focus:outline-none bg-transparent font-mono text-sm leading-relaxed"
        placeholder="Type markdown here..."
      ></textarea>
    </div>

    <!-- Preview Pane -->
    <div class="w-1/2 h-full flex flex-col">
       <div class="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 font-medium text-sm text-gray-500 uppercase tracking-wider">
        Preview
      </div>
      <div 
        class="flex-1 w-full h-full p-6 overflow-y-auto prose prose-slate dark:prose-invert max-w-none"
        v-html="output"
      ></div>
    </div>
  </div>
</template>
