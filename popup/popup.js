import storageService from './storage.js';

// Gerenciamento de estado
let appData = {
    lists: {},
    listOrder: []
};

// Templates
const listItemTemplate = document.getElementById('list-item-template');
const urlItemTemplate = document.getElementById('url-item-template');

// Carregar dados salvos
document.addEventListener('DOMContentLoaded', async () => {
    try {
        appData = await storageService.getData();
        renderSavedLists();
        updateOpenTabs();
        setupListeners();
        setupSearch();
    } catch (error) {
        console.error('Error loading data:', error);
    }

    // Export functionality
    document.getElementById('export-button').addEventListener('click', async () => {
        try {
            await storageService.exportToFile();
        } catch (error) {
            console.error('Error exporting data:', error);
            alert('Error exporting data. See console for details.');
        }
    });

    // Add event listeners for tab creation and removal
    chrome.tabs.onCreated.addListener(updateOpenTabs);
    chrome.tabs.onRemoved.addListener(updateOpenTabs);
});

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('tab-search');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const tabItems = document.querySelectorAll('.tab-item');
        
        tabItems.forEach(item => {
            const title = item.querySelector('span').textContent.toLowerCase();
            const shouldShow = title.includes(searchTerm);
            item.style.display = shouldShow ? 'flex' : 'none';
            
            if (shouldShow) {
                item.classList.add('fade-in');
                setTimeout(() => item.classList.remove('fade-in'), 300);
            }
        });
    });
}

// Function to display the lists
async function loadSavedData() {
    try {
        appData = await storageService.getData();
        renderSavedLists();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Import functionality
document.getElementById('import-button').addEventListener('click', () => {
    document.getElementById('import-input').click();
});

document.getElementById('import-input').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        try {
            appData = await storageService.importFromFile(file);
            loadSavedData();
            alert('Lists imported successfully!');
        } catch (error) {
            console.error('Error importing data:', error);
            alert('Error importing data: ' + error.message);
        }
    }
});

// Atualizar abas abertas com animação
function updateOpenTabs() {
    const openTabsList = document.getElementById('open-tabs-list');
    openTabsList.innerHTML = '';

    chrome.tabs.query({}, (tabs) => {
        document.querySelector('.tab-count').textContent = `(${tabs.length})`;

        const windowGroups = {};
        tabs.forEach(tab => {
            if (!windowGroups[tab.windowId]) {
                windowGroups[tab.windowId] = [];
            }
            windowGroups[tab.windowId].push(tab);
        });

        let windowCount = 1;
        Object.entries(windowGroups).forEach(([windowId, windowTabs]) => {
            const windowHeader = document.createElement('div');
            windowHeader.className = 'window-group-header';
            windowHeader.textContent = `Janela ${windowCount}`;
            const icon = document.createElement('span');
            icon.className = 'toggle-icon material-symbols-rounded';
            icon.textContent = 'expand_more';
            windowHeader.appendChild(icon);
            openTabsList.appendChild(windowHeader);

            const collapsibleContainer = document.createElement('div');
            collapsibleContainer.className = 'collapsible-container';
            collapsibleContainer.style.display = 'block';

            windowTabs.forEach((tab, index) => {
                const tabItem = document.createElement('div');
                tabItem.className = 'tab-item slide-in';
                tabItem.draggable = true;
                tabItem.style.animationDelay = `${index * 5}ms`;

                const favicon = document.createElement('img');
                favicon.src = tab.favIconUrl || 'default-favicon.png';
                favicon.alt = 'Favicon';
                favicon.width = 16;
                favicon.height = 16;

                const tabTitle = document.createElement('span');
                tabTitle.textContent = tab.title;
                tabTitle.className = 'tab-title';

                const tabLink = document.createElement('a');
                tabLink.href = '#';
                tabLink.appendChild(favicon);
                tabLink.appendChild(tabTitle);
                tabLink.addEventListener('click', (event) => {
                    event.preventDefault();
                    chrome.windows.update(tab.windowId, { focused: true }, () => {
                        chrome.tabs.update(tab.id, { active: true });
                    });
                });

                tabItem.addEventListener('dragstart', (e) => {
                    const dragData = {
                        type: 'tab',
                        url: tab.url,
                        title: tab.title,
                        tabId: tab.id
                    };
                    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                    tabItem.classList.add('dragging');
                });

                tabItem.addEventListener('dragend', () => {
                    tabItem.classList.remove('dragging');
                });

                tabItem.appendChild(tabLink);
                collapsibleContainer.appendChild(tabItem);
            });

            openTabsList.appendChild(collapsibleContainer);

            windowHeader.addEventListener('click', () => {
                const isVisible = collapsibleContainer.style.display === 'block';
                collapsibleContainer.style.display = isVisible ? 'none' : 'block';
                icon.textContent = isVisible ? 'expand_less' : 'expand_more';
            });

            windowCount++;
        });
    });
}

