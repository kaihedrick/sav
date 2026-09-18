import { useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import "./ShinyText.css";

type ShinyTextProps = {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  color?: string;
  shineColor?: string;
  spread?: number;
  yoyo?: boolean;
  pauseOnHover?: boolean;
  direction?: "left" | "right";
  delay?: number;
};

/** React Bits ShinyText, adapted for TypeScript and reduced-motion preferences. */
export default function ShinyText({
  text, disabled = false, speed = 2, className = "", color = "#b5b5b5",
  shineColor = "#ffffff", spread = 120, yoyo = false,
  pauseOnHover = false, direction = "left", delay = 0,
}: ShinyTextProps) {
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const inactive = disabled || reducedMotion || speed <= 0;
  const progress = useMotionValue(direction === "left" ? 0 : 100);
  const elapsed = useRef(0);
  const lastTime = useRef<number | null>(null);
  const backgroundPosition = useTransform(progress, p => `${150 - p * 2}% center`);

  useEffect(() => {
    elapsed.current = 0;
    lastTime.current = null;
    progress.set(direction === "left" ? 0 : 100);
  }, [direction, speed, delay, yoyo, progress]);

  useAnimationFrame(time => {
    if (inactive || (pauseOnHover && paused)) {
      lastTime.current = null;
      return;
    }
    if (lastTime.current === null) {
      lastTime.current = time;
      return;
    }
    elapsed.current += time - lastTime.current;
    lastTime.current = time;
    const duration = speed * 1000;
    const cycle = duration + Math.max(0, delay) * 1000;
    const cycleTime = elapsed.current % (cycle * (yoyo ? 2 : 1));
    const reverse = yoyo && cycleTime >= cycle;
    const phase = reverse ? cycleTime - cycle : cycleTime;
    const value = Math.min(phase / duration, 1) * 100;
    const position = reverse ? 100 - value : value;
    progress.set(direction === "left" ? position : 100 - position);
  });

  return (
    <motion.span
      className={`shiny-text ${className}`}
      style={inactive ? { color } : {
        color,
        backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
        backgroundSize: "200% auto",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundPosition,
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {text}
    </motion.span>
  );
}
