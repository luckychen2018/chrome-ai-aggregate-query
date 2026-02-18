(function() {
    'use strict';

    let attempts = 0;
    const MAX_ATTEMPTS = 20;
    const CHECK_INTERVAL = 500;
    let isProcessing = false;
    let hasSent = false;

    function findAndFillInput() {
        if (isProcessing || hasSent) {
            return false;
        }

        chrome.storage.local.get(['query'], function(result) {
            if (!result.query || isProcessing || hasSent) {
                return;
            }

            isProcessing = true;
            const query = result.query;

            const selectors = [
                'textarea[placeholder*="输入"]',
                'textarea[placeholder*="问"]',
                'textarea[placeholder*="消息"]',
                'textarea[placeholder*="DeepSeek"]',
                'input[type="text"][placeholder*="输入"]',
                'input[type="text"][placeholder*="问"]',
                'div[contenteditable="true"]',
                'textarea',
                'input[type="text"]'
            ];

            let inputElement = null;

            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    if (element.offsetParent !== null && !element.value && !element.textContent) {
                        inputElement = element;
                        break;
                    }
                }
                if (inputElement) break;
            }

            if (inputElement) {
                // 聚焦输入框
                inputElement.focus();
                
                if (inputElement.tagName === 'DIV' && inputElement.isContentEditable) {
                    // 对于contenteditable，先清空再设置
                    inputElement.textContent = '';
                    inputElement.innerText = '';
                    inputElement.textContent = query;
                    inputElement.innerText = query;
                    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    // 对于textarea/input，先清空再设置
                    inputElement.value = '';
                    inputElement.value = query;
                    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                    inputElement.dispatchEvent(new Event('keyup', { bubbles: true }));
                }

                setTimeout(function() {
                    if (!findAndClickSubmit()) {
                        sendEnterKey(inputElement);
                    }
                    hasSent = true;
                    // 立即清空输入框
                    clearInputImmediately(inputElement);
                    // 延迟清空storage
                    clearInputAndStorage(inputElement, query);
                }, 600);

                return true;
            }

            isProcessing = false;
            return false;
        });
    }

    function clearInputImmediately(inputElement) {
        if (inputElement) {
            if (inputElement.tagName === 'DIV' && inputElement.isContentEditable) {
                inputElement.textContent = '';
                inputElement.innerText = '';
                inputElement.innerHTML = '';
            } else {
                inputElement.value = '';
            }
            // 触发change事件确保UI更新
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function clearInputAndStorage(inputElement, query) {
        // 立即清空一次
        clearInputImmediately(inputElement);
        
        // 延迟再次清空（防止被重新填充）
        setTimeout(function() {
            clearInputImmediately(inputElement);
        }, 500);
        
        setTimeout(function() {
            clearInputImmediately(inputElement);
            
            // 清空storage
            chrome.storage.local.remove(['query'], function() {
                console.log('[DeepSeek] Cleared query from storage');
            });
            
            // 重置标志
            setTimeout(function() {
                isProcessing = false;
                hasSent = false;
            }, 2000);
        }, 1000);
    }

    function sendEnterKey(el) {
        if (!el) return;
        var e = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true });
        el.dispatchEvent(e);
        el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, bubbles: true }));
    }

    function findAndClickSubmit() {
        var submitSelectors = [
            'button[type="submit"]',
            'button[aria-label*="发送"]',
            'button[aria-label*="提交"]',
            'button[title*="发送"]',
            '[data-testid*="send"]',
            'button[class*="send"]',
            'button[class*="submit"]',
            'button svg',
            'div[role="button"][class*="send"]'
        ];
        for (var s = 0; s < submitSelectors.length; s++) {
            var buttons = document.querySelectorAll(submitSelectors[s]);
            for (var i = 0; i < buttons.length; i++) {
                var btn = buttons[i];
                if (btn.offsetParent !== null && btn.offsetWidth > 0) {
                    btn.click();
                    return true;
                }
            }
        }
        return false;
    }

    function checkAndFill() {
        if (attempts >= MAX_ATTEMPTS) {
            console.log('DeepSeek：达到最大尝试次数');
            return;
        }

        const success = findAndFillInput();
        
        if (!success) {
            attempts++;
            setTimeout(checkAndFill, CHECK_INTERVAL);
        }
    }

    // 监听来自background的消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'checkQuery') {
            // 重置标志，允许重新处理
            isProcessing = false;
            hasSent = false;
            attempts = 0;
            // 重新检查并填充
            setTimeout(checkAndFill, 300);
            sendResponse({ success: true });
        }
        return true;
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndFill);
    } else {
        checkAndFill();
    }

    let lastUrl = location.href;
    new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            attempts = 0;
            isProcessing = false;
            hasSent = false;
            setTimeout(checkAndFill, 1000);
        }
    }).observe(document, { subtree: true, childList: true });
})();