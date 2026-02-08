# 逐文件注释覆盖率检查与补注释方案（仅 .ts/.wgsl）

## 简要总结

基于要求，范围限定为 `/Users/jiangsheng/GitHub/liquid-glass/src` 下所有 `.ts` 与 `.wgsl` 文件，采用“每 1–3 行至少 1 条注释”的行级密度标准，手动逐文件检查并补齐文档注释（TSDoc）与逻辑注释，注释分散到对应行之前，避免集中成块。完成后输出每文件覆盖率与达标情况。

## 范围与约束

- 包含：所有 `.ts`、`.wgsl`（含 `types/`）。
- 排除：`.css`、`.d.ts`、二进制资源（如 `.png`）。
- 语言：注释/输出/文档/回复一律简体中文；必要英文仅保留标识符与原文错误信息。
- 密度：每 1–3 行至少 1 条注释；注释应贴近相关行，避免集中在块首。

## 具体实施步骤

1. 清单与基线统计
   - 枚举 `/Users/jiangsheng/GitHub/liquid-glass/src` 下所有 `.ts` 与 `.wgsl` 文件。
   - 生成每文件“总行数 / 注释行数 / 当前密度”基线，作为后续对比。
2. 逐文件手动审阅与补注释
   - 文档注释（TSDoc）：给所有导出的函数、类型、接口、类/结构添加 TSDoc，必须写 `@param` 与 `@returns`。
   - 逻辑注释：复杂逻辑增加更密集的行前注释；简单逻辑添加简短注释以保证密度。
   - 翻译与统一风格：现存英文注释翻译为简体中文；保留标识符英文。
3. 按文件检查覆盖率达标
   - 每个文件确认“1–3 行至少 1 条注释”的密度。
   - 若文件因结构原因难以密集，仍按规则补齐简短解释性注释。
4. 输出覆盖率报告（逐文件）
   - 包含：文件路径、总行数、注释行数、密度与是否达标。
   - 标注仍需补充的位置（如有）。

## 文件清单（将逐一处理）

- `/Users/jiangsheng/GitHub/liquid-glass/src/app/bootstrap.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/app/runtime.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/config/params.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/offscreen-targets.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/pipelines.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/render-passes.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/renderer.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/gpu/uniforms.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/interaction/hit-test.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/interaction/pointer.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/main.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/shaders.wgsl`
- `/Users/jiangsheng/GitHub/liquid-glass/src/state/glass-state.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/utils/dom.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/utils/image.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/utils/math.ts`
- `/Users/jiangsheng/GitHub/liquid-glass/src/webgpu-main.ts`

## 公共 API / 接口变化

- 无行为与 API 变更，仅补充注释与文档说明。

## 测试与验收

- 注释改动不影响运行逻辑，测试可选。
- 验收标准：
  - 每个 `.ts`/`.wgsl` 文件满足行级注释密度。
  - 导出项完整 TSDoc（含参数与返回值）。
  - 无英文注释残留（除必要标识符）。

## 假设与默认

- 默认以“每 1–3 行至少 1 条注释”为硬性标准。
- 仅处理 `.ts` 与 `.wgsl` 文件，不处理 `.css` 与 `.d.ts`。
- 若个别文件过短（如 `main.ts`），仍按规则最小补注释。
