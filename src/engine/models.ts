import * as THREE from 'three';
import { MapId, MapTheme, MonsterType } from '../types/game';

export interface AnimatedMonsterRig {
  group: THREE.Group;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  head: THREE.Object3D;
  auraLight: THREE.PointLight;
}

export function createMonsterModel(type: MonsterType): AnimatedMonsterRig {
  const group = new THREE.Group();
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const head = new THREE.Group();

  let auraColor = 0xc81e2b;

  if (type === 'evil_santa') {
    auraColor = 0xdc2626;
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x7f1119, roughness: 0.78 });
    const furMat = new THREE.MeshStandardMaterial({ color: 0xd8dce3, roughness: 0.92 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.35, metalness: 0.25 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.28, metalness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xa69b97, roughness: 0.72 });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0xff1111,
      emissiveIntensity: 2.8,
    });

    // Legs (bottom-center grounded)
    const legGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.9, 10);
    const lBoot = new THREE.Mesh(legGeo, bootMat);
    lBoot.position.y = 0.45;
    leftLeg.position.set(-0.24, 0, 0);
    leftLeg.add(lBoot);

    const rBoot = new THREE.Mesh(legGeo, bootMat);
    rBoot.position.y = 0.45;
    rightLeg.position.set(0.24, 0, 0);
    rightLeg.add(rBoot);

    // Torso coat + fur trim + brass belt
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 1.35, 12), coatMat);
    torso.position.y = 1.55;
    torso.castShadow = true;

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.5, 0.16, 12), bootMat);
    belt.position.y = 1.28;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.08), metalMat);
    buckle.position.set(0, 1.28, 0.49);

    const furHem = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.59, 0.16, 12), furMat);
    furHem.position.y = 0.92;

    // Head + jagged beard + crooked Santa hat + glowing red eyes
    head.position.set(0, 2.38, 0);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 14), skinMat);
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.55, 8), furMat);
    beard.rotation.x = Math.PI;
    beard.position.set(0, -0.22, 0.18);
    const hatBrim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.08, 8, 16), furMat);
    hatBrim.rotation.x = Math.PI / 2;
    hatBrim.position.y = 0.2;
    const hatCone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 10), coatMat);
    hatCone.position.set(0.06, 0.52, -0.04);
    hatCone.rotation.z = -0.28;
    const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    lEye.position.set(-0.11, 0.05, 0.28);
    const rEye = lEye.clone();
    rEye.position.x = 0.11;
    head.add(skull, beard, hatBrim, hatCone, lEye, rEye);

    // Arms + Rusted Hook / Toy Sack
    const armGeo = new THREE.CylinderGeometry(0.11, 0.1, 0.95, 8);
    const lArmMesh = new THREE.Mesh(armGeo, coatMat);
    lArmMesh.position.y = -0.45;
    const sack = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 1), new THREE.MeshStandardMaterial({ color: 0x3b281d, roughness: 0.9 }));
    sack.position.set(0, -0.9, 0.12);
    leftArm.position.set(-0.56, 2.08, 0);
    leftArm.add(lArmMesh, sack);

    const rArmMesh = new THREE.Mesh(armGeo, coatMat);
    rArmMesh.position.y = -0.45;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 12, Math.PI * 1.35), metalMat);
    hook.position.set(0, -0.95, 0.15);
    hook.rotation.y = Math.PI / 2;
    rightArm.position.set(0.56, 2.08, 0);
    rightArm.add(rArmMesh, hook);

    group.add(leftLeg, rightLeg, torso, belt, buckle, furHem, head, leftArm, rightArm);
  } else if (type === 'frozen_snowman') {
    auraColor = 0x38bdf8;
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xcbe0f0, roughness: 0.85, metalness: 0.05 });
    const iceMat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.86 });
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0x88131d, roughness: 0.9 });
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x12151a, roughness: 0.65 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 3.2 });

    const baseSphere = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 1), snowMat);
    baseSphere.position.y = 0.65;
    baseSphere.castShadow = true;

    const midSphere = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 1), snowMat);
    midSphere.position.y = 1.55;
    midSphere.castShadow = true;

    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.09, 8, 16), scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.98;

    head.position.set(0, 2.32, 0);
    const headMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 1), snowMat);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.34, 8), new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 }));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.02, 0.42);
    const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
    lEye.position.set(-0.13, 0.08, 0.3);
    const rEye = lEye.clone();
    rEye.position.x = 0.13;
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 14), hatMat);
    hatBrim.position.y = 0.32;
    const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.44, 14), hatMat);
    hatTop.position.set(0.03, 0.55, 0);
    hatTop.rotation.z = -0.14;
    head.add(headMesh, nose, lEye, rEye, hatBrim, hatTop);

    // Jagged icicle arms
    const armSpike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.05, 6), iceMat);
    armSpike.rotation.x = Math.PI;
    armSpike.position.y = -0.5;
    leftArm.position.set(-0.55, 1.75, 0);
    leftArm.rotation.z = -0.35;
    leftArm.add(armSpike);

    const armSpikeR = armSpike.clone();
    rightArm.position.set(0.55, 1.75, 0);
    rightArm.rotation.z = 0.35;
    rightArm.add(armSpikeR);

    // Subtle hidden stub feet so leg animation rocks the base
    leftLeg.position.set(-0.2, 0, 0);
    rightLeg.position.set(0.2, 0, 0);

    group.add(baseSphere, midSphere, scarf, head, leftArm, rightArm, leftLeg, rightLeg);
  } else if (type === 'naughty_elf') {
    auraColor = 0x22c55e;
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.75 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x98a88d, roughness: 0.65 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 3.0 });
    const caneWhite = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 });

    const legGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.68, 8);
    const lLegM = new THREE.Mesh(legGeo, redMat);
    lLegM.position.y = 0.34;
    leftLeg.position.set(-0.16, 0, 0);
    leftLeg.add(lLegM);
    const rLegM = new THREE.Mesh(legGeo, greenMat);
    rLegM.position.y = 0.34;
    rightLeg.position.set(0.16, 0, 0);
    rightLeg.add(rLegM);

    const tunic = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.36, 0.85, 10), greenMat);
    tunic.position.y = 1.08;
    tunic.castShadow = true;

    head.position.set(0, 1.72, 0);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), skinMat);
    const lEar = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.26, 6), skinMat);
    lEar.rotation.z = 1.1;
    lEar.position.set(-0.27, 0.04, 0);
    const rEar = lEar.clone();
    rEar.rotation.z = -1.1;
    rEar.position.x = 0.27;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.56, 8), redMat);
    hat.position.set(0, 0.38, -0.05);
    hat.rotation.x = -0.25;
    const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), eyeMat);
    lEye.position.set(-0.09, 0.04, 0.21);
    const rEye = lEye.clone();
    rEye.position.x = 0.09;
    head.add(skull, lEar, rEar, hat, lEye, rEye);

    const armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.68, 8);
    const lArmM = new THREE.Mesh(armGeo, greenMat);
    lArmM.position.y = -0.32;
    leftArm.position.set(-0.34, 1.42, 0);
    leftArm.add(lArmM);

    const rArmM = new THREE.Mesh(armGeo, redMat);
    rArmM.position.y = -0.32;
    // Serrated candy cane shiv
    const shiv = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.01, 0.72, 8), caneWhite);
    shiv.rotation.x = Math.PI / 2;
    shiv.position.set(0, -0.64, 0.32);
    rightArm.position.set(0.34, 1.42, 0);
    rightArm.add(rArmM, shiv);

    group.add(leftLeg, rightLeg, tunic, head, leftArm, rightArm);
  } else {
    // Christmas Shadow
    auraColor = 0x9333ea;
    const shadowMat = new THREE.MeshStandardMaterial({
      color: 0x07070c,
      roughness: 0.95,
      metalness: 0.1,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 3.5,
    });

    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.25, 10, 1, true), shadowMat);
    cloak.position.y = 1.15;
    cloak.castShadow = true;

    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 1.1, 8), shadowMat);
    chest.position.y = 1.65;

    head.position.set(0, 2.52, 0);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), shadowMat);
    const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), eyeMat);
    lEye.position.set(-0.08, 0.04, 0.21);
    const rEye = lEye.clone();
    rEye.position.x = 0.08;

    // Antler crown
    const lAntler = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 0.85, 6), shadowMat);
    lAntler.position.set(-0.24, 0.45, 0);
    lAntler.rotation.z = 0.38;
    const rAntler = lAntler.clone();
    rAntler.position.x = 0.24;
    rAntler.rotation.z = -0.38;
    head.add(skull, lEye, rEye, lAntler, rAntler);

    const armGeo = new THREE.CylinderGeometry(0.05, 0.02, 1.35, 6);
    const lArmM = new THREE.Mesh(armGeo, shadowMat);
    lArmM.position.y = -0.62;
    leftArm.position.set(-0.36, 2.15, 0);
    leftArm.add(lArmM);
    const rArmM = lArmM.clone();
    rightArm.position.set(0.36, 2.15, 0);
    rightArm.add(rArmM);

    leftLeg.position.set(-0.15, 0, 0);
    rightLeg.position.set(0.15, 0, 0);

    group.add(cloak, chest, head, leftArm, rightArm, leftLeg, rightLeg);
  }

  const auraLight = new THREE.PointLight(auraColor, 1.4, 8, 2);
  auraLight.position.set(0, 1.8, 0.35);
  group.add(auraLight);

  return { group, leftArm, rightArm, leftLeg, rightLeg, head, auraLight };
}

