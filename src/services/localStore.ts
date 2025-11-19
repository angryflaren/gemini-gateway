import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = config.storage.indexedDbName;
const STORE_NAME = config.storage.indexedDbStoreName;

interface StoredFile {
  id: string;
  name: string;
  file: File;
}

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
  });
};

export const saveLocalFile = async (file: File): Promise<{ id: string, name: string }> => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  const fileId = `${config.storage.localFilePrefix}${uuidv4()}`;
  const newName = `${file.name}`;
  
  await store.put({ id: fileId, name: newName, file: file });
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve({ id: fileId, name: newName });
    tx.onerror = () => reject(tx.error);
  });
};

export const getLocalFile = async (fileId: string): Promise<{ blob: Blob, name: string }> => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.get(fileId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      if (request.result) {
        const stored: StoredFile = request.result;
        resolve({ blob: stored.file, name: stored.name });
      } else {
        reject(new Error(`Local file not found: ${fileId}`));
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteLocalFile = async (fileId: string): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await store.delete(fileId);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const clearAllLocalFiles = async (): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await store.clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getLocalUsage = async (): Promise<number> => {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            let totalSize = 0;
            request.result.forEach((item: StoredFile) => {
                totalSize += item.file.size;
            });
            resolve(totalSize);
        };
        request.onerror = () => reject(request.error);
    });
};