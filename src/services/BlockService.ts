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

            if (metadataString) {
                const trimmed = metadataString.trim();
                if (trimmed.startsWith('type=')) {
                    // e.g. type="handwriting" name="foo"
                    // Simple attribute parser
                    const typeMatch = trimmed.match(/type=["']?(\w+)["']?/);
                    if (typeMatch) {
                        const t = typeMatch[1];
                        if (t === 'handwriting') type = 'handwriting';
                    }

                    const nameMatch = trimmed.match(/name=["']?([^"']+)["']?/);
                    if (nameMatch) {
                        name = nameMatch[1];
                    }
                } else {
                    // Legacy: It's just the name
                    if (trimmed.length > 0) {
                        name = trimmed;
                    }
                }
            }

            newBlocks.push(this.createBlock(markdown, name, type));
        }

        return newBlocks;
    }

    serializeBlocks(blocks: Block[]): string {
        return blocks.map(b => {
            let metadata = '';

            if (b.type === 'handwriting') {
                // New serialization format for typed blocks
                metadata += ` type="handwriting"`;
                if (b.name) metadata += ` name="${b.name}"`;
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
            type
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
