# WebGPU main.js 模块化拆分方案（中等粒度）

## 简要摘要
将 `/Users/jiangsheng/GitHub/liquid-glass/src/main.js` 按“启动/渲染/交互/状态/工具”拆成 7 个模块，**不改变现有视觉效果、交互行为和运行方式**（仍由 Vite + ESM 启动）。
目标是把单文件职责清晰化，后续调参（如 `PARAMS.frost`）和功能扩展（更多控件/渲染 pass）更容易维护。

## 公开接口与模块边界（新增）
> 这里“公开接口”指模块间导出 API（项目外部入口不变，仍是 `src/main.js`）。

1. `/Users/jiangsheng/GitHub/liquid-glass/src/main.js`（入口编排）
   - 保留：`main().catch(...)` 启动逻辑
   - 负责：初始化依赖、装配各模块、注册 resize/pointer 事件、触发首次渲染
   - 不再承载具体算法细节

2. `/Users/jiangsheng/GitHub/liquid-glass/src/utils/dom.js`
   - 导出：`showFallback(reason)`

3. `/Users/jiangsheng/GitHub/liquid-glass/src/utils/math.js`
   - 导出：`clamp(v, lo, hi)`, `dprClamped()`, `sdRoundRect(...)`

4. `/Users/jiangsheng/GitHub/liquid-glass/src/config/params.js`
   - 导出常量：`PARAMS`, `MIN_W`, `MIN_H`, `RESIZE_MARGIN`, `OFFSCREEN_FORMAT`
   - 说明：仅配置，不放运行态状态

5. `/Users/jiangsheng/GitHub/liquid-glass/src/state/glassState.js`
   - 导出：`createGlassState()`（返回 `glass`、`drag`、canvas 尺寸状态及操作函数）
   - 包含：`initGlassDefault`, `clampGlass`, `startDrag`, `endDrag`, `applyMove`, `applyResize`

6. `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/renderer.js`
   - 导出：`createRenderer({ device, queue, ctx, presentationFormat, module, imageTex, sampler, uniformBuffer, ... })`
   - 返回：`ensureCanvasConfigured`, `writeUniforms`, `render`, `recreateOffscreenTargets`, `setSceneDirty`
   - 包含：pipeline 创建、offscreen 纹理管理、pass 编码提交

7. `/Users/jiangsheng/GitHub/liquid-glass/src/interaction/pointer.js`
   - 导出：`attachPointerHandlers({ canvas, state, requestRender, updateGlassUi, ensureCanvasConfigured })`
   - 包含：`pointerPosCss`, `hitTestGlass`, `cursorForHit`, pointer 事件安装与解绑函数（返回 `dispose`）

8. `/Users/jiangsheng/GitHub/liquid-glass/src/assets/image.js`
   - 导出：`loadBitmap(url)`、`createImageTexture(device, queue, bitmap)`

## 详细实施步骤（决策已定）
1. **先抽“纯工具+配置”**：`showFallback`、数学函数、`PARAMS` 和交互常量迁移到独立模块（零副作用、低风险）。
2. **再抽状态层**：把 `glass/drag/canvas` 相关可变状态集中到 `createGlassState()`，并把移动/缩放逻辑作为状态方法暴露。
3. **抽渲染层**：把 pipeline、bind group、offscreen texture 生命周期、render pass 编码迁入 `createRenderer()`；入口仅调用高层 API。
4. **抽交互层**：pointer hit-test + cursor + drag 生命周期放到 `attachPointerHandlers()`，对入口只暴露挂载/卸载。
5. **入口收敛**：`main.js` 仅保留初始化流程（GPU 检查、adapter/device 获取、shader compile info、模块装配、requestRender 调度）。
6. **行为对齐校验**：确保 fallback 文案、日志前缀、默认参数与当前完全一致。
7. **轻量注释**：仅在跨模块状态同步点添加必要注释（如 `sceneDirty` 的触发时机）。

## 测试与验收场景
1. **启动与兼容**
   - `navigator.gpu` 不可用时，fallback 卡片与 debug 文案与当前一致。
   - `requestAdapter/requestDevice` 失败路径行为不变。
2. **渲染正确性**
   - 初次加载可见背景 + 玻璃叠加；`frost=4` 默认视觉一致。
   - resize 后无黑屏，offscreen 纹理会重建且不报验证错误。
3. **交互一致性**
   - 胶囊内拖动移动；边/角拖动缩放；cursor 形态与当前一致。
   - 保持约束：`MIN_W/MIN_H`、边界夹取、`height <= width` 胶囊约束。
4. **稳定性**
   - `device.onuncapturederror` 触发后停止持续渲染并展示 fallback。
   - 多次 resize/拖拽后无明显内存泄漏迹象（旧纹理 destroy）。
5. **构建检查**
   - `npm run build` 通过；`npm run dev` 启动无模块循环依赖错误。

## 默认假设（已锁定）
- 使用中等拆分，控制在约 7 个模块，不做过度抽象。
- 不引入 TypeScript、不新增第三方库、不改变现有 shader 文件与资产路径。
- 不改 UI/交互产品行为，仅做结构性重构。
- 入口文件仍为 `/Users/jiangsheng/GitHub/liquid-glass/src/main.js`（体量显著下降，负责编排）。

- 保存时间：2026-02-07
- 项目路径：/Users/jiangsheng/GitHub/liquid-glass
- 来源：Codex Plan Mode
