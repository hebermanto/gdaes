class StorageService {
    constructor() {
        this.dbName = 'gdaesDB';
        this.dbVersion = 1;
        this.storeName = 'lists';
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('Database error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('backups')) {
                    db.createObjectStore('backups', { autoIncrement: true });
                }
            };
        });
    }

    async saveData(data) {
        try {
            await this.init();
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);

                const request = store.put({
                    id: 'mainData',
                    data: data,
                    timestamp: new Date().toISOString()
                });

                request.onsuccess = () => {
                    chrome.storage.local.set({ gdaesData: data }, () => {
                        resolve();
                    });
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error saving data:', error);
            return new Promise((resolve) => {
                chrome.storage.local.set({ gdaesData: data }, resolve);
            });
        }
    }

    async getData() {
        try {
            await this.init();
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get('mainData');

                request.onsuccess = () => {
                    if (request.result) {
                        resolve(this.migrateData(request.result.data));
                    } else {
                        chrome.storage.local.get(['gdaesData', 'tabLists'], (result) => {
                            if (result.gdaesData) {
                                resolve(this.migrateData(result.gdaesData));
                            } else if (result.tabLists) {
                                resolve(this.migrateData({ lists: result.tabLists }));
                            } else {
                                resolve({
                                    lists: {
                                        "Leitura Posterior": [],
                                        "Projetos": []
                                    },
                                    listOrder: ["Leitura Posterior", "Projetos"]
                                });
                            }
                        });
                    }
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error getting data:', error);
            return new Promise((resolve) => {
                chrome.storage.local.get(['gdaesData', 'tabLists'], (result) => {
                    if (result.gdaesData) {
                        resolve(this.migrateData(result.gdaesData));
                    } else if (result.tabLists) {
                        resolve(this.migrateData({ lists: result.tabLists }));
                    } else {
                        resolve({
                            lists: {
                                "Leitura Posterior": [],
                                "Projetos": []
                            },
                            listOrder: ["Leitura Posterior", "Projetos"]
                        });
                    }
                });
            });
        }
    }

    migrateData(data) {
        if (!data.listOrder) {
            const lists = data.lists || data;
            const listOrder = Object.keys(lists);
            return { lists, listOrder };
        }
        return data;
    }

    async exportToFile() {
        try {
            const data = await this.getData();
            const exportData = {
                gdaesData: data,
                exportDate: new Date().toISOString(),
                version: '2.1'
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `gdaes-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }

    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    let dataToSave;
                    if (importedData.gdaesData) {
                        dataToSave = this.migrateData(importedData.gdaesData);
                    } else if (importedData.tabLists) { // Legacy format
                        dataToSave = this.migrateData({ lists: importedData.tabLists });
                    } else {
                        throw new Error('Invalid data format');
                    }

                    await this.saveData(dataToSave);
                    resolve(dataToSave);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    async backup() {
        try {
            const data = await this.getData();
            const backup = {
                data: data,
                timestamp: new Date().toISOString(),
                version: '2.1'
            };

            const transaction = this.db.transaction(['backups'], 'readwrite');
            const backupStore = transaction.objectStore('backups');
            
            const request = backupStore.add(backup);

            request.onsuccess = async () => {
                const allBackupsRequest = backupStore.getAll();
                allBackupsRequest.onsuccess = () => {
                    const allBackups = allBackupsRequest.result;
                    if (allBackups.length > 5) {
                        allBackups.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                        const oldestBackupKey = allBackups[0].id;
                        backupStore.delete(oldestBackupKey);
                    }
                };
            };
        } catch (error) {
            console.error('Error creating backup:', error);
        }
    }
}

const storageService = new StorageService();
export default storageService;