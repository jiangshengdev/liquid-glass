# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the app code. Main orchestration lives in `src/webgpu-main.ts`, startup/runtime wiring is in `src/app/`, rendering is in `src/gpu/`, interaction logic is in `src/interaction/`, and shared helpers/types are in `src/utils/` and `src/types/`.
- `src/config/params.ts` holds tunable glass/refraction parameters; `src/shaders.wgsl` contains WGSL shader code.
- `tests/` stores Vitest unit tests, organized by domain (for example `tests/state-glassState.test.ts`).
- `public/` keeps static assets served directly by Vite; `docs/plans/` contains refactor and implementation notes.

## Build, Test, and Development Commands
- `pnpm install` (or `npm install`): install dependencies.
- `pnpm dev`: start the Vite dev server for local WebGPU testing.
- `pnpm build`: run TypeScript type-checking and produce a production bundle.
- `pnpm preview`: serve the production build locally.
- `pnpm test` / `pnpm test:watch`: run unit tests once / in watch mode.
- `pnpm lint` and `pnpm format`: lint with ESLint and format with Prettier.

## Coding Style & Naming Conventions
- Language stack: TypeScript + WGSL; formatting is controlled by Prettier (`.prettierrc`) and linting by ESLint (`eslint.config.ts`).
- Use 2-space indentation and keep modules focused (render, interaction, state, utils).
- Prefer `camelCase` for variables/functions, `PascalCase` for types/interfaces, and descriptive file names aligned with feature intent (for example `renderPasses.ts`, `hitTest.ts`).
- Keep shader entry names and TS-side pipeline references synchronized when renaming.

## Testing Guidelines
- Framework: Vitest (`vitest.config.ts`).
- Place tests in `tests/` with `*.test.ts` suffix and domain-first naming (`gpu-uniforms.test.ts`).
- Add/adjust tests when changing math, state transitions, hit-testing, or uniform packing.
- Before opening a PR, run: `pnpm test && pnpm lint && pnpm build`.

## Commit & Pull Request Guidelines
- Match existing history style: short, imperative commit subjects (for example, `Update shader entry names`, `Clean up bootstrap and helper format`).
- Keep commits focused by concern (interaction, GPU pipeline, state, docs) and avoid mixing unrelated refactors.
- PRs should include: purpose, key implementation notes, validation steps run locally, and screenshots/GIFs for visual WebGPU changes.
- Link related issues/tasks and call out parameter or shader changes explicitly for reviewer verification.
