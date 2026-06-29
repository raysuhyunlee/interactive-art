// Single getUserMedia request that resolves once the stream is playing and has
// real dimensions. We draw these frames into the canvas ourselves (mirrored),
// so the <video> element itself stays hidden.
export async function startWebcam(video: HTMLVideoElement): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user',
    },
    audio: false,
  });
  video.srcObject = stream;

  await new Promise<void>((resolve) => {
    if (video.readyState >= 2 && video.videoWidth > 0) return resolve();
    video.onloadedmetadata = () => resolve();
  });
  await video.play();
}
