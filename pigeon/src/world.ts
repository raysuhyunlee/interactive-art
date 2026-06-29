import * as THREE from 'three';
import {
  initBuildingMaterials,
  makeBuilding,
  makeCar,
  makeMountain,
  makePerson,
  makeRoad,
  makeTree,
  mulberry32,
  type Rng,
} from './assets';

const EXTENT = 70; // city half-size
const BLOCK = 22; // grid cell size (building lot + road)
const ROAD_W = 7;
const CLEAR = 16; // keep a plaza clear around the bird's origin
const GROUND_Y = -3; // city floor

interface Car {
  obj: THREE.Object3D;
  axis: 'x' | 'z';
  dir: number;
  speed: number;
}

export interface World {
  group: THREE.Group;
  update(dt: number): void;
}

function distOrigin(x: number, z: number): number {
  return Math.hypot(x, z);
}

export function createWorld(seed = 1337): World {
  const rng: Rng = mulberry32(seed);
  initBuildingMaterials(rng);

  const group = new THREE.Group();
  group.position.y = GROUND_Y;
  const cars: Car[] = [];

  // grid line positions
  const lines: number[] = [];
  for (let g = -EXTENT; g <= EXTENT; g += BLOCK) lines.push(g);

  // ---- roads (a strip per grid line, both directions) ----
  for (const g of lines) {
    const h = makeRoad(EXTENT * 2 + BLOCK, ROAD_W, true);
    h.position.set(0, 0.02, g);
    const v = makeRoad(EXTENT * 2 + BLOCK, ROAD_W, false);
    v.position.set(g, 0.02, 0);
    group.add(h, v);
  }

  // ---- city blocks: buildings, or parks with trees ----
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const cx = (lines[i] + lines[i + 1]) / 2;
      const cz = (lines[j] + lines[j + 1]) / 2;
      const half = (BLOCK - ROAD_W) / 2 - 1;

      const isPark = distOrigin(cx, cz) < CLEAR || rng() < 0.25;

      if (isPark) {
        const trees = 2 + Math.floor(rng() * 4);
        for (let t = 0; t < trees; t++) {
          const tree = makeTree(rng);
          tree.position.set(cx + (rng() - 0.5) * half * 2, 0, cz + (rng() - 0.5) * half * 2);
          group.add(tree);
        }
      } else {
        const count = 1 + Math.floor(rng() * 3);
        for (let b = 0; b < count; b++) {
          const bld = makeBuilding(rng);
          bld.position.x = cx + (rng() - 0.5) * half;
          bld.position.z = cz + (rng() - 0.5) * half;
          group.add(bld);
        }
        // a couple of pedestrians on the block edge
        for (let p = 0; p < 2; p++) {
          if (rng() < 0.5) continue;
          const person = makePerson(rng);
          person.position.set(cx + (rng() - 0.5) * half * 2, 0, cz + half + 1.5);
          group.add(person);
        }
      }
    }
  }

  // ---- cars driving along the roads ----
  for (const g of lines) {
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      // horizontal road (drives along x)
      const ch = makeCar(rng);
      const dirH = rng() < 0.5 ? 1 : -1;
      ch.position.set((rng() - 0.5) * EXTENT * 2, 0, g + dirH * 1.7);
      ch.rotation.y = dirH > 0 ? -Math.PI / 2 : Math.PI / 2;
      group.add(ch);
      cars.push({ obj: ch, axis: 'x', dir: dirH, speed: 6 + rng() * 6 });

      // vertical road (drives along z)
      const cv = makeCar(rng);
      const dirV = rng() < 0.5 ? 1 : -1;
      cv.position.set(g - dirV * 1.7, 0, (rng() - 0.5) * EXTENT * 2);
      cv.rotation.y = dirV > 0 ? Math.PI : 0;
      group.add(cv);
      cars.push({ obj: cv, axis: 'z', dir: dirV, speed: 6 + rng() * 6 });
    }
  }

  // ---- distant mountains ringing the city ----
  const peaks = 9;
  for (let m = 0; m < peaks; m++) {
    const ang = (m / peaks) * Math.PI * 2 + rng() * 0.4;
    const rad = EXTENT + 70 + rng() * 70;
    const mtn = makeMountain(rng);
    mtn.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
    group.add(mtn);
  }

  function update(dt: number): void {
    for (const c of cars) {
      const p = c.obj.position;
      p[c.axis] += c.dir * c.speed * dt;
      if (p[c.axis] > EXTENT) p[c.axis] = -EXTENT;
      else if (p[c.axis] < -EXTENT) p[c.axis] = EXTENT;
    }
  }

  return { group, update };
}
