# 🌐 简历发电站前端

React + Vite 实现的简历优化工作台，负责用户登录注册、简历上传解析、AI 分析进度、结果展示、历史记录回显、编辑导出等交互。

## ✨ 功能模块

- ⚡ 首页与免费优化入口
- 🔐 邮箱验证码登录 / 注册 / 找回密码
- 📄 PDF、Word、文本简历上传与解析
- 🌊 AI 分析进度展示与流式结果接收
- 📊 简历评分、匹配度、问题清单、价值提炼展示
- 📝 优化版简历编辑、预览、保存版本
- 📤 Markdown 复制、Word 导出、PDF 导出
- 🕘 历史记录列表与详情恢复

## 🛠️ 技术栈

- React 19
- TypeScript
- Vite
- Framer Motion
- Lucide React

## 🚀 本地运行

```bash
npm install
copy .env.example .env
npm run dev
```

`.env` 示例：

```env
VITE_API_BASE_URL="http://localhost:3001"
```

## 📦 构建

```bash
npm run build
npm run preview
```

## 🔌 后端对接

前端通过 `src/lib/api.ts` 统一访问后端接口，默认读取：

```ts
import.meta.env.VITE_API_BASE_URL
```

本地联调时请保证：

- 后端服务已启动在 `http://localhost:3001`
- 后端 `WEB_ORIGIN` 包含前端地址
- 浏览器请求携带 Cookie，服务端负责鉴权与次数校验

## 📁 目录说明

```text
src/
├─ app/          # 页面入口
├─ components/   # UI 与业务组件
├─ lib/          # API、解析、适配器、工具函数
├─ stores/       # 前端状态
└─ types/        # 类型定义
```

## 🧪 常用命令

```bash
npm run dev      # 开发
npm run build    # 类型检查 + 打包
npm run lint     # ESLint
npm run preview  # 预览构建产物
```
