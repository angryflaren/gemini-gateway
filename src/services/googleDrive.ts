// src/services/googleDrive.ts

import { Chat, ChatContent } from '../types';

const APP_DATA_FOLDER = 'GeminiGatewayStudio_Chats';

declare const gapi: any;

const getAppFolderId = async (): Promise<string> => {
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
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        // **ИСПРАВЛЕНИЕ**: Если тело ответа пустое (новый файл), возвращаем пустую структуру
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
        // Если ошибка парсинга (например, 204 No Content), это тоже новый файл
        if (e.result && e.result.error.code !== 404) {
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
        console.error("Failed to get chat content", e);
        throw e; // Пробрасываем ошибку дальше, если это не ожидаемая ошибка
    }
};

export const saveChat = async (chatData: ChatContent): Promise<string> => {
    if (!chatData.id) {
        throw new Error("Cannot save a chat without an ID. Use createNewChatFile first.");
    }
    
    const fileName = `${chatData.name || 'New Chat'}.json`;
    
    // В теле файла храним только диалог
    const { id, name, ...conversationData } = chatData;
    const fileContent = JSON.stringify(conversationData, null, 2);
    
    const blob = new Blob([fileContent], { type: 'application/json' });

    // Обновляем и контент, и имя
    const form = new FormData();
    const metadata = { name: fileName };
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

export const renameChatFile = async (fileId: string, newName: string): Promise<void> => {
    const fileName = newName.endsWith('.json') ? newName : `${newName}.json`;
    await gapi.client.drive.files.update({
       fileId: fileId,
       resource: { name: fileName }
    });
}

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
