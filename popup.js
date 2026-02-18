document.addEventListener('DOMContentLoaded', function() {
    const queryInput = document.getElementById('queryInput');
    const openAllBtn = document.getElementById('openAllBtn');
    const clearBtn = document.getElementById('clearBtn');
    const doubaoStatus = document.getElementById('doubao-status');
    const deepseekStatus = document.getElementById('deepseek-status');
    const kimiStatus = document.getElementById('kimi-status');
    const doubaoCheckbox = document.getElementById('doubao-checkbox');
    const deepseekCheckbox = document.getElementById('deepseek-checkbox');
    const kimiCheckbox = document.getElementById('kimi-checkbox');

    const AI_SITES = [
        { name: 'doubao', url: 'https://www.doubao.com/chat/', status: doubaoStatus, checkbox: doubaoCheckbox },
        { name: 'deepseek', url: 'https://chat.deepseek.com/', status: deepseekStatus, checkbox: deepseekCheckbox },
        { name: 'kimi', url: 'https://www.kimi.com/', status: kimiStatus, checkbox: kimiCheckbox }
    ];

    // 加载选中状态
    function loadSelectedSites() {
        chrome.storage.local.get(['selectedSites'], function(result) {
            const selectedSites = result.selectedSites || { doubao: true, deepseek: true, kimi: true };
            doubaoCheckbox.checked = selectedSites.doubao !== false;
            deepseekCheckbox.checked = selectedSites.deepseek !== false;
            kimiCheckbox.checked = selectedSites.kimi !== false;
            updateUI();
        });
    }

    // 保存选中状态
    function saveSelectedSites() {
        const selectedSites = {
            doubao: doubaoCheckbox.checked,
            deepseek: deepseekCheckbox.checked,
            kimi: kimiCheckbox.checked
        };
        chrome.storage.local.set({ selectedSites: selectedSites });
        updateUI();
    }

    // 更新UI显示
    function updateUI() {
        AI_SITES.forEach(site => {
            const item = document.querySelector(`.ai-item[data-site="${site.name}"]`);
            if (item) {
                if (site.checkbox.checked) {
                    item.classList.remove('disabled');
                } else {
                    item.classList.add('disabled');
                }
            }
        });
        
        // 更新按钮文本
        const selectedCount = AI_SITES.filter(s => s.checkbox.checked).length;
        if (selectedCount === 0) {
            openAllBtn.disabled = true;
            openAllBtn.innerHTML = '<span>⚠️</span> 请至少选择一个AI';
        } else {
            openAllBtn.disabled = false;
            if (selectedCount === 3) {
                openAllBtn.innerHTML = '<span>🚀</span> 同时打开三个AI';
            } else {
                openAllBtn.innerHTML = `<span>🚀</span> 同时打开${selectedCount}个AI`;
            }
        }
    }

    // 获取选中的站点
    function getSelectedSites() {
        return AI_SITES.filter(site => site.checkbox.checked);
    }

    function updateStatus(siteName, status) {
        const site = AI_SITES.find(s => s.name === siteName);
        if (site) {
            site.status.textContent = status;
            site.status.className = 'status';
            if (status === '准备中' || status === '打开中') {
                site.status.classList.add('loading');
            } else if (status === '已就绪' || status === '已打开') {
                site.status.classList.add('ready');
            }
        }
    }

    function resetStatus() {
        AI_SITES.forEach(site => {
            updateStatus(site.name, '点击打开');
        });
    }

    // 查找或创建标签页
    async function findOrCreateTab(url) {
        return new Promise((resolve) => {
            // 提取域名用于匹配
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            
            // 查询所有标签页
            chrome.tabs.query({}, function(allTabs) {
                // 查找匹配的标签页（URL包含目标域名）
                const matchingTab = allTabs.find(tab => {
                    if (!tab.url) return false;
                    try {
                        const tabUrl = new URL(tab.url);
                        return tabUrl.hostname === domain || tabUrl.hostname.includes(domain.replace('www.', ''));
                    } catch (e) {
                        return tab.url.includes(domain);
                    }
                });
                
                if (matchingTab) {
                    // 找到现有标签页，切换到它
                    chrome.tabs.update(matchingTab.id, { active: true }, function(tab) {
                        chrome.windows.update(tab.windowId, { focused: true }, function() {
                            // 发送消息给content script，让它重新检查query
                            setTimeout(function() {
                                chrome.tabs.sendMessage(tab.id, { action: 'checkQuery' }, function(response) {
                                    if (chrome.runtime.lastError) {
                                        console.log('Content script not ready:', chrome.runtime.lastError.message);
                                    }
                                });
                            }, 500);
                            resolve(tab);
                        });
                    });
                } else {
                    // 没有找到，创建新标签页
                    chrome.tabs.create({ url: url }, function(tab) {
                        resolve(tab);
                    });
                }
            });
        });
    }

    async function openAllAI() {
        const query = queryInput.value.trim();
        const selectedSites = getSelectedSites();
        
        if (selectedSites.length === 0) {
            alert('请至少选择一个AI！');
            return;
        }
        
        if (!query) {
            alert('请输入您的问题！');
            return;
        }

        openAllBtn.disabled = true;
        openAllBtn.innerHTML = '<span>⏳</span> 打开中...';

        resetStatus();

        for (const site of selectedSites) {
            updateStatus(site.name, '准备中');
        }

        try {
            await chrome.storage.local.set({ query: query });

            // 并行处理选中的站点
            const promises = selectedSites.map(async (site) => {
                updateStatus(site.name, '打开中');
                try {
                    const tab = await findOrCreateTab(site.url);
                    updateStatus(site.name, '已就绪');
                    return tab;
                } catch (error) {
                    console.error(`Error opening ${site.name}:`, error);
                    updateStatus(site.name, '打开失败');
                    return null;
                }
            });

            await Promise.all(promises);

            setTimeout(function() {
                updateUI();
                selectedSites.forEach(function(site) { updateStatus(site.name, '已就绪'); });
            }, 500);

        } catch (error) {
            console.error('Error:', error);
            alert('打开失败，请重试！');
            updateUI();
            resetStatus();
        }
    }

    function clearInput() {
        queryInput.value = '';
        queryInput.focus();
        resetStatus();
    }

    // 复选框变化事件
    doubaoCheckbox.addEventListener('change', saveSelectedSites);
    deepseekCheckbox.addEventListener('change', saveSelectedSites);
    kimiCheckbox.addEventListener('change', saveSelectedSites);

    openAllBtn.addEventListener('click', openAllAI);
    clearBtn.addEventListener('click', clearInput);

    document.querySelectorAll('.ai-item').forEach(function(el) {
        el.addEventListener('click', async function(e) {
            // 如果点击的是复选框，不触发打开
            if (e.target.type === 'checkbox') {
                return;
            }
            
            var site = this.getAttribute('data-site');
            var url = this.getAttribute('data-url');
            if (site && url) {
                var query = queryInput.value.trim();
                if (query) {
                    await chrome.storage.local.set({ query: query });
                }
                updateStatus(site, '打开中');
                try {
                    await findOrCreateTab(url);
                    updateStatus(site, '已打开');
                } catch (error) {
                    console.error(`Error opening ${site}:`, error);
                    updateStatus(site, '打开失败');
                }
            }
        });
    });

    queryInput.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            openAllAI();
        }
    });

    chrome.storage.local.get(['query'], function(result) {
        if (result.query) {
            queryInput.value = result.query;
        }
    });

    // 初始化：加载选中状态
    loadSelectedSites();
});