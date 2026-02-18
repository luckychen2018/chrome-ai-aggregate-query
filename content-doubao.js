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
                'div[contenteditable="true"]',
                'div[contenteditable=""]',
                'textarea',
                'input[type="text"]'
            ];

            let inputElement = null;

            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const rect = element.getBoundingClientRect();
                    const isVisible = rect.width > 0 && rect.height > 0 && 
                                     window.getComputedStyle(element).display !== 'none' &&
                                     element.offsetParent !== null;
                    
                    const isEmpty = !element.value && 
                                   (!element.textContent || element.textContent.trim().length < 10);
                    
                    if (isVisible && isEmpty) {
                        inputElement = element;
                        break;
                    }
                }
                if (inputElement) break;
            }

            if (inputElement) {
                fillInputElement(inputElement, query);
                return true;
            }

            isProcessing = false;
            return false;
        });
    }

    // 业界标准方法：使用 Selection API 和 execCommand
    function fillInputElement(element, text) {
        element.focus();
        
        // 等待聚焦完成
        requestAnimationFrame(function() {
            if (element.isContentEditable || element.getAttribute('contenteditable') !== null) {
                fillContentEditable(element, text);
            } else {
                fillInputField(element, text);
            }
        });
    }

    function fillContentEditable(element, text) {
        // 方法1: 使用 Selection API 和 execCommand（业界最可靠的方法）
        const selection = window.getSelection();
        const range = document.createRange();
        
        // 选择所有内容
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 删除现有内容
        document.execCommand('delete', false);
        
        // 插入新文本
        try {
            document.execCommand('insertText', false, text);
        } catch (e) {
            // 如果execCommand失败，使用备用方法
            element.textContent = text;
            element.innerText = text;
        }
        
        // 触发React合成事件
        triggerReactEvents(element, text);
        
        // 等待React处理
        waitAndSend(element, text);
    }

    function fillInputField(element, text) {
        element.value = text;
        triggerReactEvents(element, text);
        waitAndSend(element, text);
    }

    function triggerReactEvents(element, text) {
        // 触发React需要的所有事件
        const events = [
            new Event('input', { bubbles: true, cancelable: true }),
            new Event('change', { bubbles: true, cancelable: true })
        ];
        
        // 尝试创建InputEvent（React使用这个）
        try {
            events.push(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: text
            }));
        } catch (e) {
            // 忽略不支持的情况
        }
        
        events.forEach(event => {
            element.dispatchEvent(event);
        });
    }

    function waitAndSend(element, text) {
        // 使用 requestAnimationFrame 等待React处理
        requestAnimationFrame(function() {
            setTimeout(function() {
                // 验证内容
                const currentText = element.isContentEditable ? 
                    (element.textContent || element.innerText || '').trim() :
                    (element.value || '').trim();
                
                if (currentText.length > 0) {
                    // 再次等待确保React状态更新
                    setTimeout(function() {
                        sendMessage(element);
                        hasSent = true;
                        
                        setTimeout(function() {
                            clearInput(element);
                            chrome.storage.local.remove(['query']);
                            setTimeout(function() {
                                isProcessing = false;
                                hasSent = false;
                            }, 1000);
                        }, 500);
                    }, 500);
                } else {
                    isProcessing = false;
                    attempts++;
                    setTimeout(checkAndFill, CHECK_INTERVAL);
                }
            }, 300);
        });
    }

    function sendMessage(element) {
        // 优先查找发送按钮
        const sendButton = findSendButton();
        if (sendButton) {
            clickButton(sendButton);
            return;
        }
        
        // 如果没有按钮，发送Enter键
        element.focus();
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(enterEvent);
    }

    function findSendButton() {
        // 查找发送按钮的常见选择器
        const selectors = [
            'button[type="submit"]',
            'button[aria-label*="发送"]',
            'button[aria-label*="提交"]',
            '[data-testid*="send"]',
            'button[class*="send"]',
            'button[class*="Send"]'
        ];
        
        for (const selector of selectors) {
            const buttons = document.querySelectorAll(selector);
            for (const btn of buttons) {
                if (isButtonVisible(btn)) {
                    return btn;
                }
            }
        }
        
        // 查找包含发送图标的按钮
        const allButtons = document.querySelectorAll('button, [role="button"]');
        for (const btn of allButtons) {
            if (isButtonVisible(btn)) {
                const text = (btn.textContent || '').trim();
                const ariaLabel = btn.getAttribute('aria-label') || '';
                if (text.includes('发送') || text.includes('提交') || 
                    ariaLabel.includes('发送') || ariaLabel.includes('提交') ||
                    btn.querySelector('svg')) {
                    return btn;
                }
            }
        }
        
        return null;
    }

    function isButtonVisible(btn) {
        const rect = btn.getBoundingClientRect();
        const style = window.getComputedStyle(btn);
        return rect.width > 0 && 
               rect.height > 0 && 
               style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               btn.offsetParent !== null &&
               !btn.disabled;
    }

    function clickButton(btn) {
        btn.focus();
        btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        btn.click();
    }

    function clearInput(element) {
        if (element.isContentEditable) {
            element.textContent = '';
            element.innerText = '';
        } else {
            element.value = '';
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function checkAndFill() {
        if (attempts >= MAX_ATTEMPTS) {
            return;
        }

        const success = findAndFillInput();
        
        if (!success) {
            attempts++;
            setTimeout(checkAndFill, CHECK_INTERVAL);
        }
    }

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'checkQuery') {
            isProcessing = false;
            hasSent = false;
            attempts = 0;
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
