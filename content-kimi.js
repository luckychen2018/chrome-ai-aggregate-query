(function() {
    'use strict';

    let attempts = 0;
    const MAX_ATTEMPTS = 40;
    const CHECK_INTERVAL = 500;
    let isProcessing = false;  // 防止重复执行
    let hasSent = false;  // 标记是否已发送

    function findAndFillInput() {
        // 如果正在处理或已发送，直接返回
        if (isProcessing || hasSent) {
            return false;
        }

        chrome.storage.local.get(['query'], function(result) {
            if (!result.query) {
                return;
            }

            // 如果正在处理或已发送，直接返回
            if (isProcessing || hasSent) {
                return;
            }

            isProcessing = true;
            const query = result.query;

            // 根据实际HTML结构，查找输入框
            const inputSelectors = [
                '.chat-input-editor',  // 主要输入框
                'div[class*="chat-input-editor"]',
                'div[class*="input-editor"]',
                'div[contenteditable="true"]',
                'div[contenteditable="false"]',  // 可能需要先启用
                'textarea',
                'input[type="text"]'
            ];

            let inputElement = null;

            for (const selector of inputSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    // 检查是否是输入框
                    const isInputEditor = element.classList.contains('chat-input-editor') ||
                                        element.classList.contains('input-editor') ||
                                        element.getAttribute('contenteditable') !== null;
                    
                    if (isInputEditor) {
                        const rect = element.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0 &&
                                         window.getComputedStyle(element).display !== 'none';
                        
                        // 检查是否为空（可能已经有内容）
                        const isEmpty = !element.textContent && 
                                       !element.innerText &&
                                       (!element.querySelector || !element.querySelector('*'));
                        
                        if (isVisible) {
                            inputElement = element;
                            break;
                        }
                    }
                }
                if (inputElement) break;
            }

            if (inputElement) {
                console.log('[Kimi] Found input element:', inputElement);
                
                // 如果contenteditable是false，需要先设置为true
                if (inputElement.getAttribute('contenteditable') === 'false') {
                    console.log('[Kimi] Enabling contenteditable');
                    inputElement.setAttribute('contenteditable', 'true');
                }
                
                // 聚焦元素
                inputElement.focus();
                
                // 聚焦元素
                inputElement.focus();
                
                // 等待更长时间确保聚焦完成
                setTimeout(function() {
                    // 清空可能存在的占位符或内容
                    if (inputElement.textContent || inputElement.innerText) {
                        inputElement.textContent = '';
                        inputElement.innerText = '';
                    }
                    
                    // 直接设置完整文本（不使用逐字输入，避免被中断）
                    inputElement.textContent = query;
                    inputElement.innerText = query;
                    
                    // 触发多种事件
                    const events = ['input', 'textInput', 'keydown', 'keyup', 'change'];
                    events.forEach(eventType => {
                        inputElement.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
                    });
                    
                    // 触发InputEvent
                    const inputEvent = new InputEvent('input', {
                        bubbles: true,
                        cancelable: true,
                        inputType: 'insertText',
                        data: query
                    });
                    inputElement.dispatchEvent(inputEvent);
                    
                    console.log('[Kimi] Filled input with:', query);

                    // 再次聚焦确保内容被接受
                    inputElement.focus();

                    // 等待更长时间让内容被完全接受，然后验证并发送
                    setTimeout(function() {
                        // 多次验证和重试确保文本完整
                        let retryCount = 0;
                        const maxRetries = 3;
                        
                        function verifyAndSend() {
                            const currentText = inputElement.textContent || inputElement.innerText || '';
                            console.log('[Kimi] Current text length:', currentText.length, 'Expected:', query.length);
                            
                            if (currentText.length < query.length * 0.9 && retryCount < maxRetries) {
                                // 如果文本不完整，重新设置
                                console.log('[Kimi] Text incomplete, retrying...', retryCount + 1);
                                retryCount++;
                                
                                // 清空并重新设置
                                inputElement.textContent = '';
                                inputElement.innerText = '';
                                
                                setTimeout(function() {
                                    inputElement.textContent = query;
                                    inputElement.innerText = query;
                                    
                                    // 触发事件
                                    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                                    const inputEvent = new InputEvent('input', {
                                        bubbles: true,
                                        cancelable: true,
                                        inputType: 'insertText',
                                        data: query
                                    });
                                    inputElement.dispatchEvent(inputEvent);
                                    
                                    // 再次验证，增加延迟
                                    setTimeout(verifyAndSend, 800);
                                }, 300);
                                return;
                            }
                            
                            // 文本完整或达到最大重试次数，再等待一下确保内容稳定
                            console.log('[Kimi] Text verified, waiting before send...');
                            
                            // 增加延迟，确保内容完全稳定后再发送
                            setTimeout(function() {
                                console.log('[Kimi] Attempting to send');
                                
                                // 先尝试点击发送按钮
                                if (findAndClickSubmit()) {
                                    console.log('[Kimi] Clicked submit button');
                                    hasSent = true;
                                    clearInputAndStorage(inputElement, query);
                                } else {
                                    console.log('[Kimi] Submit button not found or disabled, sending Enter key');
                                    sendEnterKey(inputElement);
                                    hasSent = true;
                                    clearInputAndStorage(inputElement, query);
                                }
                            }, 1000); // 增加1秒延迟，确保内容完全稳定
                        }
                        
                        verifyAndSend();
                    }, 1500); // 从800ms增加到1500ms
                }, 500); // 从300ms增加到500ms，确保聚焦完成

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
                console.log('[Kimi] Cleared query from storage');
            });
            
            // 重置标志
            setTimeout(function() {
                isProcessing = false;
                hasSent = false;
            }, 2000);
        }, 1000);
    }

    // 模拟鼠标移动
    function simulateMouseMove(element) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        // 触发鼠标移动事件
        const mouseMoveEvent = new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y
        });
        element.dispatchEvent(mouseMoveEvent);
    }

    // 验证输入框内容是否完整
    function verifyInputComplete(element, expectedText) {
        const currentText = element.textContent || element.innerText || '';
        return currentText.length >= expectedText.length * 0.9; // 允许10%的误差
    }

    function sendEnterKey(el) {
        if (!el) return;
        
        el.focus();
        
        // 增加延迟，确保内容完全稳定后再发送
        setTimeout(function() {
            // 再次聚焦确保元素处于活动状态
            el.focus();
            
            // 再等待一下
            setTimeout(function() {
                // 触发完整的键盘事件序列
                const events = [
                    { type: 'keydown', key: 'Enter', code: 'Enter', keyCode: 13, which: 13 },
                    { type: 'keypress', key: 'Enter', code: 'Enter', keyCode: 13, which: 13 },
                    { type: 'keyup', key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }
                ];
                
                events.forEach((eventData, i) => {
                    setTimeout(function() {
                        const event = new KeyboardEvent(eventData.type, {
                            key: eventData.key,
                            code: eventData.code,
                            keyCode: eventData.keyCode,
                            which: eventData.which,
                            bubbles: true,
                            cancelable: true
                        });
                        el.dispatchEvent(event);
                    }, i * 20); // 事件之间间隔增加到20ms
                });
                
                console.log('[Kimi] Sent Enter key events');
            }, 300); // 增加300ms延迟
        }, 500); // 从100-200ms增加到500ms
    }

    function findAndClickSubmit() {
        // 根据实际HTML，发送按钮是 .send-button-container
        const submitSelectors = [
            '.send-button-container',  // 主要发送按钮
            'div[class*="send-button"]',
            'div[class*="send"]',
            'button[type="submit"]',
            'button[aria-label*="发送"]',
            'button[aria-label*="提交"]',
            'button[title*="发送"]',
            '[data-testid*="send"]',
            'button[class*="send"]',
            'button svg',
            'div[role="button"][class*="send"]'
        ];
        
        for (let s = 0; s < submitSelectors.length; s++) {
            const buttons = document.querySelectorAll(submitSelectors[s]);
            for (let i = 0; i < buttons.length; i++) {
                const btn = buttons[i];
                const rect = btn.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0 &&
                                 window.getComputedStyle(btn).display !== 'none';
                
                // 检查是否被禁用
                const isDisabled = btn.classList.contains('disabled') ||
                                 btn.getAttribute('disabled') !== null ||
                                 btn.getAttribute('aria-disabled') === 'true';
                
                if (isVisible) {
                    console.log('[Kimi] Found submit button:', btn, 'disabled:', isDisabled);
                    
                    // 如果被禁用，先尝试移除disabled类
                    if (isDisabled) {
                        btn.classList.remove('disabled');
                        btn.removeAttribute('disabled');
                        btn.setAttribute('aria-disabled', 'false');
                        console.log('[Kimi] Removed disabled state');
                        
                        // 等待更长时间让状态更新
                        setTimeout(function() {
                            tryClickButton(btn);
                        }, 500); // 从200ms增加到500ms
                    } else {
                        tryClickButton(btn);
                    }
                    
                    return true;
                }
            }
        }
        return false;
    }

    function tryClickButton(btn) {
        // 模拟人类点击：先移动鼠标，再按下，再释放
        const rect = btn.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        // 鼠标移动
        btn.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y
        }));
        
        // 增加延迟，确保输入框内容完全稳定
        setTimeout(function() {
            // 聚焦按钮
            btn.focus();
            
            // 再等待一下
            setTimeout(function() {
                // 鼠标按下
                btn.dispatchEvent(new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 0,
                    clientX: x,
                    clientY: y
                }));
                
                // 等待更长时间（模拟按下时间）
                setTimeout(function() {
                    // 鼠标释放
                    btn.dispatchEvent(new MouseEvent('mouseup', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        button: 0,
                        clientX: x,
                        clientY: y
                    }));
                    
                    // 点击事件
                    btn.dispatchEvent(new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        button: 0,
                        clientX: x,
                        clientY: y
                    }));
                    
                    // 也调用原生click方法
                    btn.click();
                    
                    console.log('[Kimi] Clicked button');
                }, 100 + Math.random() * 100); // 从50-100ms增加到100-200ms
            }, 300); // 增加300ms延迟
        }, 500 + Math.random() * 200); // 从100-200ms增加到500-700ms
    }

    function checkAndFill() {
        if (attempts >= MAX_ATTEMPTS) {
            console.log('[Kimi] 达到最大尝试次数:', attempts);
            return;
        }

        attempts++;
        const success = findAndFillInput();
        
        if (!success) {
            setTimeout(checkAndFill, CHECK_INTERVAL);
        } else {
            console.log('[Kimi] Successfully filled input on attempt:', attempts);
        }
    }

    // 等待页面加载完成
    // 监听来自background的消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'checkQuery') {
            // 重置标志，允许重新处理
            isProcessing = false;
            hasSent = false;
            attempts = 0;
            // 重新检查并填充
            setTimeout(checkAndFill, 500);
            sendResponse({ success: true });
        }
        return true;
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(checkAndFill, 1500);
        });
    } else {
        setTimeout(checkAndFill, 1500);
    }

    // 监听URL变化
    let lastUrl = location.href;
    new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            attempts = 0;
            isProcessing = false;
            hasSent = false;
            setTimeout(checkAndFill, 2000);
        }
    }).observe(document, { subtree: true, childList: true });

    // 监听DOM变化，输入框可能是动态加载的
    const observer = new MutationObserver(function(mutations) {
        // 如果正在处理或已发送，不触发
        if (isProcessing || hasSent || attempts >= MAX_ATTEMPTS) {
            return;
        }
        
        chrome.storage.local.get(['query'], function(result) {
            if (result.query && !isProcessing && !hasSent) {
                // 检查输入框是否已经出现
                const inputEditor = document.querySelector('.chat-input-editor');
                if (inputEditor) {
                    checkAndFill();
                }
            }
        });
    });
    
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['contenteditable', 'class']
        });
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['contenteditable', 'class']
            });
        });
    }
})();
