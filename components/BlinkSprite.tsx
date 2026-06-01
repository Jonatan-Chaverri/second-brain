"use client";

import { useEffect, useState } from "react";

// Per-frame durations in ms, taken from animations/aseprite/blink.json.
const FRAME_DURATIONS_MS = [1800, 200, 1400, 200];
const FRAME_COUNT = FRAME_DURATIONS_MS.length;
const FRAME_WIDTH = 308;
const FRAME_HEIGHT = 256;
const SHEET_WIDTH = FRAME_WIDTH * FRAME_COUNT;

type BlinkSpriteProps = {
  /** Rendered height in px. Width is derived to keep aspect ratio. */
  size?: number;
  className?: string;
};

export function BlinkSprite({ size = 40, className }: BlinkSpriteProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleNext(current: number) {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        const next = (current + 1) % FRAME_COUNT;
        setFrame(next);
        scheduleNext(next);
      }, FRAME_DURATIONS_MS[current]);
    }

    scheduleNext(frame);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // We intentionally only schedule once on mount; subsequent ticks read from
    // the local `current` variable rather than React state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayWidth = Math.round((size * FRAME_WIDTH) / FRAME_HEIGHT);
  const scale = displayWidth / FRAME_WIDTH;

  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "inline-block",
        width: `${displayWidth}px`,
        height: `${size}px`,
        backgroundImage: "url('/animations/blink-sheet.png')",
        backgroundRepeat: "no-repeat",
        backgroundSize: `${SHEET_WIDTH * scale}px ${size}px`,
        backgroundPosition: `-${frame * displayWidth}px 0`,
        imageRendering: "pixelated"
      }}
    />
  );
}
