# 简历发电站前端接口契约

本文档是前端已经预接入的后端接口规范。后端按本文档返回数据后，前端可以直接完成登录鉴权、今日免费次数同步、简历解析、AI 分析优化、修改前后对比、修改详情定位、保存版本和导出。

默认地址：

```env
VITE_API_BASE_URL=http://localhost:3001
```

所有请求都携带 Cookie：

```ts
fetch(url, { credentials: 'include' })
```

## 统一响应

成功：

```json
{
  "success": true,
  "data": {}
}
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

## 鉴权接口

### 发送邮箱验证码

`POST /api/auth/email-code/send`

```json
{
  "email": "student@example.com",
  "scene": "login"
}
```

`scene` 可选值：`login`、`register`、`resetPassword`。

响应：

```json
{
  "expiresIn": 300,
  "resendAfter": 60,
  "devCode": "123456"
}
```

`devCode` 只允许开发环境返回。

### 密码登录

`POST /api/auth/login`

```json
{
  "email": "student@example.com",
  "password": "password123"
}
```

响应：

```json
{
  "user": {
    "id": "user_001",
    "email": "student@example.com",
    "name": "张同学",
    "role": "USER"
  },
  "expiresAt": "2026-06-24T00:00:00.000Z"
}
```

后端需要同时设置 `resume_auth_token` HttpOnly Cookie。

### 验证码登录

`POST /api/auth/login/email-code`

```json
{
  "email": "student@example.com",
  "code": "123456"
}
```

响应同密码登录。

### 邮箱验证码注册

`POST /api/auth/register/email-code`

```json
{
  "email": "student@example.com",
  "code": "123456",
  "password": "password123",
  "name": "张同学"
}
```

响应同密码登录，注册成功后直接登录。

### 找回密码

`POST /api/auth/password/reset`

```json
{
  "email": "student@example.com",
  "code": "123456",
  "password": "newPassword123"
}
```

响应：

```json
{
  "reset": true
}
```

### 当前用户

`GET /api/auth/me`

未登录返回 `401 UNAUTHENTICATED`。

成功响应：

```json
{
  "user": {
    "id": "user_001",
    "email": "student@example.com",
    "name": "张同学",
    "role": "USER"
  }
}
```

### 退出登录

`POST /api/auth/logout`

响应：

```json
{
  "loggedOut": true
}
```

## 今日免费次数

`GET /api/usage/today`

后端只根据 Cookie 识别用户，不接受前端传 `userId`。

响应：

```json
{
  "limit": 3,
  "used": 1,
  "remaining": 2,
  "resetAt": "2026-05-25T16:00:00.000Z"
}
```

## 简历解析

### 解析上传文件

`POST /api/resumes/parse`

请求：`multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `file` | File | 是 | 支持 `.pdf`、`.doc`、`.docx`、`.txt`、`.md`、`.markdown`，建议上限 10MB |

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

