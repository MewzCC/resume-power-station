# 用户历史记录 API 设计与对接规范

本文档是用户历史记录功能的独立接口规范。历史记录按“优化版本”建模：一次 AI 优化、一次保存恢复、一次手动保存后的版本，都可以成为用户可查看、可回显、可恢复的历史节点。

Base URL：

```text
http://localhost:3001
```

所有接口都需要登录，并携带 HttpOnly Cookie：

```ts
fetch(url, { credentials: 'include' })
```

## 设计目标

- 用户能查看自己的历史优化记录，支持分页、关键词、岗位、时间筛选。
- 用户能打开任意历史详情，前端可直接回显到“分析结果页 / 编辑导出页 / 优化表单”。
- 用户能恢复历史版本，默认恢复为一个新版本，不覆盖旧数据。
- 用户能归档历史记录；归档是软删除，可恢复，不做物理删除。
- 后端只按 Cookie 鉴权，不信任前端传 `userId`。
- 历史详情必须做资源归属校验，越权统一返回 `404 NOT_FOUND`。

## 数据模型

历史记录复用 `OptimizedVersion`，并新增字段：

| 字段 | 说明 |
|---|---|
| `snapshotJson` | 版本生成或保存时的快照，包含原始简历、表单参数、分析、优化简历、Markdown、diff |
| `restoredFromVersionId` | 如果该历史由恢复动作生成，记录来源版本 ID |
| `deletedAt` | 软删除/归档时间；为空表示正常显示 |