// Renderizar listas salvas
function renderSavedLists() {
    const savedListsContainer = document.getElementById('saved-lists');
    savedListsContainer.innerHTML = '';

    appData.listOrder.forEach(listName => {
        if (!appData.lists[listName]) return;

        const listElement = listItemTemplate.content.cloneNode(true);
        const listContainer = listElement.querySelector('.list-container');
        listContainer.dataset.listName = listName;

        const listHeader = listContainer.querySelector('.list-header');
        listHeader.draggable = true;

        listContainer.querySelector('.list-title').textContent = listName;
        
        setupListDragAndDrop(listContainer, listName);
        setupListActions(listContainer, listName);
        
        const listItems = listContainer.querySelector('.list-items');
        listItems.innerHTML = '';
        appData.lists[listName].forEach((item, index) => {
            const urlElement = createUrlElement(item, listName, index);
            listItems.appendChild(urlElement);
        });

        savedListsContainer.appendChild(listElement);
    });
}

function createUrlElement(item, listName, index) {
    const urlElement = urlItemTemplate.content.cloneNode(true);
    const urlContainer = urlElement.querySelector('.saved-url');
    urlContainer.dataset.index = index;
    
    const favicon = urlElement.querySelector('.url-favicon');
    try {
        favicon.src = `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}`;
    } catch (e) {
        favicon.src = 'default-favicon.png';
    }
    
    const urlLink = urlElement.querySelector('.url-link');
    urlLink.href = item.url;
    urlLink.textContent = item.title;
    
    urlContainer.addEventListener('dragstart', (e) => {
        const dragData = {
            type: 'url',
            url: item.url,
            title: item.title,
            sourceList: listName,
            sourceIndex: index
        };
        e.dataTransfer.setData('application/json', JSON.stringify(dragData));
        urlContainer.classList.add('dragging');
    });

    urlContainer.addEventListener('dragend', () => {
        urlContainer.classList.remove('dragging');
    });
    
    const openButton = urlElement.querySelector('.open-url');
    openButton.onclick = () => {
        try {
            new URL(item.url);
            chrome.tabs.create({ url: item.url });
        } catch (e) {
            showError(`URL inválida: ${item.url}`);
        }
    };
    
    const deleteButton = urlElement.querySelector('.delete-url');
    deleteButton.onclick = async () => {
        appData.lists[listName].splice(index, 1);
        await storageService.saveData(appData);
        renderSavedLists();
    };
    
    return urlElement;
}

