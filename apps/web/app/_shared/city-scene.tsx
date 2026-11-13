"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import * as THREE from "three";

type SceneTheme = "light" | "dark";

interface Palette {
  bg: string;
  fog: string;
  land: string;
  landEdge: string;
  water: string;
  hill: string;
  building: string;
  marble: string;
  data: string;
  accent: string;
  amber: string;
  ambient: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sun: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  moon: string;
  gridMajor: string;
  gridMinor: string;
}

const PALETTES: Record<SceneTheme, Palette> = {
  dark: {
    bg: "#0a0a0a",
    fog: "#0a0a0a",
    land: "#111111",
    landEdge: "#2a2a2a",
    water: "#050505",
    hill: "#161616",
    building: "#1b1b1b",
    marble: "#e9e2d4",
    data: "#22d3ee",
    accent: "#0052ff",
    amber: "#f5b942",
    ambient: 0.3,
    hemiSky: "#2c2c2c",
    hemiGround: "#0a0a0a",
    hemiIntensity: 0.9,
    sun: "#cfe0ff",
    sunIntensity: 1.05,
    sunPosition: [-14, 18, 9],
    moon: "#dfe8ff",
    gridMajor: "#2b4ea8",
    gridMinor: "#1a1a1a",
  },
  light: {
    bg: "#efe9dd",
    fog: "#efe9dd",
    land: "#e7e0d2",
    landEdge: "#d5cab7",
    water: "#8fc3dd",
    hill: "#d8cfbf",
    building: "#c9bfad",
    marble: "#fffaf0",
    data: "#0a7ea4",
    accent: "#0052ff",
    amber: "#b45309",
    ambient: 0.82,
    hemiSky: "#ffffff",
    hemiGround: "#d9cfbf",
    hemiIntensity: 0.95,
    sun: "#fff2d2",
    sunIntensity: 1.75,
    sunPosition: [16, 20, 12],
    moon: "#fff6dc",
    gridMajor: "#9db4d8",
    gridMinor: "#cfc4b2",
  },
};

