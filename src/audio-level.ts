export interface AudioSample { audioLevel?: number; totalAudioEnergy?: number; totalSamplesDuration?: number }
// RMS from the WebRTC energy integral. Never treat any positive energy delta
// as speech: hardware-muted headsets can still emit low electrical noise.
export function audioLevel(current: AudioSample, previous?: AudioSample): number | undefined {
 const energy = current.totalAudioEnergy;
 const duration = current.totalSamplesDuration;
 if (energy !== undefined && duration !== undefined && previous?.totalAudioEnergy !== undefined && previous.totalSamplesDuration !== undefined) {
  const dt = duration - previous.totalSamplesDuration, de = energy - previous.totalAudioEnergy;
  if (dt > 0 && de >= 0 && Number.isFinite(de / dt)) return Math.min(1, Math.sqrt(de / dt));
 }
 return typeof current.audioLevel === 'number' && Number.isFinite(current.audioLevel) && current.audioLevel >= 0 && current.audioLevel <= 1 ? current.audioLevel : undefined;
}
export function audibleSamples(levels: number[]): boolean {
 // Heuristic signal gate, not voice recognition or a hardware mute detector.
 return levels.filter(level => level >= 0.01).length >= 2;
}
