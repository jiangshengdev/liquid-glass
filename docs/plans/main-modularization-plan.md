# WebGPU main.ts 模块化拆分方案（已落地）

## 简要摘要

已将入口与渲染逻辑从单文件编排拆成职责清晰的 TypeScript 模块，保持现有视觉效果、交互行为与运行方式不变。
当前入口链路为：`src/main.ts -> src/webgpu-main.ts`。

## 当前模块边界

1. `/Users/jiangsheng/GitHub/liquid-glass/src/main.ts`
   - 仅负责加载样式与启动 `webgpu-main.ts`。

2. `/Users/jiangsheng/GitHub/liquid-glass/src/webgpu-main.ts`
   - 负责模块装配与主流程编排（状态、渲染器、交互、运行时）。

3. `/Users/jiangsheng/GitHub/liquid-glass/src/app/bootstrap.ts`
   - 负责 WebGPU 能力检查、adapter/device、canvas/context、shader 编译检查与素材初始化。

4. `/Users/jiangsheng/GitHub/liquid-glass/src/app/runtime.ts`
   - 负责 RAF 去重调度、resize 监听、`onuncapturederror` 处理、生命周期清理。

5. `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/renderer.ts`
   - 作为渲染 façade，编排 canvas 配置、uniform 写入和 render 提交。

6. `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/pipelines.ts`
   - 负责 bind group layout、pipeline layout、各 render pipeline 的创建。

7. `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/offscreenTargets.ts`
   - 负责离屏纹理与相关 bind group 的创建/销毁。

8. `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/renderPasses.ts`
   - 负责 scene/blur/final pass 编码。

9. `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/uniforms.ts`
   - 负责统一 24-float uniform 打包。

10. `/Users/jiangsheng/GitHub/liquid-glass/src/interaction/pointer.ts`
    - 仅负责 pointer 事件绑定与状态桥接。

11. `/Users/jiangsheng/GitHub/liquid-glass/src/interaction/hitTest.ts`
    - 负责纯命中检测与 cursor 映射。

12. `/Users/jiangsheng/GitHub/liquid-glass/src/state/glassState.ts`
    - 负责玻璃几何状态、拖拽/缩放状态与约束逻辑。

13. `/Users/jiangsheng/GitHub/liquid-glass/src/types/`
    - `common.ts`、`state.ts`、`renderer.ts`、`interaction.ts` 按领域拆分类型。

## 落地进度

- [x] 纯逻辑抽离：`hitTest.ts`、`uniforms.ts`
- [x] 渲染拆分：`pipelines.ts`、`offscreenTargets.ts`、`renderPasses.ts`
- [x] 启动流程拆分：`bootstrap.ts`、`runtime.ts`
- [x] 类型拆分：移除 `src/types.ts`，改为 `src/types/*`
- [x] 渲染接口清理：移除未使用公开方法 `recreateOffscreenTargets()`

## 验证记录

- [x] `npm run test`
- [x] `npm run lint`
- [x] `npm run build`

## 待补充的手工验证

- [ ] Safari Technology Preview 实机回归：拖拽移动、边角缩放、cursor 行为。
- [ ] 连续 resize 观察离屏纹理重建与控制台稳定性。
