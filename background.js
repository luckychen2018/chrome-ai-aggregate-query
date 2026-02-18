chrome.runtime.onInstalled.addListener(function() {
    console.log('AI聚合查询工具已安装');
});

chrome.runtime.onStartup.addListener(function() {
    console.log('AI聚合查询工具已启动');
});

// 检查站点是否被选中
function isSiteSelected(url, callback) {
    chrome.storage.local.get(['selectedSites'], function(result) {
        const selectedSites = result.selectedSites || { doubao: true, deepseek: true, kimi: true };
        let siteName = null;
        if (url.includes('doubao.com')) {
            siteName = 'doubao';
        } else if (url.includes('deepseek.com')) {
            siteName = 'deepseek';
        } else if (url.includes('kimi.com')) {
            siteName = 'kimi';
        }
        callback(siteName && selectedSites[siteName] !== false);
    });
}

// 监听标签页激活事件，通知content script重新检查query
chrome.tabs.onActivated.addListener(function(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function(tab) {
        if (tab && tab.url) {
            const url = tab.url;
            if (url.includes('doubao.com') || url.includes('deepseek.com') || url.includes('kimi.com')) {
                // 检查站点是否被选中
                isSiteSelected(url, function(selected) {
                    if (selected) {
                        // 发送消息给content script，让它重新检查storage
                        chrome.tabs.sendMessage(activeInfo.tabId, { action: 'checkQuery' }, function(response) {
                            if (chrome.runtime.lastError) {
                                // Content script可能还没加载，忽略错误
                            }
                        });
                    }
                });
            }
        }
    });
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
        const url = tab.url;
        
        if (url.includes('doubao.com') || url.includes('deepseek.com') || url.includes('kimi.com')) {
            // 检查站点是否被选中
            isSiteSelected(url, function(selected) {
                if (selected) {
                    console.log('检测到AI网站页面加载完成:', url);
                    // 发送消息给content script
                    chrome.tabs.sendMessage(tabId, { action: 'checkQuery' }, function(response) {
                        if (chrome.runtime.lastError) {
                            // Content script可能还没加载，忽略错误
                        }
                    });
                }
            });
        }
    }
    
    // 当标签页变为活动状态时也发送消息
    if (changeInfo.status === 'complete' && tab.active && tab.url) {
        const url = tab.url;
        if (url.includes('doubao.com') || url.includes('deepseek.com') || url.includes('kimi.com')) {
            // 检查站点是否被选中
            isSiteSelected(url, function(selected) {
                if (selected) {
                    chrome.tabs.sendMessage(tabId, { action: 'checkQuery' }, function(response) {
                        if (chrome.runtime.lastError) {
                            // Content script可能还没加载，忽略错误
                        }
                    });
                }
            });
        }
    }
});