# SIGNUM MOTORVEN — Antigravity & Stitch Workspace Rules

- **Design System Source of Truth**: Keep UI changes aligned with `.stitch/DESIGN.md` and the CSS custom properties in `src/index.css` (`--motorven-navy`, `--motorven-red`, `--bg-card-glass`, `--font-tech`, `--font-main`, `--font-code`) and `src/components/mobile/mobile.css`.
- **Theme Parity**: Support both `[data-theme="light"]` (default) and `[data-theme="dark"]` using theme variables rather than hardcoded background/text hex values.
- **Stitch UI Workflow**: When creating, redesigning, or syncing mockups/screens with Google Stitch (`stitch` MCP), activate the `.agents/skills/stitch-motorven-ui/SKILL.md` skill and keep `.stitch/metadata.json` updated.
- **Safe Verification**: After UI or service edits, verify with `npm test` and `npm run lint`.
