# AI聚合查询工具

一键同时查询豆包、Kimi、DeepSeek 三个 AI 助手，支持选择性触发和自动填充。

## ✨ 功能特性

- 🚀 **一键多查**：同时打开多个 AI 并自动填充问题
- ✅ **灵活选择**：勾选需要使用的 AI，只触发选中的站点
- 🔄 **智能填充**：自动识别输入框并填充内容
- 💾 **本地存储**：所有数据仅存储在本地，不收集任何信息

## 📦 安装

### 方式一：加载未打包扩展（开发模式）

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目文件夹

### 方式二：安装 CRX 文件

1. 运行 `pack-crx.bat` 生成 `dist/AI-aggregate-query.crx`
2. 在 `chrome://extensions/` 页面，将生成的 `.crx` 文件拖入浏览器
3. 确认安装

## 🎯 使用方法

1. 点击浏览器工具栏的扩展图标
2. 勾选要使用的 AI（默认全选）
3. 在输入框中输入问题
4. 点击「同时打开X个AI」或按 `Ctrl+Enter`
5. 扩展会自动打开选中的 AI 站点并填充问题

**单独打开**：点击某个 AI 卡片可单独打开该站点

## 📁 项目结构

```
├── manifest.json           # 扩展配置
├── popup.html/js          # 弹窗界面
├── background.js          # 后台服务
├── content-doubao.js      # 豆包内容脚本
├── content-deepseek.js    # DeepSeek内容脚本
├── content-kimi.js        # Kimi内容脚本
├── pack-crx.bat           # 打包脚本
└── dist/                   # 打包输出目录
```

## 🔧 打包说明

运行 `pack-crx.bat` 会在 `dist` 目录生成：
- `AI-aggregate-query.crx` - 扩展安装包
- `chrome-extension.pem` - 签名密钥（首次生成，请妥善保管）

## ⚠️ 注意事项

- 自动填充依赖各站点的页面结构，如遇改版可能需要手动粘贴
- 数据仅存储在本地，不会上传到任何服务器
- 需要授予扩展访问相关网站的权限

## 📄 许可证

MIT License
