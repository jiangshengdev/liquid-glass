# Plan：静态折射“液态玻璃”（WebGPU / Safari）

在当前“底图 + 圆角矩形叠加”的基础上，只做一件事：把圆角矩形改成**静态折射**玻璃（对底图做一次偏移采样），不引入任何时间/动画/交互；同时把底图铺放改为 `cover`，并确保一旦 WebGPU/WGSL 校验失败就**立刻停止渲染**，避免无限报错。

重要：折射模型按 macOS Tahoe 观感对齐——**中间几乎不变、边缘出现一致方向的“有秩序偏折”**（类似规则凸透镜/圆球透镜），不是“凹凸不平玻璃”的随机噪声折射。此实现**完全不使用噪声**（官方 Figma 版本也不包含噪声参数）。

## Scope

- In：
  - 底图 `cover` 铺放（允许裁切，不出现黑边/留白）
  - 圆角矩形区域内的静态折射采样（单次采样，无色散）
  - 折射位移场由几何决定（透镜规则场）：中心位移≈0，向边缘单调增强，方向与形状法线/径向一致
  - 参数对齐官方 Figma：仅包含 `Refraction`、`depth`、`dispersion`、`frost`、`splay`（本阶段优先只做 `Refraction` + `depth` 的静态可见结果）
  - alpha 为常量半透明（方便后续手动改值；最终可由 `depth/frost` 派生）
  - “出错即停”：任何编译/校验错误都直接 fallback，不继续渲染
- Out：
  - 任何动态效果（time/RAF 动画、随鼠标变化）
  - 噪声/颗粒（明确不做）
  - 多 pass 模糊、额外 UI 参数面板

## Action items

[ ] `src/shaders.wgsl`：把 `sample_contain_uv` 替换为 `sample_cover_uv`，并提供 `backgroundColorAtUv(uv)` 统一底图采样逻辑（背景 pass 与玻璃 pass 复用）。  
[ ] `src/shaders.wgsl`：实现规则“透镜折射”位移场（基于圆角矩形 SDF 的近似法线/径向），保证中心位移≈0、边缘位移最大且方向一致。  
[ ] `src/shaders.wgsl`：`fs_overlay` 内在圆角矩形区域计算 `uvRefract = uv + offsetUv`，采样 `backgroundColorAtUv(uvRefract)` 输出折射色；`alpha = 常量半透明 * fill`。  
[ ] `src/main.js`：不引入 RAF 动画/鼠标交互；只在初始化 + resize 时写 uniforms 并渲染一次。  
[ ] `src/main.js`：把折射参数写为常量（`Refraction`、`depth`、`dispersion`、`frost`、`splay`、`alpha`），并放在统一位置便于改（本阶段未实现的参数先占位为 0）。  
[ ] `src/main.js`：加固“出错即停”：WGSL 编译信息出现 error 或 errorScope 捕获到 validation/OOM 时直接 fallback 并 return；运行期 `device.onuncapturederror` 触发后停止后续渲染。  
[ ] 手工验收：Safari 26/TP 打开页面，确认底图 `cover`；玻璃圆角矩形居中完整显示；**中心基本不变、边缘出现一致方向偏折**；控制台无持续报错/刷屏。  
