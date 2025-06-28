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

    async saveLists(lists) {
        try {
            await this.init();
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);

                // Save to IndexedDB
                const request = store.put({
                    id: 'mainLists',
                    data: lists,
                    timestamp: new Date().toISOString()
                });

                request.onsuccess = () => {
                    // Also save to chrome.storage for sync
                    chrome.storage.local.set({ tabLists: lists }, () => {
                        resolve();
                    });
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error saving lists:', error);
            // Fallback to chrome.storage
            return new Promise((resolve) => {
                chrome.storage.local.set({ tabLists: lists }, resolve);
            });
        }
    }

    async getLists() {
        try {
            await this.init();
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get('mainLists');

                request.onsuccess = () => {
                    if (request.result) {
                        resolve(request.result.data);
                    } else {
                        // If no data in IndexedDB, try chrome.storage
                        chrome.storage.local.get(['tabLists'], (result) => {
                            resolve(result.tabLists || {
                                "Leitura Posterior": [],
                                "Projetos": []
                            });
                        });
                    }
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error getting lists:', error);
            // Fallback to chrome.storage
            return new Promise((resolve) => {
                chrome.storage.local.get(['tabLists'], (result) => {
                    resolve(result.tabLists || {
                        "Leitura Posterior": [],
                        "Projetos": []
                    });
                });
            });
        }
    }

    async exportToFile() {
        try {
            const lists = await this.getLists();
            const data = {
                tabLists: lists,
                exportDate: new Date().toISOString(),
                version: '2.0'
            };
            
            const dataStr = JSON.stringify(data, null, 2);
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
                    
                    // Validate imported data
                    if (!importedData.tabLists || typeof importedData.tabLists !== 'object') {
                        throw new Error('Invalid data format');
                    }

                    // Save to both storage systems
                    await this.saveLists(importedData.tabLists);
                    resolve(importedData.tabLists);
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
            const lists = await this.getLists();
            const backup = {
                data: lists,
                timestamp: new Date().toISOString(),
                version: '2.0'
            };

            // Store backup in a separate IndexedDB store
            const backupStore = this.db
                .transaction(['backups'], 'readwrite')
                .objectStore('backups');
            
            await backupStore.add(backup);
            
            // Keep only last 5 backups
            const allBackups = await backupStore.getAll();
            if (allBackups.length > 5) {
                const oldestBackup = allBackups[0];
                await backupStore.delete(oldestBackup.timestamp);
            }
        } catch (error) {
            console.error('Error creating backup:', error);
        }
    }
}

// Export the storage service
const storageService = new StorageService();
export default storageService; 