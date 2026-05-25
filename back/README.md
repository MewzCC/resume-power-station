# 🧠 简历发电站后端

Fastify + TypeScript 后端服务，负责用户体系、验证码、免费次数、简历解析、AI 优化、历史记录、导出与下载。

## ✨ 核心能力

- 🔐 邮箱验证码注册、登录、找回密码
- 🚦 Redis 验证码、冷却时间、邮箱/IP 小时级限流
- 🗄️ MySQL + Prisma 存储用户、简历、分析结果、历史记录
- 🛡️ 服务端鉴权与每日免费次数扣减，防止前端绕过
- 📄 PDF 坐标解析、Word 解析、文本清洗与结构化
- 🤖 DeepSeek / OpenAI-compatible AI 分析与优化
- 🌊 SSE 流式优化接口，便于前端展示阶段进度
- 📤 Markdown、Word、PDF 导出

## 🧩 技术栈

- Node.js 20+
- Fastify 5
- TypeScript
- Prisma
- MySQL 8+
- Redis 6+
- Nodemailer
- pdfjs-dist / pdf-parse / mammoth

## 🚀 本地启动

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run dev
```

服务默认监听：`http://localhost:3001`

健康检查：

```bash
curl http://localhost:3001/health
```

## 🗄️ 数据库初始化

方式一：使用 Prisma migration。

```bash
npm run prisma:migrate
```

方式二：直接执行 SQL 初始化文件。

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS resume_power_station DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p resume_power_station < database/init_mysql.sql
```

## ⚙️ 环境变量

复制示例文件：

```bash
copy .env.example .env
```

重点配置：

- `DATABASE_URL`：MySQL 连接串
- `REDIS_URL`：Redis 连接串
- `OPENAI_API_KEY`：AI 服务 Key
- `OPENAI_BASE_URL`：DeepSeek / OpenAI-compatible 网关地址
- `SMTP_HOST`、`SMTP_USER`、`SMTP_PASS`：邮箱验证码 SMTP 配置
- `DAILY_OPTIMIZE_LIMIT`：普通用户每日免费分析次数
- `WEB_ORIGIN`：允许跨域访问的前端地址

## 🔌 主要接口

- `POST /api/auth/email-code/send`：发送邮箱验证码
- `POST /api/auth/register`：注册
- `POST /api/auth/login`：登录
- `POST /api/auth/password/reset`：找回密码
- `GET /api/auth/me`：当前用户
- `GET /api/usage/today`：今日免费次数
- `POST /api/resumes/parse`：解析简历文件
- `POST /api/resumes/:resumeId/optimize/stream`：流式 AI 优化
- `GET /api/history`：历史记录列表
- `GET /api/history/:id`：历史记录详情
- `POST /api/resumes/:resumeId/export/word`：导出 Word
- `POST /api/resumes/:resumeId/export/pdf`：导出 PDF

完整接口见：[docs/API.md](docs/API.md)

## 🔒 安全策略

- `.env` 不提交，只提交 `.env.example`
- 验证码只保存在 Redis，默认 5 分钟过期
- 同邮箱同场景默认 60 秒内只能发送一次
- 邮箱与 IP 都做小时级限流
- 免费次数只在服务端鉴权后计算与扣减
- 生产环境请关闭开发兜底，配置严格 CORS 与 HTTPS

## 🧪 常用命令

```bash
npm run dev              # 开发监听
npm run build            # 编译
npm run start            # 运行编译产物
npm run typecheck        # 类型检查
npm run prisma:generate  # 生成 Prisma Client
npm run prisma:migrate   # 执行迁移
npm run prisma:studio    # 打开 Prisma Studio
```
