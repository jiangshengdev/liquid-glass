# Repository Guidelines

## 项目结构与模块组织
- `src/` 为核心代码目录：`src/webgpu-main.ts` 负责主流程编排，`src/app/` 管理启动与运行时，`src/gpu/` 负责渲染管线与 Pass，`src/interaction/` 处理拖拽与命中逻辑。
- `src/config/params.ts` 存放玻璃/折射参数，`src/shaders.wgsl` 存放 WGSL Shader。
- `tests/` 按功能放置 Vitest 单测（如 `tests/interaction-hit-test.test.ts`）。
- `public/` 放静态资源，`docs/plans/` 放实现与重构计划文档。

## 构建、测试与开发命令
- `pnpm install`（或 `npm install`）：安装依赖。
- `pnpm dev`：启动本地开发服务器（Vite）。
- `pnpm build`：执行 TypeScript 检查并打包生产构建。
- `pnpm preview`：本地预览生产包。
- `pnpm test` / `pnpm test:watch`：运行测试（单次 / 监听）。
- `pnpm lint`、`pnpm format`：代码检查与格式化。

## 代码风格与命名规范
- 技术栈为 TypeScript + WGSL，使用 Prettier（`.prettierrc`）与 ESLint（`eslint.config.ts`）。
- 统一使用 2 空格缩进；模块职责保持单一，避免“大而全”文件。
- 命名约定：变量/函数用 `camelCase`，类型/接口用 `PascalCase`，文件名采用语义化kebab-case（如 `render-passes.ts`、`glass-state.ts`）。
- 重命名 Shader 入口函数时，同步更新 TS 侧 pipeline 引用。

## 测试规范
- 测试框架：Vitest（配置见 `vitest.config.ts`）。
- 新增测试文件使用 `*.test.ts`，建议“领域-行为”命名（如 `gpu-uniforms.test.ts`）。
- 修改状态管理、命中检测、uniform 打包或数学计算时，必须补充/更新对应测试。
- 提交前建议执行：`pnpm test && pnpm lint && pnpm build`。

## 提交与 Pull Request 规范
- 提交信息参考现有历史：简短、祈使句、聚焦单一目的（如 `Update shader entry names`）。
- 每次提交尽量只包含一个关注点（渲染、交互、状态或文档）。
- PR 需包含：变更目的、关键实现说明、本地验证步骤；涉及视觉效果时附截图或 GIF。
- 若调整参数或 Shader，请在 PR 描述中显式标注，便于评审验证。

## 语言规范（强制）
- 代码注释、命令输出说明、项目文档、评审反馈与助手回复一律使用简体中文。
- 仅在必须保留原文的场景（如第三方 API 字段名、库名、报错原文）使用英文，并在上下文给出中文说明。
- 文件名与文件夹名一律使用英文，采用 `kebab-case`（以 `-` 连接）格式；禁止使用中文名、空格或混合分隔符。
