# Design：HTML in Canvas 文本覆盖层

## 背景

当前界面以 WebGPU Canvas 为主：背景图先渲染到 scene 纹理，再生成 blur 纹理，最后用玻璃 overlay 对背景做折射、磨砂与高光合成。现有“按钮”对应当前可拖拽的玻璃圆角矩形，它本身应继续折射背景。

本设计只解决一件事：在当前玻璃按钮内部添加文本 `Liquid Glass`。文本应覆盖在按钮上方，不参与折射、模糊或背景采样。

参考能力来自 Chrome 的 HTML-in-Canvas API 源试用：

- 官方文档：https://developer.chrome.google.cn/blog/html-in-canvas-origin-trial?hl=zh_cn
- API 处于早期源试用阶段，文档说明 Chrome 148 到 150 期间实现细节可能变化。
- 测试环境需要 Chrome Canary 149 或更高版本，并启用 `chrome://flags/#canvas-draw-element`。
- Canvas 需要使用 `layoutsubtree`。
- WebGPU 路径通过 `GPUQueue.copyElementImageToTexture` 上传 DOM 元素图像。
- DOM 内容更新由 `canvas.onpaint` 驱动。

## 目标

- 在当前玻璃按钮内部居中显示文本 `Liquid Glass`。
- 文本尺寸随玻璃按钮尺寸缩放。
- 文本覆盖在玻璃按钮之上，不参与折射。
- 文本仍由 HTML/DOM 管理，保留浏览器文本布局能力。
- 不支持 HTML-in-Canvas 时采用严格实验策略：显示明确错误提示，不提供普通 DOM 或 2D Canvas 回退。

## 非目标

- 不新增按钮形状或按钮列表。
- 不把文本混入 scene 纹理。
- 不让文本被玻璃折射、模糊或色散。
- 不做多按钮工具栏。
- 不引入 2D Canvas 手绘文字回退。
- 不改变现有背景折射模型和拖拽命中逻辑。

## 渲染顺序

最终渲染顺序应保持为：

```text
scene 背景
-> blur 纹理
-> glass overlay（折射背景）
-> refraction debug arrows（如已开启）
-> label overlay（文本覆盖层）
```

关键边界：`label overlay` 必须在玻璃 overlay 之后绘制，且不能作为 `sceneTexture`、`horizontalBlurTexture`、`verticalBlurTexture` 或 `overlayBindGroup` 的输入。这样文本只覆盖最终按钮视觉，不会进入折射采样路径。

## DOM 结构

`index.html` 中的 `#webgpu-canvas` 增加 `layoutsubtree` 属性，并在 canvas 子树中放置 label 元素。结构示意：

```html
<canvas id="webgpu-canvas" aria-label="WebGPU 画布" layoutsubtree>
  <span id="glass-button-label" class="glass-button-label">Liquid Glass</span>
</canvas>
```

label 元素的职责：

- 承载文本内容 `Liquid Glass`。
- 提供浏览器文本排版结果，供 HTML-in-Canvas 上传为纹理。
- 使用透明背景，只输出文字像素。
- 通过样式与当前玻璃按钮矩形对齐。

注意：当前需求是“添加文本”，不是新增可点击按钮。因此 label 可以使用 `span`。如果后续要让它承担真实按钮语义，再改为 `button` 并补充焦点、键盘与点击状态设计。

## 几何同步

每次玻璃状态变化时，同步 label 的 CSS 几何：

- `left = state.glass.left`
- `top = state.glass.top`
- `width = state.glass.width`
- `height = state.glass.height`

label 内部使用 flex 居中：

```css
.glass-button-label {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: rgba(255, 255, 255, 0.94);
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}
```

字体大小由玻璃按钮尺寸动态计算，而不是固定值。

建议规则：

```text
heightBased = glass.height * 0.28
widthBased = glass.width / 9.5
fontSize = clamp(14, min(heightBased, widthBased), 42)
```

原因：

