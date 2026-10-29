"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Escultura molecular: anel de seis átomos (referência à estrutura de açúcares e
 * aminoácidos) com ramificações e uma massa orgânica que "respira".
 * Carregada sob demanda; pausa fora da tela e respeita movimento reduzido.
 */
export default function MoleculeScene({ reduced, onFail, onReady }: { reduced: boolean; onFail: () => void; onReady: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      onFail();
      return;
    }
    const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || window.innerWidth < 768;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.25 : 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 11);

    // Luzes: chave fria + recorte volt
    const key = new THREE.DirectionalLight(0xF4F1F1, 1.4);
    key.position.set(4, 6, 6);
    scene.add(key);
    const rim = new THREE.PointLight(0xFF2A3D, 40, 30, 1.6);
    rim.position.set(-5, -2, -3);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.08));

    const root = new THREE.Group();
    scene.add(root);

    const graphite = new THREE.MeshPhysicalMaterial({
      color: 0x1C1919, metalness: 0.35, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.1,
    });
    const bone = new THREE.MeshPhysicalMaterial({ color: 0xEDE8E8, metalness: 0.05, roughness: 0.35, clearcoat: 0.6 });
    const volt = new THREE.MeshPhysicalMaterial({
      color: 0xFF2A3D, emissive: 0x8A0010, emissiveIntensity: 0.35, metalness: 0.1, roughness: 0.3, clearcoat: 1,
    });
    const bondMat = new THREE.MeshStandardMaterial({ color: 0x3E3838, metalness: 0.6, roughness: 0.35 });

    const sphere = new THREE.SphereGeometry(1, lowPower ? 32 : 48, lowPower ? 24 : 32);
    const cyl = new THREE.CylinderGeometry(0.07, 0.07, 1, 12, 1);

    const atoms: { pos: THREE.Vector3; r: number; mat: THREE.Material }[] = [];
    const R = 1.7;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      atoms.push({ pos: new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, (i % 2 ? 0.35 : -0.35)), r: 0.42, mat: i === 1 ? volt : graphite });
    }
    // ramificações
    const branches: [number, THREE.Vector3, number, THREE.Material][] = [
      [0, new THREE.Vector3(3.3, 0.4, 0.9), 0.3, bone],
      [2, new THREE.Vector3(-0.9, 3.2, -0.6), 0.34, graphite],
      [3, new THREE.Vector3(-3.4, 0.6, 0.7), 0.26, bone],
      [4, new THREE.Vector3(-1.7, -3.0, -0.8), 0.3, graphite],
      [5, new THREE.Vector3(1.4, -3.1, 0.5), 0.22, volt],
    ];
    const bonds: [number, number][] = [];
    for (let i = 0; i < 6; i++) bonds.push([i, (i + 1) % 6]);
    for (const [from, p, r, m] of branches) {
      atoms.push({ pos: p, r, mat: m });
      bonds.push([from, atoms.length - 1]);
    }
    // átomo satélite
    atoms.push({ pos: new THREE.Vector3(4.4, 1.6, 0.2), r: 0.16, mat: bone });
    bonds.push([6, atoms.length - 1]);

    const atomMeshes = atoms.map((a) => {
      const m = new THREE.Mesh(sphere, a.mat);
      m.position.copy(a.pos);
      m.scale.setScalar(a.r);
      root.add(m);
      return m;
    });
    const up = new THREE.Vector3(0, 1, 0);
    for (const [a, b] of bonds) {
      const pa = atoms[a].pos;
      const pb = atoms[b].pos;
      const mid = pa.clone().add(pb).multiplyScalar(0.5);
      const dir = pb.clone().sub(pa);
      const len = dir.length();
      const bond = new THREE.Mesh(cyl, bondMat);
      bond.position.copy(mid);
      bond.scale.set(1, len, 1);
      bond.quaternion.setFromUnitVectors(up, dir.normalize());
      root.add(bond);
    }

    // Massa orgânica central, deformação suave por ruído
    const blobGeo = new THREE.SphereGeometry(1, lowPower ? 64 : 112, lowPower ? 48 : 80); // indexada → normais suaves
    const basePos = (blobGeo.attributes.position.array as Float32Array).slice();
    const blobMat = new THREE.MeshPhysicalMaterial({
      color: 0x100D0D, metalness: 0.2, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05,
      iridescence: 0.35, iridescenceIOR: 1.3, envMapIntensity: 1.3,
    });
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.scale.setScalar(1.05);
    root.add(blob);

    // anel técnico fino
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.75, 0.008, 8, 160),
      new THREE.MeshBasicMaterial({ color: 0xFF2A3D, transparent: true, opacity: 0.45 }),
    );
    ring.rotation.x = Math.PI / 2.4;
    root.add(ring);

    root.rotation.set(0.35, -0.4, 0.1);

    function resize() {
      const w = host!.clientWidth;
      const h = host!.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / Math.max(h, 1);
      // distância com folga para as ligações externas não saírem do canvas durante a rotação
      camera.position.z = camera.aspect < 0.9 ? 20 : 15;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    function deformBlob(t: number) {
      const pos = blobGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) {
        const x = basePos[i], y = basePos[i + 1], z = basePos[i + 2];
        const n =
          Math.sin(x * 2.1 + t * 0.9) * 0.08 + Math.sin(y * 2.7 + t * 0.7) * 0.07 + Math.sin(z * 3.1 + t * 1.1) * 0.06;
        const k = 1 + n;
        pos[i] = x * k;
        pos[i + 1] = y * k;
        pos[i + 2] = z * k;
      }
      blobGeo.attributes.position.needsUpdate = true;
      blobGeo.computeVertexNormals();
    }

    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !reduced) loop();
    });
    io.observe(host);

    let raf = 0;
    const t0 = performance.now();
    let frame = 0;
    function loop() {
      cancelAnimationFrame(raf);
      const tick = () => {
        if (!visible) return;
        const t = (performance.now() - t0) / 1000;
        pointer.x += (pointer.tx - pointer.x) * 0.04;
        pointer.y += (pointer.ty - pointer.y) * 0.04;
        root.rotation.y = -0.4 + t * 0.08 + pointer.x * 0.35;
        root.rotation.x = 0.35 + Math.sin(t * 0.3) * 0.06 + pointer.y * 0.2;
        root.position.y = Math.sin(t * 0.6) * 0.08;
        atomMeshes.forEach((m, i) => {
          m.position.z = atoms[i].pos.z + Math.sin(t * 0.8 + i) * 0.05;
        });
        if (frame++ % (lowPower ? 2 : 1) === 0) deformBlob(t);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    deformBlob(0.6);
    renderer.render(scene, camera);
    onReady();
    if (!reduced) loop();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
        }
      });
      [graphite, bone, volt, bondMat, blobMat].forEach((m) => m.dispose());
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [reduced, onFail, onReady]);

  return <div ref={hostRef} className="absolute inset-0" />;
}
