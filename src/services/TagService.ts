import type { Tag } from '../types';

const STORAGE_KEY = 'mathdown_tags';

export const DEFAULT_TAGS: Tag[] = [
    { name: 'Explanations', color: '#60a5fa', isDefault: true },
    { name: 'Exercises', color: '#4ade80', isDefault: true },
    { name: 'Answers', color: '#f87171', isDefault: true }
];

export const tagService = {
    getTags(): Tag[] {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse tags', e);
            }
        }
        return [...DEFAULT_TAGS];
    },

    saveTags(tags: Tag[]): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
    }
};
