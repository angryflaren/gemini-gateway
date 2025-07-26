// src/services/googleDrive.ts

import { Chat, ChatContent } from '../types';

const APP_DATA_FOLDER = 'GeminiGatewayStudio_Chats';

declare const gapi: any;

const getAppFolderId = async (): Promise<string> => {
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
        const fileName = `${chatData.name}.json`;
        const metadata = {
            name: fileName,
            mimeType: 'application/json',
            parents: [folderId],
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));

        const response = await gapi.client.request({
            path: '/upload/drive/v3/files',
            method: 'POST',
            params: { uploadType: 'multipart', fields: 'id,name,createdTime' },
            body: form,
        });

        const newFile = response.result;
        return {
            ...chatData,
            id: newFile.id,
            name: newFile.name.replace('.json', ''),
        };
    }
};
