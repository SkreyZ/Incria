import { createPlayer, generateMap } from "@game/core";
import { createMapView } from "./render/mapView.js";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#map");
if (canvas) {
  // ponytail: carte et joueur locaux en attendant le serveur / la boucle de jeu (#12)
  const map = generateMap({ seed: "proto", players: 30 });
  const player = createPlayer(map, 0, 0);
  const view = createMapView(canvas, map);
  view.setPlayer(player);
  view.centerOn(player.spawn);
}
