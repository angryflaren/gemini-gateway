// src/services/googleDrive.ts
import { Chat, ChatContent } from '../types';

const APP_DATA_FOLDER = 'GeminiGatewayStudio_Chats';

declare const gapi: any;

// Функция для получения ID папки приложения. Кэшируем результат для производительности.
const getAppFolderId = (() => {
    let folderIdPromise: Promise<string> | null = null;
    return (): Promise<string> => {
        if (folderIdPromise) {
            return folderIdPromise;
        }
        folderIdPromise = (async () => {
            try {
                const response = await gapi.client.drive.files.list({
                    q: `'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and name='${APP_DATA_FOLDER}'`,
                    spaces: 'drive',
                    fields: 'files(id)',
                });
                if (response.result.files && response.result.files.length > 0) {
                    return response.result.files[0].id!;
                } else {
                    const fileMetadata = {
                        name: APP_DATA_FOLDER,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: ['root']
                    };
                    const newFolderResponse = await gapi.client.drive.files.create({
                        resource: fileMetadata,
                        fields: 'id',
                    });
                    return newFolderResponse.result.id!;
                }
            } catch (error) {
                // Если что-то пошло не так, сбрасываем промис, чтобы попробовать снова
                folderIdPromise = null;
                throw error;
            }
        })();
        return folderIdPromise;
    };
})();

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
        const response = await gapi.client.drive.files.get({ fileId, alt: 'media' });
        const fileDetails = await gapi.client.drive.files.get({ fileId, fields: 'name' });
        const content = response.body ? JSON.parse(response.body) : { conversation: [] };
        return { 
            id: fileId, 
            name: fileDetails.result.name.replace('.json', ''),
            conversation: content.conversation || [] 
        };
    } catch (error) {
        console.error(`Failed to get content for file ${fileId}`, error);
        // В случае ошибки возвращаем пустой чат, чтобы не ломать приложение
        return { id: fileId, name: 'Error Loading Chat', conversation: [] };
    }
};

export const saveChat = async (chatData: ChatContent): Promise<string> => {
    const fileName = `${chatData.name || 'New Chat'}.json`;
    const { id, name, ...conversationData } = chatData;
    const fileContent = JSON.stringify(conversationData, null, 2);
    const blob = new Blob([fileContent], { type: 'application/json' });

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: fileName })], { type: 'application/json' }));
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
    await gapi.client.drive.files.update({
       fileId,
       resource: { name: `${newName}.json` }
    });
}

export const createNewChatFile = async (title: string): Promise<Chat> => {
    const folderId = await getAppFolderId();
    const metadata = {
        name: `${title}.json`,
        mimeType: 'application/json',
        parents: [folderId],
    };
    const initialContent = { conversation: [] };
    const blob = new Blob([JSON.stringify(initialContent, null, 2)], { type: 'application/json' });
    
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
