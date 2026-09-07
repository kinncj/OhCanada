import * as THREE from 'three/webgpu';
import { color, mix, positionWorld, sin, time } from 'three/tsl';

export function buildWater(center: readonly [number, number, number], size: readonly [number, number], frozen: boolean): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size[0], size[1], 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardNodeMaterial({ roughness: frozen ? 0.25 : 0.08, metalness: 0.05, transparent: !frozen, opacity: frozen ? 1 : 0.86 });
  if (frozen) {
    mat.colorNode = color(0xdfe9f2);
  } else {
    const ripple = sin(positionWorld.x.mul(0.9).add(time.mul(1.3))).mul(sin(positionWorld.z.mul(0.7).add(time.mul(0.8)))).mul(0.5).add(0.5);
    mat.colorNode = mix(color(0x173f5f), color(0x2f6d8f), ripple);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(center[0], center[1], center[2]);
  mesh.receiveShadow = true;
  mesh.name = 'water';
  return mesh;
}
