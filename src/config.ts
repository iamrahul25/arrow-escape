/**
 * Global tunables for Arrow Escape.
 * Adjust these values to change feel without hunting through components.
 */
export const config = {
  /** Starting hearts per level. */
  lives: 3,

  /**
   * When true, every level is playable from the level select screen.
   * Turn off before shipping.
   */
  unlockAllLevels: true,

  /** Show the Level Generator (level design tool) on the home screen. Turn off before shipping. */
  showLevelGenerator: true,

  arrow: {
    /** Stroke width as a fraction of cell size. */
    strokeWidthFactor: 0.15,
    /** Minimum stroke width in pixels. */
    strokeWidthMin: 2,
    /** Arrowhead size as a fraction of cell size. */
    headSizeFactor: 0.42,
    /** How far the body pulls back from the tip so it meets the head cleanly. */
    tipPullbackFactor: 0.35,
    /** Corner roundness on the triangular head (fraction of head size). */
    headCornerRadiusFactor: 0.22,
  },

  animation: {
    /**
     * Escape duration base in ms.
     * Longer path adds `escapeMsPerCell` per path cell.
     */
    escapeMsBase: 320,
    /** Extra escape time per path cell (ms). */
    escapeMsPerCell: 28,
    /** Progress above this starts fading the escaping arrow. */
    escapeFadeStart: 0.88,

    /** Blocked-arrow shake amplitude in pixels. */
    shakeAmplitude: 6,
    /** Duration of each shake step (ms). */
    shakeStepMs: 40,
    /** Total shake settle time before clearing state (ms). */
    shakeDoneMs: 220,
    /** How long Auto (developer mode) shows the hint before moving the arrow (ms). */
    autoMoveDelayMs: 300,
  },

  board: {
    /** Horizontal inset when sizing the board (screen width - inset). */
    horizontalInset: 32,
    /** Max board height as a fraction of screen height. */
    maxHeightFraction: 0.55,
    /** Dot radius in pixels at each cell center. */
    dotSize: 2.5,
    /** Dot opacity (0–1). */
    dotOpacity: 0.18,
  },

  zoom: {
    /** Maximum board zoom (1 = fit to screen). */
    max: 3,
    /** Multiplier applied by the + / − buttons. */
    buttonStep: 1.5,
    /** Duration of button zoom animations (ms). */
    buttonAnimMs: 180,
    /** One-finger drag distance (px) before it counts as panning instead of a tap. */
    panMinDistance: 10,
    /** A tap that moves further than this (px) is not an arrow tap. */
    tapMaxDistance: 10,
    /** Ignore arrow taps for this long after a pinch or pan ends (ms). */
    tapCooldownMs: 250,
    /** On-screen width of the board outline shown while zoomed in (px). */
    edgeWidth: 3,
    /** Zoom amount over 1x at which the board outline is fully visible. */
    edgeFadeRange: 0.15,
    /** Vertical space reserved under the board for the zoom buttons (px). */
    barHeight: 52,
  },
};

export type AppConfig = typeof config;
