# WebGPU 代码重构计划（以可维护性为核心，行为不变）

## 摘要

- 目标：在**不改变视觉效果、交互行为、启动方式**的前提下，继续拆解当前核心复杂点（`webgpu-main.ts` 与 `gpu/renderer.ts`），把“初始化、资源生命周期、渲染编排、错误治理、可测试纯函数”分层。
- 结果：主入口变成纯编排；GPU 资源与渲染 pass 有清晰边界；关键算法（hit-test、uniform 打包）可单测；故障路径可预测且可回收。
- 非目标：不引入新功能（动画/新 UI）、不改 WGSL 视觉算法、不改交互规则、不改页面结构。

## 当前痛点（基于代码现状）

- `/Users/jiangsheng/GitHub/liquid-glass/src/webgpu-main.ts`（240 行）同时负责：环境检查、GPU 初始化、shader 编译诊断、事件绑定、渲染调度、错误兜底。
- `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/renderer.ts`（397 行）同时负责：pipeline 创建、offscreen 纹理生命周期、uniform 打包、render pass 编排。
- `/Users/jiangsheng/GitHub/liquid-glass/src/types.ts` 聚合过多领域类型，边界不清，后续扩展容易互相耦合。
- 关键逻辑缺少自动化测试（状态约束、命中测试、uniform 布局正确性）。

## 设计原则（锁定）

- 行为冻结：像素级视觉目标与交互语义保持一致（拖拽、缩放、cursor、fallback 文案语义）。
- 分层优先：模块按“纯逻辑 -> GPU资源 -> 入口编排”单向依赖。
- 错误集中：所有失败路径统一映射为 `showFallback(...)`，并确保停止后续渲染。
- 可测试优先：把可纯化逻辑抽离到无 DOM/GPU 依赖模块。

## 模块重构方案（决策已定）

### 1) 入口与运行时编排

- 保留入口文件：`/Users/jiangsheng/GitHub/liquid-glass/src/webgpu-main.ts`
- 重构后职责：仅做装配与调用，目标控制在 ~120 行。
- 新增：
  - `/Users/jiangsheng/GitHub/liquid-glass/src/app/bootstrap.ts`
    - `bootstrapWebGpuApp(): Promise<BootstrapResult>`
    - 负责 `navigator.gpu` 检查、adapter/device 获取、canvas/context 获取、sampler/image/shader 初始化与编译信息校验。
  - `/Users/jiangsheng/GitHub/liquid-glass/src/app/runtime.ts`
    - `createRuntime(...)` 返回 `{ requestRender, dispose }`
    - 负责 RAF 去重调度、`onuncapturederror`、resize 监听和停止标记。
- 约束：`main().catch(...)` 与 fallback 体验保持不变。

### 2) Renderer 拆分（核心）

- 保留 façade：`/Users/jiangsheng/GitHub/liquid-glass/src/gpu/renderer.ts`
- 新增子模块：
  - `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/pipelines.ts`
    - `createPipelines(device, module, presentationFormat)`
    - 只负责 BGL/layout/pipeline 构建。
  - `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/offscreenTargets.ts`
    - `createOffscreenTargets(...)`, `destroyOffscreenTargets(...)`
    - 管理 `sceneTex/blurTexA/blurTexB` 与对应 bind groups。
  - `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/uniforms.ts`
    - `packUniforms(input): Float32Array`
    - 统一 24 float 布局，禁止在 renderer 内散落写索引。
  - `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/renderPasses.ts`
    - `encodeScenePasses(...)`, `encodeFinalPass(...)`
    - 分离“scene+blur”与“present+overlay”编码流程。
- `Renderer` 接口调整：
  - 删除未对外使用的 `recreateOffscreenTargets()`（内部处理）。
  - 保留并明确：`ensureCanvasConfigured()`, `writeUniforms()`, `render()`, `setSceneDirty(value)`。

### 3) 交互逻辑可测试化

