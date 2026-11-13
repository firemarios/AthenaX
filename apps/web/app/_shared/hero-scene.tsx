"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const NAVY = "#050a1e";
const BLUE = "#0052ff";
const CYAN = "#22d3ee";

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Building {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  hue: number;
}

function useBuildings(): Building[] {
  return useMemo(() => {
    const random = mulberry32(20261112);
    const items: Building[] = [];
    for (let gx = -6; gx <= 6; gx += 1) {
      for (let gz = -6; gz <= 6; gz += 1) {
        if (random() < 0.38) continue;
        const x = gx * 1.55 + (random() - 0.5) * 0.45;
        const z = gz * 1.55 + (random() - 0.5) * 0.45;
        const distance = Math.hypot(x, z);
        if (distance < 1.7 || distance > 9.5) continue;
        const falloff = 1 - distance / 13;
        items.push({
          x,
          z,
          width: 0.42 + random() * 0.5,
          depth: 0.42 + random() * 0.5,
          height: 0.35 + random() * random() * 4.4 * falloff + 0.2,
          hue: 0.58 + random() * 0.08,
        });
      }
    }
    return items;
  }, []);
}

function City({ reduced }: { reduced: RefObject<boolean> }) {
  const group = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const buildings = useBuildings();

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    buildings.forEach((building, index) => {
      dummy.position.set(building.x, building.height / 2, building.z);
      dummy.scale.set(building.width, building.height, building.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.setHSL(building.hue, 0.72, 0.16 + (index % 7) * 0.012);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [buildings]);

  useFrame((_, delta) => {
    if (group.current && !reduced.current) {
      group.current.rotation.y += delta * 0.055;
    }
  });

  return (
    <group ref={group}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, buildings.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          roughness={0.38}
          metalness={0.55}
          emissive={BLUE}
          emissiveIntensity={0.16}
        />
      </instancedMesh>
      <gridHelper args={[46, 46, "#1b4fd1", "#0a1f4d"]} position={[0, -0.01, 0]} />
    </group>
  );
}

function Particles() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const random = mulberry32(7);
    const array = new Float32Array(520 * 3);
    for (let index = 0; index < 520; index += 1) {
      const radius = 4 + random() * 10;
      const angle = random() * Math.PI * 2;
      array[index * 3] = Math.cos(angle) * radius;
      array[index * 3 + 1] = 0.6 + random() * 7;
      array[index * 3 + 2] = Math.sin(angle) * radius;
    }
    return array;
  }, []);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color={CYAN}
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function Arcs() {
  const lines = useMemo(() => {
    const random = mulberry32(99);
    return Array.from({ length: 6 }, (_, index) => {
      const start = new THREE.Vector3(
        (random() - 0.5) * 10,
        0.5 + random() * 1.6,
        (random() - 0.5) * 10,
      );
      const end = new THREE.Vector3(
        (random() - 0.5) * 10,
        0.5 + random() * 1.6,
        (random() - 0.5) * 10,
      );
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.y += 2.4 + random() * 3.2;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      const material = new THREE.LineBasicMaterial({
        color: index % 2 === 0 ? CYAN : BLUE,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
      });
      return new THREE.Line(geometry, material);
    });
  }, []);

  return (
    <>
      {lines.map((line, index) => (
        <primitive key={index} object={line} />
      ))}
    </>
  );
}

function Rig({ reduced }: { reduced: RefObject<boolean> }) {
  useFrame(({ camera, pointer }) => {
    if (reduced.current) {
      camera.lookAt(0, 1.2, 0);
      return;
    }
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, 11 + pointer.x * 1.9, 0.045);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 8.5 + pointer.y * 1.3, 0.045);
    camera.lookAt(0, 1.2, 0);
  });
  return null;
}

function SceneFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="pl-float flex h-40 w-40 items-center justify-center rounded-full border border-white/20 bg-white/90 shadow-[0_30px_80px_-20px_rgba(0,82,255,0.7)]">
        <Image
          src="/brand/athenax-mark.png"
          alt=""
          width={640}
          height={640}
          className="h-28 w-28"
        />
      </div>
    </div>
  );
}

export function HeroScene() {
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  return (
    <Canvas
      camera={{ position: [11, 8.5, 15], fov: 42 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      fallback={<SceneFallback />}
      className="touch-pan-y"
      style={{ position: "absolute", inset: 0 }}
      aria-hidden="true"
    >
      <fog attach="fog" args={[NAVY, 15, 38]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[8, 12, 6]} intensity={1.4} color="#9dc4ff" />
      <pointLight position={[0, 4, 0]} intensity={22} distance={20} color={BLUE} />
      <City reduced={reduced} />
      <Particles />
      <Arcs />
      <mesh position={[0, 2.4, 0]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshBasicMaterial color={CYAN} />
      </mesh>
      <pointLight position={[0, 2.4, 0]} intensity={8} distance={12} color={CYAN} />
      <Rig reduced={reduced} />
    </Canvas>
  );
}
