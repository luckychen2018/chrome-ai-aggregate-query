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
    const splitScreenCheckbox = document.getElementById('splitScreenCheckbox');

    const AI_SITES = [
        { name: 'doubao', url: 'https://www.doubao.com/chat/', status: doubaoStatus, checkbox: doubaoCheckbox },
        { name: 'deepseek', url: 'https://chat.deepseek.com/', status: deepseekStatus, checkbox: deepseekCheckbox },
        { name: 'kimi', url: 'https://www.kimi.com/', status: kimiStatus, checkbox: kimiCheckbox }
    ];

    // 加载选中状态
    function loadSelectedSites() {
        chrome.storage.local.get(['selectedSites', 'splitScreen'], function(result) {
            const selectedSites = result.selectedSites || { doubao: true, deepseek: true, kimi: true };
            doubaoCheckbox.checked = selectedSites.doubao !== false;
            deepseekCheckbox.checked = selectedSites.deepseek !== false;
            kimiCheckbox.checked = selectedSites.kimi !== false;
            splitScreenCheckbox.checked = result.splitScreen === true;
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
        chrome.storage.local.set({ 
            selectedSites: selectedSites,
            splitScreen: splitScreenCheckbox.checked
        });
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

    // 获取屏幕尺寸（使用system.display API获取准确的屏幕信息）
    async function getScreenSize() {
        return new Promise((resolve) => {
            chrome.windows.getCurrent(function(currentWindow) {
                // 优先使用system.display API获取准确的屏幕尺寸
                if (chrome.system && chrome.system.display) {
                    chrome.system.display.getInfo(function(displays) {
                        if (displays && displays.length > 0) {
                            // 找到当前窗口所在的显示器
                            const windowLeft = currentWindow.left || 0;
                            const windowTop = currentWindow.top || 0;
                            const windowWidth = currentWindow.width || 0;
                            const windowHeight = currentWindow.height || 0;
                            
                            // 计算窗口中心点
                            const windowCenterX = windowLeft + windowWidth / 2;
                            const windowCenterY = windowTop + windowHeight / 2;
                            
                            // 找到包含窗口中心点的显示器
                            let targetDisplay = displays[0]; // 默认使用第一个显示器
                            
                            for (const display of displays) {
                                const bounds = display.bounds || {};
                                const displayLeft = bounds.left || 0;
                                const displayTop = bounds.top || 0;
                                const displayWidth = bounds.width || display.width || 1920;
                                const displayHeight = bounds.height || display.height || 1080;
                                
                                // 检查窗口中心点是否在这个显示器范围内
                                if (windowCenterX >= displayLeft && 
                                    windowCenterX < displayLeft + displayWidth &&
                                    windowCenterY >= displayTop && 
                                    windowCenterY < displayTop + displayHeight) {
                                    targetDisplay = display;
                                    break;
                                }
                            }
                            
                            const bounds = targetDisplay.bounds || {};
                            const screenWidth = bounds.width || targetDisplay.width || 1920;
                            const screenHeight = bounds.height || targetDisplay.height || 1080;
                            const screenLeft = bounds.left || 0;
                            const screenTop = bounds.top || 0;
                            
                            console.log(`[屏幕检测] 使用system.display API: ${screenWidth}x${screenHeight}, 位置(${screenLeft}, ${screenTop})`);
                            
                            resolve({
                                width: screenWidth,
                                height: screenHeight,
                                left: screenLeft,
                                top: screenTop
                            });
                            return;
                        }
                        
                        // 如果system.display返回空，使用备用方法
                        fallbackToWindowEstimate(currentWindow, resolve);
                    });
                } else {
                    // 如果system.display不可用，使用备用方法
                    fallbackToWindowEstimate(currentWindow, resolve);
                }
            });
        });
    }
    
    // 备用方法：使用窗口信息估算屏幕尺寸
    function fallbackToWindowEstimate(currentWindow, resolve) {
        // 方法1: 如果窗口是最大化状态，使用窗口尺寸
        if (currentWindow.state === 'maximized') {
            resolve({
                width: currentWindow.width || 1920,
                height: currentWindow.height || 1080,
                left: currentWindow.left || 0,
                top: currentWindow.top || 0
            });
            return;
        }
        
        // 方法2: 获取所有窗口，找到最大的窗口尺寸作为屏幕尺寸的参考
        chrome.windows.getAll(function(windows) {
            let maxWidth = currentWindow.width || 1920;
            let maxHeight = currentWindow.height || 1080;
            let minLeft = currentWindow.left || 0;
            let minTop = currentWindow.top || 0;
            
            // 遍历所有窗口，找到最大的尺寸
            windows.forEach(function(win) {
                if (win.state === 'maximized') {
                    maxWidth = Math.max(maxWidth, win.width || 1920);
                    maxHeight = Math.max(maxHeight, win.height || 1080);
                }
                if (win.left !== undefined && win.left < minLeft) {
                    minLeft = win.left;
                }
                if (win.top !== undefined && win.top < minTop) {
                    minTop = win.top;
                }
            });
            
            // 对于4K屏幕，如果检测到的宽度小于2560，可能是估算不准确
            // 尝试使用更大的默认值
            if (maxWidth < 2560) {
                // 可能是4K屏幕，使用更大的默认值
                maxWidth = Math.max(maxWidth, 3840); // 4K宽度
                maxHeight = Math.max(maxHeight, 2160); // 4K高度
            }
            
            console.log(`[屏幕检测] 使用窗口估算: ${maxWidth}x${maxHeight}, 位置(${minLeft}, ${minTop})`);
            
            resolve({
                width: maxWidth,
                height: maxHeight,
                left: minLeft,
                top: minTop
            });
        });
    }

    // 查找已存在的竖屏平铺窗口（单个）
    async function findExistingSplitScreenWindow(url) {
        return new Promise((resolve) => {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            
            // 查询所有窗口
            chrome.windows.getAll({ populate: true }, function(windows) {
                // 查找包含该域名的窗口
                for (const win of windows) {
                    if (win.tabs && win.tabs.length > 0) {
                        // 检查窗口中的标签页是否匹配该域名
                        const matchingTab = win.tabs.find(tab => {
                            if (!tab.url) return false;
                            try {
                                const tabUrl = new URL(tab.url);
                                return tabUrl.hostname === domain || 
                                       tabUrl.hostname.includes(domain.replace('www.', ''));
                            } catch (e) {
                                return tab.url.includes(domain);
                            }
                        });
                        
                        if (matchingTab) {
                            console.log(`[竖屏平铺] 找到已存在的窗口: ${win.id}, 标签页: ${matchingTab.id}`);
                            resolve({ window: win, tab: matchingTab });
                            return;
                        }
                    }
                }
                resolve(null);
            });
        });
    }

    // 查找所有已存在的竖屏平铺窗口（用于追加提问时更新所有窗口）
    async function findAllExistingSplitScreenWindows(selectedSites) {
        return new Promise((resolve) => {
            const results = {};
            
            // 查询所有窗口
            chrome.windows.getAll({ populate: true }, function(windows) {
                // 遍历所有选中的站点
                selectedSites.forEach(function(site) {
                    const urlObj = new URL(site.url);
                    const domain = urlObj.hostname;
                    
                    // 查找包含该域名的窗口
                    for (const win of windows) {
                        if (win.tabs && win.tabs.length > 0) {
                            const matchingTab = win.tabs.find(tab => {
                                if (!tab.url) return false;
                                try {
                                    const tabUrl = new URL(tab.url);
                                    return tabUrl.hostname === domain || 
                                           tabUrl.hostname.includes(domain.replace('www.', ''));
                                } catch (e) {
                                    return tab.url.includes(domain);
                                }
                            });
                            
                            if (matchingTab) {
                                results[site.name] = { window: win, tab: matchingTab };
                                console.log(`[竖屏平铺] 找到站点 ${site.name} 的窗口: ${win.id}, 标签页: ${matchingTab.id}`);
                                break;
                            }
                        }
                    }
                });
                
                resolve(results);
            });
        });
    }

    // 创建平铺窗口
    async function createSplitScreenWindow(url, index, total, screenInfo) {
        return new Promise((resolve) => {
            // 计算每个窗口的宽度（留出一些边距）
            const margin = 10; // 窗口之间的边距
            const totalMargin = margin * (total - 1);
            const windowWidth = Math.floor((screenInfo.width - totalMargin) / total);
            const left = screenInfo.left + (index * (windowWidth + margin));
            const top = screenInfo.top;
            const height = screenInfo.height;

            console.log(`[竖屏平铺] 创建窗口 ${index + 1}/${total}: 位置(${left}, ${top}), 尺寸(${windowWidth}x${height})`);

            chrome.windows.create({
                url: url,
                type: 'normal',
                left: left,
                top: top,
                width: windowWidth,
                height: height,
                state: 'normal', // 确保窗口不是最大化状态
                focused: index === 0 // 第一个窗口获得焦点
            }, function(window) {
                if (window && window.tabs && window.tabs.length > 0) {
                    resolve(window.tabs[0]); // 返回窗口中的第一个标签页
                } else {
                    // 如果窗口创建成功但没有标签页，等待一下再获取
                    setTimeout(function() {
                        chrome.tabs.query({ windowId: window.id }, function(tabs) {
                            if (tabs && tabs.length > 0) {
                                resolve(tabs[0]);
                            } else {
                                resolve(null);
                            }
                        });
                    }, 500);
                }
            });
        });
    }

    // 查找或创建标签页
    async function findOrCreateTab(url, useSplitScreen = false, index = 0, total = 1, screenInfo = null) {
        return new Promise((resolve) => {
            // 如果使用竖屏平铺，先查找是否已存在窗口
            if (useSplitScreen && screenInfo) {
                findExistingSplitScreenWindow(url).then(function(result) {
                    if (result && result.window && result.tab) {
                        // 找到已存在的窗口，切换到该窗口和标签页
                        console.log(`[竖屏平铺] 复用已存在的窗口: ${result.window.id}`);
                        chrome.windows.update(result.window.id, { focused: true }, function() {
                            chrome.tabs.update(result.tab.id, { active: true }, function(tab) {
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
                        // 没有找到已存在的窗口，创建新窗口
                        createSplitScreenWindow(url, index, total, screenInfo).then(resolve);
                    }
                });
                return;
            }

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
        const useSplitScreen = splitScreenCheckbox.checked;
        
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

            let screenInfo = null;
            if (useSplitScreen) {
                // 获取屏幕尺寸信息
                screenInfo = await getScreenSize();
                
                // 在竖屏模式下，先检查所有窗口是否都已存在
                const existingWindows = await findAllExistingSplitScreenWindows(selectedSites);
                const allWindowsExist = selectedSites.every(site => existingWindows[site.name]);
                
                if (allWindowsExist && selectedSites.length === Object.keys(existingWindows).length) {
                    // 所有窗口都已存在，向所有窗口发送checkQuery消息（追加提问）
                    console.log('[竖屏平铺] 所有窗口已存在，向所有窗口发送追加提问消息');
                    
                    const updatePromises = selectedSites.map(async (site) => {
                        const result = existingWindows[site.name];
                        if (result && result.tab) {
                            updateStatus(site.name, '更新中');
                            return new Promise((resolve) => {
                                // 切换到该窗口和标签页
                                chrome.windows.update(result.window.id, { focused: false }, function() {
                                    chrome.tabs.update(result.tab.id, { active: false }, function(tab) {
                                        // 发送消息给content script
                                        setTimeout(function() {
                                            chrome.tabs.sendMessage(tab.id, { action: 'checkQuery' }, function(response) {
                                                if (chrome.runtime.lastError) {
                                                    console.log(`Content script not ready for ${site.name}:`, chrome.runtime.lastError.message);
                                                }
                                                updateStatus(site.name, '已更新');
                                                resolve(tab);
                                            });
                                        }, 300);
                                    });
                                });
                            });
                        }
                    });
                    
                    await Promise.all(updatePromises);
                    
                    setTimeout(function() {
                        updateUI();
                        selectedSites.forEach(function(site) { updateStatus(site.name, '已更新'); });
                    }, 500);
                    
                    return;
                }
            }

            // 并行处理选中的站点（创建新窗口或更新现有窗口）
            const promises = selectedSites.map(async (site, index) => {
                updateStatus(site.name, '打开中');
                try {
                    const tab = await findOrCreateTab(
                        site.url, 
                        useSplitScreen, 
                        index, 
                        selectedSites.length, 
                        screenInfo
                    );
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
    splitScreenCheckbox.addEventListener('change', saveSelectedSites);

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