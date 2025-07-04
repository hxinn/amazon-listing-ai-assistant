# Amazon Listing AI Assistant

## 项目概述

Amazon Listing AI Assistant 是一个基于人工智能的工具，专为亚马逊卖家设计。它能够帮助卖家快速生成符合 Amazon 产品 JSON Schema 规范的产品数据，大幅提高产品上架效率。通过集成 Google Gemini AI 技术，该工具可以智能解析 Schema 结构，并根据用户提供的参考信息，自动生成高质量的产品数据。

### 主要优势

- **提高效率**：自动化生成符合亚马逊要求的产品数据，节省手动编写 JSON 的时间
- **降低错误**：实时验证确保生成的数据符合亚马逊的格式要求
- **易于使用**：直观的用户界面，无需编程知识即可操作
- **灵活定制**：支持用户提供参考信息，指导 AI 生成更符合期望的结果

## 功能特性

- 📁 支持上传 Amazon Listing JSON Schema 文件
- 🎯 智能选择 Schema 中的特定属性
- 🤖 基于 Google Gemini AI 生成符合规范的 JSON 数据
- 📝 支持用户输入参考信息来指导 AI 生成
- 📋 一键复制生成的 JSON 数据
- ✅ 实时验证生成数据的格式正确性

## 技术栈

- **前端框架**: React
- **构建工具**: Vite
- **语言**: TypeScript
- **AI 服务**: Google Gemini AI
- **样式**: tailwind css

## 本地运行

**前置要求**: Node.js (推荐 v18 或更高版本)

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **配置 API 密钥**:
   - 创建 `.env` 文件（可参考项目中的配置）
   - 添加你的 Google Gemini API Key:
     ```
     GEMINI_API_KEY=your_gemini_api_key_here
     ```
   - 获取 API Key: [Google AI Studio](https://aistudio.google.com/apikey)

3. **启动开发服务器**:
   ```bash
   npm run dev
   ```

4. **访问应用**: 打开浏览器访问 `http://localhost:5173`

## 构建部署

```bash
# 生产构建
npm run build

# 预览构建结果
npm run preview
```

## 使用说明

1. **上传 Schema**: 点击上传按钮，选择你的 Amazon Listing JSON Schema 文件
2. **选择属性**: 从下拉菜单中选择要生成数据的具体属性
3. **添加参考信息** (可选): 在文本框中输入产品描述或部分 JSON 来指导 AI 生成
4. **生成数据**: 点击"Generate JSON"按钮
5. **复制结果**: 使用"Copy"按钮复制生成的 JSON 数据

## 项目结构

```
amazon-listing-ai-assistant/
├── index.html          # HTML 入口文件
├── index.tsx           # 主应用组件
├── index.css           # 样式文件
├── vite.config.ts      # Vite 配置
├── tsconfig.json       # TypeScript 配置
├── package.json        # 项目依赖和脚本
└── README.md           # 项目说明
```

## 许可证

MIT License
