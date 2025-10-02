```instructions
# Aura IDE - GitHub Copilot Instructions (Concise)

Goal: Help AI coding agents be immediately productive in this repository by listing the architecture, important workflows, conventions, and precise file examples.

1. Big picture
   - Frontend: SvelteKit 5 + TypeScript (routes in `src/routes/`) with component UI in `src/lib/components/`.
   - Backend/services: Node + MongoDB; service layer under `src/lib/services/` (e.g., `r2-*`, `sandbox/*`, `llm/*`).
   - Sandboxes & storage: Multi-provider sandboxes (Daytona and E2B) and Cloudflare R2 for persistent project storage.

2. Quick developer workflows
   - Start Dev: `npm run dev` (or `pnpm install && pnpm dev`). See `package.json` scripts.
   - Run unit tests: `npm run test` (runs Vitest). Daytona-specific tests: `npm run test:daytona`.
   - Manage DB: `npm run db:init|db:reset|db:stats|db:health` (scripts/database.js).

3. Key integration points (where to look for impactful changes)
   - LLMs & Helicone: `src/lib/services/llm/llm.service.ts` and `src/lib/config/helicone.config.ts` — Helicone is used as a gateway; set HELICONE_* env vars (see `src/app.d.ts`).
   - Sandbox adapters: `src/lib/services/sandbox/daytona.service.ts` and E2B adapters in `src/lib/services/sandbox/` — they create sandboxes, upload files, and expose terminal/workspace operations.
   - R2 storage: `src/lib/services/r2-storage.service.ts`, `r2-file-sync.service.ts`, and `r2-backup.service.ts` — use these for uploads, downloads, versioning.
   - Auth: `src/lib/auth.ts`, `src/lib/auth.client.ts`, and `src/hooks.server.ts` — Better Auth with MongoDB adapter; session available on `event.locals`.
   - Real-time: `src/routes/api/agent/stream/+server.ts` — SSE streaming for agent responses and real-time chat updates.

4. Project conventions an AI must follow
   - Use TypeScript with strict types; prefer interfaces in `src/lib/types/`.
   - Imports use `@/` alias for `src/lib/` configured in `svelte.config.js` (use `$lib/...` within SvelteKit files).
   - Files: kebab-case for filenames, PascalCase for components.
   - Stores: grouped actions (e.g., `filesStore` + `fileActions`) under `src/lib/stores/`.

5. Actionable examples to copy/paste
   - Create a Daytona sandbox: see `DaytonaService.createSandbox` and usage in `src/lib/services/workspace-context.service.ts` (syncDaytonaWorkspace).
   - Upload project to R2: see `ProjectInitializationService.uploadToR2Storage` and `R2StorageService.uploadProject`.
   - SSE streaming setup: connect to `src/routes/api/agent/stream/+server.ts` for real-time agent responses — requires proper event handling in SSE service.

6. Tests & mocking
   - Unit tests use Vitest; many sandbox tests mock the provider SDKs (e.g., `vi.mock('$lib/services/daytona.service')`). Inspect `tests/unit/services/*.test.ts` to emulate patterns.

7. Environment & secrets
   - Main envs: DATABASE_URL, DAYTONA_API_KEY, E2B_API_KEY, HELICONE_API_KEY, OPENAI/ANTHROPIC keys, R2_* vars. Types referenced in `src/app.d.ts`.
   - For local dev, copy `.env.example` to `.env` and set provider keys; many services throw if keys are missing (DaytonaService constructor).

8. When making changes
   - Run `npm run check` to run Svelte checks and TypeScript.
   - Add a unit test when changing service behavior; follow existing vi.mock patterns for provider SDKs.
   - Keep code in `src/lib/services/` pure and add integration docs under `docs/` when adding new external integrations.

9. Helpful file pointers
   - Architecture & docs: `docs/README.md`, `docs/sandbox-integration-plan.md`
   - Sandbox code: `src/lib/services/sandbox/` and `src/routes/api/ws/+server.ts`
   - R2 code: `src/lib/services/r2-storage.service.ts`
   - LLM code: `src/lib/services/llm/llm.service.ts`

Please review this condensed guidance — what sections need more detail (e.g., deployment, rate-limits, or preferred test fixtures)?
```
