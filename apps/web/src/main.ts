import { createGame } from "./game/game.js";
import { mountPanel } from "./ui/panel.js";
import "./style.css";

const SAVE_EVERY_MS = 5000;

/** Instance du jeu : le rendu de la carte (#11) lit `game.state`/`game.map` et appelle `game.setGrowthTarget(hex)`. */
export const game = createGame(Date.now());

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  const render = mountPanel(app, game);
  let lastSave = Date.now();
  setInterval(() => {
    const now = Date.now();
    game.tick(now);
    render();
    if (now - lastSave >= SAVE_EVERY_MS) {
      game.save();
      lastSave = now;
    }
  }, 250);
  addEventListener("pagehide", () => game.save());
}
