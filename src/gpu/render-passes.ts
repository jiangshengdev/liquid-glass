import type { OffscreenTargets } from "./offscreen-targets";
import type { RendererPipelines } from "./pipelines";

interface EncodePassOptions {
  encoder: GPUCommandEncoder;
  targets: OffscreenTargets;
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
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    scenePass.setBindGroup(0, pipelines.uniformBindGroup);
    scenePass.setBindGroup(1, pipelines.imageBindGroup);
    scenePass.setPipeline(pipelines.scenePipeline);
    scenePass.draw(3);
    scenePass.end();
  }

  // 通道 2：执行横向模糊，输出到 horizontalBlurTexture。
  {
    const blurHorizontalPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.horizontalBlurTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    blurHorizontalPass.setBindGroup(0, pipelines.uniformBindGroup);
    blurHorizontalPass.setBindGroup(1, targets.blurHorizontalBindGroup);
    blurHorizontalPass.setPipeline(pipelines.blurHorizontalPipeline);
    blurHorizontalPass.draw(3);
    blurHorizontalPass.end();
  }

  // 通道 3：执行纵向模糊，输出到 verticalBlurTexture。
  {
    const blurVerticalPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.verticalBlurTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    blurVerticalPass.setBindGroup(0, pipelines.uniformBindGroup);
    blurVerticalPass.setBindGroup(1, targets.blurVerticalBindGroup);
    blurVerticalPass.setPipeline(pipelines.blurVerticalPipeline);
    blurVerticalPass.draw(3);
    blurVerticalPass.end();
  }
}

interface EncodeFinalPassOptions {
  encoder: GPUCommandEncoder;
  canvasContext: GPUCanvasContext;
  targets: OffscreenTargets;
  pipelines: RendererPipelines;
}

/**
 * 编码最终上屏通道：先绘制场景，再叠加玻璃效果。
 * @param options 编码参数。
 * @returns 无返回值。
 */
export function encodeFinalPass({
  encoder,
  canvasContext,
  targets,
  pipelines,
}: EncodeFinalPassOptions): void {
  const view = canvasContext.getCurrentTexture().createView();
  const finalPass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view,
        clearValue: { r: 0.05, g: 0.05, b: 0.07, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });

  finalPass.setBindGroup(0, pipelines.uniformBindGroup);

  finalPass.setBindGroup(1, targets.presentBindGroup);
  finalPass.setPipeline(pipelines.presentPipeline);
  finalPass.draw(3);

  finalPass.setBindGroup(1, targets.overlayBindGroup);
  finalPass.setPipeline(pipelines.overlayPipeline);
  finalPass.draw(3);

  finalPass.end();
}
