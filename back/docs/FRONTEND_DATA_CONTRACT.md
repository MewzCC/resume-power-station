# 前端联调数据契约

前端已按 `D:\Codex\resume-power-station\docs\BACKEND_DATA_CONTRACT.md` 接入结果页、编辑导出页和动态简历模块 Tabs。

后端实现重点：

1. `POST /api/resumes/analyze` 必须接收并使用前端传入的 `jobStage`、`outputLanguage`、`optimizeLevel`，这些不是纯 UI 选择。
2. 成功响应需要返回 `resumeId`、`analysisId`、`versionId`、`usage`、`analysis`、`optimizedResume`、`lapisMarkdown`。
3. `analysis` 用于分析结果页，字段包括 `score`、`matchRate`、`grade`、`summary`、`issues`、`keywords`、`valueExtraction`、`actionItems`。
4. `optimizedResume.editorSections` 用于编辑导出页左侧动态 Tabs。后端应根据简历内容识别模块并动态返回，例如 `profile`、`skills`、`projects-0`、`internships-0`、`education`、`campusExperience-0`、`awards`、`research-0`。
5. 用户没有分析时由前端展示占位数据；只要后端返回真实 `analysis` / `optimizedResume`，前端会自动替换。

请以后端实现时以 `D:\Codex\resume-power-station\docs\BACKEND_DATA_CONTRACT.md` 为完整字段规范。
