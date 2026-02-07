# 命名规范重构计划（逐文件人工检查版）

## 摘要
- 目标：统一 `/src` 与受影响测试中的命名，消除 `px/Px` 歧义、去掉 `W/H/X/Y` 缩写命名，保持语义清晰且不过度冗长。
- 原则：每个文件人工逐项检查（不是正则批量替换），每改一处都核对调用链。
- 已锁定规则：
  - 保留：`pixelWidth/pixelHeight`
  - `dpr` → `devicePixelRatio`
  - `startPx/startPy` → `startPointerLeft/startPointerTop`
  - `startX/startY/startW/startH` → `startLeft/startTop/startWidth/startHeight`
  - 函数参数 `px/py` → `pointerLeft/pointerTop`
  - `MIN_W/MIN_H` → `MIN_WIDTH/MIN_HEIGHT`
  - `GlassRect` 用 `left/top/width/height`

## 公共接口/类型变更（破坏式）
1. `src/config/params.ts`
- `MIN_W` → `MIN_WIDTH`
- `MIN_H` → `MIN_HEIGHT`

2. `src/types/common.ts`
- `GlassRect.xCss/yCss/wCss/hCss` → `GlassRect.left/top/width/height`

3. `src/types/state.ts`
- `CanvasState.dpr` → `CanvasState.devicePixelRatio`
- `DragState.startPx/startPy` → `DragState.startPointerLeft/startPointerTop`
- `DragState.startX/startY/startW/startH` → `DragState.startLeft/startTop/startWidth/startHeight`
- `startDrag(mode, pointerId, px, py, ...)` 参数名改为 `pointerLeft/pointerTop`
- `applyMove(px, py)` / `applyResize(px, py)` 参数名改为 `pointerLeft/pointerTop`

4. `src/gpu/uniforms.ts`
- `UniformPackInput.canvasPxW/canvasPxH` → `canvasWidth/canvasHeight`
- `UniformPackInput.dpr` → `devicePixelRatio`
- `UniformPackInput.overlayXCss/overlayYCss/overlayWCss/overlayHCss` → `overlayLeft/overlayTop/overlayWidth/overlayHeight`

5. `src/gpu/offscreenTargets.ts`
- `blurTexA/blurTexB` → `horizontalBlurTexture/verticalBlurTexture`

6. `src/gpu/pipelines.ts` 与 `src/shaders.wgsl`
- `blurHPipeline/blurVPipeline` → `blurHorizontalPipeline/blurVerticalPipeline`
- shader entrypoint `fs_blur_h/fs_blur_v` → `fs_blur_horizontal/fs_blur_vertical`

## 逐文件人工检查与改名实施顺序
1. **类型与常量层（先改定义）**
- `src/config/params.ts`
- `src/types/common.ts`
- `src/types/state.ts`
- `src/gpu/uniforms.ts`（先改接口名）

2. **状态与交互层**
- `src/state/glassState.ts`
- `src/interaction/hitTest.ts`
- `src/interaction/pointer.ts`
- `src/types/interaction.ts`（如签名受影响）

3. **渲染链路层**
- `src/gpu/renderer.ts`
- `src/gpu/offscreenTargets.ts`
- `src/gpu/pipelines.ts`
- `src/gpu/renderPasses.ts`

4. **入口与应用层**
- `src/webgpu-main.ts`
- `src/app/bootstrap.ts`
- `src/app/runtime.ts`
- `src/main.ts`（人工确认）

5. **工具与 shader 层**
- `src/utils/math.ts`
- `src/utils/dom.ts`（人工确认）
- `src/utils/image.ts`（人工确认）
- `src/shaders.wgsl`

6. **声明与样式文件人工核对**
- `src/webgpu.d.ts`
- `src/vite-env.d.ts`
- `src/style.css`
- `src/assets/left-image.png`（仅确认）

7. **测试联动**
- `tests/state-glassState.test.ts`
- `tests/interaction-hitTest.test.ts`
- `tests/gpu-uniforms.test.ts`

## 验证与验收
- 静态与构建：`pnpm lint`、`pnpm test`、`pnpm build`
- 行为验收：
  - 拖拽移动/缩放行为与当前一致
  - 窗口 resize 后玻璃区域约束不回归
  - WebGPU 渲染与 blur pass 正常
- 命名验收（人工 review）：
  - 不再出现 `MIN_W/MIN_H`
  - 不再出现 `startPx/startPy/startX/startY/startW/startH`
  - 不再出现 `xCss/yCss/wCss/hCss`
  - 不再出现 `canvasPxW/canvasPxH/overlayXCss/.../overlayHCss`
  - 不再出现 `blurTexA/blurTexB` 与 `blurHPipeline/blurVPipeline`
  - `pixelWidth/pixelHeight` 保持不变

## 假设与默认
- 本次改名仅影响当前仓库内部，不做旧名兼容层。
- 范围包含 `src + tests + shaders.wgsl` 逐文件人工检查。
- 不改功能逻辑，只做命名与必要联动。
