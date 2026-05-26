# 前端联调数据契约

前端优化表单已经把「简历类型 / 优化强度 / 简历语言」作为真实业务参数传给后端，后端不能只当作 UI 状态忽略。

## 优化请求参数

`POST /api/resumes/analyze`

`POST /api/resumes/:resumeId/optimize`

`POST /api/resumes/:resumeId/optimize/stream`

请求体必须支持：

| 字段 | 允许值 | 前端含义 | 后端处理要求 |
|---|---|---|---|
| `jobStage` | `internship` / `campus` / `social` / `graduate` / `career_change` / `other` | 实习 / 校招 / 社招 / 研究生 / 转行 / 其他 | 必须参与 AI prompt 策略，不允许校验失败 |
| `optimizeLevel` | `conservative` / `standard` / `strong` | 保守 / 标准 / 增强 | 必须影响改写幅度 |
| `outputLanguage` | `zh` / `en` | 中文 / 英文 | 必须影响分析与优化输出语言 |

示例：

```json
{
  "targetRole": "Java 后端开发工程师",
  "targetJD": "",
  "jobStage": "social",
  "outputLanguage": "en",
  "optimizeLevel": "strong"
}
```

## 后端策略要求

- `jobStage=social`：突出业务结果、独立交付、复杂问题解决、稳定性、性能、成本、效率、质量等社招信号。
- `jobStage=career_change`：突出迁移能力、目标岗位相关经历、学习路径和可验证项目证据。
- `jobStage=internship`：突出基础能力、学习速度、项目参与度与可培养性，不要套用资深社招口吻。
- `jobStage=campus`：突出课程、竞赛、校园项目、实习与岗位基础能力匹配。
- `jobStage=graduate`：突出科研、论文、实验、工程深度、方法论与技术沉淀。
- `optimizeLevel=conservative`：少改写，尽量保留原表达。
- `optimizeLevel=standard`：平衡真实性与岗位匹配度。
- `optimizeLevel=strong`：更积极重组表达和关键词，但不得编造事实或删除关键经历。
- `outputLanguage=en`：分析、优化结构和渲染 Markdown 都应尽量使用英文。

## 返回要求

成功响应需要返回：

- `resumeId`
- `analysisId`
- `versionId`
- `usage`
- `analysis`
- `optimizedResume`
- `lapisMarkdown`
- `diff`

前端会优先读取 `diff` 展示编辑导出页；分析页会读取 `analysis.score`、`analysis.matchRate`、`analysis.grade`、`analysis.mainProblems`、`analysis.valueExtraction`、`analysis.actionItems`。