旧数据没有 `snapshotJson` 时，后端会从 `Resume`、`ResumeAnalysis`、`OptimizedVersion` 兜底重建回显数据。

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
    "code": "UNAUTHENTICATED",
    "message": "请先登录后再使用免费优化次数",
    "details": {}
  }
}
```

## 1. 历史列表

`GET /api/history/resume-versions`

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `cursor` | string | 否 | 下一页游标，使用上一页返回的 `pageInfo.nextCursor` |
| `limit` | number | 否 | 每页数量，默认 20，最大 50 |
| `q` | string | 否 | 搜索原文件名或目标岗位 |
| `targetRole` | string | 否 | 按目标岗位模糊筛选 |
| `from` | ISO string | 否 | 创建时间起点 |
| `to` | ISO string | 否 | 创建时间终点 |
| `includeArchived` | boolean | 否 | 是否包含归档记录，默认 false |

响应：

```json
{
  "items": [
    {
      "historyId": "version_001",
      "resumeId": "resume_001",
      "versionId": "version_001",
      "title": "产品经理简历",
      "versionName": "AI optimized version",
      "targetRole": "产品经理",
      "sourceType": "pdf",
      "score": 86,
      "matchRate": 78,
      "summary": "整体简历质量良好，已完成结构、表达和关键词优化。",
      "markdownPreview": "# 张同学 产品经理...",
      "archived": false,
      "canRestore": true,
      "restoredFromVersionId": null,
      "createdAt": "2026-05-25T12:00:00.000Z",
      "updatedAt": "2026-05-25T12:03:00.000Z"
    }
  ],
  "pageInfo": {
    "limit": 20,
    "nextCursor": "version_002",
    "hasMore": true
  }
}
```

前端建议：

- 历史页用 `items` 渲染卡片或表格。
- 加载更多时传 `cursor=pageInfo.nextCursor`。
- 默认不要传 `includeArchived`，避免把用户已归档记录混进常规列表。

## 2. 历史详情与回显

`GET /api/history/resume-versions/:historyId`

响应：

```json
{
  "historyId": "version_001",
  "resumeId": "resume_001",
  "versionId": "version_001",
  "title": "产品经理简历",
  "versionName": "AI optimized version",
  "targetRole": "产品经理",
  "sourceType": "text",
  "score": 86,
  "matchRate": 78,
  "archived": false,
  "analysisId": "analysis_001",
  "analysis": {
    "oneSentenceConclusion": "这份简历具备基础经历，但需要补强量化结果。",
    "score": 86,
    "matchRate": 78,
    "mainProblems": [],
    "valueExtraction": [],
    "missingKeywords": [],
    "questionsToAsk": [],
    "actionItems": []
  },
  "optimizedResume": {
    "markdown": "# 张同学\n\n## 个人简介...",
    "diff": {}
  },
  "diff": {
    "resumeId": "resume_001",
    "versionId": "version_001",
    "targetRole": "产品经理",
    "beforeMarkdown": "# 原始简历\n\n...",
    "afterMarkdown": "# 优化后简历\n\n...",
    "score": { "before": 74, "after": 86 },
    "stats": { "total": 1, "added": 0, "optimized": 1, "removed": 0 },
    "summary": "这份简历具备基础经历，但需要补强量化结果。",
    "suggestions": ["补充真实业务指标"],
    "changes": []
  },
  "lapisMarkdown": "# 张同学\n\n## 个人简介...",
  "lapisTheme": "lapis-cv",
  "editorPayload": {
    "sourceResumeId": "resume_001",
    "resumeText": "原始简历正文",
    "originalName": "resume.pdf",
    "targetJob": "产品经理",
    "jobDescription": "目标岗位 JD",
    "jobStage": "campus",
    "outputLanguage": "zh",
    "optimizeLevel": "standard"
  },
  "restoreOptions": {
    "defaultMode": "newVersion",
    "modes": ["newVersion", "newResume"],
    "safeRestore": true
  }
}
```

前端回显建议：

- 分析结果页：使用 `analysis`、`diff`、`optimizedResume`。
- 编辑导出页：使用 `diff.afterMarkdown` 或 `lapisMarkdown` 初始化编辑器。
- 优化表单页：使用 `editorPayload` 填充 `resumeText`、`targetJob`、`jobDescription`、`jobStage`、`outputLanguage`、`optimizeLevel`。
- 如果历史已归档，仍可查看详情；常规列表默认不显示。

## 3. 恢复历史

`POST /api/history/resume-versions/:historyId/restore`

请求：

```json
{
  "restoreMode": "newVersion",
  "versionName": "恢复版本 - 产品经理"
}
```

字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `restoreMode` | enum | 否 | `newVersion` 或 `newResume`，默认 `newVersion` |
| `versionName` | string | 否 | 恢复后的版本名称 |

恢复模式：

- `newVersion`：在原 `resumeId` 下复制一个新优化版本。推荐默认模式，不覆盖旧数据。
- `newResume`：复制原始简历和优化版本，生成一个新的 `resumeId`。适合用户想把历史版本作为新简历继续编辑。

响应：

```json
{
  "restored": true,
  "restoreMode": "newVersion",
  "resumeId": "resume_001",
  "versionId": "version_009",
  "historyId": "version_009",
  "restoredFromVersionId": "version_001",
  "editorPayload": {
    "sourceResumeId": "resume_001",
    "resumeText": "原始简历正文",
    "originalName": "resume.pdf",
    "targetJob": "产品经理",
    "jobDescription": "目标岗位 JD",
    "jobStage": "campus",
    "outputLanguage": "zh",
    "optimizeLevel": "standard"
  }
}
```

前端恢复后建议：

- 如果用户点击“恢复并编辑”，跳转编辑导出页并传新 `resumeId/versionId`。
- 如果用户点击“恢复到优化表单”，用 `editorPayload` 回填表单。
- 恢复不扣免费次数，因为没有调用 AI。

## 4. 归档历史

`DELETE /api/history/resume-versions/:historyId`

说明：这是软删除，只写入 `deletedAt`，不会物理删除数据。

响应：

```json
{
  "historyId": "version_001",
  "archived": true,
  "deletedAt": "2026-05-25T12:10:00.000Z"
}
```

安全策略：

- 只能归档当前用户自己的历史。
- 归档后默认列表不显示。
- 归档记录仍可在 `includeArchived=true` 时查看。

## 5. 取消归档

`POST /api/history/resume-versions/:historyId/unarchive`

响应：

```json
{
  "historyId": "version_001",
  "archived": false,
  "updatedAt": "2026-05-25T12:12:00.000Z"
}
```

## 安全与风控

- 所有接口必须登录。
- 后端从 `resume_auth_token` 解析用户，不接受前端传 `userId`。
- 查询条件强制附加 `resume.userId = currentUser.id`。
- 越权访问和不存在都返回 `404 NOT_FOUND`，避免泄露其他用户资源是否存在。
- 恢复使用复制策略，不覆盖历史原记录，降低误操作风险。
- 归档是软删除，便于用户撤销，也便于后续做数据恢复。
- 历史恢复不扣次数；只有 AI 优化成功才扣今日免费次数。
- `snapshotJson` 保存的是用户简历内容，生产环境数据库备份要加密或限制访问权限。

## 数据恢复策略

场景一：用户误归档。

1. 前端在历史页打开“已归档”筛选。
2. 调用 `POST /api/history/resume-versions/:historyId/unarchive`。
3. 刷新列表。

场景二：用户想恢复旧优化版本。

1. 调用详情接口确认版本内容。
2. 调用恢复接口，默认 `restoreMode=newVersion`。
3. 后端复制历史版本，返回新的 `versionId`。
4. 前端跳转编辑导出页展示新版本。

场景三：旧数据没有快照。

1. 后端用 `Resume.originalText`、`ResumeAnalysis.analysisJson`、`OptimizedVersion.optimizedJson/lapisMarkdown` 重建详情。
2. 新保存或新恢复后的版本会重新写入 `snapshotJson`。

## 前端最小接入顺序

1. 历史页：接 `GET /api/history/resume-versions`。
2. 历史详情弹窗或详情页：接 `GET /api/history/resume-versions/:historyId`。
3. 恢复按钮：接 `POST /api/history/resume-versions/:historyId/restore`。
4. 删除按钮改名为“归档”：接 `DELETE /api/history/resume-versions/:historyId`。
5. 已归档筛选：列表请求加 `includeArchived=true`，取消归档接 `POST /unarchive`。
