import * as THREE from 'three';

// Low-poly building blocks for the city. Geometries and materials are created
// once and shared across every instance to keep the scene cheap.

export type Rng = () => number;

// deterministic PRNG so the city layout is stable across reloads
export function mulberry32(seed: number): Rng {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAT = {
  trunk: new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 }),
  leaf: [
    new THREE.MeshStandardMaterial({ color: 0x2f7d3a, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x3d9450, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x27692f, roughness: 1 }),
  ],
  mountain: new THREE.MeshStandardMaterial({ color: 0x5c6a52, roughness: 1, flatShading: true }),
  snow: new THREE.MeshStandardMaterial({ color: 0xeef2f5, roughness: 0.9, flatShading: true }),
  road: new THREE.MeshStandardMaterial({ color: 0x2e3136, roughness: 1 }),
  person: [
    new THREE.MeshStandardMaterial({ color: 0xd24b4b, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x3b6fd2, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0xd2a83b, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0xefefef, roughness: 1 }),
  ],
  skin: new THREE.MeshStandardMaterial({ color: 0xe0b48a, roughness: 1 }),
  car: [
    new THREE.MeshStandardMaterial({ color: 0xd23b3b, roughness: 0.5, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0x3b7ad2, roughness: 0.5, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xf0c63b, roughness: 0.5, metalness: 0.3 }),
  ],
  glass: new THREE.MeshStandardMaterial({ color: 0x223044, roughness: 0.3, metalness: 0.6 }),
  buildings: [] as THREE.MeshStandardMaterial[],
};

const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

// ---------------------------------------------------------------------------
// shared geometries (unit-sized; scaled per instance)
// ---------------------------------------------------------------------------
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const TRUNK_GEO = new THREE.CylinderGeometry(0.12, 0.18, 1, 6);
const FOLIAGE_GEO = new THREE.ConeGeometry(0.8, 1.6, 7);
const HEAD_GEO = new THREE.SphereGeometry(0.13, 8, 6);
const MOUNTAIN_GEO = new THREE.ConeGeometry(1, 1, 7, 1);

// A grid of lit/dark windows, tiled across building faces.
function makeWindowTexture(rng: Rng): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = '#39414e';
  x.fillRect(0, 0, 64, 64);
  for (let yy = 5; yy < 60; yy += 12) {
    for (let xx = 5; xx < 60; xx += 12) {
      x.fillStyle = rng() < 0.5 ? '#ffe6a0' : '#2b323d';
      x.fillRect(xx, yy, 7, 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Build a small palette of window-textured building materials up front.
export function initBuildingMaterials(rng: Rng): void {
  if (MAT.buildings.length) return;
  const tints = [0x9aa6b3, 0x8694a2, 0xb0b8bf, 0x76828f, 0xa6968a];
  for (const tint of tints) {
    const tex = makeWindowTexture(rng);
    MAT.buildings.push(
      new THREE.MeshStandardMaterial({
        color: tint,
        roughness: 0.8,
        map: tex,
        emissive: 0xffe6a0,
        emissiveMap: tex,
        emissiveIntensity: 0.35,
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// factories — each returns an Object3D sitting on y = 0 (ground level)
// ---------------------------------------------------------------------------
export function makeTree(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(TRUNK_GEO, MAT.trunk);
  trunk.position.y = 0.5;
  const foliage = new THREE.Mesh(FOLIAGE_GEO, pick(MAT.leaf, rng));
  foliage.position.y = 1.6;
  g.add(trunk, foliage);
  g.scale.setScalar(0.7 + rng() * 0.9);
  return g;
}

export function makeBuilding(rng: Rng): THREE.Mesh {
  const w = 4 + rng() * 7;
  const d = 4 + rng() * 7;
  const h = 6 + rng() * rng() * 38; // skew toward shorter, occasional towers
  const mat = pick(MAT.buildings, rng).clone();
  if (mat.map) {
    mat.map = mat.map.clone();
    mat.map.repeat.set(Math.max(1, Math.round(w / 2.5)), Math.max(1, Math.round(h / 2.5)));
    mat.map.needsUpdate = true;
    mat.emissiveMap = mat.map;
  }
  const m = new THREE.Mesh(UNIT_BOX, mat);
  m.scale.set(w, h, d);
  m.position.y = h / 2;
  return m;
}

export function makeMountain(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const r = 24 + rng() * 28;
  const h = 32 + rng() * 46;
  const body = new THREE.Mesh(MOUNTAIN_GEO, MAT.mountain);
  body.scale.set(r, h, r);
  body.position.y = h / 2;
  g.add(body);
  // snow cap: a smaller cone near the peak
  const cap = new THREE.Mesh(MOUNTAIN_GEO, MAT.snow);
  const ch = h * 0.3;
  cap.scale.set(r * 0.34, ch, r * 0.34);
  cap.position.y = h - ch / 2;
  g.add(cap);
  return g;
}

export function makeCar(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(UNIT_BOX, pick(MAT.car, rng));
  body.scale.set(1.6, 0.55, 3.2);
  body.position.y = 0.45;
  const cabin = new THREE.Mesh(UNIT_BOX, MAT.glass);
  cabin.scale.set(1.4, 0.5, 1.6);
  cabin.position.set(0, 0.9, -0.2);
  g.add(body, cabin);
  return g;
}

export function makePerson(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(UNIT_BOX, pick(MAT.person, rng));
  body.scale.set(0.34, 0.7, 0.26);
  body.position.y = 0.45;
  const head = new THREE.Mesh(HEAD_GEO, MAT.skin);
  head.position.y = 0.92;
  g.add(body, head);
  return g;
}

// flat dark strip laid on the ground
export function makeRoad(length: number, width: number, horizontal: boolean): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(horizontal ? length : width, horizontal ? width : length);
  const m = new THREE.Mesh(geo, MAT.road);
  m.rotation.x = -Math.PI / 2;
  return m;
}