export function createPlayerAvatarModel(skinId: string): {
  group: THREE.Group;
  flashlightSpot: THREE.SpotLight;
  flashlightTarget: THREE.Object3D;
} {
  const group = new THREE.Group();
  const coatColor =
    skinId === 'skin_crimson'
      ? 0x7f1d1d
      : skinId === 'skin_conductor'
        ? 0x1e3a5f
        : 0x334155;

  const coatMat = new THREE.MeshStandardMaterial({ color: coatColor, roughness: 0.78 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd6b59e, roughness: 0.65 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 1.05, 10), coatMat);
  body.position.y = 0.95;
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.55, 8), bootMat);
  legs.position.y = 0.27;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), skinMat);
  head.position.y = 1.66;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 10), bootMat);
  hat.position.y = 1.82;

  const flashlightSpot = new THREE.SpotLight(0xfff1d0, 3.2, 22, Math.PI / 6, 0.45, 1.6);
  flashlightSpot.position.set(0.2, 1.45, 0.22);
  const flashlightTarget = new THREE.Object3D();
  flashlightTarget.position.set(0.2, 1.35, 8);
  flashlightSpot.target = flashlightTarget;

  group.add(body, legs, head, hat, flashlightSpot, flashlightTarget);
  return { group, flashlightSpot, flashlightTarget };
}

