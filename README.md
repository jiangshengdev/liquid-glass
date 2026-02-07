# liquid-glass（WebGPU：静态折射 + Frost 高斯模糊）

目标：用纯 WebGPU 做一个可交互的“玻璃胶囊”探索 Demo：

- 静态、规则的折射（中心基本不变，边缘有秩序偏折）
- Frost（高斯模糊），用于“磨砂”观感（当前默认 `frost = 4`）
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

## 交互

- 拖拽玻璃内部：移动位置
- 拖拽玻璃边缘/角落：调整尺寸

说明：

- 当前是“静态”效果（无动画、无噪声），折射模型为规则透镜场：中心基本不变、边缘有秩序偏折。
- Frost（高斯模糊）在 `src/main.js` 的 `PARAMS.frost` 设置（默认 4）。
