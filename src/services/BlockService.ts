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
        // Regex to split by delimiters, capturing optional name
        const regex = /\n*<!--\s*block(?::\s*(.*?))?\s*-->\n*/g;
        const rawParts = content.split(regex);
        const newBlocks: Block[] = [];

        let startIndex = 0;

        if (rawParts.length > 0) {
            const firstChunk = rawParts[0];
            if (firstChunk && firstChunk.trim().length > 0) {
                newBlocks.push(this.createBlock(firstChunk, undefined, true));
            }
            startIndex = 1;
        }

        for (let i = startIndex; i < rawParts.length; i += 2) {
            const name = rawParts[i];
            if (i + 1 >= rawParts.length) break;
            const markdown = rawParts[i + 1] || '';

            newBlocks.push(this.createBlock(markdown, name ? name.trim() : undefined));
        }

        return newBlocks;
    }

    serializeBlocks(blocks: Block[]): string {
        return blocks.map(b => {
            const namePart = b.name ? `: ${b.name}` : '';
            return `<!-- block${namePart} -->\n${b.markdown}`;
        }).join('\n\n').trim();
    }

    createBlock(markdown: string, name?: string, isLegacy = false): Block {
        const id = isLegacy ? `block-legacy-${Date.now()}` : `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        return {
            id,
            markdown,
            html: this.renderHtml(markdown),
            isEditing: false,
            name
        };
    }

    renderHtml(markdown: string): string {
        return DOMPurify.sanitize(md.render(markdown), {
            ADD_TAGS: ["math", "annotation", "semantics", "mtext", "mn", "mo", "mi", "mspace", "mover", "mstyle", "msub", "msup", "msubsup", "mfrac", "msqrt", "mroot", "mtable", "mtr", "mtd", "merror", "mpadded", "mphantom", "mglyph", "maligngroup", "malignmark", "menclose", "mfenced", "mscarry", "mscarry", "msgroup", "msline", "msrow", "mstack", "mlongdiv"],
            ADD_ATTR: ['encoding', 'display', 'data-source-line']
        });
    }

    duplicateBlock(original: Block): Block {
        return {
            ...original,
            id: `block-${Date.now()}-dup-${Math.random().toString(36).substr(2, 9)}`,
            isEditing: false,
            name: original.name ? `${original.name} (Copy)` : undefined,
            markdown: original.markdown,
            html: original.html
        };
    }
}

export const blockService = new BlockService();
