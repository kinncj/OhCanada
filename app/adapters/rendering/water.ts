import * as THREE from 'three/webgpu';
import { color, mix, positionWorld, sin, time, vec3, normalize, float } from 'three/tsl';

/** Reflective water: env-mapped physical material with two animated ripple layers driving the normal. */
export function buildWater(center: readonly [number, number, number], size: readonly [number, number], frozen: boolean): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size[0], size[1], 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhysicalNodeMaterial({ roughness: frozen ? 0.3 : 0.04, metalness: frozen ? 0.05 : 0.15, transparent: !frozen, opacity: frozen ? 1 : 0.9, envMapIntensity: frozen ? 0.6 : 1.6 });
  if (frozen) {
    mat.colorNode = color(0xdfe9f2);
  } else {
    const p = positionWorld;
    const t = time;
    const w1 = sin(p.x.mul(0.35).add(p.z.mul(0.2)).add(t.mul(0.9)));
    const w2 = sin(p.z.mul(0.55).sub(p.x.mul(0.15)).add(t.mul(1.4)));
    const w3 = sin(p.x.mul(1.3).add(p.z.mul(1.1)).add(t.mul(2.2)));
    const ripple = w1.add(w2).add(w3.mul(0.5)).mul(0.5).add(0.5);
    mat.colorNode = mix(color(0x0f2f45), color(0x2b6a8c), ripple.mul(0.6));
    // Perturbed world-space normal so the sky/HDRI reflection breaks up like moving water.
    const dx = w1.mul(0.35).add(w3.mul(0.55)).mul(0.08);
    const dz = w2.mul(0.35).add(w3.mul(0.45)).mul(0.08);
    mat.normalNode = normalize(vec3(dx, float(1), dz));
    mat.roughnessNode = ripple.mul(0.05).add(0.02);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(center[0], center[1], center[2]);
  mesh.receiveShadow = true;
  mesh.name = 'water';
  return mesh;
}
