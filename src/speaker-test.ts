export function attachSpeakerTest(button: HTMLButtonElement, status: HTMLElement) {
 let context: AudioContext | undefined;
 button.onclick = async () => {
  if (context) return;
  button.disabled = true;
  const audio = new AudioContext(); context = audio;
  try {
   await audio.resume();
   if (audio.state !== 'running') throw new Error('unavailable');
   status.textContent = 'Слышно мелодию?';
   [523.25,659.25,783.99].forEach((frequency,i) => {
    const oscillator=audio.createOscillator(), gain=audio.createGain();
    const start=audio.currentTime+i*0.24;
    oscillator.frequency.value=frequency; oscillator.type='sine';
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(0.07,start+0.025);gain.gain.linearRampToValueAtTime(0,start+0.22);
    oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+0.24);
   });
   await new Promise(resolve=>setTimeout(resolve,900));
   status.textContent='Не слышно? Проверьте громкость и выход звука ОС.';
  } catch {status.textContent='Не удалось воспроизвести. Повторите проверку.';}
  finally {await audio.close().catch(()=>{});context=undefined;button.disabled=false;}
 };
 window.addEventListener('pagehide',()=>{void context?.close().catch(()=>{});},{once:true});
}
