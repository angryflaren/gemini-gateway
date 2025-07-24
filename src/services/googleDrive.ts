// src/services/googleDrive.ts

import { Chat, ChatContent } from '../types';

const APP_DATA_FOLDER = 'GeminiGatewayStudio_Chats';

declare const gapi: any;

/**
 * Находит или создает папку приложения в корне Google Drive.
 * Эта функция - ключевой элемент для стабильной работы.
 * @returns {Promise<string>} ID папки приложения.
 */
const getAppFolderId = async (): Promise<string> => {
    // --- ИСПРАВЛЕНИЕ: Запрос был изменен для повышения надежности ---
    // Старый запрос: `name='...'` (искал по всему Drive, что приводило к ошибкам).
    // Новый, более строгий запрос ищет папку ИСКЛЮЧИТЕЛЬНО в корневой директории ('root' in parents),
    // что предотвращает использование папок-дубликатов или случайно перемещенных папок.
    // Это гарантирует, что мы всегда работаем с одной и той же папкой.
    const response = await gapi.client.drive.files.list({
        q: `'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and name='${APP_DATA_FOLDER}'`,
        spaces: 'drive', // Явно указываем область поиска
        fields: 'files(id, name)',
    });

    if (response.result.files && response.result.files.length > 0) {
        // Папка найдена в корне, возвращаем ее ID
        return response.result.files[0].id!;
    } else {
        // Папка не найдена в корне, создаем ее там же
        console.log(`Folder "${APP_DATA_FOLDER}" not found in root. Creating it...`);
        const fileMetadata = {
            name: APP_DATA_FOLDER,
            mimeType: 'application/vnd.google-apps.folder',
            // Родители не указываются, по умолчанию папка создается в корне ('My Drive')
        };
        const newFolderResponse = await gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id',
        });
        return newFolderResponse.result.id!;
    }
};

/**
 * Получает список всех чатов из папки приложения.
 * @returns {Promise<Chat[]>} Отсортированный по дате создания список чатов.
 */
export const listChats = async (): Promise<Chat[]> => {
    const folderId = await getAppFolderId();
    if (!folderId) {
        console.error("Could not get app folder ID. Cannot list chats.");
        return [];
    }
    const response = await gapi.client.drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
        fields: 'files(id, name, createdTime)',
        orderBy: 'createdTime desc',
    });
    return response.result.files?.map((file: any) => ({
        id: file.id!,
        name: file.name!.replace('.json', ''),
        createdTime: file.createdTime!
    })) || [];
};

/**
 * Получает полное содержимое чата по его ID.
 * @param {string} fileId - ID файла чата.
 * @returns {Promise<ChatContent>} Содержимое чата.
 */
export const getChatContent = async (fileId: string): Promise<ChatContent> => {
    try {
        // Запрос на получение содержимого файла
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        // Безопасный парсинг JSON. Если тело ответа пустое, возвращаем пустой диалог.
        const content = response.body ? JSON.parse(response.body) : { conversation: [] };
        
        // Отдельный запрос на получение метаданных (имени файла)
        const fileDetails = await gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'name'
        });

        return { 
            id: fileId, 
            name: fileDetails.result.name.replace('.json', ''),
            conversation: content.conversation || [] // Гарантируем, что conversation всегда является массивом
        };
    } catch (e: any) {
         // --- ИСПРАВЛЕНИЕ: Добавлена более надежная обработка ошибок ---
         // Если файл пустой (часто бывает сразу после создания), GAPI может вернуть ошибку.
         // Этот блок корректно обрабатывает такую ситуацию, возвращая пустой чат вместо падения.
        if (e.result && e.result.error.code !== 404) {
             const fileDetails = await gapi.client.drive.files.get({
                fileId: fileId,
                fields: 'name'
            });
            console.warn(`Content of chat ${fileId} might be empty. Returning empty conversation.`);
            return {
                id: fileId,
                name: fileDetails.result.name.replace('.json', ''),
                conversation: []
            };
        }
        console.error("Failed to get chat content. The file might be corrupted or inaccessible.", e);
        throw e; // Пробрасываем критические ошибки (например, 404 - не найдено)
    }
};

/**
 * Сохраняет (обновляет) существующий чат.
 * @param {ChatContent} chatData - Полные данные чата для сохранения.
 * @returns {Promise<string>} ID сохраненного чата.
 */
export const saveChat = async (chatData: ChatContent): Promise<string> => {
    if (!chatData.id) {
        throw new Error("Cannot save a chat without an ID. Use createNewChatFile first.");
    }
    
    // Исключаем лишние поля (id, name), чтобы сохранить только сам диалог.
    const { id, name, ...conversationData } = chatData;
    const fileContent = JSON.stringify(conversationData, null, 2);
    const blob = new Blob([fileContent], { type: 'application/json' });

    // Используем multipart upload для обновления и файла, и его метаданных (имени)
    const form = new FormData();
    const metadata = { name: `${chatData.name || 'Untitled Chat'}.json` };
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    await gapi.client.request({
        path: `/upload/drive/v3/files/${chatData.id}`,
        method: 'PATCH',
        params: { uploadType: 'multipart' },
        body: form,
    });

    return chatData.id;
};

/**
 * Переименовывает файл чата.
 * @param {string} fileId - ID файла.
 * @param {string} newName - Новое имя чата (без .json).
 */
export const renameChatFile = async (fileId: string, newName: string): Promise<void> => {
    const fileName = newName.endsWith('.json') ? newName : `${newName}.json`;
    await gapi.client.drive.files.update({
       fileId: fileId,
       resource: { name: fileName }
    });
}

/**
 * Создает новый пустой файл чата в папке приложения.
 * @param {string} title - Начальное название чата.
 * @returns {Promise<Chat>} Объект нового чата.
 */
export const createNewChatFile = async (title: string): Promise<Chat> => {
    const folderId = await getAppFolderId();
    const fileName = `${title}.json`;

    // Начальное содержимое для нового файла чата.
    const initialContent: Omit<ChatContent, 'id' | 'name'> = {
        conversation: [],
    };
    
    const blob = new Blob([JSON.stringify(initialContent, null, 2)], { type: 'application/json' });
    
    const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId],
    };

    // Создаем файл с помощью multipart upload, передавая и метаданные, и содержимое.
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const response = await gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart', fields: 'id, name, createdTime' },
        body: form,
    });
    
    // Возвращаем структурированный объект Chat для немедленного использования в UI.
    return {
        id: response.result.id,
        name: response.result.name.replace('.json', ''),
        createdTime: response.result.createdTime
    };
}
