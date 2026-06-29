import { ARM_CONNECTIONS, BODY_CONNECTIONS, LM, type Pose } from './pose';

const ARM_JOINTS = new Set<number>([
  LM.leftShoulder,
  LM.rightShoulder,
  LM.leftElbow,
  LM.rightElbow,
  LM.leftWrist,
  LM.rightWrist,
]);

// Mirrored mapping (selfie view) into the small debug canvas.
function px(lm: { x: number }, w: number) {
  return (1 - lm.x) * w;
}
function py(lm: { y: number }, h: number) {
  return lm.y * h;
}

function strokeConnections(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  connections: [number, number][],
  w: number,
  h: number,
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
    ctx.moveTo(px(p, w), py(p, h));
    ctx.lineTo(px(q, w), py(q, h));
    ctx.stroke();
  }
}

// Draws the mirrored webcam feed plus the pose skeleton into the PIP canvas.
export function drawDebug(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  pose: Pose | null,
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);

  // mirrored video, stretched to fill the PIP
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();

  if (!pose) return;

  const unit = Math.min(w, h);
  strokeConnections(ctx, pose, BODY_CONNECTIONS, w, h, 'rgba(255,255,255,0.4)', unit * 0.01);
  strokeConnections(ctx, pose, ARM_CONNECTIONS, w, h, '#27e0a0', unit * 0.022);

  for (let i = 0; i < pose.length; i++) {
    const lm = pose[i];
    const isArm = ARM_JOINTS.has(i);
    ctx.beginPath();
    ctx.arc(px(lm, w), py(lm, h), unit * (isArm ? 0.022 : 0.009), 0, Math.PI * 2);
    ctx.fillStyle = isArm ? '#fff' : 'rgba(255,255,255,0.45)';
    ctx.fill();
  }
}
