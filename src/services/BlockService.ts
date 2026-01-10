import type { Block } from '../types';
import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';

// Initialize core markdown instance
// Initialize core markdown instance
const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
});

// Add line numbers plugin manually (simplified)
// Or use markdown-it-source-map if available? 
// Native markdown-it doesn't output line numbers by default in render, only in token stream.
// We need a custom render rule or plugin.
// Let's implement a simple rule injection.

const injectLineNumbers = (md: MarkdownIt) => {
    const tempRender = md.renderer.renderToken.bind(md.renderer);
    md.renderer.renderToken = (tokens, idx, options) => {
        const token = tokens[idx];
        if (token && token.map && token.level === 0) {
            token.attrPush(['data-source-line', String(token.map[0])]);
            token.attrPush(['data-source-line-end', String(token.map[1])]);
        }
        return tempRender(tokens, idx, options);
    };
};

injectLineNumbers(md);

md.use(texmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: { macros: { "\\RR": "\\mathbb{R}" } }
});

export class BlockService {
    parseBlocks(content: string): Block[] {
        // Updated regex to capture optional name AND optional type
        // Format: <!-- block: name="Foo" type="handwriting" -->
        // Or simple: <!-- block: Foo --> (legacy name only)
        // Or: <!-- blockType="handwriting" --> ? 
        // Let's stick to the existing "block: (maybe name)" format and extend it carefully.
        // Actually, the previous regex was `<!--\s*block(?::\s*(.*?))?\s*-->`
        // If we want to support attributes, we should probably parse the content inside more robustly.
        // But for backward compat with "block: Name", let's be careful.

        // Let's try to match: <!-- block:? (content) -->
        const regex = /\n*<!--\s*block(?::\s*|)(.*?)\s*-->\n*/g;
        const rawParts = content.split(regex);
        const newBlocks: Block[] = [];

        let startIndex = 0;

        if (rawParts.length > 0) {
            // First chunk before any block comment is virtually a block (usually title/intro)
            const firstChunk = rawParts[0];
            if (firstChunk && firstChunk.trim().length > 0) {
                // The very first implicit block is always text
                newBlocks.push(this.createBlock(firstChunk, undefined, 'text', true));
            }
            startIndex = 1;
        }

        for (let i = startIndex; i < rawParts.length; i += 2) {
            const metadataString = rawParts[i]; // The captured group (metadata)
            if (i + 1 >= rawParts.length) break;
            const markdown = rawParts[i + 1] || '';

            // Parse metadata
            let name: string | undefined = undefined;
            let type: 'text' | 'handwriting' = 'text';
            let isSpoiler = false;

            if (metadataString) {
                const trimmed = metadataString.trim();
                if (trimmed.startsWith('type=')) {
                    // e.g. type="handwriting" name="foo"
                    // Simple attribute parser
                    const typeMatch = trimmed.match(/type=["']?(\w+)["']?/);
                    if (typeMatch) {
                        if (typeMatch[1] === 'handwriting') type = 'handwriting';
                    }

                    const nameMatch = trimmed.match(/name=["']?([^"']+)["']?/);
                    if (nameMatch) {
                        name = nameMatch[1];
                    }

                    if (trimmed.includes('spoiler')) {
                        isSpoiler = true;
                    }
                } else {
                    // Legacy: It's just the name
                    // BUT check for spoiler flag even here? 
                    // Let's assume spoiler implies switching to attribute format or we support mixed?
                    // Safe bet: if it has attributes, use attributes.
                    if (trimmed.length > 0) {
                        // Check legacy cases
                        if (!trimmed.includes('=')) {
                            name = trimmed;
                        } else {
                            // It has equals but didn't start with type=. 
                            // Example: name="foo" spoiler
                            // Let's use a more robust regex approach if possible, but keep it simple as requested.
                            // The user's code relies on `trimmed.startsWith('type=')`? 
                            // Actually, let's just make it robust.
                            const nameMatch = trimmed.match(/name=["']?([^"']+)["']?/);
                            if (nameMatch) name = nameMatch[1];

                            if (trimmed.includes('spoiler')) isSpoiler = true;
                        }
                    }
                }
            }

            const block = this.createBlock(markdown, name, type);
            if (isSpoiler) {
                block.isSpoiler = true;
                block.isRevealed = false;
            }
            newBlocks.push(block);
        }

        return newBlocks;
    }

    serializeBlocks(blocks: Block[]): string {
        return blocks.map(b => {
            let metadata = '';

            if (b.type === 'handwriting' || b.isSpoiler) {
                // New serialization format for typed blocks OR spoilers
                if (b.type === 'handwriting') metadata += ` type="handwriting"`;
                else metadata += ` type="text"`;

                if (b.name) metadata += ` name="${b.name}"`;
                if (b.isSpoiler) metadata += ` spoiler`;

                return `<!-- block:${metadata} -->\n${b.markdown}`;
            } else {
                // Legacy / Standard Text format
                const namePart = b.name ? `: ${b.name}` : '';
                return `<!-- block${namePart} -->\n${b.markdown}`;
            }
        }).join('\n\n').trim();
    }

    createBlock(markdown: string, name?: string, type: 'text' | 'handwriting' = 'text', isLegacy = false): Block {
        const id = isLegacy ? `block-legacy-${Date.now()}` : `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        return {
            id,
            markdown,
            html: this.renderHtml(markdown),
            isEditing: false,
            name,
            type,
            isSpoiler: false, // Default false, parsed will override
            isRevealed: undefined
        };
    }

    // ... renderHtml ...

    renderHtml(markdown: string): string {
        return DOMPurify.sanitize(md.render(markdown), {
            ADD_TAGS: ["math", "annotation", "semantics", "mtext", "mn", "mo", "mi", "mspace", "mover", "mstyle", "msub", "msup", "msubsup", "mfrac", "msqrt", "mroot", "mtable", "mtr", "mtd", "merror", "mpadded", "mphantom", "mglyph", "maligngroup", "malignmark", "menclose", "mfenced", "mscarry", "mscarry", "msgroup", "msline", "msrow", "mstack", "mlongdiv"],
            ADD_ATTR: ['encoding', 'display', 'data-source-line', 'data-source-line-end']
        });
    }

    duplicateBlock(original: Block): Block {
        return {
            ...original,
            id: `block-${Date.now()}-dup-${Math.random().toString(36).substr(2, 9)}`,
            isEditing: false,
            name: original.name ? `${original.name} (Copy)` : undefined,
            markdown: original.markdown,
            html: original.html,
            type: original.type // preserve type
        };
    }

    updateBlock(block: Block, updates: Partial<Block>): void {
        Object.assign(block, updates);
        // If markdown or type is updated, re-render might be needed (though renderHtml handles content)
        // If we update content/markdown, we should ensure html is sync.
        if (updates.markdown !== undefined) {
            block.html = this.renderHtml(updates.markdown);
        }
    }
}

export const blockService = new BlockService();
