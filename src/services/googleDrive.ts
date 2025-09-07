// src/services/googleDrive.ts
import { Chat, ChatContent } from '../types';

const APP_DATA_FOLDER = 'GeminiGatewayStudio_Chats';
declare const gapi: any;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Централизованный обработчик, который выбрасывает ошибку только при проблемах с аутентификацией
const handleGoogleApiError = (err: any, context: string): never => {
    console.error(`Google Drive API Error in ${context}:`, err);
    const status = err?.result?.error?.code;
    const message = err?.result?.error?.message || "An unknown error occurred.";

    if (status === 401 || status === 403) {
        throw new Error("Authentication error: The access token is expired or invalid.");
    }
    
    throw new Error(`Google Drive Error: ${message}`);
};

export const getAppFolderId = async (): Promise<string> => {
    try {
        const response = await gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${APP_DATA_FOLDER}'`,
            fields: 'files(id)',
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
    } catch (err) {
        handleGoogleApiError(err, 'getAppFolderId');
    }
};

export const listChats = async (): Promise<Chat[]> => {
    try {
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
    } catch (err) {
        handleGoogleApiError(err, 'listChats');
    }
};

// --- ИСПРАВЛЕННАЯ ЛОГИКА ЗАГРУЗКИ ЧАТА ---
export const getChatContent = async (fileId: string): Promise<ChatContent> => {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });
        
        const fileDetails = await gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'name'
        });

        const content = response.body && response.body.length > 0 
            ? JSON.parse(response.body) 
            : { conversation: [] };

        return { 
            id: fileId, 
            name: fileDetails.result.name.replace('.json', ''),
            conversation: content.conversation || [] 
        };
    } catch (err: any) {
        console.error(`Failed to get content for chat ID ${fileId}:`, err);
        const status = err?.result?.error?.code;

        // Сначала обрабатываем критическую ошибку аутентификации
        if (status === 401 || status === 403) {
            handleGoogleApiError(err, 'getChatContent'); // Это выбросит ошибку, которую поймает App.tsx
        }

        // Для всех остальных ошибок (файл не найден, поврежден, и т.д.)
        // мы вернем пустой чат, чтобы приложение не падало.
        let chatName = 'Error Loading Chat';
        try {
            // Пытаемся получить хотя бы имя чата
            const fileDetails = await gapi.client.drive.files.get({
                fileId: fileId,
                fields: 'name'
            });
            chatName = fileDetails.result.name.replace('.json', '');
        } catch (nameError) {
            console.error(`Could not fetch the name for the failed chat ${fileId}:`, nameError);
        }

        return {
            id: fileId,
            name: chatName,
            conversation: [] // Возвращаем пустую историю, но с правильным ID и именем
        };
    }
};


export const renameChatFile = async (fileId: string, newName: string): Promise<void> => {
    try {
        const fileName = newName.endsWith('.json') ? newName : `${newName}.json`;
        await gapi.client.drive.files.update({
           fileId: fileId,
           resource: { name: fileName }
        });
    } catch (err) {
        handleGoogleApiError(err, 'renameChatFile');
    }
}

export const deleteChat = async (fileId: string): Promise<void> => {
    try {
        await gapi.client.drive.files.delete({
            fileId: fileId,
        });
        console.log(`Successfully deleted chat file ${fileId}.`);
    } catch (err) {
        handleGoogleApiError(err, 'deleteChat');
    }
};

export const saveOrUpdateChat = async (chatData: ChatContent): Promise<ChatContent> => {
    const LOCAL_CHAT_ID = "local-session";
    const folderId = await getAppFolderId();
    const conversationData = { conversation: chatData.conversation };
    const fileContent = JSON.stringify(conversationData, null, 2);

    try {
        if (chatData.id && chatData.id !== LOCAL_CHAT_ID) {
            await gapi.client.request({
                path: `/upload/drive/v3/files/${chatData.id}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                headers: { 'Content-Type': 'application/json' },
                body: fileContent,
            });
            return chatData;
        } else {
            const fileMetadata = {
                name: `${chatData.name}.json`,
                mimeType: 'application/json',
                parents: [folderId],
            };
            const createResponse = await gapi.client.drive.files.create({
                resource: fileMetadata,
                fields: 'id, name',
            });
            const newFile = createResponse.result;

            if (!newFile || !newFile.id) {
                throw new Error("Google Drive API failed to create the file metadata.");
            }

            await gapi.client.request({
                path: `/upload/drive/v3/files/${newFile.id}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                headers: { 'Content-Type': 'application/json' },
                body: fileContent,
            });

            return {
                ...chatData,
                id: newFile.id,
                name: newFile.name.replace('.json', ''),
            };
        }
    } catch(err) {
        handleGoogleApiError(err, 'saveOrUpdateChat');
    }
};