# SideRun v2.2.0

Lightweight JavaScript + CSS library for animated flying border effects.

[![Version](https://img.shields.io/badge/version-2.2.0-orange)](https://github.com/CedricSeidel/SideRun/releases) [![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE) [![Size](https://img.shields.io/badge/size-~5kb-green)](./dist) [![Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://CedricSeidel.github.io/SideRun)

## Features

- **Lightweight** — No dependencies, ~5kb total
- **Smooth animations** — GPU-accelerated 60fps
- **Touch-friendly** — Works on mobile devices
- **Accessible** — Respects `prefers-reduced-motion`
- **Customizable** — CSS variables for colors and stroke

## Installation

Download from the [dist folder](./dist) or copy the files:

```bash
curl -O https://raw.githubusercontent.com/CedricSeidel/SideRun/main/dist/siderun.js
curl -O https://raw.githubusercontent.com/CedricSeidel/SideRun/main/dist/siderun.css
```

## Quick Start

```html
<!-- 1. Include files -->
<link rel="stylesheet" href="siderun.css" />
<script defer src="siderun.js"></script>

<!-- 2. Add markup -->
<div id="my-element" class="siderun">
  <div class="site-nav__stroke siderun"></div>
  Your content here...
</div>

<!-- 3. Initialize -->
<script>
  SideRun.init(document.getElementById('my-element'), {
    margin: 11,
    trackPointer: true,
    ease: 0.08
  });
</script>
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `margin` | `11` | Offset between element and border (px) |
| `ease` | `0.1` | Animation smoothness (0.01–0.3) |
| `trackPointer` | `false` | Follow cursor position |
| `useAppleRadius` | `false` | Apple-style squircle corners |
| `maxRadius` | `null` | Maximum border radius limit |
| `pauseOffscreen` | `true` | Pause animation when not visible |

## CSS Variables

Customize the appearance with CSS custom properties:

```css
:root {
  /* Stroke */
  --sr-stroke-width: 3;
  
  /* Colors */
  --sr-color-runner: rgba(255, 149, 0, 1);
  --sr-color-border: rgba(255, 149, 0, 0.4);
  
  /* Animation */
  --sr-tail: 10;
  --sr-gap: 10;
  --sr-ease: 0.1;
  --sr-margin: 11;
}
```

## API

### `SideRun.init(element, options)`

Initialize the effect on an element. Returns a cleanup function.

```javascript
const cleanup = SideRun.init(element, { trackPointer: true });

// Later: remove the effect
cleanup();
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

## License

MIT © 2025 Cedric Seidel

---

[Demo](https://CedricSeidel.github.io/SideRun) · [Download](./dist/siderun.zip) · [GitHub](https://github.com/CedricSeidel/SideRun)
