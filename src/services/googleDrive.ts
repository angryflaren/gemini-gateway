// src/services/googleDrive.ts

import { Chat, ChatContent } from '../types';

const APP_DATA_FOLDER = 'GeminiGatewayStudio_Chats';

declare const gapi: any;

// Функция для получения ID папки приложения.
// Сначала ищет папку в корне диска, если не находит - создает ее там же.
const getAppFolderId = async (): Promise<string> => {
    const response = await gapi.client.drive.files.list({
        q: `'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and name='${APP_DATA_FOLDER}'`,
        spaces: 'drive',
        fields: 'files(id, name)',
    });

    if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id!;
    } else {
        console.log(`Folder '${APP_DATA_FOLDER}' not found, creating it.`);
        const fileMetadata = {
            name: APP_DATA_FOLDER,
            mimeType: 'application/vnd.google-apps.folder',
            parents: ['root'] // Явно указываем, что создавать в корне
        };
        const newFolderResponse = await gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id',
        });
        return newFolderResponse.result.id!;
    }
};

export const listChats = async (): Promise<Chat[]> => {
    const folderId = await getAppFolderId();
    if (!folderId) {
        throw new Error("Could not get app folder ID.");
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

export const getChatContent = async (fileId: string): Promise<ChatContent> => {
    // Эта функция остается без критических изменений
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        const content = response.body ? JSON.parse(response.body) : { conversation: [] };
        
        const fileDetails = await gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'name'
        });

        return { 
            id: fileId, 
            name: fileDetails.result.name.replace('.json', ''),
            conversation: content.conversation || [] 
        };
    } catch (e: any) {
        console.error("Failed to get chat content for fileId:", fileId, e);
        // Возвращаем пустой чат, если не удалось загрузить, чтобы не ломать UI
        const fileDetails = await gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'name'
        });
        return {
            id: fileId,
            name: fileDetails.result.name.replace('.json', ''),
            conversation: []
        };
    }
};

export const saveChat = async (chatData: ChatContent): Promise<string> => {
    if (!chatData.id) {
        throw new Error("Cannot save a chat without an ID. Use createNewChatFile first.");
    }
    
    const fileName = `${chatData.name || 'New Chat'}.json`;
    const { id, name, ...conversationData } = chatData;
    const fileContent = JSON.stringify(conversationData, null, 2);
    
    const metadata = { name: fileName, mimeType: 'application/json' };
    
    // Используем multipart upload для обновления и метаданных, и контента
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([fileContent], { type: 'application/json' }));

    await gapi.client.request({
        path: `/upload/drive/v3/files/${chatData.id}`,
        method: 'PATCH',
        params: { uploadType: 'multipart' },
        body: form,
    });

    return chatData.id;
};

export const renameChatFile = async (fileId: string, newName: string): Promise<void> => {
    const fileName = newName.endsWith('.json') ? newName : `${newName}.json`;
    await gapi.client.drive.files.update({
       fileId: fileId,
       resource: { name: fileName }
    });
}

export const createNewChatFile = async (title: string): Promise<Chat> => {
    const folderId = await getAppFolderId();
    if (!folderId) {
        throw new Error("Application folder ID is missing, cannot create chat file.");
    }
    
    const fileName = `${title}.json`;

    const initialContent = {
        conversation: [],
    };
    
    const fileMetadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId], // <--- Это самая важная строка
    };

    const response = await gapi.client.drive.files.create({
        resource: fileMetadata,
        media: {
            mimeType: 'application/json',
            body: JSON.stringify(initialContent, null, 2)
        },
        fields: 'id, name, createdTime'
    });
    
    return {
        id: response.result.id,
        name: response.result.name.replace('.json', ''),
        createdTime: response.result.createdTime
    };
}
