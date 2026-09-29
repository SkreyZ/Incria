import { baseZoneLabel } from "./label.js";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.textContent = baseZoneLabel();
}
