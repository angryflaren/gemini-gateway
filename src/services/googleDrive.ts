import { Chat, ChatContent } from '../types';
import { config } from '../config';

const APP_DATA_FOLDER = config.storage.gdriveAppFolder;
declare const gapi: any;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
            q: `mimeType='${config.storage.gdriveFolderMimeType}' and trashed=false and name='${APP_DATA_FOLDER}'`,
            fields: 'files(id)',
        });

        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id!;
        } else {
            const fileMetadata = {
                name: APP_DATA_FOLDER,
                mimeType: config.storage.gdriveFolderMimeType,
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
            q: `'${folderId}' in parents and mimeType='${config.storage.gdriveJsonMimeType}' and trashed=false`,
            fields: 'files(id, name, createdTime)',
            orderBy: 'createdTime desc',
        });

        return response.result.files?.map((file: any) => ({
            id: file.id!,
            name: file.name!.replace(config.storage.jsonFileSuffix, ''),
            createdTime: file.createdTime!
        })) || [];
    } catch (err) {
        handleGoogleApiError(err, 'listChats');
    }
};

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
            name: fileDetails.result.name.replace(config.storage.jsonFileSuffix, ''),
            conversation: content.conversation || [] 
        };
    } catch (err: any) {
        console.error(`Failed to get content for chat ID ${fileId}:`, err);
        const status = err?.result?.error?.code;

        if (status === 401 || status === 403) {
            handleGoogleApiError(err, 'getChatContent');
        }

        let chatName = 'Error Loading Chat';
        try {
            const fileDetails = await gapi.client.drive.files.get({
                fileId: fileId,
                fields: 'name'
            });
            chatName = fileDetails.result.name.replace(config.storage.jsonFileSuffix, '');
        } catch (nameError) {
            console.error(`Could not fetch the name for the failed chat ${fileId}:`, nameError);
        }

        return {
            id: fileId,
            name: chatName,
            conversation: []
        };
    }
};

export const renameChatFile = async (fileId: string, newName: string): Promise<void> => {
    try {
        const fileName = newName.endsWith(config.storage.jsonFileSuffix) 
            ? newName 
            : `${newName}${config.storage.jsonFileSuffix}`;
            
        await gapi.client.drive.files.update({
            fileId: fileId,
            resource: { name: fileName }
        });
    } catch (err) {
        handleGoogleApiError(err, 'renameChatFile');
    }
};

export const deleteChat = async (fileId: string): Promise<void> => {
    try {
        await gapi.client.drive.files.delete({
            fileId: fileId,
        });
        console.log(`Successfully deleted chat file ${fileId}.`);
    } catch (err: any) {
        if (err?.result?.error?.code === 404) {
            console.log(`Chat file ${fileId} not found, already deleted.`);
            return;
        }

        handleGoogleApiError(err, 'deleteChat');
    }
};

export const deleteFile = async (fileId: string): Promise<void> => {
    try {
        await gapi.client.drive.files.delete({
            fileId: fileId,
        });
        console.log(`Successfully deleted file ${fileId}.`);
    } catch (err: any) {
        if (err?.result?.error?.code === 404) {
            console.log(`File ${fileId} not found, already deleted.`);
            return;
        }
        handleGoogleApiError(err, 'deleteFile');
    }
};

export const saveOrUpdateChat = async (chatData: ChatContent): Promise<ChatContent> => {
    const LOCAL_CHAT_ID = config.storage.localSessionId;
    const folderId = await getAppFolderId();
    const conversationData = { conversation: chatData.conversation };
    const fileContent = JSON.stringify(conversationData, null, 2);
    
    try {
        if (chatData.id && chatData.id !== LOCAL_CHAT_ID) {
            await gapi.client.request({
                path: `/upload/drive/v3/files/${chatData.id}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                headers: { 'Content-Type': config.storage.gdriveJsonMimeType },
                body: fileContent,
            });
            return chatData;
        } else {
            const fileMetadata = {
                name: `${chatData.name}${config.storage.jsonFileSuffix}`,
                mimeType: config.storage.gdriveJsonMimeType,
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
                headers: { 'Content-Type': config.storage.gdriveJsonMimeType },
                body: fileContent,
            });

            return {
                ...chatData,
                id: newFile.id,
                name: newFile.name.replace(config.storage.jsonFileSuffix, ''),
            };
        }
    } catch(err) {
        handleGoogleApiError(err, 'saveOrUpdateChat');
    }
};


export const uploadFile = async (file: File): Promise<{ id: string, name: string }> => {
    try {
        const folderId = await getAppFolderId();
        
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '-');
        const newName = `${timestamp}_${file.name}`;
        
        const metadata = {
            name: newName,
            parents: [folderId],
            mimeType: file.type || config.storage.defaultMimeType,
        };

        const createResponse = await gapi.client.drive.files.create({
            resource: metadata,
            fields: 'id, name',
        });

        const newFile = createResponse.result;
        if (!newFile || !newFile.id) {
            throw new Error("Google Drive API failed to create the file metadata.");
        }

        const token = gapi.client.getToken().access_token;
        const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${newFile.id}?uploadType=media`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': file.type || config.storage.defaultMimeType,
            },
            body: file,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || "Upload failed");
        }

        console.log(`Uploaded file: ${newName} (ID: ${newFile.id})`);
        return { id: newFile.id, name: newFile.name };

    } catch (err) {
        handleGoogleApiError(err, 'uploadFile');
    }
};

export const getFileWithMetadata = async (fileId: string): Promise<{ blob: Blob, name: string, size: number }> => {
    try {
        const token = gapi.client.getToken().access_token;
        if (!token) {
            throw new Error("Authentication error: No GAPI token found.");
        }

        const fileDetails = await gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'name, mimeType, size'
        });

        const name = fileDetails.result.name;
        const mimeType = fileDetails.result.mimeType;
        const size = parseInt(fileDetails.result.size, 10) || 0;

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || "Download failed");
        }

        const blob = await response.blob();
        
        console.log(`Re-fetched file: ${name} (Size: ${size} bytes)`);
        return { blob, name, size };

    } catch (err) {
        handleGoogleApiError(err, 'getFileWithMetadata');
    }
};