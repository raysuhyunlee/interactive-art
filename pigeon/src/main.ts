import './style.css';
import { startWebcam } from './camera';
import {
  createPoseLandmarker,
  ARM_CONNECTIONS,
  BODY_CONNECTIONS,
  LM,
  type Pose,
} from './pose';

const video = document.querySelector<HTMLVideoElement>('#webcam')!;
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const hud = document.querySelector<HTMLDivElement>('#hud')!;
const ctx = canvas.getContext('2d')!;

// Landmark indices that make up the arms — drawn as larger, brighter joints.
const ARM_JOINTS = new Set<number>([
  LM.leftShoulder,
  LM.rightShoulder,
  LM.leftElbow,
  LM.rightElbow,
  LM.leftWrist,
  LM.rightWrist,
]);

// Device-pixel-aware sizing so the canvas stays crisp on retina displays.
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}
window.addEventListener('resize', resize);
resize();

// "cover" fit: the video fills the canvas, cropping overflow on the long axis.
function coverRect(cw: number, ch: number, vw: number, vh: number) {
  const scale = Math.max(cw / vw, ch / vh);
  const w = vw * scale;
  const h = vh * scale;
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}

let rect = { x: 0, y: 0, w: 0, h: 0 };

// Landmark x is mirrored so the view reads like a selfie mirror.
function px(lm: { x: number }) {
  return rect.x + (1 - lm.x) * rect.w;
}
function py(lm: { y: number }) {
  return rect.y + lm.y * rect.h;
}

function drawConnections(
  pose: Pose,
  connections: [number, number][],
  color: string,
  width: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  for (const [a, b] of connections) {
    const p = pose[a];
    const q = pose[b];
    if (!p || !q) continue;
    ctx.beginPath();
    ctx.moveTo(px(p), py(p));
    ctx.lineTo(px(q), py(q));
    ctx.stroke();
  }
}

function drawPose(pose: Pose) {
  const unit = Math.min(rect.w, rect.h);
  drawConnections(pose, BODY_CONNECTIONS, 'rgba(255,255,255,0.35)', unit * 0.006);
  drawConnections(pose, ARM_CONNECTIONS, '#27e0a0', unit * 0.012);

  // joints: arms big & bright, everything else small & dim
  for (let i = 0; i < pose.length; i++) {
    const lm = pose[i];
    const isArm = ARM_JOINTS.has(i);
    ctx.beginPath();
    ctx.arc(px(lm), py(lm), unit * (isArm ? 0.012 : 0.005), 0, Math.PI * 2);
    ctx.fillStyle = isArm ? '#fff' : 'rgba(255,255,255,0.4)';
    ctx.fill();
  }
}

function drawFrame(pose: Pose | null) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  rect = coverRect(canvas.width, canvas.height, video.videoWidth, video.videoHeight);

  // mirrored video background
  ctx.save();
  ctx.translate(rect.x + rect.w, rect.y);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, rect.w, rect.h);
  ctx.restore();

  if (pose) drawPose(pose);
}

async function main() {
  try {
    hud.textContent = 'requesting camera…';
    await startWebcam(video);

    hud.textContent = 'loading pose model…';
    const landmarker = await createPoseLandmarker();

    hud.textContent = 'tracking — move your arms';

    let lastVideoTime = -1;
    let lastPose: Pose | null = null;

    const loop = () => {
      // Only run inference when the video has a fresh frame.
      if (video.currentTime !== lastVideoTime && video.videoWidth > 0) {
        lastVideoTime = video.currentTime;
        const result = landmarker.detectForVideo(video, performance.now());
        lastPose = result.landmarks[0] ?? null;
        hud.textContent = lastPose ? 'arms tracked' : 'no person detected';
      }
      drawFrame(lastPose);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    hud.textContent = `error: ${(err as Error).message}`;
    hud.classList.add('error');
  }
}

main();
