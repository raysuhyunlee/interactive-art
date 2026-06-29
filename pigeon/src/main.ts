import './style.css';
import * as THREE from 'three';
import { startWebcam } from './camera';
import { createPoseLandmarker, readArms, type Pose } from './pose';
import { Bird } from './bird';
import { drawDebug } from './debug';

const video = document.querySelector<HTMLVideoElement>('#webcam')!;
const sceneCanvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const debugCanvas = document.querySelector<HTMLCanvasElement>('#debug')!;
const hud = document.querySelector<HTMLDivElement>('#hud')!;
const debugCtx = debugCanvas.getContext('2d')!;

const DEBUG_W = 280; // CSS px width of the bottom-right PIP

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

function renderLoop() {
  bird.update();
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
    hud.textContent = 'requesting camera…';
    await startWebcam(video);

    // size the debug PIP to the camera's aspect ratio
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const aspect = video.videoHeight / video.videoWidth;
    debugCanvas.style.width = `${DEBUG_W}px`;
    debugCanvas.style.height = `${Math.round(DEBUG_W * aspect)}px`;
    debugCanvas.width = Math.round(DEBUG_W * dpr);
    debugCanvas.height = Math.round(DEBUG_W * aspect * dpr);

    hud.textContent = 'loading pose model…';
    const landmarker = await createPoseLandmarker();

    hud.textContent = 'tracking — raise and flap your arms';

    let lastVideoTime = -1;

    const detectLoop = () => {
      if (video.currentTime !== lastVideoTime && video.videoWidth > 0) {
        lastVideoTime = video.currentTime;
        const result = landmarker.detectForVideo(video, performance.now());
        lastPose = result.landmarks[0] ?? null;

        if (lastPose) {
          const arms = readArms(lastPose);
          if (arms.left.ok) bird.setWingTargetsLeft(toWingAngle(arms.left.elevation));
          if (arms.right.ok) bird.setWingTargetsRight(toWingAngle(arms.right.elevation));
          hud.textContent =
            arms.left.ok || arms.right.ok ? 'tracking arms' : 'arms not visible';
        } else {
          hud.textContent = 'no person detected';
        }
      }
      requestAnimationFrame(detectLoop);
    };
    requestAnimationFrame(detectLoop);
  } catch (err) {
    console.error(err);
    hud.textContent = `error: ${(err as Error).message}`;
    hud.classList.add('error');
  }
}

startTracking();
