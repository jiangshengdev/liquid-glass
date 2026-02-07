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
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.sceneTex.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setBindGroup(0, pipelines.uniformBG);
    pass.setBindGroup(1, pipelines.imageBG);
    pass.setPipeline(pipelines.scenePipeline);
    pass.draw(3);
    pass.end();
  }

  // Pass 2: horizontal blur -> blurTexA.
  {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.blurTexA.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setBindGroup(0, pipelines.uniformBG);
    pass.setBindGroup(1, targets.blurHBG);
    pass.setPipeline(pipelines.blurHPipeline);
    pass.draw(3);
    pass.end();
  }

  // Pass 3: vertical blur -> blurTexB.
  {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.blurTexB.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setBindGroup(0, pipelines.uniformBG);
    pass.setBindGroup(1, targets.blurVBG);
    pass.setPipeline(pipelines.blurVPipeline);
    pass.draw(3);
    pass.end();
  }
}

interface EncodeFinalPassOptions {
  encoder: GPUCommandEncoder;
  ctx: GPUCanvasContext;
  targets: OffscreenTargets;
  pipelines: RendererPipelines;
}

export function encodeFinalPass({
  encoder,
  ctx,
  targets,
  pipelines,
}: EncodeFinalPassOptions): void {
  const view = ctx.getCurrentTexture().createView();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view,
        clearValue: { r: 0.05, g: 0.05, b: 0.07, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });

  pass.setBindGroup(0, pipelines.uniformBG);

  pass.setBindGroup(1, targets.presentBG);
  pass.setPipeline(pipelines.presentPipeline);
  pass.draw(3);

  pass.setBindGroup(1, targets.overlayBG);
  pass.setPipeline(pipelines.overlayPipeline);
  pass.draw(3);

  pass.end();
}
