let ctx = null;

export async function unlockAlertAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") await ctx.resume();
}

/** Two-tone square alarm scheduled in one shot so it can keep playing after the tab hides. */
export function playLeaveAlert() {
  if (!ctx) return;
  const now = ctx.currentTime;
  const pattern = [880, 622, 880, 622, 988, 622, 880];
  pattern.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    const t = now + i * 0.22;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
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
    new Notification("Hatch — you left focus", {
      body: "Come back. Focus is still running and the Inklet only grows if you stay.",
      silent: false,
      tag: "hatch-tab-leave",
    });
  } catch {
    /* some browsers block notifications from hidden documents */
  }
}
