# Overlord brand extraction

Source: https://overlord.ink/

## Core tokens

```css
:root {
  --bg:      oklch(16.38% 0.0001 299.1);
  --surface: oklch(17.76% 0.0001 299.1);
  --fg:      oklch(95.96% 0.0050 65.2);
  --muted:   oklch(95.96% 0.0050 65.2 / 60%);
  --border:  oklch(95.96% 0.0050 65.2 / 10%);
  --accent:  oklch(85.80% 0.2077 142.1);
}
```

Secondary signal observed: `oklch(61.88% 0.2274 292.5)` from `#8f5eff`.
Status colors observed: success `#10b981`, warning `#f59e0b`, destructive `#f43f5e`.

## Typography

- Display / brand: `AKONY`, fallback `system-ui, -apple-system, sans-serif`.
- Body: `Futura Cyrillic`, fallback `"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif`.
- Mono / numerics: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`.

## Logo

- White logo source copied from `/logos/logo-white.svg` to `overlord-logo-white.svg`.
- Color logo source observed at `/logos/logo-color.svg`.

## Layout posture

- Dark command-center canvas, not a light SaaS surface.
- Large AKONY wordmark treatment; supporting headings are heavy uppercase Futura.
- Glass panels use rounded 24-40px radii, very low-alpha off-white borders, and green glow only for active system signals.
- Information is presented as operational telemetry: live posture, risk, queue, voice load, audit route.
- Accent budget: green for primary action and active telemetry; violet is a secondary system-signal only.
