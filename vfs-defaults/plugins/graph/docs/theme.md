# Graph Theming

The graph uses a hybrid of CSS variables for high-level colors and JavaScript configuration for simulation physics.

## Theme Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `--graph-bg` | Canvas background color | `var(--bg)` |
| `--graph-node-bg` | Default fill for nodes | `var(--surface-high)` |
| `--graph-node-active` | Color for columns and focused nodes | `var(--accent)` |
| `--graph-link` | Color of ownership lines | `var(--border)` |
| `--graph-link-active` | Color of dependency arrows | `var(--accent)` |

## Physics Configuration
The simulation behavior can be modified via the `fluxide.graph.config` object before or during runtime:

```javascript
// Example: High-gravity compact graph
fluxide.graph.config.strength = -300;
fluxide.graph.config.distance = 50;
fluxide.graph.refresh();
```