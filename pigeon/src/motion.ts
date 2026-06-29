import type { Arms } from './pose';

// Derived, frame-to-frame motion signals. No physics here — just measurement
// of how the player is moving their arms, for visualization (and later flight).
export interface MotionState {
  flapHz: number; // smoothed flap frequency (flaps per second)
  flapPower: number; // 0..1 smoothed flapping intensity
  tilt: number; // -1..1 left/right lean from arm asymmetry
  flapped: boolean; // a down-stroke completed on this frame
}

// rad/s of arm-elevation change that maps to full flap power.
const VEL_REF = 6.0;
// hysteresis band (rad) around the running baseline for cycle detection.
const HYST = 0.16;
// seconds without a completed flap before frequency decays toward 0.
const FLAP_TIMEOUT = 1.1;
// rad of left/right elevation difference that maps to full tilt.
const TILT_REF = 1.2;

export class MotionAnalyzer {
  private prevElev = 0;
  private prevTime = 0;
  private hasPrev = false;
  private baseline = 0;
  private smoothVel = 0;
  private power = 0;
  private phase: 'up' | 'down' = 'down';
  private lastFlapTime = 0;
  private hz = 0;
  private tilt = 0;

  // `now` in milliseconds (performance.now()).
  update(arms: Arms, now: number): MotionState {
    const t = now / 1000;

    // mean elevation across whichever arms are visible
    let sum = 0;
    let okCount = 0;
    if (arms.left.ok) {
      sum += arms.left.elevation;
      okCount++;
    }
    if (arms.right.ok) {
      sum += arms.right.elevation;
      okCount++;
    }
    const mean = okCount > 0 ? sum / okCount : this.prevElev;

    let flapped = false;

    if (this.hasPrev && okCount > 0) {
      const dt = Math.max(1e-3, t - this.prevTime);
      const vel = (mean - this.prevElev) / dt;
      this.smoothVel += (vel - this.smoothVel) * 0.4;

      // slow baseline tracks the neutral arm height
      this.baseline += (mean - this.baseline) * 0.03;

      const targetPower = Math.min(1, Math.abs(this.smoothVel) / VEL_REF);
      this.power += (targetPower - this.power) * 0.25;

      // count a flap on each up->down transition (the power stroke)
      if (mean > this.baseline + HYST) {
        this.phase = 'up';
      } else if (mean < this.baseline - HYST) {
        if (this.phase === 'up') {
          flapped = true;
          const interval = t - this.lastFlapTime;
          if (this.lastFlapTime > 0 && interval > 0.12 && interval < 2.5) {
            const instHz = 1 / interval;
            this.hz += (instHz - this.hz) * 0.5;
          }
          this.lastFlapTime = t;
        }
        this.phase = 'down';
      }
    }

    // decay when idle / not tracked
    if (t - this.lastFlapTime > FLAP_TIMEOUT) this.hz += (0 - this.hz) * 0.05;
    if (okCount === 0) this.power += (0 - this.power) * 0.1;

    // tilt: arm asymmetry. Left arm higher than right -> positive.
    if (arms.left.ok && arms.right.ok) {
      const target = Math.max(
        -1,
        Math.min(1, (arms.left.elevation - arms.right.elevation) / TILT_REF),
      );
      this.tilt += (target - this.tilt) * 0.2;
    } else {
      this.tilt += (0 - this.tilt) * 0.1;
    }

    this.prevElev = mean;
    this.prevTime = t;
    this.hasPrev = true;

    return {
      flapHz: this.hz,
      flapPower: this.power,
      tilt: this.tilt,
      flapped,
    };
  }
}
