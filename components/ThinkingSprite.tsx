"use client";

import { useEffect, useState } from "react";

// Per-frame durations in ms, from animations/aseprite/full_animation1.json.
const FRAME_DURATIONS_MS = [300, 300, 300, 300];
const FRAME_COUNT = FRAME_DURATIONS_MS.length;
const FRAME_WIDTH = 358;
const FRAME_HEIGHT = 389;
const SHEET_WIDTH = FRAME_WIDTH * FRAME_COUNT;

type ThinkingSpriteProps = {
  /** Rendered height in px. Width is derived to keep aspect ratio. */
  size?: number;
  className?: string;
};

export function ThinkingSprite({ size = 40, className }: ThinkingSpriteProps) {
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
        backgroundImage: "url('/animations/thinking-sheet.png')",
        backgroundRepeat: "no-repeat",
        backgroundSize: `${SHEET_WIDTH * scale}px ${size}px`,
        backgroundPosition: `-${frame * displayWidth}px 0`,
        imageRendering: "pixelated"
      }}
    />
  );
}