const UP = new THREE.Vector3(0, 1, 0);

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(min: number, max: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

interface Building {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  tone: number;
}

function useBuildings(): Building[] {
  return useMemo(() => {
    const random = mulberry32(20261113);
    const items: Building[] = [];
    for (let gx = -18; gx <= 18; gx += 1) {
      for (let gz = -18; gz <= 18; gz += 1) {
        if (random() < 0.3) continue;
        const x = gx * 1.12 + (random() - 0.5) * 0.5;
        const z = gz * 1.12 + (random() - 0.5) * 0.5;
        const distance = Math.hypot(x, z);
        if (distance > 19.6) continue;
        if (Math.hypot(x - 3.4, z + 3.4) < 3.1) continue;
        const central = Math.max(0, 1 - distance / 16);
        const height =
          0.22 + random() * random() * (0.8 + central * 5.6);
        items.push({
          x,
          z,
          width: 0.38 + random() * 0.58,
          depth: 0.38 + random() * 0.58,
          height,
          tone: random(),
        });
      }
    }
    return items;
  }, []);
}

interface DataNode {
  x: number;
  y: number;
  z: number;
}

const CAMERA_KEYS: {
  position: THREE.Vector3;
  target: THREE.Vector3;
}[] = [
  {
    position: new THREE.Vector3(17.5, 12, 21.5),
    target: new THREE.Vector3(0, 1.4, 0),
  },
  {
    position: new THREE.Vector3(12.5, 7.4, 15.5),
    target: new THREE.Vector3(0, 1.6, 0),
  },
  {
    position: new THREE.Vector3(7.2, 4.6, 8.4),
    target: new THREE.Vector3(0.6, 2.1, 1.2),
  },
  {
    position: new THREE.Vector3(9.4, 4.8, 1.6),
    target: new THREE.Vector3(3.4, 2.2, -3.4),
  },
  {
    position: new THREE.Vector3(1.2, 4.6, 10.2),
    target: new THREE.Vector3(-4.2, 2.1, 2.2),
  },
  {
    position: new THREE.Vector3(10.6, 5, -0.8),
    target: new THREE.Vector3(2.4, 2.3, -5.2),
  },
  {
    position: new THREE.Vector3(16.5, 10.5, 18),
    target: new THREE.Vector3(0, 1.5, 0),
  },
  {
    position: new THREE.Vector3(20, 14, 9),
    target: new THREE.Vector3(0, 1.4, 0),
  },
  {
    position: new THREE.Vector3(12.5, 6.5, 13),
    target: new THREE.Vector3(0, 1.7, 0),
  },
  {
    position: new THREE.Vector3(17.5, 12, 21.5),
    target: new THREE.Vector3(0, 1.4, 0),
  },
];

// A single Catmull-Rom path keeps camera velocity continuous through every
// chapter and continues through the modules, metrics, pricing and finale.
const CAMERA_PATH = new THREE.CatmullRomCurve3(
  CAMERA_KEYS.map((key) => key.position),
  false,
  "centripetal",
);
const TARGET_PATH = new THREE.CatmullRomCurve3(
  CAMERA_KEYS.map((key) => key.target),
  false,
  "centripetal",
);

function pathAt(
  progress: number,
  position: THREE.Vector3,
  target: THREE.Vector3,
) {
  const t = Math.min(0.999999, Math.max(0, progress));
  CAMERA_PATH.getPoint(t, position);
  TARGET_PATH.getPoint(t, target);
}

function Rig({
  progressRef,
  orbitRef,
}: {
  progressRef: RefObject<number>;
  orbitRef: RefObject<number>;
}) {
  const position = useRef(new THREE.Vector3(17.5, 12, 21.5));
  const target = useRef(new THREE.Vector3(0, 1.4, 0));
  const desiredPosition = useRef(new THREE.Vector3());
  const desiredTarget = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());
  const pointerTarget = useRef({ x: 0, y: 0 });
  const pointer = useRef({ x: 0, y: 0 });
  const orbit = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerTarget.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointerTarget.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    const onLeave = () => {
      pointerTarget.current.x = 0;
      pointerTarget.current.y = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  useFrame(({ camera, clock }, delta) => {
    // Clamp long frames (tab restore, GC) so the camera never jumps.
    const dt = Math.min(delta, 0.05);
    const time = clock.elapsedTime;
    const progress = progressRef.current;

    pathAt(progress, desiredPosition.current, desiredTarget.current);
    const nextPosition = desiredPosition.current;
    const nextTarget = desiredTarget.current;

    orbit.current = THREE.MathUtils.damp(
      orbit.current,
      orbitRef.current,
      3.2,
      dt,
    );

    const pointerLerp = 1 - Math.exp(-dt * 7);
    pointer.current.x +=
      (pointerTarget.current.x - pointer.current.x) * pointerLerp;
    pointer.current.y +=
      (pointerTarget.current.y - pointer.current.y) * pointerLerp;

    const aspect = (camera as THREE.PerspectiveCamera).aspect || 1;
    const pull =
      aspect < 0.72 ? 1.32 : aspect < 0.95 ? 1.17 : aspect < 1.3 ? 1.06 : 1;
    const parallax = aspect < 1 ? 0.4 : 1;

    offset.current
      .copy(nextPosition)
      .sub(nextTarget)
      .applyAxisAngle(UP, orbit.current)
      .multiplyScalar(pull);
    nextPosition.copy(nextTarget).add(offset.current);
    nextPosition.x += pointer.current.x * 1.1 * parallax;
    nextPosition.y -= pointer.current.y * 0.5 * parallax;
    nextPosition.y += Math.sin(time * 0.24) * 0.16;
    nextTarget.x += pointer.current.x * 0.3 * parallax;
    nextTarget.y += Math.sin(time * 0.19 + 1.2) * 0.08;

    const damp = 1 - Math.exp(-dt * 1.8);
    if (!started.current) {
      position.current.copy(nextPosition);
      target.current.copy(nextTarget);
      started.current = true;
    }
    position.current.lerp(nextPosition, damp);
    target.current.lerp(nextTarget, damp);
    camera.position.copy(position.current);
    camera.lookAt(target.current);
  });

  return null;
}

function Terrain({ palette }: { palette: Palette }) {
  const gridRef = useRef<THREE.GridHelper>(null);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const material = grid.material as THREE.LineBasicMaterial;
    material.transparent = true;
    material.opacity = 0.16;
    material.depthWrite = false;
  }, [palette]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.62, 0]}>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial
          color={palette.water}
          roughness={0.32}
          metalness={0.4}
        />
      </mesh>
      <mesh position={[0, -0.26, 0]}>
        <cylinderGeometry args={[26, 27, 0.5, 84]} />
        <meshStandardMaterial
          color={palette.land}
          roughness={0.92}
          metalness={0.04}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]}>
        <ringGeometry args={[25.5, 26.2, 84]} />
        <meshBasicMaterial
          color={palette.landEdge}
          transparent
          opacity={0.55}
        />
      </mesh>
      <gridHelper
        ref={gridRef}
        args={[46, 46, palette.gridMajor, palette.gridMinor]}
        position={[0, 0.012, 0]}
      />
    </group>
  );
}