function setupListDragAndDrop(listContainer, listName) {
    const listHeader = listContainer.querySelector('.list-header');

    // Dragging the list itself
    listHeader.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        const dragData = { type: 'list', sourceList: listName };
        e.dataTransfer.setData('application/json', JSON.stringify(dragData));
        listContainer.classList.add('dragging-list');
    });

    listHeader.addEventListener('dragend', (e) => {
        listContainer.classList.remove('dragging-list');
    });

    // Dragging over a list container (for both URLs and lists)
    listContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
        if (dragData.type === 'list') {
            listContainer.classList.add('drag-over-list');
        } else {
            listContainer.classList.add('drag-over');
        }
    });

    listContainer.addEventListener('dragleave', () => {
        listContainer.classList.remove('drag-over');
        listContainer.classList.remove('drag-over-list');
    });

    // Dropping on a list container
    listContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        listContainer.classList.remove('drag-over');
        listContainer.classList.remove('drag-over-list');

        const dragData = JSON.parse(e.dataTransfer.getData('application/json'));

        if (dragData.type === 'list') {
            // Reorder lists
            const sourceList = dragData.sourceList;
            const targetList = listName;
            const sourceIndex = appData.listOrder.indexOf(sourceList);
            const targetIndex = appData.listOrder.indexOf(targetList);

            if (sourceIndex > -1 && targetIndex > -1) {
                appData.listOrder.splice(sourceIndex, 1);
                appData.listOrder.splice(targetIndex, 0, sourceList);
                await storageService.saveData(appData);
                renderSavedLists();
            }
        } else {
            // Move URL or Tab
            const newItem = { url: dragData.url, title: dragData.title };
            
            // Add to new list
            if (!appData.lists[listName]) appData.lists[listName] = [];
            appData.lists[listName].push(newItem);

            // Remove from source list if it's a move
            if (dragData.sourceList) {
                appData.lists[dragData.sourceList].splice(dragData.sourceIndex, 1);
            }

            await storageService.saveData(appData);
            
            if (dragData.type === 'tab' && dragData.tabId) {
                await chrome.tabs.remove(dragData.tabId);
            }
            
            await storageService.backup();
            renderSavedLists();
        }
    });
}

function setupListActions(listContainer, listName) {
    const editButton = listContainer.querySelector('.edit-list-name');
    const deleteButton = listContainer.querySelector('.delete-list');
    const openAllButton = listContainer.querySelector('.open-all-urls');
    
    editButton.onclick = () => editListName(listName);
    deleteButton.onclick = () => deleteList(listName);
    openAllButton.onclick = () => openAllUrls(listName);
}

function openAllUrls(listName) {
    appData.lists[listName].forEach(item => {
        try {
            new URL(item.url);
            chrome.tabs.create({ url: item.url, active: false });
        } catch (e) {
            console.warn(`Skipping invalid URL: ${item.url}`);
        }
    });
}

function setupListeners() {
    const addListBtn = document.getElementById('add-list-btn');
    const newListModal = document.getElementById('new-list-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    const confirmNewListBtn = document.getElementById('confirm-new-list');
    const newListNameInput = document.getElementById('new-list-name');

    addListBtn.addEventListener('click', () => {
        newListModal.style.display = 'block';
        newListNameInput.value = '';
        newListNameInput.focus();
    });

    closeModalBtn.addEventListener('click', () => {
        newListModal.style.display = 'none';
    });

    const createNewList = async () => {
        const newListName = newListNameInput.value.trim();
        if (newListName && !appData.lists[newListName]) {
            appData.lists[newListName] = [];
            appData.listOrder.push(newListName);
            await storageService.saveData(appData);
            renderSavedLists();
            newListModal.style.display = 'none';
        } else {
            alert('Por favor, insira um nome de lista válido e único.');
        }
    };

    confirmNewListBtn.addEventListener('click', createNewList);
    newListNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') createNewList();
    });

    window.addEventListener('click', (e) => {
        if (e.target === newListModal) {
            newListModal.style.display = 'none';
        }
    });
}

async function deleteList(listName) {
    if (confirm(`Tem certeza que deseja deletar a lista "${listName}"?`)) {
        delete appData.lists[listName];
        appData.listOrder = appData.listOrder.filter(name => name !== listName);

        try {
            await storageService.saveData(appData);
            await storageService.backup();
        } catch (error) {
            console.error('Error deleting list:', error);
        }
        renderSavedLists();
    }
}

async function editListName(oldListName) {
    const newListName = prompt('Digite o novo nome da lista:', oldListName);

    if (newListName && newListName.trim() !== '' && newListName !== oldListName) {
        if (appData.lists[newListName]) {
            alert('Já existe uma lista com este nome.');
            return;
        }

        appData.lists[newListName] = appData.lists[oldListName];
        delete appData.lists[oldListName];

        const index = appData.listOrder.indexOf(oldListName);
        if (index > -1) {
            appData.listOrder[index] = newListName;
        }

        try {
            await storageService.saveData(appData);
            await storage.backup();
        } catch (error) {
            console.error('Error updating list name:', error);
        }
        renderSavedLists();
    }
}

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }, 100);
}