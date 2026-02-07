import { runUniformTests } from "./gpu-uniforms.test";
import { runHitTestTests } from "./interaction-hitTest.test";
import { runStateTests } from "./state-glassState.test";

interface Suite {
  name: string;
  run: () => void;
}

const suites: Suite[] = [
  { name: "state/glassState", run: runStateTests },
  { name: "interaction/hitTest", run: runHitTestTests },
  { name: "gpu/uniforms", run: runUniformTests },
];

let failed = 0;
for (const suite of suites) {
  try {
    suite.run();
    console.log(`✓ ${suite.name}`);
  } catch (err) {
    failed += 1;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${suite.name}: ${message}`);
  }
}

if (failed > 0) {
  throw new Error(`${failed} test suite(s) failed`);
}

console.log("All unit tests passed.");
