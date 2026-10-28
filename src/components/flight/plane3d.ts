// 3D 機体（Boeing 787-9 風のオリジナルモデル）を MapLibre の地図に Three.js で描くカスタムレイヤー。
//
// - 地図と同じ WebGL コンテキストに描き、地形の奥行きを共有する（renderingMode: "3d"）
// - 地球儀とメルカトルの両方に対応（plane3dMath の行列を projectionTransition で混ぜる）
// - モデルは読み込み時に 1 つのジオメトリへ結合し、描画は機体と影の 2 回だけ
// - Three.js とモデルは、3D 機体を使うときだけ読み込む（初回表示を重くしない）

import type { CustomLayerInterface, CustomRenderMethodInput, Map as MLMap } from "maplibre-gl";
import type * as THREEType from "three";
import { globeAnchor, mercatorAnchor, mix, multiply, planeAttitude, shadowAttitude } from "./plane3dMath";

export interface Plane3DFrame {
  lng: number;
  lat: number;
  /** 機首方位（度） */
  bearing: number;
  /** 機首上げ（度） */
  pitch: number;
  /** 右バンク（度） */
  bank: number;
  /** 機体を描く地面からの高さ（m） */
  altitude: number;
  /** 影を機体からずらす距離（m）。高度感はこちらで出す */
  shadowDistance: number;
  /** 地面の標高（m） */
  ground: number;
  /** モデルの拡大率 */
  scale: number;
  visible: boolean;
}

export interface Plane3D {
  layer: CustomLayerInterface;
  setFrame(frame: Plane3DFrame): void;
  dispose(): void;
}

export const PLANE_LAYER_ID = "sf-plane-3d";

type Three = typeof THREEType;

let geometryCache: Promise<{ THREE: Three; geometry: THREEType.BufferGeometry }> | null = null;

/** Three.js とモデルを読み込み、1 つのジオメトリに結合する（ページ内で 1 回だけ）。 */
function loadGeometry(url: string) {
  geometryCache ??= (async () => {
    const [THREE, { GLTFLoader }, { mergeGeometries }] = await Promise.all([
      import("three"),
      import("three/examples/jsm/loaders/GLTFLoader.js"),
      import("three/examples/jsm/utils/BufferGeometryUtils.js"),
    ]);
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.updateMatrixWorld(true);
    const parts: THREEType.BufferGeometry[] = [];
    const color = new THREE.Color();
    gltf.scene.traverse((o) => {
      const mesh = o as THREEType.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      const pos = src.getAttribute("position");
      if (!src.getAttribute("normal")) src.computeVertexNormals();
      // 頂点色は sRGB で作られているので、描画用の線形色に直す
      const srcColor = src.getAttribute("color");
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        if (srcColor) color.setRGB(srcColor.getX(i), srcColor.getY(i), srcColor.getZ(i), THREE.SRGBColorSpace);
        else color.setRGB(1, 1, 1);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(Array.from(pos.array as ArrayLike<number>), 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(Array.from(src.getAttribute("normal").array as ArrayLike<number>), 3));
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      g.setIndex(src.index ? Array.from(src.index.array as ArrayLike<number>) : [...Array(pos.count).keys()]);
      parts.push(g);
      src.dispose();
    });
    const geometry = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!geometry) throw new Error("model has no meshes");
    geometry.computeBoundingSphere();
    return { THREE, geometry };
  })();
  geometryCache.catch(() => (geometryCache = null));
  return geometryCache;
}

export async function createPlane3D(url: string): Promise<Plane3D> {
  const { THREE, geometry } = await loadGeometry(url);

  const scene = new THREE.Scene();
  const body = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  const shadow = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false, depthTest: false }),
  );
  for (const m of [body, shadow]) {
    m.matrixAutoUpdate = false;
    m.frustumCulled = false;
  }
  shadow.renderOrder = -1;
  scene.add(shadow, body);
  // ローカル座標は東・北・上（z が上）。光も同じ座標で置く
  const hemi = new THREE.HemisphereLight(0xe8f2ff, 0x3a4a5e, 2.2);
  hemi.position.set(0, 0, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-0.45, 0.5, 1);
  scene.add(hemi, sun, sun.target);

  const camera = new THREE.Camera();
  let renderer: THREEType.WebGLRenderer | null = null;
  let map: MLMap | null = null;
  let frame: Plane3DFrame | null = null;

  const layer: CustomLayerInterface = {
    id: PLANE_LAYER_ID,
    type: "custom",
    renderingMode: "3d",
    onAdd(m, gl) {
      map = m;
      renderer ??= new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl as WebGL2RenderingContext, antialias: true });
      renderer.autoClear = false;
    },
    onRemove() {
      map = null;
    },
    render(_gl, args: CustomRenderMethodInput) {
      if (!renderer || !frame || !frame.visible) return;
      const d = args.defaultProjectionData;
      const t = d.projectionTransition ?? 0;
      const merc = multiply(d.fallbackMatrix as ArrayLike<number>, mercatorAnchor(frame.lng, frame.lat, frame.ground));
      const toClip = t > 0 ? mix(multiply(d.mainMatrix as ArrayLike<number>, globeAnchor(frame.lng, frame.lat, frame.ground)), merc, t) : merc;
      camera.projectionMatrix.fromArray(toClip);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      body.matrix.fromArray(planeAttitude(frame.bearing, frame.pitch, frame.bank, frame.scale, frame.altitude));
      body.matrixWorld.copy(body.matrix);
      shadow.matrix.fromArray(shadowAttitude(frame.bearing, frame.scale, frame.shadowDistance, frame.scale * 0.5));
      shadow.matrixWorld.copy(shadow.matrix);
      shadow.visible = frame.shadowDistance > 0;
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };

  return {
    layer,
    setFrame(f) {
      frame = f;
      map?.triggerRepaint();
    },
    dispose() {
      if (map?.getLayer(PLANE_LAYER_ID)) map.removeLayer(PLANE_LAYER_ID);
      (body.material as THREEType.Material).dispose();
      (shadow.material as THREEType.Material).dispose();
      // ジオメトリは次のフライトでも使うので残す。renderer は地図の WebGL を共有しているため破棄しない
      renderer = null;
      map = null;
    },
  };
}
