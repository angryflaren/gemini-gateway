// src/services/googleDrive.ts

import { Chat, ChatContent } from '../types';

const APP_DATA_FOLDER = 'GeminiGatewayStudio_Chats';

// Объявляем gapi как глобальную переменную
declare const gapi: any;

const getAppFolderId = async (): Promise<string> => {
    // ... (эта функция без изменений)
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

export const listChats = async (): Promise<Chat[]> => {
    // ... (эта функция без изменений)
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

export const getChatContent = async (fileId: string): Promise<ChatContent> => {
    const response = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
    });
    // Ответ приходит как строка в поле `body`, парсим его в JSON
    return JSON.parse(response.body) as ChatContent;
};

// **ПЕРЕРАБОТАННАЯ И УПРОЩЕННАЯ ФУНКЦИЯ**
export const saveChat = async (chatData: ChatContent): Promise<string> => {
    const folderId = await getAppFolderId();
    const fileName = `${chatData.name || 'New Chat'}.json`;

    // Данные файла, которые мы будем сохранять (контент)
    const fileContent = JSON.stringify(chatData, null, 2);
    const blob = new Blob([fileContent], { type: 'application/json' });

    // Метаданные файла (имя, тип, родительская папка)
    const metadata = {
        name: fileName,
        mimeType: 'application/json',
    };

    if (chatData.id) {
        // --- ОБНОВЛЕНИЕ СУЩЕСТВУЮЩЕГО ФАЙЛА ---
        const response = await gapi.client.request({
            path: `/upload/drive/v3/files/${chatData.id}`,
            method: 'PATCH',
            params: { uploadType: 'media' },
            body: blob,
        });
        return response.result.id;

    } else {
        // --- СОЗДАНИЕ НОВОГО ФАЙЛА ---
        metadata.parents = [folderId];
        const response = await gapi.client.drive.files.create({
            resource: metadata,
            media: {
                mimeType: 'application/json',
                body: fileContent,
            },
            fields: 'id',
        });
        return response.result.id;
    }
};


export const createNewChatFile = async (title: string): Promise<ChatContent> => {
    // ... (эта функция без изменений)
    const newChat: ChatContent = {
        id: '', // id пустой, так как файл еще не создан в Drive
        name: title,
        conversation: [],
    };
    return newChat;
}
