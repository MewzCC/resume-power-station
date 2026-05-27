# 简历发电站后端接口文档

本文档以 `D:\Codex\resume-power-station\docs\API.md` 的前端契约为准，旧版 `docs` 中的二进制导出和单步 `/api/resumes/analyze` 流程仅保留兼容。

用户历史记录的分页、详情回显、恢复和归档接口见独立文档：`docs/HISTORY_API.md`。

Base URL：

```env
VITE_API_BASE_URL=http://localhost:3001
```

所有前端请求必须携带 Cookie：

```ts
fetch(url, { credentials: 'include' })
```

## 统一响应

成功：

```json
{ "success": true, "data": {} }
```

失败：

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "提交内容不符合要求",
    "details": {}
  }
}
```

## 鉴权与次数

后端只信任 `resume_auth_token` HttpOnly Cookie，不接受前端传 `userId`。

- `POST /api/auth/email-code/send`：发送验证码，`scene` 为 `login`、`register`、`resetPassword`
- `POST /api/auth/login`：邮箱密码登录
- `POST /api/auth/login/email-code`：验证码登录
- `POST /api/auth/register/email-code`：验证码注册，成功后直接登录
- `POST /api/auth/password/reset`：找回密码
- `GET /api/auth/me`：当前用户
- `POST /api/auth/logout`：退出登录
- `GET /api/usage/today`：今日免费次数

验证码存 Redis，有效期 5 分钟；用户、会话、次数和简历数据存 MySQL。每日免费次数由服务端按登录用户和 `Asia/Shanghai` 日期计算，AI 优化成功后才扣减。

## 简历接口

### 解析上传文件

`POST /api/resumes/parse`

请求：`multipart/form-data`，字段 `file`。

响应：

```json
{
  "resumeId": "resume_001",
  "text": "解析后的纯文本",
  "markdown": "# 张同学\n\n## 工作经历...",
  "originalName": "resume.pdf",
  "size": 204800
}
```

### 创建文本简历

`POST /api/resumes`

```json
{
  "title": "产品经理简历",
  "sourceType": "text",
  "content": "用户粘贴的简历正文",
  "originalName": "paste.txt"
}
```

响应：

```json
{ "resumeId": "resume_001" }
```

### AI 简历分块整理

`POST /api/resumes/segment`

用于把 PDF/Word 解析出的散乱纯文本整理成标准简历模块。该接口需要登录，会调用 AI，但不扣减每日免费优化次数。

请求：

```json
{
  "resumeText": "PDF 或 Word 解析出的简历纯文本",
  "originalName": "resume.pdf"
}
```

响应：

```json
{
  "text": "【基本信息】\n张三...\n\n【教育经历】\n...",
  "sections": [
    {
      "title": "基本信息",
      "type": "basic",
      "content": "张三...",
      "confidence": 0.92
    }
  ],
  "warnings": []
}
```

`sections[].type` 可选值：`basic`、`intention`、`education`、`skills`、`work`、`internship`、`project`、`campus`、`awards`、`research`、`summary`、`other`。

### 流式 AI 简历分块整理

`POST /api/resumes/segment/stream`

请求体同 `/api/resumes/segment`。响应类型为 `text/event-stream`，用于向前端推送 AI 分块进度；前端只接收 AI 成功后的分块正文，不再使用规则分块或旧解析结果兜底。

事件格式：

```text
data: {"stage":"done","progress":100,"message":"AI 分块完成：6 个模块。","text":"【基本信息】...","sections":[...],"warnings":[]}
```

阶段：

| stage | 说明 |
|---|---|
| `accepted` | 后端已接收简历文本 |
| `segmenting` | 正在调用 AI 校正文档结构和模块归属 |
| `done` | AI 分块完成，事件中包含完整 `result`、`text`、`sections` |
| `error` | 分块失败，事件中包含 `error` |

前端推荐使用该接口；同步 `/api/resumes/segment` 仅作为兼容入口。后端不会再使用规则分块兜底，AI 返回异常时会直接返回错误。

### 推荐优化入口

`POST /api/resumes/:id/optimize`

```json
{
  "targetRole": "产品经理",
  "targetJD": "目标岗位 JD，可选",
  "jobStage": "internship",
  "outputLanguage": "zh",
  "optimizeLevel": "standard"
}
```

成功响应包含 `resumeId`、`analysisId`、`versionId`、`usage`、`analysis`、`diff`、`optimizedResume`、`lapisMarkdown`。前端优先读取 `diff`：

```json
{
  "resumeId": "resume_001",
  "analysisId": "analysis_001",
  "versionId": "version_001",
  "remaining": 2,
  "usage": {
    "limit": 3,
    "used": 1,
    "remaining": 2,
    "resetAt": "2026-05-25T16:00:00.000Z"
  },
  "diff": {
    "resumeId": "resume_001",
    "versionId": "version_001",
    "targetRole": "产品经理",
    "beforeMarkdown": "# 原始简历\n\n...",
    "afterMarkdown": "# 优化后简历\n\n...",
    "score": { "before": 68, "after": 86 },
    "stats": { "total": 1, "added": 0, "optimized": 1, "removed": 0 },
    "summary": "AI 已完成优化。",
    "suggestions": ["补充真实业务指标"],
    "changes": []
  },
  "lapisMarkdown": "# 优化后简历..."
}
```

### 旧兼容优化入口

`POST /api/resumes/analyze`

仍可用；它会直接创建简历并优化。新前端优先使用 `/api/resumes` + `/api/resumes/:id/optimize`。

### 流式优化入口

`POST /api/resumes/:id/optimize/stream`

请求体同 `/api/resumes/:id/optimize`。响应类型为 `text/event-stream`，每个事件格式：

```text
data: {"stage":"calling_ai","progress":38,"message":"正在调用 AI 生成结构化优化结果"}
```

阶段：

| stage | 说明 |
|---|---|
| `accepted` | 后端已接收请求 |
| `checking_usage` | 校验登录态和今日免费次数 |
| `loading_resume` | 读取并整理简历 |
| `calling_ai` | 调用 AI |
| `saving_version` | 保存版本和历史快照 |
| `done` | 完成，事件中包含完整 `result` |
| `error` | 失败，事件中包含 `error` |

`done` 事件示例：

```text
data: {"stage":"done","progress":100,"message":"优化完成","result":{...AnalyzeResumeResult}}
```

前端应优先使用流式接口展示真实进度；如果部署环境不支持流式响应，可回退到同步优化入口。

## 对比、保存、列表

- `GET /api/resumes/:resumeId/versions/:versionId/diff`：获取完整 `diff`
- `PUT /api/resumes/versions/:versionId`：保存编辑后的 Markdown 和 theme
- `GET /api/resumes`：简历列表
- `GET /api/resumes/history`：优化历史

保存版本请求：

```json
{
  "markdown": "# 张一凡\n\n## 个人简介...",
  "theme": "lapis-cv",
  "changes": []
}
```

响应：

```json
{
  "versionId": "version_001",
  "savedAt": "2026-05-25T12:00:00.000Z"
}
```

## 导出

新前端需要 JSON 下载地址，不再直接接收二进制响应。

### PDF

`POST /api/resumes/:resumeId/export/pdf`

```json
{
  "versionId": "version_001",
  "markdown": "# 张一凡\n\n## 个人简介...",
  "theme": "lapis-cv",
  "filename": "resume-产品经理.pdf"
}
```

响应：

```json
{
  "downloadUrl": "http://localhost:3001/downloads/resume.pdf",
  "filename": "resume-产品经理.pdf",
  "expiresAt": "2026-05-25T12:10:00.000Z"
}
```

### Word

`POST /api/resumes/:resumeId/export/docx`

请求和响应同 PDF，文件名后缀为 `.docx`。

下载地址：

`GET /downloads/:filename`

## 错误码

常用错误码：`VALIDATION_ERROR`、`UNAUTHENTICATED`、`EMAIL_ALREADY_EXISTS`、`EMAIL_NOT_REGISTERED`、`EMAIL_CODE_INVALID`、`EMAIL_CODE_EXPIRED`、`EMAIL_CODE_TOO_FREQUENT`、`EMAIL_CODE_SEND_FAILED`、`INVALID_CREDENTIALS`、`DAILY_LIMIT_EXCEEDED`、`FILE_TOO_LARGE`、`UNSUPPORTED_FILE_TYPE`、`PARSE_FAILED`、`AI_FAILED`、`AI_JSON_INVALID`、`NOT_FOUND`、`PDF_EXPORT_UNAVAILABLE`、`NETWORK_ERROR`。
