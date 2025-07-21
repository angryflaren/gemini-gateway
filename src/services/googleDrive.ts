import { gapi } from 'gapi-script';
import { config } from '../config';
import { Chat, ChatContent, UserProfile } from '../types';
import { jwtDecode } from "jwt-decode";

const APP_DATA_FOLDER = 'GeminiGatewayStudio_Chats';

// --- Инициализация и Авторизация ---

export const initGoogleClient = (
  onSuccess: (profile: UserProfile) => void, 
  onFailure: () => void
): void => {
  const start = () => {
    gapi.client.init({
      apiKey: config.google.apiKey,
      clientId: config.google.clientId,
      scope: config.google.scope,
      discoveryDocs: config.google.discoveryDocs,
    }).then(() => {
      const authInstance = gapi.auth2.getAuthInstance();
      if (authInstance.isSignedIn.get()) {
        const googleUser = authInstance.currentUser.get();
        const profile = googleUser.getBasicProfile();
        onSuccess({
          id: profile.getId(),
          name: profile.getName(),
          email: profile.getEmail(),
          imageUrl: profile.getImageUrl(),
        });
      }
    }).catch(onFailure);
  };
  gapi.load('client:auth2', start);
};

export const handleSignIn = async (): Promise<UserProfile> => {
  const authInstance = gapi.auth2.getAuthInstance();
  const googleUser = await authInstance.signIn();
  const profile = googleUser.getBasicProfile();
  return {
    id: profile.getId(),
    name: profile.getName(),
    email: profile.getEmail(),
    imageUrl: profile.getImageUrl(),
  };
};

export const handleSignOut = async (): Promise<void> => {
  const authInstance = gapi.auth2.getAuthInstance();
  await authInstance.signOut();
};


// --- Работа с файлами чатов ---

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
  return response.result.files?.map(file => ({
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
  const fileContent = JSON.parse(response.body);
  return fileContent as ChatContent;
};

export const saveChat = async (chatData: ChatContent): Promise<string> => {
    const folderId = await getAppFolderId();
    const fileName = `${chatData.name}.json`;
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: chatData.id ? undefined : [folderId]
    };
  
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
  
    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(chatData) +
      close_delim;
  
    const request = gapi.client.request({
      path: `/upload/drive/v3/files${chatData.id ? '/' + chatData.id : ''}`,
      method: chatData.id ? 'PATCH' : 'POST',
      params: { uploadType: 'multipart' },
      headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
      body: multipartRequestBody,
    });
  
    const response = await request;
    return response.result.id!;
  };

  export const createNewChatFile = async (title: string): Promise<ChatContent> => {
    const newChat = {
        id: '', // id будет присвоен после первого сохранения
        name: title,
        conversation: [],
    };
    // Файл будет фактически создан на Google Drive только при первом сохранении
    return newChat;
  }
