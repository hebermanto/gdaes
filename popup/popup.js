import storageService from './storage.js';

// Gerenciamento de estado
let lists = {
    "Leitura Posterior": [],
    "Projetos": []
};

// Templates
const listItemTemplate = document.getElementById('list-item-template');
const urlItemTemplate = document.getElementById('url-item-template');

// Carregar dados salvos
document.addEventListener('DOMContentLoaded', async () => {
    try {
        lists = await storageService.getLists();
        renderSavedLists();
        updateOpenTabs();
        setupListeners();
        setupSearch();
    } catch (error) {
        console.error('Error loading lists:', error);
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
            
            // Add animation for showing items
            if (shouldShow) {
                item.classList.add('fade-in');
                setTimeout(() => item.classList.remove('fade-in'), 300);
            }
        });
    });
}

// Function to display the lists
async function loadSavedLists() {
    try {
        lists = await storageService.getLists();
        renderSavedLists();
    } catch (error) {
        console.error('Error loading lists:', error);
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
            lists = await storageService.importFromFile(file);
            loadSavedLists();
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
        // Update the "Abas Abertas" heading with the tab count
        const tabCount = document.createElement('span');
        tabCount.className = 'tab-count';
        //tabCount.textContent = `(${tabs.length})`;
        //atualiza o número de abas abertas
        document.querySelector('.tab-count').textContent = `(${tabs.length})`;

        tabs.forEach((tab, index) => {
            const tabItem = document.createElement('div');
            tabItem.className = 'tab-item slide-in';
            tabItem.draggable = true;
            tabItem.style.animationDelay = `${index * 5}ms`;

            // Criar ícone da aba
            const favicon = document.createElement('img');
            favicon.src = tab.favIconUrl || 'default-favicon.png';
            favicon.alt = 'Favicon';
            favicon.width = 16;
            favicon.height = 16;

            // Criar título da aba
            const tabTitle = document.createElement('span');
            tabTitle.textContent = tab.title;
            tabTitle.className = 'tab-title';

            // Add link to switch to tab
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

            // Eventos de drag com feedback visual
            tabItem.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/uri-list', tab.url);
                e.dataTransfer.setData('tabId', tab.id);
                e.dataTransfer.setData('text/plain', tab.title);
                tabItem.classList.add('dragging');
            });

            tabItem.addEventListener('dragend', () => {
                tabItem.classList.remove('dragging');
            });

            tabItem.appendChild(tabLink);
            openTabsList.appendChild(tabItem);
        });
    });
}

// Renderizar listas salvas usando templates
function renderSavedLists() {
    const savedListsContainer = document.getElementById('saved-lists');
    savedListsContainer.innerHTML = '';

    Object.keys(lists).forEach(listName => {
        const listElement = listItemTemplate.content.cloneNode(true);
        const listContainer = listElement.querySelector('.list-container');
        
        // Set list title
        listContainer.querySelector('.list-title').textContent = listName;
        
        // Setup drag and drop
        setupDragAndDrop(listContainer, listName);
        
        // Setup list actions
        setupListActions(listContainer, listName);
        
        // Add URLs to list
        const listItems = listContainer.querySelector('.list-items');
        lists[listName].forEach((item, index) => {
            const urlElement = createUrlElement(item, listName, index);
            listItems.appendChild(urlElement);
        });

        savedListsContainer.appendChild(listElement);
    });
}

function createUrlElement(item, listName, index) {
    const urlElement = urlItemTemplate.content.cloneNode(true);
    const urlContainer = urlElement.querySelector('.saved-url');
    
    // Set favicon and title
    const favicon = urlElement.querySelector('.url-favicon');
    favicon.src = `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}`;
    
    const urlLink = urlElement.querySelector('.url-link');
    urlLink.href = item.url;
    urlLink.textContent = item.title;
    
    // Setup drag
    urlContainer.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/uri-list', item.url);
        e.dataTransfer.setData('text/plain', item.title);
        e.dataTransfer.setData('sourceList', listName);
        e.dataTransfer.setData('sourceIndex', index);
        urlContainer.classList.add('dragging');
    });

    urlContainer.addEventListener('dragend', () => {
        urlContainer.classList.remove('dragging');
    });
    
    // Setup actions
    const openButton = urlElement.querySelector('.open-url');
    openButton.onclick = () => chrome.tabs.create({ url: item.url });
    
    const deleteButton = urlElement.querySelector('.delete-url');
    deleteButton.onclick = async () => {
        lists[listName].splice(index, 1);
        await storageService.saveLists(lists);
        renderSavedLists();
    };
    
    return urlElement;
}

