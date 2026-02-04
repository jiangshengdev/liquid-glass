# Plan：静态折射“液态玻璃”（WebGPU / Safari）

在当前“底图 + 圆角矩形叠加”的基础上，只做一件事：把圆角矩形改成**静态折射**玻璃（对底图做一次偏移采样），不引入任何时间/动画/交互；同时把底图铺放改为 `cover`，并确保一旦 WebGPU/WGSL 校验失败就**立刻停止渲染**，避免无限报错。

## Scope

- In：
  - 底图 `cover` 铺放（允许裁切，不出现黑边/留白）
  - 圆角矩形区域内的静态折射采样（单次采样，无色散）
  - alpha 为常量半透明（方便后续手动改值）
  - “出错即停”：任何编译/校验错误都直接 fallback，不继续渲染
- Out：
  - 任何动态效果（time/RAF 动画、随鼠标变化）
  - 色散、多 pass 模糊、额外 UI 参数面板

## Action items

[ ] `src/shaders.wgsl`：把 `sample_contain_uv` 替换为 `sample_cover_uv`，并提供 `backgroundColorAtUv(uv)` 统一底图采样逻辑（背景 pass 与玻璃 pass 复用）。  
[ ] `src/shaders.wgsl`：新增轻量静态噪声位移（hash/value noise + fbm，固定 octave，手动展开避免兼容性坑）。  
[ ] `src/shaders.wgsl`：`fs_overlay` 内在圆角矩形区域计算 `uvRefract = uv + offsetUv`，采样 `backgroundColorAtUv(uvRefract)` 输出折射色；`alpha = 常量半透明 * fill`。  
[ ] `src/main.js`：不引入 RAF 动画/鼠标交互；只在初始化 + resize 时写 uniforms 并渲染一次。  
[ ] `src/main.js`：把折射参数写为常量（`refractionPx`、`noiseScale`、`alpha`），并放在统一位置便于改。  
[ ] `src/main.js`：加固“出错即停”：WGSL 编译信息出现 error 或 errorScope 捕获到 validation/OOM 时直接 fallback 并 return；运行期 `device.onuncapturederror` 触发后停止后续渲染。  
[ ] 手工验收：Safari 26/TP 打开页面，确认底图 `cover`；玻璃圆角矩形居中完整显示；玻璃内部出现静态扭曲；控制台无持续报错/刷屏。  