export function createHidingSpotModel(theme: MapTheme): THREE.Group {
  const group = new THREE.Group();
  if (theme === 'forest') {
    // Hollow snowdrift & evergreen shelter
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 });
    const mound = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 1), snowMat);
    mound.scale.set(1.1, 0.95, 1.0);
    mound.position.y = 0.7;
    const hollow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.65), darkMat);
    hollow.position.set(0, 0.58, 0.55);
    group.add(mound, hollow);
  } else if (theme === 'factory' || theme === 'station') {
    // Industrial Iron Locker
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.72 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.28, metalness: 0.85 });
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.9), ironMat);
    cabinet.position.y = 1.1;
    cabinet.castShadow = true;
    const doorSeam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 0.04), trimMat);
    doorSeam.position.set(0, 1.1, 0.46);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.22, 0.04), trimMat);
    vent.position.set(0, 1.75, 0.46);
    group.add(cabinet, doorSeam, vent);
  } else {
    // Gothic Wooden Wardrobe
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3f2719, roughness: 0.68 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.28, metalness: 0.85 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.3, 0.92), woodMat);
    body.position.y = 1.15;
    body.castShadow = true;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.16, 1.02), woodMat);
    crown.position.y = 2.34;
    const lKnob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), brassMat);
    lKnob.position.set(-0.12, 1.1, 0.48);
    const rKnob = lKnob.clone();
    rKnob.position.x = 0.12;
    group.add(body, crown, lKnob, rKnob);
  }
  return group;
}

