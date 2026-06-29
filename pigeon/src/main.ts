import './style.css';
import * as THREE from 'three';
import { startWebcam } from './camera';
import { createPoseLandmarker, readArms, type Arms, type Pose } from './pose';
import { Bird } from './bird';
import { drawDebug } from './debug';
import { MotionAnalyzer, type MotionState } from './motion';
import { Hud } from './hud';
import { BirdPhysics } from './physics';

const video = document.querySelector<HTMLVideoElement>('#webcam')!;
const sceneCanvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const debugCanvas = document.querySelector<HTMLCanvasElement>('#debug')!;
const debugCtx = debugCanvas.getContext('2d')!;

const hud = new Hud();
const analyzer = new MotionAnalyzer();
const physics = new BirdPhysics();

// latest motion signals, written by the pose loop and read by the render loop
let motion: MotionState = { flapHz: 0, flapPower: 0, tilt: 0, flapped: false };

const DEBUG_W = 280; // CSS px width of the bottom-right PIP

// max bank angle (rad) the bird rolls to at full tilt
const MAX_ROLL = 0.6;
// camera offset behind/above the bird as it climbs and falls
const CAM_BACK = 5.0;
const CAM_UP = 2.0;
const NO_ARMS: Arms = {
  left: { elevation: 0, ok: false },
  right: { elevation: 0, ok: false },
};

// ---------------------------------------------------------------------------
// Three.js scene
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8e0); // daytime sky

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
// slightly elevated rear view: behind (+Z) and above (+Y), looking down a bit
camera.position.set(0, 2.0, 5.0);
camera.lookAt(0, 0.1, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(3, 6, 4);
scene.add(sun);

// faint ground plane so the bird has a sense of place (city comes in step 4)
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x4a7a4a, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -3;
scene.add(ground);

const bird = new Bird();
scene.add(bird.group);

function resizeScene() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // updateStyle = true: also set the canvas CSS size. Without it the canvas
  // renders at drawing-buffer size (viewport * dpr), so on retina it overflows
  // and the centered scene drifts into the bottom-right corner.
  renderer.setSize(w, h, true);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeScene);
resizeScene();

// Map arm elevation (radians) to a wing angle, with a little gain and clamping
// so fully-raised arms lift the wings high and lowered arms droop them.
function toWingAngle(elevation: number): number {
  return THREE.MathUtils.clamp(elevation * 1.15, -0.7, 1.35);
}

// ---------------------------------------------------------------------------
// Render loop — runs immediately and independently, so the bird is always on
// screen even before (or without) the camera and pose model.
// ---------------------------------------------------------------------------
let lastPose: Pose | null = null;
const clock = new THREE.Clock();

function renderLoop() {
  const dt = Math.min(clock.getDelta(), 0.05); // clamp to avoid post-stall jumps

  // physics: flapping lifts, gravity pulls, tilt turns
  physics.update(dt, motion.flapPower, motion.tilt);
  bird.group.position.copy(physics.position);
  bird.group.rotation.y = physics.heading;

  // chase cam: sit behind the bird along its heading so turns read naturally
  const back = physics.forward.multiplyScalar(-CAM_BACK);
  camera.position.set(
    physics.position.x + back.x,
    physics.position.y + CAM_UP,
    physics.position.z + back.z,
  );
  camera.lookAt(physics.position.x, physics.position.y + 0.1, physics.position.z);

  bird.update();
  hud.setFlight(physics.altitude, physics.speed, physics.headingDeg);

  renderer.render(scene, camera);
  if (video.videoWidth > 0) drawDebug(debugCtx, video, lastPose);
  requestAnimationFrame(renderLoop);
}
renderLoop();

// ---------------------------------------------------------------------------
// Camera + pose pipeline — drives the wings once it's ready.
// ---------------------------------------------------------------------------
async function startTracking() {
  try {
    hud.setStatus('requesting camera…');
    await startWebcam(video);

    // size the debug PIP to the camera's aspect ratio
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const aspect = video.videoHeight / video.videoWidth;
    debugCanvas.style.width = `${DEBUG_W}px`;
    debugCanvas.style.height = `${Math.round(DEBUG_W * aspect)}px`;
    debugCanvas.width = Math.round(DEBUG_W * dpr);
    debugCanvas.height = Math.round(DEBUG_W * aspect * dpr);

    hud.setStatus('loading pose model…');
    const landmarker = await createPoseLandmarker();

    hud.setStatus('tracking — flap and tilt your arms');

    let lastVideoTime = -1;

    const detectLoop = () => {
      if (video.currentTime !== lastVideoTime && video.videoWidth > 0) {
        lastVideoTime = video.currentTime;
        const now = performance.now();
        const result = landmarker.detectForVideo(video, now);
        lastPose = result.landmarks[0] ?? null;

        const arms = lastPose ? readArms(lastPose) : NO_ARMS;

        // direct mapping: each arm drives its wing
        if (arms.left.ok) bird.setWingTargetsLeft(toWingAngle(arms.left.elevation));
        if (arms.right.ok) bird.setWingTargetsRight(toWingAngle(arms.right.elevation));

        // derived signals: flap + tilt (shared with the physics/render loop)
        motion = analyzer.update(arms, now);
        bird.setBankTarget(-motion.tilt * MAX_ROLL);
        hud.update(motion);

        if (!lastPose) hud.setStatus('no person detected');
        else if (!arms.left.ok && !arms.right.ok) hud.setStatus('arms not visible');
        else hud.setStatus('tracking — flap and tilt your arms');
      }
      requestAnimationFrame(detectLoop);
    };
    requestAnimationFrame(detectLoop);
  } catch (err) {
    console.error(err);
    hud.setError(`error: ${(err as Error).message}`);
  }
}

startTracking();
