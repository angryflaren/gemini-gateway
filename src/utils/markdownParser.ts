import { ResponsePart } from '../types';

export function parseMarkdownToParts(markdown: string): ResponsePart[] {
    if (!markdown || !markdown.trim()) {
        return [];
    }

    const parts: ResponsePart[] = [];
    const blocks = markdown.split(/(```[\s\S]*?```)/g);

    for (const block of blocks) {
        if (!block.trim()) continue;

        if (block.startsWith('```')) {
            const lines = block.trim().split('\n');
            const language = lines[0].substring(3).trim() || 'text';
            const content = lines.slice(1, -1).join('\n');
            parts.push({ type: 'code', language, content });
        } else {
            const lines = block.trim().split('\n');
            let currentList: string[] = [];
            let currentParagraph: string[] = [];

            const flushParagraph = () => {
                if (currentParagraph.length > 0) {
                    parts.push({ type: 'text', content: currentParagraph.join('\n') });
                    currentParagraph = [];
                }
            };

            const flushList = () => {
                if (currentList.length > 0) {
                    flushParagraph();
                    parts.push({ type: 'list', items: currentList });
                    currentList = [];
                }
            };

            for (const line of lines) {
                if (line.startsWith('# ')) {
                    flushList();
                    flushParagraph();
                    parts.push({ type: 'title', content: line.substring(2).trim() });
                } else if (line.startsWith('## ')) {
                    flushList();
                    flushParagraph();
                    parts.push({ type: 'heading', content: line.substring(3).trim() });
                } else if (line.startsWith('### ')) {
                    flushList();
                    flushParagraph();
                    parts.push({ type: 'subheading', content: line.substring(4).trim() });
                } else if (line.match(/^[-*]\s/)) {
                    flushParagraph();
                    currentList.push(line.replace(/^[-*]\s/, '').trim());
                } else if (line.trim() === '') {
                    flushList();
                    flushParagraph();
                } else {
                    flushList();
                    currentParagraph.push(line);
                }
            }
            flushList();
            flushParagraph();
        }
    }
    return parts;
}