/// <reference types="vite/client" />
// 引入 Vite 客户端类型定义。

declare module "*.wgsl?raw" {
  // WGSL 原始文本内容。
  const source: string;
  // 默认导出 Shader 源码。
  export default source;
}
