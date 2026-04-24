# Architectural Decision: Pretext Canvas Rendering

## Context
The core creative goal of LiquidFlow is to provide a "living" reading experience where text is not static but animated and responsive to the story's themes.

## Decision
Use `@chenglou/pretext` for all book text rendering on an HTML5 Canvas.

## Status: Active

## Rationale
- **Layout Precision**: Pretext provides low-level layout primitives (`prepareWithSegments`, `layoutNextLineRange`) that allow for pixel-perfect word placement.
- **Dynamic Obstacles**: Unlike standard HTML/CSS layout, Pretext allows us to compute line width line-by-line, enabling text to "swim" around animated entities or the user's cursor.
- **Animation Performance**: By rendering to Canvas, we can achieve smooth 60fps animations for both text and background effects without DOM layout thrashing.

## Consequences
- **Complexity**: Requires manual management of hit-testing for clicks/taps and selection.
- **Accessibility**: Requires careful implementation of ARIA labels and potentially a hidden DOM layer for screen readers.
- **Tooling**: Requires custom rendering logic (`TypographyRenderer`) to implement standard book features like paragraph indents and chapter headings.
