let ctx = null;
let siren = null;
let sirenTimer = null;

function buildAlarmWavUrl() {
  const sampleRate = 22050;
  const seconds = 0.45;
  const n = Math.floor(sampleRate * seconds);
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const freq = t < 0.22 ? 880 : 620;
    const env = Math.min(1, i / 400) * Math.min(1, (n - i) / 800);
    pcm[i] = Math.floor(Math.sin(2 * Math.PI * freq * t) * 0.85 * env * 32767);
  }
  const bytes = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + bytes);
  const view = new DataView(buffer);
  const ascii = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, bytes, true);
  new Uint8Array(buffer, 44).set(new Uint8Array(pcm.buffer));
  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

function getSiren() {
  if (!siren) {
    siren = new Audio(buildAlarmWavUrl());
    siren.loop = true;
    siren.preload = "auto";
  }
  return siren;
}

export async function unlockAlertAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (AudioCtx) {
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === "suspended") await ctx.resume();
  }
  try {
    const a = getSiren();
    a.volume = 0.001;
    await a.play();
    a.pause();
    a.currentTime = 0;
    a.volume = 1;
  } catch {
    /* wait for a later click */
  }
}

export function playLeaveAlert() {
  const now = ctx?.currentTime ?? 0;
  if (ctx) {
    const pattern = [880, 622, 880, 622, 988, 622, 880, 622];
    pattern.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      const t = now + i * 0.2;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.28, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  const a = getSiren();
  a.volume = 1;
  a.currentTime = 0;
  a.play().catch(() => {});
  window.clearTimeout(sirenTimer);
  sirenTimer = window.setTimeout(stopLeaveAlert, 4000);
}

export function playCompleteChime() {
  if (!ctx) return;
  const now = ctx.currentTime;
  [523, 659, 784].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + i * 0.12;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}

export function stopLeaveAlert() {
  window.clearTimeout(sirenTimer);
  if (!siren) return;
  siren.pause();
  siren.currentTime = 0;
}

export async function requestLeaveNotifications() {
  if (!("Notification" in window) || Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    /* ignored — audio still runs */
  }
}

export function showLeaveNotification() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification("Pom-pom — come back", {
      body: "You left this tab. Your Inklet is waiting.",
      silent: false,
      tag: "hatch-tab-leave",
    });
  } catch {
    /* some browsers block notifications from hidden documents */
  }
}
