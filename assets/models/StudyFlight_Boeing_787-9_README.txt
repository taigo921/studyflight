StudyFlight aircraft model — Boeing 787-9 inspired (original procedural geometry)

File: StudyFlight_Boeing_787-9.glb
Coordinates: +X nose / +/-Y wings / +Z up. Units: meters.
Approximate dimensions: 62.8 m fuselage length / 60.1 m wingspan.
Includes curved raked wingtip, flexed wings, two engine nacelles with serrated chevron edges, cockpit/cabin windows, navy and cyan StudyFlight-style livery.

Example (Three.js):
const loader = new GLTFLoader();
loader.load('/models/StudyFlight_Boeing_787-9.glb', (gltf) => {
  const plane = gltf.scene;
  plane.scale.setScalar(1);
  plane.rotation.x = -Math.PI / 2; // convert model Z-up to Three.js Y-up
  scene.add(plane);
});

Note: This model is a hand-built stylized approximation of the Boeing 787-9, NOT a licensed Boeing CAD model or an engineering-accurate replica. Do not use as a flight simulation engineering model.
