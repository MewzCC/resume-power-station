# ⚡ 简历发电站 Resume Power Station

一个面向求职者的 AI 简历优化单仓项目：前端负责上传、解析、进度展示、分析结果和编辑导出；后端负责注册登录、邮箱验证码、服务端免费次数校验、简历解析、AI 优化、历史记录、Word/PDF 导出。

## 🧭 仓库结构

```text
resume-power-station/
├─ front/   # React + Vite 前端
└─ back/    # Fastify + TypeScript 后端
```

## ✨ 核心能力

- 🔐 邮箱验证码注册登录，验证码存 Redis，用户数据存 MySQL
- 🛡️ 服务端鉴权与每日免费次数校验，避免前端绕过和接口被刷
- 📄 PDF / Word / 文本简历解析，PDF 使用坐标解析提升版面还原
- 🤖 OpenAI-compatible AI 接口，支持 DeepSeek / OpenAI / 中转网关
- 🌊 流式优化接口，前端可展示分析进度
- 🕘 用户历史记录，支持回显、恢复、查看优化版本
- 📤 Markdown、Word、PDF 导出，适配 LapisCV 样式

## 🚀 本地启动

### 1. 启动后端

```bash
cd back
npm install
copy .env.example .env
npm run prisma:generate
npm run dev
```

后端默认地址：`http://localhost:3001`

### 2. 启动前端

```bash
cd front
npm install
copy .env.example .env
npm run dev
```

前端默认地址：`http://localhost:3000` 或 Vite 输出的本地地址。

## 🧩 基础依赖

- Node.js 20+
- MySQL 8+
- Redis 6+
- SMTP 邮箱服务，例如 163 邮箱授权码
- DeepSeek / OpenAI-compatible API Key

## 🔒 安全说明

- `.env` 已被 `.gitignore` 忽略，仓库只提交 `.env.example`
- 验证码只写入 Redis，不落 MySQL
- 免费次数由后端鉴权后计算，前端展示只作为 UI
- 生产环境请配置 HTTPS、强随机 Cookie Secret、严格 CORS 域名

## 📚 子项目文档

- 🌐 前端说明：[front/README.md](front/README.md)
- 🧠 后端说明：[back/README.md](back/README.md)
- 📘 后端接口文档：[back/docs/API.md](back/docs/API.md)
- 🕘 历史记录接口：[back/docs/HISTORY_API.md](back/docs/HISTORY_API.md)
- ⚙️ 性能优化记录：[back/docs/AI_OPTIMIZATION_PERFORMANCE.md](back/docs/AI_OPTIMIZATION_PERFORMANCE.md)

## 🧪 常用命令

```bash
# 前端构建
cd front && npm run build

# 后端构建
cd back && npm run build

# 后端类型检查
cd back && npm run typecheck
```

## 📝 提交规范

提交日志使用：

```text
<type>(<scope>): <subject>
```

示例：

```text
feat(auth): 完成邮箱验证码注册登录
fix(ai): 修复流式优化返回格式异常
docs(repo): 重写单仓项目说明文档
```
