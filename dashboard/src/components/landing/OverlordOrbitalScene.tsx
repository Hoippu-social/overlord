"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function OverlordOrbitalScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rootStyles = getComputedStyle(document.documentElement);
    const primary = rootStyles.getPropertyValue("--color-primary-1").trim() || "#75f16a";
    const violet = rootStyles.getPropertyValue("--color-primary-2").trim() || "#8f5eff";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    camera.position.set(0, 0.45, 8.8);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const primaryColor = new THREE.Color(primary);
    const violetColor = new THREE.Color(violet);
    const group = new THREE.Group();
    scene.add(group);

    scene.add(new THREE.AmbientLight(0xffffff, 0.58));

    const keyLight = new THREE.PointLight(primaryColor, 4.2, 18);
    keyLight.position.set(3.6, 4.2, 5.2);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(violetColor, 2.5, 16);
    rimLight.position.set(-4, -2.4, 4.8);
    scene.add(rimLight);

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: primaryColor,
      emissive: primaryColor,
      emissiveIntensity: 0.65,
      metalness: 0.45,
      roughness: 0.22,
      transparent: true,
      opacity: 0.92,
    });

    const shellMaterial = new THREE.MeshBasicMaterial({
      color: primaryColor,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 2), coreMaterial);
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.72, 2), shellMaterial);
    group.add(core, shell);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });

    const violetRingMaterial = new THREE.MeshBasicMaterial({
      color: violetColor,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });

    const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.012, 10, 160), ringMaterial);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.01, 10, 180), violetRingMaterial);
    const ringC = new THREE.Mesh(new THREE.TorusGeometry(4.05, 0.008, 8, 200), ringMaterial);
    ringA.rotation.x = Math.PI / 2.25;
    ringB.rotation.x = Math.PI / 2.7;
    ringB.rotation.y = Math.PI / 5;
    ringC.rotation.x = Math.PI / 2.1;
    ringC.rotation.z = Math.PI / 7;
    group.add(ringA, ringB, ringC);

    const shardMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: primaryColor,
      emissiveIntensity: 0.18,
      metalness: 0.3,
      roughness: 0.35,
      transparent: true,
      opacity: 0.78,
    });

    const shards: THREE.Mesh[] = [];
    for (let i = 0; i < 14; i += 1) {
      const angle = (i / 14) * Math.PI * 2;
      const radius = 2.45 + (i % 4) * 0.36;
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52 + (i % 3) * 0.12, 0.1), shardMaterial.clone());
      shard.position.set(Math.cos(angle) * radius, Math.sin(i * 1.7) * 0.86, Math.sin(angle) * radius);
      shard.rotation.set(angle * 0.34, angle, angle * 0.2);
      shards.push(shard);
      group.add(shard);
    }

    const positions: number[] = [];
    const colors: number[] = [];
    for (let i = 0; i < 900; i += 1) {
      const radius = 2.2 + Math.random() * 3.3;
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 4.5;
      positions.push(Math.cos(angle) * radius, height, Math.sin(angle) * radius);

      const color = Math.random() > 0.82 ? violetColor : primaryColor;
      colors.push(color.r, color.g, color.b);
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    particleGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        size: 0.026,
        transparent: true,
        opacity: 0.62,
        vertexColors: true,
        depthWrite: false,
      }),
    );
    group.add(particles);

    const pointer = new THREE.Vector2(0, 0);
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    canvas.addEventListener("pointermove", onPointerMove);
    resize();

    const clock = new THREE.Clock();
    let raf = 0;

    const renderFrame = () => {
      const elapsed = clock.getElapsedTime();
      const targetX = pointer.y * 0.16;
      const targetY = pointer.x * 0.18;

      group.rotation.x += (targetX - group.rotation.x) * 0.035;
      group.rotation.y += (targetY - group.rotation.y) * 0.035;

      if (!reducedMotion) {
        core.rotation.y = elapsed * 0.36;
        core.rotation.x = elapsed * 0.11;
        shell.rotation.y = -elapsed * 0.18;
        ringA.rotation.z = elapsed * 0.28;
        ringB.rotation.z = -elapsed * 0.18;
        ringC.rotation.z = elapsed * 0.1;
        particles.rotation.y = elapsed * 0.035;
        shards.forEach((shard, index) => {
          shard.rotation.y += 0.006 + index * 0.0005;
          shard.position.y += Math.sin(elapsed * 1.4 + index) * 0.0009;
        });
      }

      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      window.cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onPointerMove);
      resizeObserver.disconnect();
      renderer.dispose();
      particleGeometry.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((entry) => entry.dispose());
          } else {
            material.dispose();
          }
        }
      });
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="h-full min-h-[25rem] w-full touch-pan-y select-none"
    />
  );
}
