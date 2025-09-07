import { ResponsePart } from '../types';

/**
 * Преобразует строку в формате Markdown в массив структурированных ResponsePart.
 * Эта версия корректно обрабатывает многострочные параграфы, списки и блоки кода.
 * @param markdown - Входная строка Markdown от модели.
 * @returns Массив объектов ResponsePart.
 */
export function parseMarkdownToParts(markdown: string): ResponsePart[] {
    if (!markdown || !markdown.trim()) {
        // Если ответ пустой, возвращаем пустой массив, чтобы не создавать пустых блоков.
        return [];
    }

    const parts: ResponsePart[] = [];
    // Регулярное выражение для разделения текста на блоки кода и всё остальное.
    // Оно захватывает блоки кода (```...```) как отдельные элементы массива.
    const blocks = markdown.split(/(```[\s\S]*?```)/g);

    for (const block of blocks) {
        if (!block.trim()) continue;

        if (block.startsWith('```')) {
            // --- Обработка блока кода ---
            const lines = block.trim().split('\n');
            // Язык указывается сразу после ```, например, ```python
            const language = lines[0].substring(3).trim() || 'text';
            const content = lines.slice(1, -1).join('\n');
            parts.push({ type: 'code', language, content });
        } else {
            // --- Обработка обычного текста (заголовки, списки, параграфы) ---
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
                    flushParagraph(); // Сначала добавляем любой накопленный текст
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
                    flushParagraph(); // Списки прерывают параграфы
                    currentList.push(line.replace(/^[-*]\s/, '').trim());
                } else if (line.trim() === '') {
                    // Пустая строка означает конец списка или параграфа
                    flushList();
                    flushParagraph();
                } else {
                    flushList(); // Обычный текст прерывает списки
                    currentParagraph.push(line);
                }
            }
            // Добавляем остатки после завершения цикла
            flushList();
            flushParagraph();
        }
    }
    return parts;
}