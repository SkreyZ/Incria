/** Panneau ressources + améliorations. Affichage seulement : les calculs viennent de `@game/core`. */
import { multipliers, productionRates, tileCost, UPGRADE_IDS, UPGRADES, upgradeCost } from "@game/core";
import type { Game } from "../game/game.js";

const fmt = (x: number): string => x.toLocaleString("fr-FR", { maximumFractionDigits: x < 100 ? 1 : 0 });

export function mountPanel(root: HTMLElement, game: Game): () => void {
  root.innerHTML = `
    <section class="panel">
      <h2>Ressources</h2>
      <dl class="res"></dl>
      <p class="growth"></p>
      <button type="button" class="idle">Croissance libre (idle)</button>
      <h2>Améliorations</h2>
      <div class="upgrades"></div>
      <p class="msg" role="status"></p>
    </section>`;
  const q = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
  const res = q<HTMLElement>(".res");
  const growth = q<HTMLElement>(".growth");
  const msg = q<HTMLElement>(".msg");
  const upgrades = q<HTMLElement>(".upgrades");

  const buttons = UPGRADE_IDS.map((id) => {
    const b = document.createElement("button");
    b.type = "button";
    b.title = UPGRADES[id].description;
    b.addEventListener("click", () => {
      const r = game.buy(id);
      msg.textContent = r.ok ? "" : r.error;
      render();
    });
    upgrades.append(b);
    return { id, b };
  });
  q<HTMLButtonElement>(".idle").addEventListener("click", () => {
    game.setGrowthTarget(null);
    render();
  });

  function render(): void {
    const s = game.state;
    const rates = productionRates(s.owned.values(), s.time, multipliers(s.upgrades));
    res.innerHTML = (["nutrients", "water", "biomass"] as const)
      .map(
        (k) =>
          `<dt>${{ nutrients: "Nutriments", water: "Eau", biomass: "Biomasse" }[k]}</dt>` +
          `<dd>${fmt(s.resources[k])} <small>+${fmt(rates[k])}/s</small></dd>`,
      )
      .join("");
    const pousse = s.growing
      ? `pousse en cours, ${Math.ceil(Math.max(0, s.growing.finishAt - s.time) / 60)} min`
      : `prochaine tuile : ${fmt(tileCost(s.owned.size))} biomasse`;
    growth.textContent = `${s.owned.size} tuiles · ${pousse} · ${s.target ? `cible ${s.target}` : "idle"}`;
    for (const { id, b } of buttons) {
      const cost = upgradeCost(id, s.upgrades[id]);
      b.textContent = `${UPGRADES[id].name} (niv. ${s.upgrades[id]}) — ${fmt(cost)} nutriments`;
      b.disabled = s.resources.nutrients < cost;
    }
  }
  render();
  return render;
}
