// src/services/googleDrive.ts

import { Chat, ChatContent, ConversationTurn } from '../types';

const APP_DATA_FOLDER = 'GeminiGatewayStudio_Chats';

declare const gapi: any;

// Функция getAppFolderId остается без изменений
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

// Функция listChats остается без изменений
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

// Функция getChatContent остается без изменений
export const getChatContent = async (fileId: string): Promise<ChatContent> => {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });
        
        const content = response.body && response.body.length > 0 
            ? JSON.parse(response.body) 
            : { conversation: [] };
        
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
        throw e;
    }
};

// ИСПРАВЛЕНИЕ: Функция теперь просто сохраняет или обновляет контент
export const saveChat = async (chatData: ChatContent): Promise<string> => {
    if (!chatData.id) {
        throw new Error("Cannot save a chat without an ID. Use createNewChatFile first.");
    }
    
    // Мы передаем только conversation, чтобы не хранить дублирующую информацию (id, name)
    const conversationData = { conversation: chatData.conversation };
    const fileContent = JSON.stringify(conversationData, null, 2);
    
    const blob = new Blob([fileContent], { type: 'application/json' });

    // Используем тот же надежный метод загрузки, что и для создания
    const form = new FormData();
    form.append('file', blob);

    await gapi.client.request({
        path: `/upload/drive/v3/files/${chatData.id}`,
        method: 'PATCH',
        params: { uploadType: 'multipart' },
        body: form,
    });

    return chatData.id;
};

// Функция renameChatFile остается без изменений
export const renameChatFile = async (fileId: string, newName: string): Promise<void> => {
    const fileName = newName.endsWith('.json') ? newName : `${newName}.json`;
    await gapi.client.drive.files.update({
       fileId: fileId,
       resource: { name: fileName }
    });
}

// ИСПРАВЛЕНИЕ: Функция теперь создает пустой файл в нужной папке, что более надежно
export const createNewChatFile = async (title: string): Promise<Chat> => {
    const folderId = await getAppFolderId();
    const fileName = `${title}.json`;

    const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId],
    };

    // Создаем пустой файл с метаданными
    const response = await gapi.client.drive.files.create({
        resource: metadata,
        fields: 'id, name, createdTime',
    });
    
    // Сразу же загружаем в него пустой диалог, чтобы избежать ошибок при чтении
    const initialContent: ChatContent = {
        id: response.result.id,
        name: title,
        conversation: []
    };
    await saveChat(initialContent);

    return {
        id: response.result.id,
        name: response.result.name.replace('.json', ''),
        createdTime: response.result.createdTime
    };
}
