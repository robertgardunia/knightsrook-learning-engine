# ui/themes/

Per-theme visual assets (logos, background images, avatar portraits used in
UI chrome) referenced by a course's `ThemeTokens`. One subfolder per theme id,
matching `ThemeTokens.id`:

```
ui/themes/
  vulcan/
    logo.svg
    background.jpg
```

`ThemeTokens.cssVariables`/`copyRegister` (in `course.json`) carry the
non-visual half of a theme (colors, copy); this folder carries the visual
assets a theme needs beyond CSS variables. `ThemeProvider` (see
`src/theme/themeProvider.ts`) only owns the CSS/copy half today — wiring in
theme-specific image assets is a TODO once a second theme actually needs one.

Nothing checked in yet.