- `height * 0.28` 保证文字不会撑满按钮高度。
- `width / 9.5` 针对 `Liquid Glass` 的长度限制宽度占用。
- `14px` 保证最小可读性。
- `42px` 避免大屏下文字过度膨胀。

如果未来文本可配置，应把 `9.5` 替换为基于文本长度或测量宽度的计算。

## 纹理上传

新增 label 纹理资源：

- `labelTexture`
- `labelSampler`
- `labelBindGroup`
- `labelPipeline`

纹理尺寸与 canvas 像素尺寸保持一致，格式优先沿用 `rgba8unorm`。画布尺寸或 DPR 变化时重建 label 纹理。

当 `canvas.onpaint` 触发时：

1. 确认 label 元素存在且 HTML-in-Canvas API 可用。
2. 调用 `queue.copyElementImageToTexture`，把 label 元素上传到 `labelTexture`。
3. 标记 label 纹理已更新。
4. 请求渲染一帧。

上传逻辑只处理 label 元素，不上传整个 scene。这样可以把文本生命周期与背景/玻璃渲染分开。

## Label Overlay Pipeline

新增 label 专用 pass 或在最终 pass 末尾追加绘制步骤。为保持当前 `encodeFinalPass` 结构集中，推荐在最终 pass 中追加：

```text
presentPipeline.draw()
overlayPipeline.draw()
refractionDebugPipeline.draw()
labelPipeline.draw()
```

label shader 只做纹理采样与 alpha blend：

- 顶点阶段绘制全屏三角形。
- 片元阶段采样 `labelTexture`。
- alpha 为 0 的区域输出透明。
- blend 使用普通 alpha 合成。

目标是让 HTML 文本像素按原位置覆盖到最终交换链纹理上。

## 能力检测与错误提示

启动阶段增加严格检测：

- `canvas` 是否支持 `layoutsubtree` 场景下的 paint 更新。
- `GPUQueue` 是否存在 `copyElementImageToTexture`。
- `canvas.onpaint` 路径是否可用。

任一条件不满足时，调用现有 `showFallback()`，提示：

```text
HTML-in-Canvas 不可用：请使用支持源试用的 Chrome Canary，并启用 chrome://flags/#canvas-draw-element。
```

不做普通 DOM overlay 回退，因为普通 DOM 不能验证 HTML-in-Canvas 到 WebGPU 的合成路径。

## 文件影响范围

预计实现会触及：

- `index.html`：为 canvas 增加 `layoutsubtree`，增加 label 子元素。
- `src/style.css`：增加 label 样式。
- `src/app/bootstrap.ts`：获取 label 元素并做实验能力检测。
- `src/webgpu-main.ts`：在玻璃 UI 同步时同步 label 几何。
- `src/types/renderer.ts`：补充 label 相关依赖。
- `src/gpu/renderer.ts`：管理 label 纹理生命周期、上传标记与渲染调度。
- `src/gpu/pipelines.ts`：创建 label bind group layout、bind group 与 pipeline。
- `src/gpu/render-passes.ts`：在最终 pass 末尾绘制 label。
- `src/shaders/passes/label-pass.wgsl`：新增 label overlay shader。
- `src/shaders/passes/index.ts` 与 `src/shaders/index.ts`：接入新增 WGSL。

测试视具体实现补充，重点覆盖字体缩放纯函数和能力检测分支。

## 验收标准

- 支持实验 API 的 Chrome Canary 中，玻璃按钮内部显示 `Liquid Glass`。
- 拖拽或缩放玻璃按钮时，文本始终居中。
- 按钮尺寸变化时，文本大小随之缩放，且不会溢出按钮。
- 背景在玻璃按钮内继续发生折射。
- 文本不被折射、不被模糊，始终覆盖在按钮最上层。
- 关闭或缺少 HTML-in-Canvas 能力时，页面进入明确 fallback，不静默降级。
- `pnpm test`、`pnpm lint`、`pnpm build` 通过。
