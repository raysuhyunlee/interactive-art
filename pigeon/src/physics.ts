import * as THREE from 'three';

// Minimal vertical flight model: gravity pulls down, flapping generates lift.
// Horizontal motion (forward flight, steering) comes with the city in step 6.
const GRAVITY = 10; // constant downward acceleration
const LIFT_GAIN = 20; // upward acceleration at full flap power
const VERT_DRAG = 1.5; // air resistance proportional to vertical speed
const GROUND_Y = -2.5; // bird rests here; can't sink below
const MAX_SPEED = 9; // clamp vertical speed for stability
const YAW_RATE = 1.2; // rad/s of turn at full tilt

// At flapPower = GRAVITY / LIFT_GAIN (= 0.5) lift balances gravity and the bird
// hovers; flap harder to climb, ease off to descend.
export class BirdPhysics {
  readonly position = new THREE.Vector3(0, GROUND_Y, 0);
  readonly velocity = new THREE.Vector3();
  heading = 0; // yaw in radians; 0 faces -Z (north)

  update(dt: number, flapPower: number, tilt: number): void {
    // vertical: gravity vs. lift
    let ay = -GRAVITY + LIFT_GAIN * flapPower;
    ay -= this.velocity.y * VERT_DRAG; // drag

    this.velocity.y = THREE.MathUtils.clamp(
      this.velocity.y + ay * dt,
      -MAX_SPEED,
      MAX_SPEED,
    );
    this.position.y += this.velocity.y * dt;

    // ground contact
    if (this.position.y <= GROUND_Y) {
      this.position.y = GROUND_Y;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }

    // banking turns the bird (heading only; forward travel comes in step 6)
    this.heading += tilt * YAW_RATE * dt;
  }

  // height above the ground, in world units
  get altitude(): number {
    return this.position.y - GROUND_Y;
  }

  // current speed (vertical only for now)
  get speed(): number {
    return this.velocity.length();
  }

  // unit forward vector implied by the heading (bird faces -Z at heading 0)
  get forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
  }

  // compass bearing in degrees: 0 = N (-Z), 90 = E (+X)
  get headingDeg(): number {
    return ((-this.heading * 180) / Math.PI + 360 * 10) % 360;
  }
}
