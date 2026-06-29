import type { MotionState } from './motion';

function el<T extends HTMLElement>(sel: string): T {
  return document.querySelector<T>(sel)!;
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function compass(deg: number): string {
  return POINTS[Math.round(deg / 45) % 8];
}

// Live readout of the motion signals: flap power bar + frequency, tilt knob.
export class Hud {
  private root = el<HTMLDivElement>('#hud');
  private status = el<HTMLDivElement>('#status');
  private flapFill = el<HTMLDivElement>('#flap-fill');
  private flapHz = el<HTMLSpanElement>('#flap-hz');
  private tiltKnob = el<HTMLDivElement>('#tilt-knob');
  private altVal = el<HTMLSpanElement>('#alt-val');
  private spdVal = el<HTMLSpanElement>('#spd-val');
  private hdgVal = el<HTMLSpanElement>('#hdg-val');
  private pulseTimer = 0;

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  setFlight(altitude: number, speed: number, headingDeg: number): void {
    this.altVal.textContent = altitude.toFixed(1);
    this.spdVal.textContent = speed.toFixed(1);
    this.hdgVal.textContent = `${compass(headingDeg)} ${Math.round(headingDeg)}°`;
  }

  setError(text: string): void {
    this.status.textContent = text;
    this.root.classList.add('error');
  }

  update(m: MotionState): void {
    this.flapFill.style.width = `${Math.round(m.flapPower * 100)}%`;
    this.flapHz.textContent = `${m.flapHz.toFixed(1)} Hz`;
    this.tiltKnob.style.left = `${((m.tilt + 1) / 2) * 100}%`;

    if (m.flapped) {
      this.flapFill.classList.add('pulse');
      clearTimeout(this.pulseTimer);
      this.pulseTimer = window.setTimeout(
        () => this.flapFill.classList.remove('pulse'),
        120,
      );
    }
  }
}
