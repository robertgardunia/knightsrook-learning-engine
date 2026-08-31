import type { ThemeTokens } from "@learning-engine/shared-types"

/**
 * NEW (per spec). Live mid-session theme swap is the demo's wow moment — it
 * should be shown early rather than saved for the end. Swapping is just:
 * (1) write CSS variables onto :root, (2) hand the copy register to whatever UI
 * reads dialogue strings, (3) let the avatar-swap side (avatarConfig per theme)
 * happen wherever CoursePackage.avatar is resolved — this module only owns the
 * CSS/copy half.
 */
export class ThemeProvider {
  private current: ThemeTokens | null = null
  private listeners = new Set<(theme: ThemeTokens) => void>()

  apply(theme: ThemeTokens): void {
    this.current = theme
    for (const [key, value] of Object.entries(theme.cssVariables)) {
      document.documentElement.style.setProperty(`--${key}`, value)
    }
    this.listeners.forEach((fn) => fn(theme))
  }

  copy(key: string): string {
    return this.current?.copyRegister[key] ?? key
  }

  onChange(fn: (theme: ThemeTokens) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}