const HILLS: { position: [number, number, number]; scale: [number, number, number] }[] = [
  { position: [-13, -0.4, -12], scale: [8, 2.8, 6.5] },
  { position: [13.5, -0.4, -12.5], scale: [8.5, 3.2, 7] },
  { position: [0, -0.4, -16.5], scale: [11, 4.2, 7.5] },
  { position: [-17, -0.4, 5], scale: [6.5, 2.2, 5.5] },
  { position: [16, -0.4, 7], scale: [7.5, 2.5, 6] },
  { position: [-6, -0.4, 17], scale: [9, 2, 5.5] },
];

function Hills({ palette }: { palette: Palette }) {
  return (
    <>
      {HILLS.map((hill, index) => (
        <mesh
          key={index}
          position={hill.position}
          scale={hill.scale}
          rotation-y={index * 0.7}
        >
          <sphereGeometry args={[1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={palette.hill}
            roughness={0.95}
            metalness={0.02}
          />
        </mesh>
      ))}
    </>
  );
}

function Acropolis({ palette }: { palette: Palette }) {
  const columns = useMemo(() => {
    const list: [number, number][] = [];
    for (let index = 0; index < 8; index += 1) {
      const x = -1.05 + (index / 7) * 2.1;
      list.push([x, -0.62], [x, 0.62]);
    }
    for (let index = 1; index < 3; index += 1) {
      const z = -0.62 + (index / 3) * 1.24;
      list.push([-1.05, z], [1.05, z]);
    }
    return list;
  }, []);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    columns.forEach(([x, z], index) => {
      dummy.position.set(x, 1.06, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [columns]);

  return (
    <group position={[3.4, 0, -3.4]} rotation-y={-0.38}>
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[2.7, 3.1, 0.64, 9]} />
        <meshStandardMaterial
          color={palette.marble}
          roughness={0.88}
          metalness={0.04}
          emissive={palette.marble}
          emissiveIntensity={0.04}
        />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[2.6, 0.16, 1.5]} />
        <meshStandardMaterial color={palette.marble} roughness={0.85} />
      </mesh>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, columns.length]}
      >
        <cylinderGeometry args={[0.048, 0.055, 0.56, 6]} />
        <meshStandardMaterial color={palette.marble} roughness={0.8} />
      </instancedMesh>
      <mesh position={[0, 1.44, 0]}>
        <boxGeometry args={[2.7, 0.2, 1.6]} />
        <meshStandardMaterial color={palette.marble} roughness={0.82} />
      </mesh>
      <mesh position={[0, 1.62, 0]} rotation-y={Math.PI / 4}>
        <coneGeometry args={[1.72, 0.44, 4]} />
        <meshStandardMaterial color={palette.marble} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Buildings({
  buildings,
  palette,
}: {
  buildings: Building[];
  palette: Palette;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const base = new THREE.Color(palette.building);
    buildings.forEach((building, index) => {
      dummy.position.set(building.x, building.height / 2, building.z);
      dummy.scale.set(building.width, building.height, building.depth);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.copy(base).offsetHSL(
        (building.tone - 0.5) * 0.03,
        0,
        (building.tone - 0.5) * 0.07,
      );
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [buildings, palette.building]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, buildings.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        roughness={0.52}
        metalness={0.28}
        emissive={palette.accent}
        emissiveIntensity={0.07}
      />
    </instancedMesh>
  );
}

function DataLayer({
  nodes,
  palette,
  material,
}: {
  nodes: DataNode[];
  palette: Palette;
  material: THREE.MeshBasicMaterial;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    nodes.forEach((node, index) => {
      dummy.position.set(node.x, node.y, node.z);
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [nodes]);

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, nodes.length]}
        material={material}
      >
        <octahedronGeometry args={[0.095, 0]} />
      </instancedMesh>
      <pointLight
        position={[0, 3.2, 0]}
        intensity={palette === PALETTES.dark ? 26 : 8}
        distance={16}
        color={palette.data}
      />
    </>
  );
}

function Arcs({
  nodes,
  palette,
  materialsRef,
}: {
  nodes: DataNode[];
  palette: Palette;
  materialsRef: RefObject<THREE.LineBasicMaterial[]>;
}) {
  const arcs = useMemo(() => {
    const random = mulberry32(4242);
    const result: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[] =
      [];
    for (let index = 0; index < 9; index += 1) {
      const from = nodes[index % nodes.length];
      const to = nodes[(index * 5 + 4) % nodes.length];
      if (!from || !to) continue;
      const start = new THREE.Vector3(from.x, from.y, from.z);
      const end = new THREE.Vector3(to.x, to.y, to.z);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.y += 2.6 + random() * 3;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const geometry = new THREE.BufferGeometry().setFromPoints(
        curve.getPoints(40),
      );
      const material = new THREE.LineBasicMaterial({
        color: index % 3 === 0 ? palette.amber : palette.data,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      result.push(new THREE.Line(geometry, material));
    }
    return result;
  }, [nodes, palette]);

  useEffect(() => {
    materialsRef.current = arcs.map((line) => line.material);
    return () => {
      materialsRef.current = [];
      arcs.forEach((line) => {
        line.geometry.dispose();
        line.material.dispose();
      });
    };
  }, [arcs, materialsRef]);

  return (
    <>
      {arcs.map((line, index) => (
        <primitive key={index} object={line} />
      ))}
    </>
  );
}

const DISTRICTS: { center: [number, number]; radius: number }[] = [
  { center: [-4.2, 2.2], radius: 2.6 },
  { center: [5.2, -1.4], radius: 3.1 },
  { center: [-1.4, -6.2], radius: 2.1 },
];

function DistrictRings({
  palette,
  materialsRef,
}: {
  palette: Palette;
  materialsRef: RefObject<THREE.MeshBasicMaterial[]>;
}) {
  const rings = useMemo(
    () =>
      DISTRICTS.map((district) => {
        const geometry = new THREE.RingGeometry(
          district.radius,
          district.radius + 0.055,
          72,
        );
        const material = new THREE.MeshBasicMaterial({
          color: palette.accent,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });
        return { ...district, geometry, material };
      }),
    [palette],
  );

  useEffect(() => {
    materialsRef.current = rings.map((ring) => ring.material);
    return () => {
      materialsRef.current = [];
      rings.forEach((ring) => {
        ring.geometry.dispose();
        ring.material.dispose();
      });
    };
  }, [rings, materialsRef]);

  return (
    <>
      {rings.map((ring, index) => (
        <mesh
          key={index}
          geometry={ring.geometry}
          material={ring.material}
          rotation-x={-Math.PI / 2}
          position={[ring.center[0], 0.03, ring.center[1]]}
        />
      ))}
    </>
  );
}

const SCENARIO_BOXES: { x: number; z: number; width: number; depth: number; height: number }[] = [
  { x: -5.4, z: 2.7, width: 0.62, depth: 0.62, height: 2.2 },
  { x: -4.3, z: 2.2, width: 0.58, depth: 0.58, height: 3.1 },
  { x: -3.2, z: 2.9, width: 0.6, depth: 0.6, height: 1.8 },
  { x: -4.8, z: 1.2, width: 0.54, depth: 0.54, height: 2.7 },
  { x: -3.6, z: 1.1, width: 0.66, depth: 0.66, height: 2.1 },
  { x: -5.2, z: 3.8, width: 0.5, depth: 0.5, height: 1.5 },
  { x: -2.9, z: 1.8, width: 0.52, depth: 0.52, height: 3.4 },
  { x: -4.1, z: 3.3, width: 0.56, depth: 0.56, height: 2.5 },
];

function ScenarioLayer({
  palette,
  material,
}: {
  palette: Palette;
  material: THREE.MeshStandardMaterial;
}) {
  return (
    <>
      {SCENARIO_BOXES.map((box, index) => (
        <mesh
          key={index}
          position={[box.x, box.height / 2 + 0.36, box.z]}
          material={material}
        >
          <boxGeometry args={[box.width, box.height, box.depth]} />
        </mesh>
      ))}
      <pointLight
        position={[-4.2, 3.4, 2.4]}
        intensity={palette === PALETTES.dark ? 18 : 5}
        distance={10}
        color={palette.data}
      />
    </>
  );
}

const IMPACT_MARKERS: [number, number][] = [
  [-4.2, 2.2],
  [2.4, -5.2],
  [6.4, 2.2],
  [-7.4, -1.8],
  [1.2, 6.4],
];

function ImpactLayer({
  palette,
  ringMaterial,
  stickMaterial,
}: {
  palette: Palette;
  ringMaterial: THREE.MeshBasicMaterial;
  stickMaterial: THREE.MeshBasicMaterial;
}) {
  return (
    <>
      {IMPACT_MARKERS.map(([x, z], index) => (
        <group key={index} position={[x, 0, z]}>
          <mesh
            rotation-x={-Math.PI / 2}
            position={[0, 0.04, 0]}
            material={ringMaterial}
          >
            <ringGeometry args={[0.62 + index * 0.04, 0.7 + index * 0.04, 48]} />
          </mesh>
          <mesh position={[0, 1.25, 0]} material={stickMaterial}>
            <cylinderGeometry args={[0.016, 0.016, 2.5, 6]} />
          </mesh>
          <mesh position={[0, 2.55, 0]} material={ringMaterial}>
            <octahedronGeometry args={[0.09, 0]} />
          </mesh>
        </group>
      ))}
      <pointLight
        position={[0, 4.2, 0]}
        intensity={palette === PALETTES.dark ? 22 : 6}
        distance={18}
        color={palette.amber}
      />
    </>
  );
}

const CHAPTER_MARKERS: { id: string; x: number; z: number; tone: "data" | "amber" }[] = [
  { id: "01", x: 0.6, z: 1.2, tone: "data" },
  { id: "02", x: 3.4, z: -3.4, tone: "data" },
  { id: "03", x: -4.2, z: 2.2, tone: "amber" },
  { id: "04", x: 2.4, z: -5.2, tone: "data" },
];

const CHAPTER_CENTERS = [0.42, 0.585, 0.75, 0.92];

function chapterWeight(progress: number, index: number) {
  const distance = Math.abs(progress - CHAPTER_CENTERS[index]);
  return 1 - smoothstep(0.02, 0.13, distance);
}

function labelTexture(id: string, color: string) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, size, size);
  context.font = "600 52px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  context.fillText(id, size / 2, size / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function ChapterMarkers({
  palette,
  progressRef,
}: {
  palette: Palette;
  progressRef: RefObject<number>;
}) {
  const markerRefs = useRef<(THREE.Group | null)[]>([]);

  const markers = useMemo(
    () =>
      CHAPTER_MARKERS.map((marker) => {
        const color = marker.tone === "amber" ? palette.amber : palette.data;
        const texture = labelTexture(marker.id, color);
        const beam = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });
        const ring = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });
        const sprite = new THREE.SpriteMaterial({
          map: texture ?? undefined,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
          toneMapped: false,
        });
        return { ...marker, beam, ring, sprite };
      }),
    [palette],
  );

  useEffect(
    () => () => {
      markers.forEach((marker) => {
        marker.beam.dispose();
        marker.ring.dispose();
        marker.sprite.map?.dispose();
        marker.sprite.dispose();
      });
    },
    [markers],
  );

  useFrame(({ clock }) => {
    const progress = progressRef.current;
    const base = smoothstep(0.26, 0.36, progress);
    const time = clock.elapsedTime;

    markers.forEach((marker, index) => {
      const weight = chapterWeight(progress, index);
      const pulse = 0.78 + 0.22 * Math.sin(time * 2.2 + index * 1.4);
      const visible = base > 0.01;
      marker.beam.opacity = base * (0.1 + 0.55 * weight) * pulse;
      marker.ring.opacity = base * (0.16 + 0.7 * weight) * pulse;
      marker.sprite.opacity = base * (0.38 + 0.62 * weight);
      marker.beam.visible = visible;
      marker.ring.visible = visible;
      marker.sprite.visible = visible;
      const group = markerRefs.current[index];
      if (group) {
        group.scale.setScalar(0.88 + weight * 0.3);
        group.rotation.y += 0.0025 + weight * 0.004;
      }
    });
  });

  return (
    <>
      {markers.map((marker, index) => (
        <group
          key={marker.id}
          ref={(node) => {
            markerRefs.current[index] = node;
          }}
          position={[marker.x, 0.02, marker.z]}
          renderOrder={3}
        >
          <mesh
            rotation-x={-Math.PI / 2}
            position={[0, 0.02, 0]}
            material={marker.ring}
          >
            <ringGeometry args={[0.42, 0.5, 44]} />
          </mesh>
          <mesh position={[0, 1.7, 0]} material={marker.beam}>
            <cylinderGeometry args={[0.012, 0.02, 3.3, 6]} />
          </mesh>
          <mesh position={[0, 3.35, 0]} material={marker.ring}>
            <octahedronGeometry args={[0.1, 0]} />
          </mesh>
          <sprite position={[0, 3.82, 0]} material={marker.sprite} scale={[0.8, 0.8, 1]} />
        </group>
      ))}
    </>
  );
}

