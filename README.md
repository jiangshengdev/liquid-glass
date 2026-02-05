# Glass-effect playground（WebGPU 实现：第 1 步）

目标：先不做任何“玻璃特效”，只把 Figma 中的背景（图片 + 右侧色块）在 WebGPU 里画出来，并在其上方叠加一个圆角矩形（菜单组件占位）。

Figma：
- 文件：Glass-effect playground--Community
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