export function createCollectibleModel(
  mapId: MapId,
  giftTex: THREE.Texture,
  isCoin = false,
): THREE.Group {
  const group = new THREE.Group();
  if (isCoin) {
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.7,
      roughness: 0.25,
      metalness: 0.85,
    });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 16), coinMat);
    coin.rotation.x = Math.PI / 2;
    coin.position.y = 0.85;
    group.add(coin);
    return group;
  }

  if (mapId === 'forest') {
    // Missing Train Track Rail section
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.85 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.28, metalness: 0.88 });
    const sleeper1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.2), woodMat);
    sleeper1.position.set(0, 0.55, -0.3);
    const sleeper2 = sleeper1.clone();
    sleeper2.position.z = 0.3;
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 1.0), steelMat);
    railL.position.set(-0.36, 0.66, 0);
    const railR = railL.clone();
    railR.position.x = 0.36;
    group.add(sleeper1, sleeper2, railL, railR);
  } else if (mapId === 'factory') {
    // Brass Master Cog
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      emissive: 0x854d0e,
      emissiveIntensity: 0.5,
      roughness: 0.25,
      metalness: 0.9,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 8, 16), brassMat);
    ring.position.y = 0.85;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.14, 12), brassMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.y = 0.85;
    group.add(ring, hub);
  } else if (mapId === 'mansion') {
    // Antique Vault Key
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0x92400e,
      emissiveIntensity: 0.55,
      roughness: 0.22,
      metalness: 0.92,
    });
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 16), goldMat);
    bow.position.set(0, 1.08, 0);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), goldMat);
    shaft.position.set(0, 0.75, 0);
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.04), goldMat);
    tooth.position.set(0.08, 0.55, 0);
    group.add(bow, shaft, tooth);
  } else if (mapId === 'station') {
    // Steam Pressure Valve & Coal Bucket
    const valveMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.65,
    });
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 16), valveMat);
    wheel.position.y = 0.85;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.06), valveMat);
    spoke.position.y = 0.85;
    group.add(wheel, spoke);
  } else {
    // Wrapped Stolen Gift
    const boxMat = new THREE.MeshStandardMaterial({ map: giftTex, roughness: 0.45 });
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.6 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.62), boxMat);
    box.position.y = 0.72;
    const bow1 = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 6, 12), ribbonMat);
    bow1.position.set(-0.08, 1.03, 0);
    bow1.rotation.z = 0.4;
    const bow2 = bow1.clone();
    bow2.position.x = 0.08;
    bow2.rotation.z = -0.4;
    group.add(box, bow1, bow2);
  }

  const glow = new THREE.PointLight(0xfbbf24, 1.1, 4.5, 2);
  glow.position.y = 1.0;
  group.add(glow);
  return group;
}

export function createPuzzleStationModel(mapId: MapId): THREE.Group {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.75 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.28, metalness: 0.85 });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 2.0,
  });

  if (mapId === 'mansion') {
    // Grandfather Clock Secret Basement trigger
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3b2316, roughness: 0.6 });
    const tallCase = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.7, 0.6), woodMat);
    tallCase.position.y = 1.35;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0x92400e, emissiveIntensity: 0.4 }));
    face.position.set(0, 2.25, 0.32);
    group.add(tallCase, face);
  } else {
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.35, 0.85), metalMat);
    pedestal.position.y = 0.675;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.1), brassMat);
    panel.position.set(0, 1.45, 0.15);
    panel.rotation.x = -0.35;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), beaconMat);
    lamp.position.set(0, 1.85, 0);
    group.add(pedestal, panel, lamp);
  }

  const light = new THREE.PointLight(0x38bdf8, 1.6, 8, 2);
  light.position.set(0, 2.0, 0.6);
  group.add(light);
  return group;
}

export function createLocomotiveModel(): THREE.Group {
  const group = new THREE.Group();
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35, metalness: 0.82 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.48, metalness: 0.35 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.25, metalness: 0.9 });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 3.0,
  });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 7.2), redMat);
  chassis.position.y = 0.7;
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 4.4, 16), ironMat);
  boiler.rotation.x = Math.PI / 2;
  boiler.position.set(0, 1.85, 0.9);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.3, 2.2), ironMat);
  cab.position.set(0, 2.05, -2.2);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 1.1, 12), brassMat);
  stack.position.set(0, 3.0, 2.3);
  const headlamp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12), headMat);
  headlamp.rotation.x = Math.PI / 2;
  headlamp.position.set(0, 2.4, 3.15);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.18, 12);
  [-1.9, -0.5, 0.9, 2.2].forEach((zOff) => {
    const wL = new THREE.Mesh(wheelGeo, brassMat);
    wL.rotation.z = Math.PI / 2;
    wL.position.set(-1.32, 0.45, zOff);
    const wR = wL.clone();
    wR.position.x = 1.32;
    group.add(wL, wR);
  });

  const headLight = new THREE.SpotLight(0xfbbf24, 4.5, 28, Math.PI / 5, 0.5, 1.5);
  headLight.position.set(0, 2.4, 3.3);
  const target = new THREE.Object3D();
  target.position.set(0, 1.0, 16);
  headLight.target = target;

  group.add(chassis, boiler, cab, stack, headlamp, headLight, target);
  return group;
}

export function createStreetlampModel(): THREE.Group {
  const group = new THREE.Group();
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.4, metalness: 0.75 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.2,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.5, 8), ironMat);
  base.position.y = 0.25;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.3, 8), ironMat);
  pole.position.y = 2.0;
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.42, 6), glassMat);
  lantern.position.y = 3.78;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.24, 6), ironMat);
  cap.position.y = 4.08;

  group.add(base, pole, lantern, cap);
  return group;
}
