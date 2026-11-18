---
name: stitch-motorven-ui
description: >-
  Use this skill when designing, iterating, or converting UI screens between Google Stitch
  (stitch MCP) and React components in SIGNUM MOTORVEN (src/views/, src/components/,
  src/components/mobile/). Covers syncing .stitch/DESIGN.md, generating/editing Stitch
  screens, downloading HTML/screenshots into .stitch/designs/, and implementing changes
  using the project's CSS custom properties without breaking light/dark themes or mobile PWA.
---

# Stitch UI Workflow for SIGNUM MOTORVEN

This skill coordinates **Google Stitch MCP** (`stitch`) with the React/Vite codebase in `SIGNUM MOTORVEN`.

## Prerequisites

1. Verify the `stitch` MCP server is authenticated (test with `list_projects` or `list_design_systems`).
   - If Stitch returns an authentication error (`Request is missing required authentication credential`), stop and ask the user to refresh their Stitch API key at `https://stitch.withgoogle.com` (Settings -> API Keys) in `mcp_config.json`, or configure Google Cloud ADC (`gcloud auth application-default login` + `authProviderType: "google_credentials"`).
2. Read [.stitch/DESIGN.md](../../../.stitch/DESIGN.md) and [.stitch/metadata.json](../../../.stitch/metadata.json) before generating or editing screens.

## Step 1: Project & Design System Setup in Stitch

1. Call `list_projects` (via `call_mcp_tool` on server `stitch`) to check if a project already exists for `SIGNUM MOTORVEN`.
2. If none exists, create one with `create_project` (`title: "SIGNUM MOTORVEN"`).
3. Check `list_design_systems` for that `projectId`. If no design system is linked yet:
   - Summarize the design system from `.stitch/DESIGN.md` and ask the user for confirmation before uploading.
   - Base64-encode `.stitch/DESIGN.md` (UTF-8) and call `upload_design_md`, then immediately call `create_design_system_from_design_md`.
   - Save the resulting `projectId` and `designSystemId` (`assets/...`) in `.stitch/metadata.json`.

## Step 2: Designing or Editing Screens in Stitch

1. **New screens**: Enhance the user's request with Spanish ERP domain terminology, layout structure, and responsive intent (`DESKTOP` or `MOBILE`). Do **not** hardcode hex colors or font names in generation prompts when `designSystem` (`assets/...`) is already attached — pass `designSystem` to `generate_screen_from_text`.
   - If `generate_screen_from_text` times out, do **not** retry generation; poll `get_screen` every ~30s before concluding.
2. **Existing screens**: Use `edit_screens` with `selectedScreenIds` and targeted structural/visual instructions.
3. **Sync artifacts locally**: Call `get_screen` and download the HTML and screenshot into `.stitch/designs/<slug>.html` and `.stitch/designs/<slug>.png` (updating `.stitch/metadata.json`). Visually inspect the downloaded `.png` with `view_file` before writing React code.

## Step 3: Integrating Stitch Designs into SIGNUM MOTORVEN Code

1. **Preserve CSS custom properties**: Map generated layouts to existing tokens in [src/index.css](../../../src/index.css) and [src/components/mobile/mobile.css](../../../src/components/mobile/mobile.css) (`--motorven-navy`, `--motorven-red`, `--bg-card-glass`, `--text-primary`, `--font-tech`, `--font-main`, `--font-code`, `.bento-card`, `.btn`, `.btn-primary`, `.btn-print-report`, `.badge`).
2. **Respect both themes**: Verify visual contrast under both `[data-theme="light"]` (default) and `[data-theme="dark"]`.
3. **Preserve business logic & services**: Keep existing data hooks, `supabaseService.js`, `storageService.js`, fiscal/currency calculations (`USD` + `Bs.`), and `MobileAppLayout` zero-scroll boundaries intact.
4. **Verify after edits**: Run `npm test`, `npm run lint` (0 errors), and `vite build`.
