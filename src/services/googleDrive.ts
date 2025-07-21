// src/services/googleDrive.ts

import { Chat, ChatContent } from '../types';

const APP_DATA_FOLDER = 'GeminiGatewayStudio_Chats';

declare const gapi: any;

/**
 * Находит или создает специальную папку приложения в Google Drive.
 * @returns {Promise<string>} ID папки приложения.
 */
const getAppFolderId = async (): Promise<string> => {
    const response = await gapi.client.drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${APP_DATA_FOLDER}'`,
        fields: 'files(id, name)',
    });

    if (response.result.files && response.result.files.length > 0) {
        // Папка найдена, возвращаем ее ID.
        return response.result.files[0].id!;
    } else {
        // Папка не найдена, создаем новую.
        const fileMetadata = {
            name: APP_DATA_FOLDER,
            mimeType: 'application/vnd.google-apps.folder',
        };
        const newFolderResponse = await gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id',
        });
        return newFolderResponse.result.id!;
    }
};

/**
 * Получает список всех файлов чатов из папки приложения.
 * @returns {Promise<Chat[]>} Массив объектов чатов.
 */
export const listChats = async (): Promise<Chat[]> => {
    const folderId = await getAppFolderId();
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
 * Загружает и парсит содержимое файла чата по его ID.
 * @param {string} fileId ID файла в Google Drive.
 * @returns {Promise<ChatContent>} Полное содержимое чата.
 */
export const getChatContent = async (fileId: string): Promise<ChatContent> => {
    const response = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
    });
    return JSON.parse(response.body) as ChatContent;
};

/**
 * Сохраняет (создает новый или обновляет существующий) чат в Google Drive.
 * @param {ChatContent} chatData Объект с данными чата.
 * @returns {Promise<string>} ID сохраненного файла.
 */
export const saveChat = async (chatData: ChatContent): Promise<string> => {
    const folderId = await getAppFolderId();
    // Убедимся, что у файла есть имя, иначе даем имя по умолчанию
    const fileName = `${chatData.name || 'New Chat'}.json`;
    const fileContent = JSON.stringify(chatData, null, 2);
    
    // Для загрузки/обновления контента файла используется Blob
    const blob = new Blob([fileContent], { type: 'application/json' });

    // Метаданные файла (имя, тип и т.д.)
    const metadata = {
        name: fileName,
        mimeType: 'application/json',
    };

    if (chatData.id) {
        // --- ОБНОВЛЕНИЕ СУЩЕСТВУЮЩЕГО ФАЙЛА ---
        // Для обновления контента файла используется специальный endpoint /upload/drive/v3/files/
        // и метод PATCH. Это стандартный способ для Google Drive API.
        const response = await gapi.client.request({
            path: `/upload/drive/v3/files/${chatData.id}`,
            method: 'PATCH',
            params: { uploadType: 'media' },
            body: blob,
        });
        // Обновляем метаданные отдельно, если имя изменилось
        await gapi.client.drive.files.update({
           fileId: chatData.id,
           resource: { name: fileName }
        });
        return response.result.id;

    } else {
        // --- СОЗДАНИЕ НОВОГО ФАЙЛА ---
        // Для создания файла с контентом используется multipart-запрос.
        // JS-клиент GAPI упрощает это с помощью `resource` для метаданных 
        // и `media` для самого контента.
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify({ ...metadata, parents: [folderId] })], { type: 'application/json' }));
        form.append('file', blob);

        const response = await gapi.client.request({
            path: '/upload/drive/v3/files',
            method: 'POST',
            params: { uploadType: 'multipart' },
            body: form,
        });
        
        return response.result.id;
    }
};

/**
 * Создает локальный объект нового чата, который еще не сохранен в Drive.
 * @param {string} title Название нового чата.
 * @returns {Promise<ChatContent>} Локальный объект чата.
 */
export const createNewChatFile = async (title: string): Promise<ChatContent> => {
    const newChat: ChatContent = {
        id: '', // id пустой, так как файл еще не создан в Drive
        name: title,
        conversation: [],
    };
    return newChat;
}
