import * as THREE from 'three';
import { mulberry32, type Rng } from './assets';

// Volume the flock roams within (centered on the player at the origin).
const RADIUS = 55;
const Y_MIN = 3;
const Y_MAX = 32;
const MIN_SPEED = 4;
const MAX_SPEED = 11;
const NEIGHBOR = 6; // separation radius

// shared low-poly bird parts
const BODY_GEO = new THREE.SphereGeometry(0.18, 10, 8);
const HEAD_GEO = new THREE.SphereGeometry(0.11, 8, 6);
const WING_GEO = new THREE.BoxGeometry(1.1, 0.04, 0.5);
const BODY_MAT = new THREE.MeshStandardMaterial({ color: 0x55606b, roughness: 0.9 });
const WING_MAT = new THREE.MeshStandardMaterial({
  color: 0x6c7783,
  roughness: 0.85,
  side: THREE.DoubleSide,
});

interface Boid {
  obj: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  vel: THREE.Vector3;
  phase: number;
  flapFreq: number;
}

function makeFlockBird(): {
  obj: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
} {
  const obj = new THREE.Group();

  const body = new THREE.Mesh(BODY_GEO, BODY_MAT);
  body.scale.set(1, 0.8, 1.8);
  obj.add(body);

  const head = new THREE.Mesh(HEAD_GEO, BODY_MAT);
  head.position.set(0, 0.06, -0.32); // faces -Z
  obj.add(head);

  const rightWing = new THREE.Group();
  const rw = new THREE.Mesh(WING_GEO, WING_MAT);
  rw.position.x = 0.55;
  rightWing.add(rw);
  rightWing.position.set(0.1, 0.05, 0);

  const leftWing = new THREE.Group();
  const lw = new THREE.Mesh(WING_GEO, WING_MAT);
  lw.position.x = -0.55;
  leftWing.add(lw);
  leftWing.position.set(-0.1, 0.05, 0);

  obj.add(rightWing, leftWing);
  return { obj, leftWing, rightWing };
}

export class Flock {
  readonly group = new THREE.Group();
  private boids: Boid[] = [];
  private rng: Rng;

  // scratch vectors reused across the update to avoid per-frame allocation
  private acc = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  constructor(count = 14, seed = 99) {
    this.rng = mulberry32(seed);
    for (let i = 0; i < count; i++) this.spawn();
  }

  private spawn(): void {
    const { obj, leftWing, rightWing } = makeFlockBird();
    const ang = this.rng() * Math.PI * 2;
    const rad = 12 + this.rng() * (RADIUS - 12);
    obj.position.set(
      Math.cos(ang) * rad,
      Y_MIN + this.rng() * (Y_MAX - Y_MIN),
      Math.sin(ang) * rad,
    );
    const heading = this.rng() * Math.PI * 2;
    const speed = MIN_SPEED + this.rng() * (MAX_SPEED - MIN_SPEED);
    const vel = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading)).multiplyScalar(speed);

    this.group.add(obj);
    this.boids.push({
      obj,
      leftWing,
      rightWing,
      vel,
      phase: this.rng() * Math.PI * 2,
      flapFreq: 7 + this.rng() * 5,
    });
  }

  update(dt: number): void {
    for (const b of this.boids) {
      const p = b.obj.position;
      this.acc.set(0, 0, 0);

      // wander: small random nudge
      this.acc.x += (this.rng() - 0.5) * 8;
      this.acc.y += (this.rng() - 0.5) * 3;
      this.acc.z += (this.rng() - 0.5) * 8;

      // separation: steer away from close neighbors
      for (const o of this.boids) {
        if (o === b) continue;
        this.tmp.subVectors(p, o.obj.position);
        const d = this.tmp.length();
        if (d > 0 && d < NEIGHBOR) {
          this.acc.addScaledVector(this.tmp, (NEIGHBOR - d) / (d * NEIGHBOR) * 6);
        }
      }

      // containment: stay within the horizontal radius and altitude band
      const horiz = Math.hypot(p.x, p.z);
      if (horiz > RADIUS) {
        this.acc.x -= (p.x / horiz) * (horiz - RADIUS) * 0.6;
        this.acc.z -= (p.z / horiz) * (horiz - RADIUS) * 0.6;
      }
      if (p.y < Y_MIN) this.acc.y += (Y_MIN - p.y) * 2;
      else if (p.y > Y_MAX) this.acc.y -= (p.y - Y_MAX) * 2;

      // integrate, clamp speed
      b.vel.addScaledVector(this.acc, dt);
      const sp = b.vel.length();
      if (sp > MAX_SPEED) b.vel.multiplyScalar(MAX_SPEED / sp);
      else if (sp < MIN_SPEED && sp > 0) b.vel.multiplyScalar(MIN_SPEED / sp);
      p.addScaledVector(b.vel, dt);

      // orient: yaw toward velocity, slight pitch from climb rate
      b.obj.rotation.y = Math.atan2(-b.vel.x, -b.vel.z);
      const speed = b.vel.length();
      b.obj.rotation.x = speed > 0 ? -Math.asin(THREE.MathUtils.clamp(b.vel.y / speed, -1, 1)) * 0.5 : 0;

      // flap
      b.phase += dt * b.flapFreq;
      const a = Math.sin(b.phase) * 0.7;
      b.leftWing.rotation.z = -a;
      b.rightWing.rotation.z = a;
    }
  }
}
