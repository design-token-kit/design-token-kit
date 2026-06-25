import { loadProject, Release } from "./project.mjs";

new Release(loadProject()).publish();