- 从 `/Users/jiangsheng/GitHub/liquid-glass/src/interaction/pointer.ts` 抽出纯函数：
  - 新增 `/Users/jiangsheng/GitHub/liquid-glass/src/interaction/hitTest.ts`
    - 导出 `hitTestGlass(...)`、`cursorForHit(...)`（纯函数）。
- `pointer.ts` 只保留 DOM 事件绑定与状态桥接。
- `attachPointerHandlers` 的 `dispose` 在 runtime 中统一调用（消除潜在监听泄漏）。

### 4) 类型按领域拆分

- 拆分 `/Users/jiangsheng/GitHub/liquid-glass/src/types.ts` 为：
  - `/Users/jiangsheng/GitHub/liquid-glass/src/types/state.ts`
  - `/Users/jiangsheng/GitHub/liquid-glass/src/types/renderer.ts`
  - `/Users/jiangsheng/GitHub/liquid-glass/src/types/interaction.ts`
  - `/Users/jiangsheng/GitHub/liquid-glass/src/types/common.ts`
- 保持原有类型语义不变，仅移动位置与依赖方向整理。
- 迁移完成后删除聚合大文件，避免循环依赖。

## 实施步骤（按提交批次）

1. **批次 A：纯逻辑拆分**
   - 新增 `gpu/uniforms.ts`、`interaction/hitTest.ts`，原逻辑迁移，零行为变更。
2. **批次 B：Renderer 内聚**
   - 新增 `gpu/pipelines.ts`、`gpu/offscreenTargets.ts`、`gpu/renderPasses.ts`；
   - `renderer.ts` 改为 orchestrator façade。
3. **批次 C：启动流程解耦**
   - 新增 `app/bootstrap.ts`、`app/runtime.ts`；
   - `webgpu-main.ts` 只保留装配与错误出口。
4. **批次 D：类型分层**
   - `types.ts` 拆分并修复导入路径。
5. **批次 E：测试与文档**
   - 增加单测、更新 README 与 `docs/plans`（把 `main.js` 表述更新为 `main.ts`/`webgpu-main.ts`）。

## 公共接口/类型变更（明确）

- `Renderer`（`types/renderer.ts`）：
  - 移除 `recreateOffscreenTargets()` 对外暴露。
- `interaction`：
  - 新增可复用纯函数导出：`hitTestGlass`, `cursorForHit`。
- `app`：
  - 新增 `bootstrapWebGpuApp`, `createRuntime` 两个装配级 API（仅内部使用）。
- `types`：
  - 路径变化（按领域拆分），类型定义本身不改语义。

## 测试计划与验收场景

- 单元测试（新增，使用 Vitest）：
  - `state/glassState`：最小尺寸约束、边界夹取、`height <= width` 约束。
  - `interaction/hitTest`：内部移动命中、边缘/角命中优先级、cursor 映射。
  - `gpu/uniforms`：24-float 布局位置、DPR 缩放、alpha/光照参数映射。
- 集成检查：
  - `npm run lint`、`npm run build` 全通过。
  - 手动回归：拖拽移动、四边八角缩放、窗口 resize 后无黑屏、fallback 触发可中止后续渲染。
- 验收标准：
  - 视觉与交互对比重构前无可感知差异；
  - 入口文件行数下降且职责单一；
  - renderer 主文件只保留编排（不再内嵌布局索引与资源销毁细节）。

## 风险与回滚

- 风险 1：uniform 索引迁移导致 shader 参数错位。
  - 规避：先加 `packUniforms` 快照测试，再替换调用。
- 风险 2：offscreen 纹理重建时机变化导致偶发黑帧。
  - 规避：保留 `sceneDirty` 语义与 resize 时强制重建。
- 风险 3：事件解绑遗漏。
  - 规避：runtime 统一管理 `dispose`，并在测试中验证重复绑定行为。

## 假设与默认值（已锁定）

- 默认保持现有参数与视觉：`PARAMS`、WGSL 算法、交互体验不变。
- 默认引入 Vitest 作为测试框架（仅 dev 依赖），不引入运行时依赖。
- 默认不调整目录外资源，不改 HTML/CSS 结构，不做 API 对外暴露。
