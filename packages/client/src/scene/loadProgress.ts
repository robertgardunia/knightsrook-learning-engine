/**
 * Weighted byte-progress tracker for cold-start asset loads (room, avatar, etc).
 *
 * Ported near-verbatim from knightsrook-garage/src/garage/loadProgress.js — see
 * docs/reuse-log.md #1. Behavior unchanged: each load registers its known on-disk
 * weight up front; reportProgress() feeds real bytes into a shared fraction.
 *
 * Adjustment: a lazily-loaded asset (e.g. a character fetched after the room GLB)
 * must NOT call registerLoad() until its own fetch actually starts — the spec's
 * arrival-transition gotcha (c) exists because of exactly this class of bug: the
 * shared denominator grows mid-load and the progress needle runs backward.
 */

type ProgressListener = (fraction: number) => void

const loaded = new Map<string, number>()
const total = new Map<string, number>()
const listeners = new Set<ProgressListener>()

export function registerLoad(key: string, weightBytes: number): void {
  total.set(key, weightBytes)
  if (!loaded.has(key)) loaded.set(key, 0)
  emit()
}

export function reportProgress(key: string, loadedBytes: number, totalBytes?: number): void {
  if (!total.has(key)) return
  if (totalBytes) total.set(key, totalBytes)
  loaded.set(key, loadedBytes)
  emit()
}

export function completeLoad(key: string): void {
  if (!total.has(key)) return
  loaded.set(key, total.get(key)!)
  emit()
}

export function getFraction(): number {
  let sumLoaded = 0
  let sumTotal = 0
  for (const [key, t] of total) {
    sumTotal += t
    sumLoaded += Math.min(loaded.get(key) ?? 0, t)
  }
  return sumTotal > 0 ? sumLoaded / sumTotal : 0
}

export function subscribe(fn: ProgressListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit(): void {
  const fraction = getFraction()
  listeners.forEach((fn) => fn(fraction))
}
