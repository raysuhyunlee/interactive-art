import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

// Pin the wasm CDN to the installed package version so the runtime always
// matches the JS API we bundle.
const WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// BlazePose 33-landmark indices we care about for arm tracking.
export const LM = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
} as const;

// Connections drawn as the dim "body" reference.
export const BODY_CONNECTIONS: [number, number][] = [
  [LM.leftShoulder, LM.rightShoulder],
  [LM.leftShoulder, LM.leftHip],
  [LM.rightShoulder, LM.rightHip],
  [LM.leftHip, LM.rightHip],
];

// Connections drawn as the bright, highlighted arms.
export const ARM_CONNECTIONS: [number, number][] = [
  [LM.leftShoulder, LM.leftElbow],
  [LM.leftElbow, LM.leftWrist],
  [LM.rightShoulder, LM.rightElbow],
  [LM.rightElbow, LM.rightWrist],
];

export type Pose = NormalizedLandmark[];

export interface ArmReading {
  elevation: number; // radians: +up, 0 level, -down (relative to shoulder)
  ok: boolean; // landmarks confident enough to trust
}

export interface Arms {
  left: ArmReading;
  right: ArmReading;
}

const VIS_MIN = 0.5;

// Elevation of the hand relative to the shoulder: vertical rise over horizontal
// reach. ~+pi/2 when the arm is straight up, ~0 when held out level, negative
// when lowered. Independent of distance from the camera.
function armElevation(shoulder: NormalizedLandmark, wrist: NormalizedLandmark): number {
  const dy = shoulder.y - wrist.y; // image y is top-down, so flip to make up +
  const dx = Math.abs(wrist.x - shoulder.x);
  return Math.atan2(dy, dx + 1e-3);
}

export function readArms(pose: Pose): Arms {
  const ls = pose[LM.leftShoulder];
  const lw = pose[LM.leftWrist];
  const rs = pose[LM.rightShoulder];
  const rw = pose[LM.rightWrist];

  const okL = (ls?.visibility ?? 0) > VIS_MIN && (lw?.visibility ?? 0) > VIS_MIN;
  const okR = (rs?.visibility ?? 0) > VIS_MIN && (rw?.visibility ?? 0) > VIS_MIN;

  return {
    left: { elevation: okL ? armElevation(ls, lw) : 0, ok: okL },
    right: { elevation: okR ? armElevation(rs, rw) : 0, ok: okR },
  };
}

export async function createPoseLandmarker(): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}
