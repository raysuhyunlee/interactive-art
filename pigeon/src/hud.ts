import type { MotionState } from './motion';

function el<T extends HTMLElement>(sel: string): T {
  return document.querySelector<T>(sel)!;
}

// Live readout of the motion signals: flap power bar + frequency, tilt knob.
export class Hud {
  private root = el<HTMLDivElement>('#hud');
  private status = el<HTMLDivElement>('#status');
  private flapFill = el<HTMLDivElement>('#flap-fill');
  private flapHz = el<HTMLSpanElement>('#flap-hz');
  private tiltKnob = el<HTMLDivElement>('#tilt-knob');
  private pulseTimer = 0;

  setStatus(text: string): void {
    this.status.textContent = text;
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
