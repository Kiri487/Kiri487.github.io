import * as THREE from "three";
import type { SectionId } from "../types";

export const HOME_POS = new THREE.Vector3(-1.15, -1.1, -2.35);
export const IS_MOBILE = window.matchMedia("(pointer: coarse)").matches;

export const ZOOM_TARGETS: Record<SectionId, THREE.Vector3> = {
  about: new THREE.Vector3(-2.55, -0.6, -0.90),
  projects: new THREE.Vector3(1.05, -0.64, 0.00),
  works: new THREE.Vector3(-0.90, -1.75, -0.50),
  credits: new THREE.Vector3(-1.45, -0.95, -0.65),
};

export interface VideoConfig {
  src: string;
  aspect: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  shadowOffset: [number, number, number];
  shadowSize: [number, number];
  gamma: number;
  brightness: number;
  tint: [number, number, number];
}

export const WALL_VIDEOS: VideoConfig[] = [
  {
    src: "/kuru/video/KuruWallAFK_stacked.webm",
    aspect: 934 / 1440,
    position: [-1.89, -1.23, -0.13],
    rotation: [0, -3.13, 0],
    scale: 1.37,
    shadowOffset: [0.05, -0.53, -0.09],
    shadowSize: [0.49, 0.26],
    gamma: 2.0,
    brightness: 0.08,
    tint: [1.0, 0.92, 0.88],
  },
  {
    src: "/kuru/video/KuruSitAFK_stacked.webm",
    aspect: 1334 / 1440,
    position: [1.19, -1.54, -0.15],
    rotation: [0, -3.13, 0],
    scale: 0.85,
    shadowOffset: [0.15, -0.35, 0.13],
    shadowSize: [0.41, 0.28],
    gamma: 2.0,
    brightness: 0.08,
    tint: [1.0, 0.92, 0.88],
  },
];

export const LEFT_BOUNDARY_POINT = new THREE.Vector3(3.68, HOME_POS.y, 1.0);
export const RIGHT_BOUNDARY_POINT = new THREE.Vector3(-3.4, HOME_POS.y, -0.02);

export const SAFE_NDC_X = 0.98;
export const CAMERA_X_SEARCH_MIN = -20;
export const CAMERA_X_SEARCH_MAX = 20;
export const CAMERA_X_SEARCH_STEPS = 60;
