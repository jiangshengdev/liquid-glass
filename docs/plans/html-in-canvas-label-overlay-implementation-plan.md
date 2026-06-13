# HTML in Canvas Label Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有玻璃按钮内部显示随尺寸缩放的 `Liquid Glass` 文本，并让文本覆盖在玻璃效果之上，不参与折射。

**Architecture:** 文本使用 HTML-in-Canvas DOM 元素生成纹理，WebGPU 最终 pass 在玻璃 overlay 和调试箭头之后绘制 label overlay。字体缩放与实验能力检测放入可测试的 TypeScript 纯函数，渲染器只负责纹理生命周期、上传与合成。

**Tech Stack:** TypeScript、WGSL、WebGPU、HTML-in-Canvas Origin Trial、Vitest。

---

### Task 1: 可测试的 label 布局与能力检测

**Files:**
- Create: `src/ui/label-layout.ts`
- Create: `src/utils/html-in-canvas.ts`
- Test: `tests/label-layout.test.ts`
- Test: `tests/html-in-canvas-support.test.ts`

- [ ] 写 `computeGlassButtonLabelFontSize()` 测试，覆盖最小值、最大值和宽度受限场景。
- [ ] 写 `hasHtmlInCanvasWebGpuSupport()` 测试，覆盖支持、缺少 `copyElementImageToTexture`、缺少 `onpaint`、缺少 `getElementTransform`。
- [ ] 运行 focused tests，确认因模块不存在而失败。
- [ ] 实现两个纯函数。
- [ ] 运行 focused tests，确认通过。

### Task 2: DOM 与样式接入

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`
- Modify: `src/app/bootstrap.ts`
- Modify: `src/types/renderer.ts`
- Modify: `src/webgpu.d.ts`

- [ ] 给 `#webgpu-canvas` 增加 `layoutsubtree`，并加入 `#glass-button-label`。
- [ ] 增加 `.glass-button-label` 样式，保证透明背景、居中和不可选。
- [ ] 在 bootstrap 阶段获取 label 元素，并按严格实验策略检测 HTML-in-Canvas 能力。
- [ ] 扩展本地 WebGPU/HTML-in-Canvas 类型声明。

### Task 3: 渲染管线接入 label overlay

**Files:**
- Create: `src/shaders/passes/label-pass.wgsl`
- Modify: `src/shaders/passes/index.ts`
- Modify: `src/gpu/pipelines.ts`
- Modify: `src/gpu/render-passes.ts`
- Modify: `src/gpu/renderer.ts`
- Modify: `src/webgpu-main.ts`

- [ ] 新增 label shader，按 overlayBounds 把 label 纹理映射到玻璃按钮区域。
- [ ] 新增 label bind group layout、bind group 与 pipeline。
- [ ] 渲染器管理 label 纹理尺寸，并在 `canvas.onpaint` 中调用 `copyElementImageToTexture` 上传。
- [ ] 最终 pass 在玻璃 overlay 和调试箭头之后绘制 label。
- [ ] 玻璃矩形变化时同步 label 几何和字体大小。

### Task 4: 验证

**Files:**
- Modify as needed from previous tasks.

- [ ] 运行 `pnpm test`。
- [ ] 运行 `pnpm lint`。
- [ ] 运行 `pnpm build`。
- [ ] 若本机浏览器缺少 HTML-in-Canvas Origin Trial，记录无法做视觉验证的原因。
