// Only inspect an existing preview whose track is the exact outgoing camera.
// No capture request, stored images, or incoming participant video.
export function cameraBrightness(track: MediaStreamTrack): number | undefined {
 try {
  const video = [...document.querySelectorAll('video')].find(v =>
   v.srcObject instanceof MediaStream && v.srcObject.getVideoTracks().includes(track) && v.readyState >= 2 && v.videoWidth > 0);
  if (!video) return;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
  const context = canvas.getContext('2d', {willReadFrequently:true}); if (!context) return;
  context.drawImage(video, 0, 0, 16, 16);
  const pixels = context.getImageData(0, 0, 16, 16).data;
  let total = 0;
  for (let i=0;i<pixels.length;i+=4) total += (pixels[i]*0.2126 + pixels[i+1]*0.7152 + pixels[i+2]*0.0722)/255;
  canvas.width = canvas.height = 0;
  return total / 256;
 } catch { return; }
}
export function darkFrames(levels: number[]): boolean { return levels.length >= 3 && levels.every(v => v < 0.025); }

export async function openCameraPreview(track: MediaStreamTrack) {
 const video=document.createElement('video');video.muted=true;video.playsInline=true;
 video.srcObject=new MediaStream([track]);
 video.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
 document.documentElement.append(video);
 // Playback never requests a device and cleanup must not stop the shared track.
 void video.play().catch(()=>{});
 return () => {video.pause();video.srcObject=null;video.remove();};
}
