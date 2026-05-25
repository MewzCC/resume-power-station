# AI 简历优化耗时优化说明

## 问题原因

旧链路一次简历优化会串行调用两次 AI：

1. 分析简历与岗位匹配度。
2. 基于分析结果再生成优化简历和 LapisCV Markdown。

这会带来几个问题：

- 两次模型请求串行等待，网络和排队时间叠加。
- 第二次 prompt 会携带完整简历和完整分析结果，输入 token 增加。
- AI 同时生成结构化 JSON 和完整 Markdown，输出 token 很大。
- 没有请求超时控制，模型慢或供应商排队时可能拖到 5 分钟。

## 当前优化方案

后端现在默认启用快速模式：

```env
AI_FAST_MODE="true"
OPENAI_MODEL_FAST_OPTIMIZE="deepseek-v4-pro"
AI_REQUEST_TIMEOUT_MS=300000
AI_MAX_RESUME_CHARS=6000
AI_MAX_JD_CHARS=3000
AI_MAX_OUTPUT_TOKENS=0
```

快速模式的链路：

```text
简历正文/JD 裁剪
  -> 单次 AI 调用
  -> AI 只返回 analysis + optimizedResume JSON
  -> 后端渲染 LapisCV Markdown
  -> 保存版本与历史快照
  -> 返回前端需要的 diff/analysis/optimizedResume/lapisMarkdown
```

这符合后端需求文档中的原则：

- AI 只负责结构化优化。
- Markdown 由后端生成。
- 控制 AI 输入 token。
- 控制 AI 输出 token。
- AI 输出继续使用 Zod 校验。

## 预期收益

- AI 调用从 2 次减少为 1 次。
- 输出不再要求 AI 生成完整 Markdown。
- 默认使用更快的 `OPENAI_MODEL_FAST_OPTIMIZE`。
- 单次请求超过 `AI_REQUEST_TIMEOUT_MS` 会失败；当前建议 DeepSeek pro 配置为 5 分钟。

实际耗时取决于模型供应商和网络。正常情况下应从数分钟级降到几十秒级；如果模型服务排队严重，接口会在默认 5 分钟超时失败，前端可以提示用户稍后重试。

## 参数调优建议

### 1. 模型

优先给快速模式配置低延迟模型：

```env
OPENAI_BASE_URL="https://api.deepseek.com"
OPENAI_MODEL_FAST_OPTIMIZE="deepseek-v4-pro"
```

如果你的服务商确认提供 flash 档，可以改成对应 flash 模型名：

```env
OPENAI_MODEL_FAST_OPTIMIZE="deepseek-v4-flash"
```

如果使用 DeepSeek 官方模型名或第三方兼容网关，请按控制台实际模型名填写，例如 `deepseek-chat`、`deepseek-reasoner`，或网关提供的完整模型 ID。

### 2. 输入长度

```env
AI_MAX_RESUME_CHARS=6000
AI_MAX_JD_CHARS=3000
```

如果用户简历普遍很长，可以提高到 8000，但会增加耗时。

### 3. 输出长度

```env
AI_MAX_OUTPUT_TOKENS=0
```

如果经常出现 AI JSON 被截断，可提高到 4500；如果想继续压速度，可降到 2800。

### 4. 超时

```env
AI_REQUEST_TIMEOUT_MS=300000
```

DeepSeek pro 在高峰期可能排队，建议生产环境先保持 300000ms。后续如果接入异步任务队列，可以把 HTTP 请求改成快速返回 `jobId`，再由前端轮询状态。

## 回退旧模式

如果要临时回到旧的两次 AI 调用：

```env
AI_FAST_MODE="false"
```

不建议生产环境关闭快速模式。

## 后续可继续升级

如果仍然出现高峰期等待过长，建议按需求文档继续做异步任务：

- `POST /api/resumes/:id/optimize` 返回 `jobId`
- `GET /api/jobs/:id` 查询状态
- Redis/BullMQ 执行优化任务
- 前端轮询或 SSE 显示真实进度

当前版本优先保证不破坏现有前端同步联调，并先解决 5 分钟等待问题。

## 已加入流式进度

后端已提供：

```http
POST /api/resumes/:id/optimize/stream
```

前端通过 `fetch` 读取 `text/event-stream`，可以获得真实阶段：

```text
accepted -> checking_usage -> loading_resume -> calling_ai -> saving_version -> done
```

这类流式进度主要优化用户等待体验：用户能看到任务正在推进，不会误以为页面卡死。真正降低耗时的部分仍然是快速模式的一次 AI 调用、输入裁剪、输出 token 限制和后端 Markdown 渲染。
