// Group tabs by windowId
const groupedTabs = tabs.reduce((acc, tab) => {
  if (!acc[tab.windowId]) {
    acc[tab.windowId] = [];
  }
  acc[tab.windowId].push(tab);
  return acc;
}, {});

// Create HTML for each window group
let tabsHtml = '';
Object.entries(groupedTabs).forEach(([windowId, windowTabs], index) => {
  tabsHtml += `
    <div class="window-group">
      <div class="window-header">Janela ${index + 1}</div>
      ${windowTabs.map(tab => `
        <div class="tab-item" data-tab-id="${tab.id}">
          <img src="${tab.favIconUrl || 'icon.png'}" alt="favicon">
          <span class="tab-title">${tab.title}</span>
        </div>
      `).join('')}
    </div>
  `;
});

document.getElementById('tabsList').innerHTML = tabsHtml; 