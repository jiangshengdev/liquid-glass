import type { OffscreenTargets } from "./offscreenTargets";
import type { RendererPipelines } from "./pipelines";

interface EncodePassOptions {
  encoder: GPUCommandEncoder;
  targets: OffscreenTargets;
  pipelines: RendererPipelines;
}

export function encodeScenePasses({
  encoder,
  targets,
  pipelines,
}: EncodePassOptions): void {
  // Pass 1: render cover-mapped image into sceneTex.
  {
    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.sceneTex.createView(),
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

  // Pass 2: horizontal blur -> blurTexA.
  {
    const blurHorizontalPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.blurTexA.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    blurHorizontalPass.setBindGroup(0, pipelines.uniformBindGroup);
    blurHorizontalPass.setBindGroup(1, targets.blurHorizontalBindGroup);
    blurHorizontalPass.setPipeline(pipelines.blurHPipeline);
    blurHorizontalPass.draw(3);
    blurHorizontalPass.end();
  }

  // Pass 3: vertical blur -> blurTexB.
  {
    const blurVerticalPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.blurTexB.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    blurVerticalPass.setBindGroup(0, pipelines.uniformBindGroup);
    blurVerticalPass.setBindGroup(1, targets.blurVerticalBindGroup);
    blurVerticalPass.setPipeline(pipelines.blurVPipeline);
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
