// src/services/googleDrive.ts

import { Chat, ChatContent } from '../types';

const APP_DATA_FOLDER = 'GeminiGatewayStudio_Chats';

declare const gapi: any;

/**
 * Находит или создает специальную папку приложения в Google Drive.
 * @returns {Promise<string>} ID папки приложения.
 */
const getAppFolderId = async (): Promise<string> => {
    // Эта функция остается без изменений
    const response = await gapi.client.drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${APP_DATA_FOLDER}'`,
        fields: 'files(id, name)',
    });

    if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id!;
    } else {
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
    // Эта функция остается без изменений
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
    // Эта функция остается без изменений
    const response = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
    });
    // ИСПРАВЛЕНИЕ: Добавляем ID и имя в возвращаемый объект, так как они там нужны
    const content = JSON.parse(response.body);
    const fileDetails = await gapi.client.drive.files.get({
        fileId: fileId,
        fields: 'name'
    });
    return { 
        ...content, 
        id: fileId, 
        name: fileDetails.result.name.replace('.json', '') 
    };
};

/**
 * Сохраняет (обновляет существующий) чат в Google Drive.
 * @param {ChatContent} chatData Объект с данными чата.
 * @returns {Promise<string>} ID сохраненного файла.
 */
export const saveChat = async (chatData: ChatContent): Promise<string> => {
    if (!chatData.id) {
        throw new Error("Cannot save a chat without an ID. Use createNewChatFile first.");
    }
    
    // Убедимся, что у файла есть имя
    const fileName = `${chatData.name || 'New Chat'}.json`;
    
    // Убираем id и name из тела файла, чтобы не дублировать данные
    const { id, name, ...conversationData } = chatData;
    const fileContent = JSON.stringify(conversationData, null, 2);
    
    const blob = new Blob([fileContent], { type: 'application/json' });

    // Обновление контента
    await gapi.client.request({
        path: `/upload/drive/v3/files/${chatData.id}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        body: blob,
    });
    
    // Обновление имени
    await renameChatFile(chatData.id, fileName);

    return chatData.id;
};

/**
 * **НОВАЯ ФУНКЦИЯ**: Переименовывает файл чата.
 * @param {string} fileId ID файла.
 * @param {string} newName Новое имя (без .json).
 */
export const renameChatFile = async (fileId: string, newName: string): Promise<void> => {
    const fileName = newName.endsWith('.json') ? newName : `${newName}.json`;
    await gapi.client.drive.files.update({
       fileId: fileId,
       resource: { name: fileName }
    });
}

/**
 * **ИЗМЕНЕННАЯ ЛОГИКА**: Создает НОВЫЙ ПУСТОЙ файл чата в Google Drive.
 * @param {string} title Название нового чата.
 * @returns {Promise<Chat>} Объект нового чата с реальным ID.
 */
export const createNewChatFile = async (title: string): Promise<Chat> => {
    const folderId = await getAppFolderId();
    const fileName = `${title}.json`;

    const initialContent: Omit<ChatContent, 'id' | 'name'> = {
        conversation: [],
    };
    
    const blob = new Blob([JSON.stringify(initialContent, null, 2)], { type: 'application/json' });
    
    const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const response = await gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart', fields: 'id, name, createdTime' },
        body: form,
    });
    
    return {
        id: response.result.id,
        name: response.result.name.replace('.json', ''),
        createdTime: response.result.createdTime
    };
}
