# AI 分析任务持久化接口建议

当前前端已经做到：用户在同一个浏览器会话内切换页面时，AI 分析请求不会因为优化页卸载而中断，并会显示跨页面的“后台分析中”状态条。

如果后续需要支持刷新页面、关闭浏览器后继续查看分析进度，建议后端把一次 AI 分析建模为可查询任务。

## 推荐流程

1. 前端提交优化请求，后端立即创建任务并返回 `taskId`。
2. 前端根据 `taskId` 订阅 SSE 或轮询任务状态。
3. 用户刷新页面后，前端调用“当前进行中任务”接口恢复状态。
4. 任务完成后，后端返回 `resumeId`、`versionId`、`analysisId`，前端跳转结果页。

## 创建任务

`POST /api/resumes/:resumeId/optimize/tasks`

请求体沿用当前优化参数：

```json
{
  "targetRole": "产品经理",
  "targetJD": "岗位 JD",
  "jobStage": "campus",
  "outputLanguage": "zh",
  "optimizeLevel": "standard"
}
```

响应：

```json
{
  "taskId": "task_001",
  "resumeId": "resume_001",
  "status": "queued",
  "createdAt": "2026-05-25T14:00:00.000Z"
}
```

## 查询当前任务

`GET /api/analysis-tasks/current`

说明：只返回当前登录用户最近一个未完成任务；没有任务时返回 `task: null`。

```json
{
  "task": {
    "taskId": "task_001",
    "resumeId": "resume_001",
    "status": "running",
    "stage": "calling_ai",
    "progress": 0.56,
    "message": "正在生成优化方案",
    "createdAt": "2026-05-25T14:00:00.000Z",
    "updatedAt": "2026-05-25T14:01:00.000Z"
  }
}
```

## 查询任务详情

`GET /api/analysis-tasks/:taskId`

```json
{
  "taskId": "task_001",
  "status": "done",
  "stage": "done",
  "progress": 1,
  "message": "优化完成",
  "resumeId": "resume_001",
  "versionId": "version_001",
  "analysisId": "analysis_001",
  "result": {}
}
```

状态枚举建议：

```text
queued | running | done | failed | cancelled
```

## 取消任务

`POST /api/analysis-tasks/:taskId/cancel`

```json
{
  "cancelled": true,
  "taskId": "task_001"
}
```

## SSE 订阅

`GET /api/analysis-tasks/:taskId/stream`

事件数据建议：

```json
{
  "stage": "calling_ai",
  "progress": 0.56,
  "message": "正在生成优化方案",
  "result": null
}
```

完成事件：

```json
{
  "stage": "done",
  "progress": 1,
  "message": "优化完成",
  "result": {
    "resumeId": "resume_001",
    "analysisId": "analysis_001",
    "versionId": "version_001"
  }
}
```

## 前端接入点

- 当前前端已支持内存级后台分析状态，不切页中断。
- 接入 `taskId` 后，可把 `taskId` 写入 store 和 `sessionStorage`。
- App 启动时调用 `/api/analysis-tasks/current`，如果有未完成任务，就恢复顶部分析状态条。
- 取消按钮改为调用 `/api/analysis-tasks/:taskId/cancel`，再 abort 当前 SSE。
