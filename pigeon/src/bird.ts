import * as THREE from 'three';

// A flat, horizontal wing extending along +X from a root at the origin.
// Shape is laid out in XY (x = span outward, y = chord front/back) then rotated
// flat so it lies in the X-Z plane with its thin dimension vertical.
function makeWingGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, -0.13); // root, leading edge (front)
  s.lineTo(1.5, -0.06); // tip, leading edge
  s.lineTo(1.5, 0.08); // tip, trailing edge
  s.lineTo(0.55, 0.32); // swept-back trailing edge
  s.lineTo(0, 0.13); // root, trailing edge
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
  geo.translate(0, 0, -0.025); // center thickness
  geo.rotateX(Math.PI / 2); // lay flat: chord -> z, thickness -> y
  geo.computeVertexNormals();
  return geo;
}

// Pigeon built from primitives. Faces -Z (away from the camera) so we watch it
// fly forward and see both wings flap. Wings pivot at the shoulders and rotate
// around the body's forward (Z) axis.
export class Bird {
  readonly group = new THREE.Group();
  private readonly leftWing = new THREE.Group();
  private readonly rightWing = new THREE.Group();
  private targetLeft = 0;
  private targetRight = 0;

  constructor() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6b7785, roughness: 0.85 });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x9aa6b3,
      roughness: 0.75,
      side: THREE.DoubleSide,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a4450, roughness: 0.8 });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xe0a040, roughness: 0.5 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.4 });

    // body — ellipsoid stretched along the forward axis
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 18), bodyMat);
    body.scale.set(1, 0.92, 1.6);
    this.group.add(body);

    // head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), bodyMat);
    head.position.set(0, 0.2, -0.5);
    this.group.add(head);

    // beak
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 12), beakMat);
    beak.position.set(0, 0.18, -0.72);
    beak.rotation.x = -Math.PI / 2;
    this.group.add(beak);

    // eyes
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), eyeMat);
      eye.position.set(0.1 * sx, 0.26, -0.62);
      this.group.add(eye);
    }

    // tail — flattened, fanned slightly upward at the back
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.45), darkMat);
    tail.position.set(0, 0.08, 0.6);
    tail.rotation.x = -0.25;
    this.group.add(tail);

    // wings — shared geometry; left is mirrored on x
    const wingGeo = makeWingGeometry();

    const rw = new THREE.Mesh(wingGeo, wingMat);
    this.rightWing.position.set(0.22, 0.12, 0.05);
    this.rightWing.add(rw);

    const lw = new THREE.Mesh(wingGeo, wingMat);
    lw.scale.x = -1;
    this.leftWing.position.set(-0.22, 0.12, 0.05);
    this.leftWing.add(lw);

    this.group.add(this.leftWing, this.rightWing);
  }

  // angle > 0 raises a wing above horizontal; 0 is level; < 0 droops it.
  // Per-arm setters so a briefly-hidden arm keeps its last commanded angle.
  setWingTargetsLeft(angle: number): void {
    this.targetLeft = angle;
  }
  setWingTargetsRight(angle: number): void {
    this.targetRight = angle;
  }

  // Call once per frame. Smoothly eases each wing toward its target so jittery
  // pose data doesn't make the wings buzz.
  update(): void {
    // left wing extends -X, so a positive "up" angle is a negative z-rotation
    this.leftWing.rotation.z = THREE.MathUtils.lerp(
      this.leftWing.rotation.z,
      -this.targetLeft,
      0.35,
    );
    this.rightWing.rotation.z = THREE.MathUtils.lerp(
      this.rightWing.rotation.z,
      this.targetRight,
      0.35,
    );
  }
}
