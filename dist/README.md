# SideRun v2.2.0

Lightweight animated flying border effect for modern web interfaces.

## Installation

```html
<link rel="stylesheet" href="siderun.css" />
<script defer src="siderun.js"></script>
```

## Quick Start

```html
<!-- 1. Add class and stroke container -->
<div id="my-element" class="siderun">
  <div class="site-nav__stroke siderun"></div>
  Your content here...
</div>

<!-- 2. Initialize -->
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
| `margin` | `11` | Offset between element and border |
| `ease` | `0.1` | Animation smoothness (0.01–0.3) |
| `trackPointer` | `false` | Follow cursor position |
| `useAppleRadius` | `false` | Use Apple-style squircle radius |
| `maxRadius` | `null` | Maximum border radius limit |
| `pauseOffscreen` | `true` | Pause when not visible |

## CSS Variables

```css
:root {
  --sr-stroke-width: 3;
  --sr-color-runner: rgba(255, 149, 0, 1);
  --sr-color-border: rgba(255, 149, 0, 0.4);
}
```

## License

MIT © 2025 Cedric Seidel
