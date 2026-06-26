import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SectionId, Phase } from "../types";
import {
  HOME_POS, IS_MOBILE, ZOOM_TARGETS,
  LEFT_BOUNDARY_POINT, RIGHT_BOUNDARY_POINT,
  SAFE_NDC_X, CAMERA_X_SEARCH_MIN, CAMERA_X_SEARCH_MAX, CAMERA_X_SEARCH_STEPS,
} from "./config";

function findCameraXForProjectedX(
  sourceCamera: THREE.PerspectiveCamera,
  aspect: number,
  point: THREE.Vector3,
  targetNdcX: number,
) {
  const testCamera = sourceCamera.clone() as THREE.PerspectiveCamera;
  const projected = new THREE.Vector3();

  testCamera.position.set(HOME_POS.x, HOME_POS.y, HOME_POS.z);
  testCamera.aspect = aspect;
  testCamera.updateProjectionMatrix();

  const evaluate = (cameraX: number) => {
    testCamera.position.x = cameraX;
    testCamera.updateMatrixWorld(true);
    projected.copy(point).project(testCamera);
    return projected.x - targetNdcX;
  };

  let low = CAMERA_X_SEARCH_MIN;
  let high = CAMERA_X_SEARCH_MAX;
  let lowValue = evaluate(low);
  let highValue = evaluate(high);

  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) {
    throw new Error("Could not project a scene boundary point.");
  }

  if (Math.abs(lowValue) < 1e-7) return low;
  if (Math.abs(highValue) < 1e-7) return high;

  if (lowValue * highValue > 0) {
    return HOME_POS.x;
  }

  for (let i = 0; i < CAMERA_X_SEARCH_STEPS; i++) {
    const mid = (low + high) / 2;
    const midValue = evaluate(mid);

    if (Math.abs(midValue) < 1e-7) return mid;

    if (lowValue * midValue <= 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }

  return (low + high) / 2;
}

function KuruCamera({ target, phase, onDone }: {
  target: SectionId | null;
  phase: Phase;
  onDone: () => void;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);

  const doneRef = useRef(false);
  const mouseX = useRef(0);
  const panX = useRef(HOME_POS.x);
  const touchRef = useRef({ startX: 0, lastX: 0, active: false });
  const velocityX = useRef(0);
  const boundsRef = useRef({ lo: HOME_POS.x, hi: HOME_POS.x });

  useEffect(() => {
    doneRef.current = false;
  }, [target, phase]);

  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;

    const aspect = size.width / size.height;

    const lo = findCameraXForProjectedX(
      camera,
      aspect,
      RIGHT_BOUNDARY_POINT,
      SAFE_NDC_X,
    );

    const hi = findCameraXForProjectedX(
      camera,
      aspect,
      LEFT_BOUNDARY_POINT,
      -SAFE_NDC_X,
    );

    if (lo <= hi) {
      boundsRef.current = { lo, hi };
    } else {
      const center = (lo + hi) / 2;
      boundsRef.current = { lo: center, hi: center };
    }

    panX.current = THREE.MathUtils.clamp(
      panX.current,
      boundsRef.current.lo,
      boundsRef.current.hi,
    );

  }, [camera, size.width, size.height]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      mouseX.current = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      touchRef.current = {
        startX: t.clientX,
        lastX: t.clientX,
        active: true,
      };
      velocityX.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchRef.current.active) return;
      const t = e.touches[0];
      if (!t) return;

      const dx = t.clientX - touchRef.current.lastX;
      const sensitivity = 2.0 / Math.max(size.width, 1);

      velocityX.current = dx * sensitivity;
      panX.current += dx * sensitivity;
      panX.current = THREE.MathUtils.clamp(
        panX.current,
        boundsRef.current.lo,
        boundsRef.current.hi,
      );
      touchRef.current.lastX = t.clientX;
    };

    const onTouchEnd = () => {
      touchRef.current.active = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [gl, size.width]);

  useFrame((_, delta) => {
    if (phase === "idle") {
      if (!IS_MOBILE) {
        const mx = mouseX.current;
        const edge = 0.15;
        const speed = 1.2;

        if (mx < -1 + edge) {
          const strength = ((-1 + edge) - mx) / edge;
          panX.current += speed * strength * delta;
        } else if (mx > 1 - edge) {
          const strength = (mx - (1 - edge)) / edge;
          panX.current -= speed * strength * delta;
        }
      }

      if (!touchRef.current.active && Math.abs(velocityX.current) > 0.0001) {
        panX.current += velocityX.current;
        velocityX.current *= 0.92;
      }

      panX.current = THREE.MathUtils.clamp(
        panX.current,
        boundsRef.current.lo,
        boundsRef.current.hi,
      );

      camera.position.x += (panX.current - camera.position.x) * 0.08;
      camera.position.y += (HOME_POS.y - camera.position.y) * 0.04;
      camera.position.z += (HOME_POS.z - camera.position.z) * 0.04;
      return;
    }

    if (phase === "zooming" && target) {
      const dest = ZOOM_TARGETS[target];
      camera.position.lerp(dest, 0.06);

      if (!doneRef.current && camera.position.distanceTo(dest) < 0.05) {
        doneRef.current = true;
        onDone();
      }
    }
  });

  return null;
}

export default KuruCamera;