`resumeId` 可选。如果解析时已经入库，建议返回，前端后续可直接调用 `/api/resumes/:id/optimize`。

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
{
  "resumeId": "resume_001"
}
```

## AI 分析优化

前端兼容两个入口，后端可任选其一，推荐新接口 `/api/resumes/:id/optimize`。

### 旧兼容入口

`POST /api/resumes/analyze`

```json
{
  "resumeText": "简历正文",
  "targetJob": "产品经理",
  "jobDescription": "目标岗位 JD，可选",
  "jobStage": "internship",
  "outputLanguage": "zh",
  "optimizeLevel": "standard",
  "originalName": "resume.pdf"
}
```

### 推荐入口

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

字段枚举：

| 字段 | 可选值 |
|---|---|
| `jobStage` | `internship`、`campus`、`social`、`graduate`、`career_change`、`other` |
| `outputLanguage` | `zh`、`en` |
| `optimizeLevel` | `conservative`、`standard`、`strong` |

成功响应必须包含：

```json
{
  "resumeId": "resume_001",
  "analysisId": "analysis_001",
  "versionId": "version_002",
  "remaining": 2,
  "usage": {
    "limit": 3,
    "used": 1,
    "remaining": 2,
    "resetAt": "2026-05-25T16:00:00.000Z"
  },
  "analysis": {
    "analysisId": "analysis_001",
    "resumeId": "resume_001",
    "versionId": "version_002",
    "score": 86,
    "matchRate": 78,
    "grade": "优秀",
    "summary": "整体简历质量良好，已完成结构、表达和关键词优化。",
    "issues": [
      {
        "level": "medium",
        "text": "项目成果缺少量化结果",
        "sectionId": "work",
        "suggestion": "补充业务指标。"
      }
    ],
    "keywords": ["产品设计", "用户研究", "数据分析"]
  },
  "diff": {
    "resumeId": "resume_001",
    "versionId": "version_002",
    "targetRole": "产品经理",
    "beforeMarkdown": "# 张一凡\n\n## 个人简介\n\n具备3年产品经理经验...",
    "afterMarkdown": "# 张一凡\n\n## 个人简介\n\n3年产品经理经验，主导过从0到1...",
    "score": {
      "before": 68,
      "after": 86
    },
    "stats": {
      "total": 23,
      "added": 8,
      "optimized": 12,
      "removed": 3
    },
    "summary": "AI 已从内容表达、结构布局、关键词匹配等维度完成优化。",
    "suggestions": ["补充真实业务指标", "导出前核对新增内容"],
    "changes": [
      {
        "id": "change_001",
        "resumeId": "resume_001",
        "versionId": "version_002",
        "sectionId": "profile",
        "section": "个人简介",
        "type": "optimized",
        "title": "优化能力摘要",
        "before": "具备3年产品经理经验，熟悉产品从0到1的流程。",
        "after": "3年产品经理经验，主导过从0到1的产品设计与落地。",
        "reason": "突出主导能力和岗位相关性。",
        "impact": "提升专业表达和岗位匹配度",
        "startIndex": 12,
        "endIndex": 46,
        "order": 1
      }
    ]
  },
  "optimizedResume": {
    "markdown": "# 张一凡\n\n## 个人简介...",
    "editorSections": [
      {
        "id": "profile",
        "label": "个人简介",
        "original": "具备3年产品经理经验...",
        "optimized": "3年产品经理经验，主导过从0到1...",
        "reason": "突出岗位能力。",
        "order": 10
      }
    ],
    "preview": {
      "name": "张一凡",
      "title": "产品经理｜3年经验",
      "theme": "lapis-cv",
      "lines": ["Axure RP / Figma / Jira", "SQL / Excel"]
    }
  },
  "lapisMarkdown": "# 张一凡\n\n## 个人简介..."
}
```

前端优先使用 `diff`。如果没有 `diff`，会退回读取顶层 `beforeMarkdown`、`afterMarkdown`、`changes`；再退回 `optimizedResume.markdown`。

关键要求：

- `beforeMarkdown` 和 `afterMarkdown` 必须是完整可渲染 Markdown。
- `changes[].before` 必须能在 `beforeMarkdown` 中找到，方便高亮原文。
- `changes[].after` 必须能在 `afterMarkdown` 中找到，方便高亮修改后内容。
- `type` 只允许 `added`、`optimized`、`removed`。
- 不要让 AI 虚构公司、学校、项目、证书、时间和具体数字。需要用户补充的数字请写成“建议补充：xxx”。

## 获取版本对比数据

`GET /api/resumes/:resumeId/versions/:versionId/diff`

响应：返回完整 `diff` 对象。

前端在编辑导出页会调用此接口补拉对比数据。

## 保存优化版本

`PUT /api/resumes/versions/:versionId`

```json
{
  "markdown": "# 张一凡\n\n## 个人简介...",
  "theme": "lapis-cv",
  "changes": [
    {
      "id": "change_001",
      "section": "个人简介",
      "type": "optimized",
      "before": "原文",
      "after": "优化后",
      "reason": "优化原因"
    }
  ]
}
```

响应：

```json
{
  "versionId": "version_002",
  "savedAt": "2026-05-25T12:00:00.000Z"
}
```

## 导出

### 导出 PDF

`POST /api/resumes/:resumeId/export/pdf`

```json
{
  "versionId": "version_002",
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

### 导出 Word

`POST /api/resumes/:resumeId/export/docx`

请求和响应同 PDF，文件名后缀为 `.docx`。

## 列表和历史

### 简历列表

`GET /api/resumes`

```json
{
  "items": [
    {
      "id": "resume_001",
      "title": "产品经理简历",
      "sourceType": "text",
      "createdAt": "2026-05-25T12:00:00.000Z",
      "updatedAt": "2026-05-25T12:00:00.000Z",
      "latestVersionId": "version_002",
      "latestScore": 86
    }
  ]
}
```

### 优化历史

`GET /api/resumes/history`

```json
{
  "items": [
    {
      "resumeId": "resume_001",
      "versionId": "version_002",
      "title": "产品经理简历",
      "targetRole": "产品经理",
      "score": 86,
      "stats": {
        "total": 23,
        "added": 8,
        "optimized": 12,
        "removed": 3
      },
      "createdAt": "2026-05-25T12:00:00.000Z"
    }
  ]
}
```

## 错误码和中文提示

| code | 前端提示 |
|---|---|
| `VALIDATION_ERROR` | 提交内容不符合要求，请检查表单后再试 |
| `EMAIL_ALREADY_EXISTS` | 该邮箱已注册，请直接登录 |
| `EMAIL_NOT_REGISTERED` | 该邮箱尚未注册，请先免费注册 |
| `EMAIL_CODE_INVALID` | 验证码不正确，请重新输入 |
| `EMAIL_CODE_EXPIRED` | 验证码已过期，请重新获取 |
| `EMAIL_CODE_TOO_FREQUENT` | 验证码发送太频繁，请稍后再试 |
| `EMAIL_CODE_SEND_FAILED` | 验证码邮件发送失败，请稍后重试 |
| `INVALID_CREDENTIALS` | 邮箱、密码或验证码不正确，请重新输入 |
| `UNAUTHENTICATED` | 请先登录后再使用免费优化次数 |
| `DAILY_LIMIT_EXCEEDED` | 今天的免费优化次数已经用完 |
| `FILE_TOO_LARGE` | 文件超过大小限制，请上传 10MB 以内的文件 |
| `UNSUPPORTED_FILE_TYPE` | 文件类型不支持，请上传 TXT、DOCX 或 PDF |
| `PARSE_FAILED` | 文件解析失败，请改用文本粘贴 |
| `AI_FAILED` | AI 分析暂时失败，请稍后重试，本次不扣次数 |
| `AI_JSON_INVALID` | AI 返回格式异常，请稍后重试，本次不扣次数 |
| `NOT_FOUND` | 资源不存在，或你没有权限访问 |
| `PDF_EXPORT_UNAVAILABLE` | PDF 导出暂不可用，请稍后再试 |
| `NETWORK_ERROR` | 无法连接后端服务，请确认后端已启动 |

## 前后端联调验收标准

1. 登录或注册成功后，`GET /api/usage/today` 返回真实次数，首页和顶部次数同步刷新。
2. 上传文件调用 `/api/resumes/parse`，返回文本后自动填入优化表单。
3. 点击“开始免费 AI 分析”后，后端扣减次数并返回 `diff`。
4. 编辑导出页显示评分、修改统计、修改前/修改后双栏对比、右侧修改详情。
5. 点击右侧某条修改详情，页面能平滑定位到对应高亮文本。
6. 点击“全局预览”展示完整优化后简历。
7. 点击“保存版本”调用 `PUT /api/resumes/versions/:versionId`。
8. 点击“导出 PDF / Word”调用对应导出接口，并打开 `downloadUrl`。
