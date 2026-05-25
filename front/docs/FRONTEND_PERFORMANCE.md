# 前端性能与 AI 长耗时处理说明

## 目标

减少 AI 分析等待时间过长带来的卡顿感，并避免用户在后端长时间无响应时只能停留在假进度页面。

## 已接入的前端策略

1. 全局请求超时

   - 普通 API 默认 30 秒超时。
   - 简历文件解析 60 秒超时。
   - AI 分析与优化 180 秒超时。
   - 超时后前端抛出 `REQUEST_TIMEOUT`，展示中文提示。

2. 请求可取消

   - AI 分析流程使用同一个 `AbortController`。
   - 创建简历、优化简历、兜底分析接口都会透传同一条 `signal`。
   - 用户点击“取消分析”后，当前请求会中断，页面不会跳转到结果页。
   - 取消后抛出 `REQUEST_CANCELLED`，不会触发全局错误弹窗。

3. 分析中低频刷新

   - 前端只按秒更新耗时与阶段，不做 token 级渲染。
   - 进度条是阶段型预估，不代表后端真实 token 进度。
   - 超过 45 秒、90 秒、150 秒会展示不同中文提示，降低用户误判。

4. 延迟生成重型内容

   - PDF / Word 导出仍保持点击后请求后端生成。
   - 前端不会在分析页主动生成导出文件，避免阻塞首屏和分析流程。

## 后端联调建议

AI 分析接口建议在 180 秒内返回标准 JSON：

```json
{
  "success": true,
  "data": {
    "resumeId": "res_001",
    "analysisId": "ana_001",
    "versionId": "ver_001",
    "remaining": 2,
    "usage": {
      "limit": 3,
      "used": 1,
      "remaining": 2,
      "resetAt": "2026-05-26T00:00:00+08:00"
    },
    "beforeMarkdown": "...",
    "afterMarkdown": "...",
    "score": {
      "before": 62,
      "after": 86
    },
    "stats": {
      "total": 4,
      "added": 2,
      "optimized": 2,
      "removed": 0
    },
    "summary": "整体简历质量良好，已完成针对目标岗位的优化。",
    "changes": []
  }
}
```

失败时统一返回：

```json
{
  "success": false,
  "error": {
    "code": "AI_FAILED",
    "message": "AI 分析失败，请稍后重试"
  }
}
```

后续如果后端支持流式进度，建议新增：

```text
POST /api/resumes/{resumeId}/optimize/stream
```

返回事件字段建议包含：

```json
{
  "stage": "matching | generating | assembling | done",
  "progress": 0.64,
  "message": "正在生成优化方案",
  "data": null
}
```

前端目前已预留阶段 UI，接入流式接口时只需要把预估进度替换为后端真实进度。