function Particles({ palette, count }: { palette: Palette; count: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const random = mulberry32(7);
    const array = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = 5 + random() * 17;
      const angle = random() * Math.PI * 2;
      array[index * 3] = Math.cos(angle) * radius;
      array[index * 3 + 1] = 0.8 + random() * 9;
      array[index * 3 + 2] = Math.sin(angle) * radius;
    }
    return array;
  }, [count]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.016;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        color={palette.data}
        transparent
        opacity={0.45}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function Moon({ palette }: { palette: Palette }) {
  return (
    <group position={[-18, 16, -26]}>
      <mesh>
        <sphereGeometry args={[1.15, 24, 24]} />
        <meshBasicMaterial color={palette.moon} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.6, 24, 24]} />
        <meshBasicMaterial
          color={palette.moon}
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function World({
  progressRef,
  cameraProgressRef,
  orbitRef,
  palette,
  compact,
}: {
  progressRef: RefObject<number>;
  cameraProgressRef: RefObject<number>;
  orbitRef: RefObject<number>;
  palette: Palette;
  compact: boolean;
}) {
  const buildings = useBuildings();
  const nodes = useMemo(() => {
    const list: DataNode[] = [];
    for (let index = 5; index < buildings.length; index += 17) {
      const building = buildings[index];
      list.push({
        x: building.x,
        y: building.height + 0.3,
        z: building.z,
      });
    }
    return list.slice(0, 26);
  }, [buildings]);

  const materials = useMemo(
    () => ({
      data: new THREE.MeshBasicMaterial({
        color: palette.data,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      scenario: new THREE.MeshStandardMaterial({
        color: palette.data,
        emissive: palette.data,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        roughness: 0.4,
        metalness: 0.1,
      }),
      impactRing: new THREE.MeshBasicMaterial({
        color: palette.amber,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      impactStick: new THREE.MeshBasicMaterial({
        color: palette.data,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    }),
    [palette],
  );

  const materialsRef = useRef(materials);

  useLayoutEffect(() => {
    materialsRef.current = materials;
    return () => {
      materials.data.dispose();
      materials.scenario.dispose();
      materials.impactRing.dispose();
      materials.impactStick.dispose();
    };
  }, [materials]);

  const arcMaterials = useRef<THREE.LineBasicMaterial[]>([]);
  const ringMaterials = useRef<THREE.MeshBasicMaterial[]>([]);

  useFrame((state) => {
    const current = materialsRef.current;
    if (!current) return;
    const time = state.clock.elapsedTime;
    const progress = progressRef.current;
    const dataOn = smoothstep(0.1, 0.28, progress);
    const arcOn = smoothstep(0.18, 0.36, progress);
    const ringOn = smoothstep(0.26, 0.42, progress);
    const scenarioOn = smoothstep(0.5, 0.66, progress);
    const impactOn = smoothstep(0.7, 0.86, progress);

    current.data.opacity = dataOn * 0.95;
    current.data.visible = dataOn > 0.01;

    current.scenario.opacity = scenarioOn * 0.34;
    current.scenario.visible = scenarioOn > 0.01;

    current.impactRing.opacity =
      impactOn * (0.5 + 0.28 * Math.sin(time * 2.1));
    current.impactRing.visible = impactOn > 0.01;
    current.impactStick.opacity = impactOn * 0.7;
    current.impactStick.visible = impactOn > 0.01;

    arcMaterials.current.forEach((material, index) => {
      const pulse = 0.5 + 0.5 * Math.sin(time * 1.3 + index * 1.7);
      material.opacity = arcOn * (0.12 + pulse * 0.26);
      material.visible = arcOn > 0.01;
    });

    ringMaterials.current.forEach((material, index) => {
      material.opacity = ringOn * (0.22 + 0.12 * Math.sin(time * 0.9 + index));
      material.visible = ringOn > 0.01;
    });
  });

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.fog, 20, 58]} />

      <ambientLight intensity={palette.ambient} />
      <hemisphereLight
        args={[palette.hemiSky, palette.hemiGround, palette.hemiIntensity]}
      />
      <directionalLight
        position={palette.sunPosition}
        intensity={palette.sunIntensity}
        color={palette.sun}
      />
      <pointLight position={[0, 4, 0]} intensity={18} distance={20} color={palette.accent} />

      <Terrain palette={palette} />
      <Hills palette={palette} />
      <Acropolis palette={palette} />
      <Buildings buildings={buildings} palette={palette} />
      <DataLayer nodes={nodes} palette={palette} material={materials.data} />
      <Arcs nodes={nodes} palette={palette} materialsRef={arcMaterials} />
      <DistrictRings palette={palette} materialsRef={ringMaterials} />
      <ScenarioLayer palette={palette} material={materials.scenario} />
      <ImpactLayer
        palette={palette}
        ringMaterial={materials.impactRing}
        stickMaterial={materials.impactStick}
      />
      <ChapterMarkers palette={palette} progressRef={progressRef} />
      <Particles palette={palette} count={compact ? 140 : 460} />
      <Moon palette={palette} />

      <mesh position={[0, 2.6, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={palette.data} toneMapped={false} />
      </mesh>

      <Rig progressRef={cameraProgressRef} orbitRef={orbitRef} />
    </>
  );
}

function SceneFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="pl-home-poster-mark" aria-hidden="true" />
    </div>
  );
}

export interface CitySceneProps {
  progressRef: RefObject<number>;
  cameraProgressRef?: RefObject<number>;
  orbitRef: RefObject<number>;
  theme: SceneTheme;
  paused: boolean;
  active: boolean;
  compact?: boolean;
}

export function CityScene({
  progressRef,
  cameraProgressRef = progressRef,
  orbitRef,
  theme,
  paused,
  active,
  compact = false,
}: CitySceneProps) {
  const palette = PALETTES[theme];

  return (
    <Canvas
      camera={{
        position: [17.5, 12, 21.5],
        fov: compact ? 48 : 42,
        near: 0.1,
        far: 140,
      }}
      dpr={compact ? [1, 1.25] : [1, 1.7]}
      gl={{
        antialias: !compact,
        alpha: false,
        stencil: false,
        powerPreference: compact ? "default" : "high-performance",
      }}
      frameloop={paused || !active ? "demand" : "always"}
      fallback={<SceneFallback />}
      aria-hidden="true"
      className="touch-pan-y"
      style={{ position: "absolute", inset: 0 }}
    >
      <World
        progressRef={progressRef}
        cameraProgressRef={cameraProgressRef}
        orbitRef={orbitRef}
        palette={palette}
        compact={compact}
      />
    </Canvas>
  );
}

