"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";
import { Trash2, MessageCircle } from "lucide-react";

interface SwipeableRowProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftLabel?: string;
  rightLabel?: string;
}

const SWIPE_THRESHOLD = 80;

export function SwipeableRow({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftLabel = "Sil",
  rightLabel = "WhatsApp",
}: SwipeableRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = true;
    isHorizontal.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return;

    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Determine direction on first significant move
    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!isHorizontal.current) return;

    // Only allow left swipe if onSwipeLeft, right if onSwipeRight
    if (dx < 0 && !onSwipeLeft) return;
    if (dx > 0 && !onSwipeRight) return;

    const clamped = Math.max(-SWIPE_THRESHOLD * 1.5, Math.min(SWIPE_THRESHOLD * 1.5, dx));
    setOffsetX(clamped);
  }, [onSwipeLeft, onSwipeRight]);

  const handleTouchEnd = useCallback(() => {
    swiping.current = false;
    isHorizontal.current = null;

    if (offsetX < -SWIPE_THRESHOLD && onSwipeLeft) {
      onSwipeLeft();
    } else if (offsetX > SWIPE_THRESHOLD && onSwipeRight) {
      onSwipeRight();
    }

    setOffsetX(0);
  }, [offsetX, onSwipeLeft, onSwipeRight]);

  const progress = Math.abs(offsetX) / SWIPE_THRESHOLD;
  const isLeft = offsetX < 0;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Background action indicators */}
      {offsetX !== 0 && (
        <div
          className={`absolute inset-0 flex items-center ${
            isLeft ? "justify-end bg-red-500" : "justify-start bg-green-500"
          } px-6`}
          style={{ opacity: Math.min(progress, 1) }}
        >
          {isLeft ? (
            <div className="flex items-center gap-2 text-white">
              <span className="text-xs font-medium">{leftLabel}</span>
              <Trash2 className="h-5 w-5" />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-white">
              <MessageCircle className="h-5 w-5" />
              <span className="text-xs font-medium">{rightLabel}</span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div
        className="relative bg-card transition-transform duration-200"
        style={{
          transform: `translateX(${offsetX}px)`,
          transitionDuration: swiping.current ? "0ms" : "200ms", // eslint-disable-line
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
