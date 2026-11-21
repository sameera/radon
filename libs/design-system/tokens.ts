// Raiden — generated from tokens.json by build-tokens.ts. Do not edit.

export const themes = ["light", "dark"] as const;
export type Theme = (typeof themes)[number];

export const color = {
    canvas: "var(--rd-canvas)",
    canvasSubtle: "var(--rd-canvas-subtle)",
    canvasInset: "var(--rd-canvas-inset)",
    overlay: "var(--rd-overlay)",
    border: "var(--rd-border)",
    borderControl: "var(--rd-border-control)",
    borderMuted: "var(--rd-border-muted)",
    fg: "var(--rd-fg)",
    fgMuted: "var(--rd-fg-muted)",
    fgSubtle: "var(--rd-fg-subtle)",
    brand: "var(--rd-brand)",
    brandFg: "var(--rd-brand-fg)",
    onBrand: "var(--rd-on-brand)",
    brandMuted: "var(--rd-brand-muted)",
    accent: "var(--rd-accent)",
    accentMuted: "var(--rd-accent-muted)",
    success: "var(--rd-success)",
    successMuted: "var(--rd-success-muted)",
    attention: "var(--rd-attention)",
    attentionMuted: "var(--rd-attention-muted)",
    danger: "var(--rd-danger)",
    dangerMuted: "var(--rd-danger-muted)",
    done: "var(--rd-done)",
    doneMuted: "var(--rd-done-muted)",
    epic: "var(--rd-epic)",
    epicMuted: "var(--rd-epic-muted)",
    story: "var(--rd-story)",
    storyMuted: "var(--rd-story-muted)",
    decision: "var(--rd-decision)",
    decisionMuted: "var(--rd-decision-muted)",
} as const;

export const space = {
    space1: "var(--rd-space-1)",
    space2: "var(--rd-space-2)",
    space3: "var(--rd-space-3)",
    space4: "var(--rd-space-4)",
    space6: "var(--rd-space-6)",
    space8: "var(--rd-space-8)",
} as const;

export const radius = {
    radiusSm: "var(--rd-radius-sm)",
    radiusMd: "var(--rd-radius-md)",
    radiusLg: "var(--rd-radius-lg)",
    radiusFull: "var(--rd-radius-full)",
} as const;

export const shadow = {
    shadowSm: "var(--rd-shadow-sm)",
    shadowOverlay: "var(--rd-shadow-overlay)",
    shadowGlow: "var(--rd-shadow-glow)",
} as const;

export const font = {
    display: "var(--font-display)",
    sans: "var(--font-sans)",
    mono: "var(--font-mono)",
} as const;

export const textStyle = {
    goalLg: "rd-text-goal-lg",
    viewTitle: "rd-text-view-title",
    title: "rd-text-title",
    body: "rd-text-body",
    bodyStrong: "rd-text-body-strong",
    small: "rd-text-small",
    axis: "rd-text-axis",
    ref: "rd-text-ref",
} as const;
