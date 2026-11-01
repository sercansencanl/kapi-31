// Gerçekçi görünüm katmanı: HDRI gökyüzü + PBR dokular (Poly Haven, CC0).
// Arka planda yüklenir. Bir şey yüklenemezse oyun koddan üretilen görünümle devam eder.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const SKY = 'assets/sky/evening_road_01_puresky_2k.hdr';
const TEX = 'assets/tex/';

function loadTex(loader, file, { srgb = false, repeat = [1, 1], aniso = 8 } = {}) {
  return new Promise((res, rej) => loader.load(TEX + file, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    res(t);
  }, undefined, rej));
}

// HDRI'deki en parlak noktayı (güneşi) ve ufuk rengini bul.
function analyzeSky(tex) {
  const { data: raw, width: W, height: H } = tex.image;
  // HalfFloatType'ta veri Uint16Array (yarım hassasiyet): yalnızca okunan değerler sayıya çevrilir
  const fh = THREE.DataUtils.fromHalfFloat;
  const at = raw instanceof Uint16Array ? (i) => fh(raw[i]) : (i) => raw[i];
  let best = -1, bc = 0, br = 0;
  for (let r = 0; r < H / 2; r += 2) {
    for (let c = 0; c < W; c += 2) {
      const i = (r * W + c) * 4, l = at(i) * 0.2126 + at(i + 1) * 0.7152 + at(i + 2) * 0.0722;
      if (l > best) { best = l; bc = c; br = r; }
    }
  }
  // Ufuk bandının (görüş yönü dahil tüm çevre) ortalama rengi: sis ve uzak dağlar için
  const hz = [0, 0, 0]; let n = 0;
  const r0 = Math.floor(H * 0.47), r1 = Math.floor(H * 0.5);
  for (let r = r0; r < r1; r++) for (let c = 0; c < W; c += 4) {
    const i = (r * W + c) * 4; hz[0] += at(i); hz[1] += at(i + 1); hz[2] += at(i + 2); n++;
  }
  const u = (bc + 0.5) / W, v = 1 - (br + 0.5) / H; // flipY=true: satır 0 = v 1
  return { sunPhi: (u - 0.5) * Math.PI * 2, sunTheta: (v - 0.5) * Math.PI, horizon: hz.map((x) => x / n) };
}

export async function upgradeRealism(world, { onDone } = {}) {
  const r = world.renderer, scene = world.scene;
  const tl = new THREE.TextureLoader();
  const maxA = Math.min(8, r.capabilities.getMaxAnisotropy());
  try {
    const [hdr, aDiff, aNor, aArm, cDiff, cNor, cArm, kNor, kArm, wNor] = await Promise.all([
      new RGBELoader().setDataType(THREE.HalfFloatType).loadAsync(SKY), // yarım hassasiyet: GPU belleği yarıya iner
      loadTex(tl, 'asphalt_02_diff_1k.jpg', { srgb: true, repeat: [55, 2], aniso: maxA }),
      loadTex(tl, 'asphalt_02_nor_gl_1k.jpg', { repeat: [55, 2], aniso: maxA }),
      loadTex(tl, 'asphalt_02_arm_1k.jpg', { repeat: [55, 2], aniso: maxA }),
      loadTex(tl, 'concrete_floor_02_diff_1k.jpg', { srgb: true, repeat: [140, 140], aniso: maxA }),
      loadTex(tl, 'concrete_floor_02_nor_gl_1k.jpg', { repeat: [140, 140], aniso: maxA }),
      loadTex(tl, 'concrete_floor_02_arm_1k.jpg', { repeat: [140, 140], aniso: maxA }),
      loadTex(tl, 'container_side_nor_gl_1k.jpg', { repeat: [3, 1], aniso: maxA }),
      loadTex(tl, 'container_side_arm_1k.jpg', { repeat: [3, 1], aniso: maxA }),
      loadTex(tl, 'waternormals.jpg', { repeat: [40, 18], aniso: maxA }),
    ]);

    // --- Gökyüzü: gün batımı kameranın baktığı yönde, deniz üzerinde dursun ---
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const sky = analyzeSky(hdr);
    const targetPhi = Math.atan2(-700, -420); // eski güneş parıltısının yönü
    const rotY = sky.sunPhi - targetPhi;
    scene.background = hdr;
    scene.backgroundRotation.set(0, rotY, 0);
    scene.backgroundIntensity = 0.6;
    scene.backgroundBlurriness = 0;
    const pmrem = new THREE.PMREMGenerator(r);
    const env = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
    scene.environment = env;
    scene.environmentRotation.set(0, rotY, 0);
    scene.environmentIntensity = 0.5;
    world.skyMesh.visible = false;
    if (world.sunGlow) world.sunGlow.visible = false;
    world.hemi.intensity = 0.35;

    // Sis ve uzak dağlar ufuk rengine uysun (hava perspektifi)
    const [hr, hg, hb] = sky.horizon.map((x) => Math.min(x * 0.8, 1.0));
    const fog = new THREE.Color().setRGB(hr, hg, hb).lerp(new THREE.Color('#e9c9a4'), 0.35);
    scene.fog.near = 110; scene.fog.far = 620;
    scene.fog.color.copy(fog);
    (world.ridgeMats || []).forEach((m, i) => {
      m.color.copy(fog).multiplyScalar(i === 0 ? 0.62 : 0.48).lerp(new THREE.Color('#5d5a78'), i === 0 ? 0.3 : 0.45);
    });

    // --- Zemin ---
    const setPBR = (mat, map, nor, arm, tint, nScale = 1) => {
      mat.map = map; mat.normalMap = nor; mat.normalScale.set(nScale, nScale);
      mat.roughnessMap = arm; mat.roughness = 1; mat.metalness = 0;
      if (tint) mat.color.set(tint);
      mat.needsUpdate = true;
    };
    setPBR(world.laneMesh.material, aDiff, aNor, aArm, '#b9b9b9', 0.8);
    setPBR(world.groundMesh.material, cDiff, cNor, cArm, '#efe8dc', 0.6);

    // --- Konteynerler: renk/yazı koddaki dokuda kalır, oluk ve pürüz gerçek haritadan gelir ---
    const corr = (mat, rep = [3, 1]) => {
      const n = kNor.clone(); n.repeat.set(...rep); n.needsUpdate = true;
      const a = kArm.clone(); a.repeat.set(...rep); a.needsUpdate = true;
      mat.normalMap = n; mat.normalScale.set(1.2, 1.2);
      mat.roughnessMap = a; mat.roughness = 0.9; mat.metalness = 0.35;
      mat.needsUpdate = true;
    };
    corr(world.yardMat); corr(world.shipMat);
    world.onTruckMaterials = ({ sideMat }) => corr(sideMat, [4, 1]);

    // --- Deniz: pürüzsüz, gökyüzünü yansıtan, iki katman kayan dalga ---
    const sea = world.sea.material;
    sea.flatShading = false; sea.color.set('#1b4f5c'); sea.roughness = 0.06; sea.metalness = 0.0;
    sea.normalMap = wNor; sea.normalScale.set(0.35, 0.35); sea.envMapIntensity = 1.4; sea.needsUpdate = true;
    world.onFrame = (dt, t) => { wNor.offset.set(t * 0.004, t * 0.0025); };

    world.realism = true;
    onDone?.(true);
  } catch (err) {
    console.warn('Gerçekçi görünüm yüklenemedi, koddan üretilen görünümle devam ediliyor:', err);
    onDone?.(false);
  }
}
