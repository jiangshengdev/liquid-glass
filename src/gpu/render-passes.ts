import type { OffscreenTargets } from "./offscreen-targets";
import type { RendererPipelines } from "./pipelines";

interface EncodePassOptions {
  /** 命令编码器。 */
  encoder: GPUCommandEncoder;
  /** 离屏目标集合。 */
  targets: OffscreenTargets;
  /** 渲染管线集合。 */
  pipelines: RendererPipelines;
}

/**
 * 编码离屏场景与双通道高斯模糊。
 * @param options 编码参数。
 * @returns 无返回值。
 */
export function encodeScenePasses({
  encoder,
  targets,
  pipelines,
}: EncodePassOptions): void {
  // 通道 1：将覆盖映射后的原图写入 sceneTexture。
  {
    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.sceneTexture.createView(),
          // 清屏为黑色。
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    // 绑定 uniform。
    scenePass.setBindGroup(0, pipelines.uniformBindGroup);
    // 绑定图像纹理。
    scenePass.setBindGroup(1, pipelines.imageBindGroup);
    // 使用场景管线。
    scenePass.setPipeline(pipelines.scenePipeline);
    // 绘制全屏三角形。
    scenePass.draw(3);
    // 结束通道。
    scenePass.end();
  }

  // 通道 2：执行横向模糊，输出到 horizontalBlurTexture。
  {
    const blurHorizontalPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.horizontalBlurTexture.createView(),
          // 清屏为黑色。
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    // 绑定 uniform。
    blurHorizontalPass.setBindGroup(0, pipelines.uniformBindGroup);
    // 绑定横向模糊输入。
    blurHorizontalPass.setBindGroup(1, targets.blurHorizontalBindGroup);
    // 使用横向模糊管线。
    blurHorizontalPass.setPipeline(pipelines.blurHorizontalPipeline);
    // 绘制全屏三角形。
    blurHorizontalPass.draw(3);
    // 结束通道。
    blurHorizontalPass.end();
  }

  // 通道 3：执行纵向模糊，输出到 verticalBlurTexture。
  {
    const blurVerticalPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.verticalBlurTexture.createView(),
          // 清屏为黑色。
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    // 绑定 uniform。
    blurVerticalPass.setBindGroup(0, pipelines.uniformBindGroup);
    // 绑定纵向模糊输入。
    blurVerticalPass.setBindGroup(1, targets.blurVerticalBindGroup);
    // 使用纵向模糊管线。
    blurVerticalPass.setPipeline(pipelines.blurVerticalPipeline);
    // 绘制全屏三角形。
    blurVerticalPass.draw(3);
    // 结束通道。
    blurVerticalPass.end();
  }
}

interface EncodeFinalPassOptions {
  /** 命令编码器。 */
  encoder: GPUCommandEncoder;
  /** 画布上下文。 */
  canvasContext: GPUCanvasContext;
  /** 离屏目标集合。 */
  targets: OffscreenTargets;
  /** 渲染管线集合。 */
  pipelines: RendererPipelines;
  /** 折射箭头实例数量。 */
  refractionArrowCount: number;
}

/**
 * 编码最终上屏通道：先绘制场景，再叠加玻璃效果和 GPU 箭头。
 * @param options 编码参数。
 * @returns 无返回值。
 */
export function encodeFinalPass({
  encoder,
  canvasContext,
  targets,
  pipelines,
  refractionArrowCount,
}: EncodeFinalPassOptions): void {
  // 获取交换链纹理视图。
  const view = canvasContext.getCurrentTexture().createView();
  // 创建最终渲染通道。
  const finalPass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view,
        // 背景清屏色。
        clearValue: { r: 0.05, g: 0.05, b: 0.07, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });

  // 绑定 uniform。
  finalPass.setBindGroup(0, pipelines.uniformBindGroup);

  // 先绘制场景纹理。
  finalPass.setBindGroup(1, targets.presentBindGroup);
  finalPass.setPipeline(pipelines.presentPipeline);
  finalPass.draw(3);

  // 再叠加玻璃效果。
  finalPass.setBindGroup(1, targets.overlayBindGroup);
  finalPass.setPipeline(pipelines.overlayPipeline);
  finalPass.draw(3);

  // 最后叠加 GPU 实例化箭头调试层。
  if (refractionArrowCount > 0) {
    finalPass.setBindGroup(1, pipelines.refractionDebugBindGroup);
    finalPass.setPipeline(pipelines.refractionDebugPipeline);
    // 每个箭头实例由 9 个顶点拼出箭杆与箭头头。
    finalPass.draw(9, refractionArrowCount);
  }

  // 结束通道。
  finalPass.end();
}
