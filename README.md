# liquid-glass（WebGPU：静态折射 + Frost 高斯模糊）

目标：用纯 WebGPU 做一个可交互的“玻璃胶囊”探索 Demo。

- 静态、规则的折射（中心基本不变，边缘有秩序偏折）
- Frost（高斯模糊）用于“磨砂”观感（默认 `frost = 4`）
- 不引入任何 time/动画/噪声（保持完全静态）

Figma：

- 文件：liquid-glass
- 节点：`3974:2581`（section）
- 背景参考：`3986:2666`（右侧背景区域）
- 菜单组件：`4009:1821`

## 运行

```bash
npm i
npm run dev
```

Safari Technology Preview 启用 WebGPU：

- Develop → Experimental Features → WebGPU

## 校验

```bash
npm run test
npm run lint
npm run build
```

## 交互

- 拖拽玻璃内部：移动位置
- 拖拽玻璃边缘/角落：调整尺寸

## 核心参数位置

- 玻璃参数：`/Users/jiangsheng/GitHub/liquid-glass/src/config/params.ts`
- Shader：`/Users/jiangsheng/GitHub/liquid-glass/src/shaders.wgsl`

## 重构后模块结构

- 入口编排：`/Users/jiangsheng/GitHub/liquid-glass/src/webgpu-main.ts`
- 启动初始化：`/Users/jiangsheng/GitHub/liquid-glass/src/app/bootstrap.ts`
- 运行时调度：`/Users/jiangsheng/GitHub/liquid-glass/src/app/runtime.ts`
- 渲染层：`/Users/jiangsheng/GitHub/liquid-glass/src/gpu/`
  - `renderer.ts`（编排）
  - `pipelines.ts`（pipeline/layout）
  - `offscreenTargets.ts`（离屏纹理生命周期）
  - `renderPasses.ts`（pass 编码）
  - `uniforms.ts`（uniform 打包）
- 交互层：`/Users/jiangsheng/GitHub/liquid-glass/src/interaction/`
  - `pointer.ts`（事件绑定）
  - `hitTest.ts`（纯命中逻辑）
- 单元测试：`/Users/jiangsheng/GitHub/liquid-glass/tests/`
