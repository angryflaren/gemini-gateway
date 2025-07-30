// src/services/googleDrive.ts

import { Chat, ChatContent } from '../types';

const APP_DATA_FOLDER = 'GeminiGatewayStudio_Chats';
declare const gapi: any;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getAppFolderId = async (): Promise<string> => {
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
        console.error("Failed to get chat content", e);
        if (e.result && e.result.error.code === 404) {
             throw new Error(`Chat with ID ${fileId} not found.`);
        }
        const fileDetails = await gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'name'
        }).catch(() => ({ result: { name: 'Error Chat.json' }}));
        return {
            id: fileId,
            name: fileDetails.result.name.replace('.json', ''),
            conversation: []
        };
    }
};

export const renameChatFile = async (fileId: string, newName: string): Promise<void> => {
    const fileName = newName.endsWith('.json') ? newName : `${newName}.json`;
    await gapi.client.drive.files.update({
       fileId: fileId,
       resource: { name: fileName }
    });
}

export const deleteChat = async (fileId: string): Promise<void> => {
    if (!gapi?.client?.drive) {
        throw new Error("Google Drive API client is not initialized.");
    }
    const MAX_RETRIES = 3;
    let lastError: any = null;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            await gapi.client.drive.files.delete({
                fileId: fileId,
            });
            console.log(`Successfully deleted chat file ${fileId} on attempt ${i + 1}.`);
            return;
        } catch (err: any) {
            lastError = err;
            const status = err?.result?.error?.code;
            const message = err?.result?.error?.message;
            console.warn(`Attempt ${i + 1} to delete chat ${fileId} failed with status ${status}: ${message}. Retrying...`);
            if (status === 404) {
                 console.log("File not found. It might have been already deleted. Stopping retries.");
                 return;
            }
            
            await delay(1000 * Math.pow(2, i));
        }
    }
    
    console.error(`Failed to delete chat ${fileId} after ${MAX_RETRIES} attempts.`);
    const finalMessage = lastError?.result?.error?.message || "The operation timed out after multiple retries.";
    throw new Error(`Failed to delete from Google Drive: ${finalMessage}`);
};

export const saveOrUpdateChat = async (chatData: ChatContent): Promise<ChatContent> => {
    const LOCAL_CHAT_ID = "local-session";
    const folderId = await getAppFolderId();
    const conversationData = { conversation: chatData.conversation };
    const fileContent = JSON.stringify(conversationData, null, 2);
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
};