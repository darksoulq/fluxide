# Theme Variables

The Kanban Board maps its entire structural aesthetic to CSS custom properties. While it inherits base system colors by default, it exposes a specific namespace for granular aesthetic control of the workspace canvas and task cards.

## Variable Reference

The following keys are utilized within the Board's rendering engine. When creating a theme or overriding styles, target these variables:

| Variable | Description | Default Reference |
| :--- | :--- | :--- |
| `--board-canvas-bg` | Background of the entire board area | `transparent` |
| `--board-col-bg` | Background color of column containers | `var(--surface-low)` |
| `--board-col-border` | Border color of column containers | `var(--border)` |
| `--board-card-bg` | Background of individual task cards | `var(--card-bg)` |
| `--board-card-border` | Idle border of task cards | `var(--border)` |
| `--board-card-hover` | Border color during hover or drag | `var(--accent)` |
| `--board-add-col-bg` | Background of the "New Column" block | `rgba(255,255,255,0.02)` |
| `--board-add-col-border` | Border of the "New Column" block | `var(--border-bright)` |

## Style Definition Format

To apply these specifically for the Board plugin via the API, follow the structured object format below. This ensures the styles are scoped correctly to the board namespace:

```json
{
	"--board-canvas-bg": "#0a0a0c",
	"--board-col-bg": "#111114",
	"--board-col-border": "#1f1f23",
	"--board-card-bg": "#16161a",
	"--board-card-border": "#252529",
	"--board-card-hover": "#3b82f6",
	"--board-add-col-bg": "rgba(59, 130, 246, 0.05)",
	"--board-add-col-border": "rgba(59, 130, 246, 0.2)"
}
```