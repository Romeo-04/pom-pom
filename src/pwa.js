import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

export function bindInstallButton(button) {
  if (!button) return;
  let deferred = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
    button.hidden = false;
  });

  button.addEventListener("click", async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    button.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    button.hidden = true;
  });
}