function setupDragAndDrop(listContainer, listName) {
    listContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        listContainer.classList.add('drag-over');
    });

    listContainer.addEventListener('dragleave', () => {
        listContainer.classList.remove('drag-over');
    });

    listContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        listContainer.classList.remove('drag-over');

        const url = e.dataTransfer.getData('text/uri-list');
        const title = e.dataTransfer.getData('text/plain');
        const tabId = parseInt(e.dataTransfer.getData('tabId'));
        const sourceList = e.dataTransfer.getData('sourceList');
        const sourceIndex = parseInt(e.dataTransfer.getData('sourceIndex'));

        try {
            // Add to new list with animation
            const newItem = { url, title };
            lists[listName].push(newItem);
            
            // Remove from source list if it's a move operation
            if (sourceList && !isNaN(sourceIndex)) {
                lists[sourceList].splice(sourceIndex, 1);
            }

            // Save changes
            await storageService.saveLists(lists);
            
            // Close tab if it's from open tabs
            if (!isNaN(tabId) && tabId) {
                await chrome.tabs.remove(tabId);
            }

            // Create backup
            await storageService.backup();
            
            // Update UI with animation
            renderSavedLists();
        } catch (error) {
            console.error('Error handling drop:', error);
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

// Função para abrir todas as URLs de uma lista
function openAllUrls(listName) {
    lists[listName].forEach(item => {
        chrome.tabs.create({ url: item.url, active: false });
    });
}

// Configurar listeners para criação e edição de listas
function setupListeners() {
    // Botão para adicionar nova lista
    const addListBtn = document.getElementById('add-list-btn');
    const newListModal = document.getElementById('new-list-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    const confirmNewListBtn = document.getElementById('confirm-new-list');
    const newListNameInput = document.getElementById('new-list-name');

    // Abrir modal de nova lista
    addListBtn.addEventListener('click', () => {
        newListModal.style.display = 'block';
        newListNameInput.value = '';
        newListNameInput.focus(); // Focus the input field
    });

    // Fechar modal
    closeModalBtn.addEventListener('click', () => {
        newListModal.style.display = 'none';
    });

    // Confirmar criação de nova lista
    confirmNewListBtn.addEventListener('click', () => {
        const newListName = newListNameInput.value.trim();
        if (newListName && !lists[newListName]) {
            lists[newListName] = [];
            storageService.saveLists(lists);
            renderSavedLists();
            newListModal.style.display = 'none';
        } else {
            alert('Por favor, insira um nome de lista válido e único.');
        }
    });

    // Confirmar criação de nova lista ao pressionar Enter
    newListNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const newListName = newListNameInput.value.trim();
            if (newListName && !lists[newListName]) {
                lists[newListName] = [];
                storageService.saveLists(lists);
                renderSavedLists();
                newListModal.style.display = 'none';
            } else {
                alert('Por favor, insira um nome de lista válido e único.');
            }
        }
    });

    // Fechar modal ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === newListModal) {
            newListModal.style.display = 'none';
        }
    });
}

// Deletar lista
async function deleteList(listName) {
    if (confirm(`Tem certeza que deseja deletar a lista "${listName}"?`)) {
        delete lists[listName];

        try {
            // Save to storage
            await storageService.saveLists(lists);
            // Create backup
            await storageService.backup();
        } catch (error) {
            console.error('Error deleting list:', error);
        }

        // Renderizar listas atualizadas
        renderSavedLists();
    }
}

// Editar nome da lista
async function editListName(oldListName) {
    const newListName = prompt('Digite o novo nome da lista:', oldListName);

    if (newListName && newListName.trim() !== '' && newListName !== oldListName) {
        // Verificar se o novo nome já existe
        if (lists[newListName]) {
            alert('Já existe uma lista com este nome.');
            return;
        }

        // Criar nova entrada com o novo nome
        lists[newListName] = lists[oldListName];
        delete lists[oldListName];

        try {
            // Save to storage
            await storageService.saveLists(lists);
            // Create backup
            await storageService.backup();
        } catch (error) {
            console.error('Error updating list name:', error);
        }

        // Renderizar listas atualizadas
        renderSavedLists();
    }
}

// Add loading indicator
function showLoading(element) {
    element.classList.add('loading');
}

function hideLoading(element) {
    element.classList.remove('loading');
}

// Error toast notification
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
