# 前后端联调数据契约

本文档给后端实现联调用。前端已经按以下结构接入：用户未完成分析时使用占位数据；完成分析后使用后端返回的 `analysis`、`optimizedResume`、`lapisMarkdown` 替换占位内容。

## 1. 创建简历优化

`POST /api/resumes/analyze`

前端会把用户选择的优化参数作为真实请求参数传给后端，而不是只在页面上选中：

```json
{
  "resumeText": "简历正文，200 到 12000 字",
  "targetJob": "前端工程师",
  "jobDescription": "岗位 JD，可为空",
  "jobStage": "internship",
  "outputLanguage": "zh",
  "optimizeLevel": "standard",
  "originalName": "resume.pdf"
}
```

枚举：

| 字段 | 可选值 | 前端含义 |
|---|---|---|
| `jobStage` | `internship` / `campus` / `social` / `graduate` / `career_change` / `other` | 实习 / 校招 / 社招 / 研究生 / 转行 / 其他 |
| `outputLanguage` | `zh` / `en` | 中文 / 英文输出 |
| `optimizeLevel` | `conservative` / `standard` / `strong` | 保守 / 标准 / 增强 |

## 2. 创建优化成功响应

前端期望响应：

```json
{
  "success": true,
  "data": {
    "resumeId": "clx_resume",
    "analysisId": "clx_analysis",
    "versionId": "clx_version",
    "remaining": 2,
    "usage": {
      "limit": 3,
      "used": 1,
      "remaining": 2,
      "resetAt": "2026-05-24T16:00:00.000Z"
    },
    "analysis": {},
    "optimizedResume": {},
    "lapisMarkdown": "# 张同学\n..."
  }
}
```

其中 `analysis` 用于分析结果页，`optimizedResume` 用于编辑导出页和右侧预览。

## 3. 分析结果页 `analysis`

```json
{
  "score": 78,
  "matchRate": 72,
  "grade": "B+",
  "summary": "这份简历有基础，但项目经历还没有证明岗位能力。",
  "oneSentenceConclusion": "简历有基础，但需要增强岗位匹配证据。",
  "issues": [
    {
      "level": "高",
      "text": "项目经历的业务结果不足",
      "sectionId": "projects",
      "suggestion": "补充量化结果和业务指标。"
    }
  ],
  "keywords": ["Python", "SQL", "数据分析", "RAG"],
  "valueExtraction": [
    {
      "module": "数据看板项目",
      "currentProblem": "技术栈堆叠",
      "direction": "说明业务指标、使用动作和最终结果"
    }
  ],
  "actionItems": [
    "补充目标岗位的核心技能关键词。",
    "每段项目经历增加一个可量化结果。"
  ],
  "questionsToAsk": [
    "项目是否有用户量、转化率、准确率或效率提升数据？"
  ]
}
```

说明：

| 字段 | 必填 | 说明 |
|---|---:|---|
| `score` | 是 | 0 到 100 |
| `matchRate` | 是 | 0 到 100 |
| `grade` | 是 | 如 `A`、`B+` |
| `summary` | 是 | 结果页蓝色摘要块 |
| `issues` | 是 | 关键问题列表，`level` 支持 `高/中/低` 或 `high/medium/low` |
| `keywords` | 是 | 关键词 tag |
| `valueExtraction` | 否 | 价值提炼表格 |
| `actionItems` | 否 | 下一步行动清单 |

## 4. 编辑导出页 `optimizedResume`

后端最好直接返回 `editorSections`。前端会按 `order` 排序并动态生成 Tabs，不再写死「个人简介 / 技能清单 / 项目经历 / 实习经历」。

```json
{
  "editorSections": [
    {
      "id": "profile",
      "label": "个人简介",
      "original": "熟悉 Python、SQL 等技术，做过数据分析项目。",
      "optimized": "面向数据分析岗位，具备 Python、SQL 与可视化基础...",
      "reason": "把泛泛技术描述改成岗位能力摘要。",
      "order": 10
    },
    {
      "id": "skills",
      "label": "技能清单",
      "optimized": "Python / SQL / Java\nLinux / Git / Docker",
      "items": ["Python / SQL / Java", "Linux / Git / Docker"],
      "reason": "按技术能力、工程工具、业务方法分组。",
      "order": 20
    },
    {
      "id": "projects-0",
      "label": "项目经历",
      "original": "做过用户留存分析。",
      "optimized": "用户留存分析项目：使用 SQL 与 Python 清洗行为数据...",
      "reason": "改成问题、动作、结果结构。",
      "order": 30
    }
  ],
  "preview": {
    "name": "张同学",
    "title": "应用型数据分析实习生",
    "theme": "lapis-cv",
    "lines": ["Python / SQL / 数据分析", "用户留存分析与运营看板"]
  },
  "markdown": "# 张同学\n..."
}
```

动态 Tabs 识别建议：

| 简历内容识别到 | 建议 section id | 建议 label |
|---|---|---|
| 个人简介 / 求职意向 / Summary | `profile` | 个人简介 |
| 技能 / 技术栈 / Skills | `skills` | 技能清单 |
| 项目 / Projects | `projects-0`、`projects-1` | 项目经历 |
| 实习 / 工作经历 | `internships-0` | 实习经历 |
| 教育 / Education | `education` | 教育经历 |
| 校园 / 社团 / 志愿 | `campusExperience-0` | 校园经历 |
| 奖项 / 证书 / 竞赛 | `awards` | 奖项证书 |
| 论文 / 科研 | `research-0` | 科研经历 |

如果后端暂时不能生成 `editorSections`，前端也支持从这些字段兜底生成 Tabs：

```json
{
  "profile": "优化后的个人简介",
  "skills": "优化后的技能清单",
  "projects": [{ "title": "项目经历", "content": "优化后的项目" }],
  "internships": [{ "title": "实习经历", "content": "优化后的实习" }],
  "campusExperience": [{ "title": "校园经历", "content": "优化后的校园经历" }],
  "education": "教育经历",
  "awards": "奖项证书"
}
```

## 5. 无分析时的前端占位规则

用户没有完成分析时，前端展示示例，所有占位数据都带 `isPlaceholder: true`，并不会当作真实联调数据。

占位内容包括：

| 页面 | 占位内容 |
|---|---|
| 分析结果页 | 示例评分 `78`、匹配度 `72`、等级 `B+`、示例问题和关键词 |
| 编辑导出页 | 示例个人简介、技能清单、项目经历、实习经历 |
| 右侧预览 | 示例姓名 `张同学`、示例岗位 `应用型数据分析实习生` |

后端返回真实 `analysis` / `optimizedResume` 后，前端会自动替换占位数据。

## 6. 后续查询接口建议

为了用户刷新页面或从历史记录进入，建议后端提供：

```text
GET /api/resumes/analysis/:analysisId
GET /api/resumes/version/:versionId
GET /api/resumes/version/:versionId/markdown
PUT /api/resumes/version/:versionId/markdown
```

其中 `GET /api/resumes/version/:versionId` 建议返回：

```json
{
  "success": true,
  "data": {
    "resumeId": "clx_resume",
    "analysisId": "clx_analysis",
    "versionId": "clx_version",
    "optimizedResume": {},
    "lapisMarkdown": "# 张同学\n..."
  }
}
```
