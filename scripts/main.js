import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const vertex_shader = await getGLSL("scripts/shaders/vertex.glsl");
const fragment_shader = await getGLSL("scripts/shaders/frag.glsl");

// get glsl files and convert to a string
async function getGLSL(path) {
  let response = await fetch(path);

  if (!response.ok) {
    alert("Error loading GLSL file!");
    throw new Error(`Error fetching GLSL file from path: ${path}`);
  }

  const source = await response.text();
  return source;
}

const camera_width = window.innerWidth;
const camera_height = window.innerHeight;
const camera_aspect = camera_width / camera_height;
const near_plane = 0.1;
const far_plane = 1000;

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer();
renderer.setSize(camera_width, camera_height);
renderer.domElement.tabIndex = "0";
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, camera_aspect, near_plane, far_plane);
const camera_controls = new OrbitControls(camera, renderer.domElement);
const clear_color = new THREE.Color(0x000000);
renderer.setClearColor(clear_color, 1);
camera.position.z = 5;
camera_controls.update();

const geometry = new THREE.PlaneGeometry();
const material = new THREE.ShaderMaterial();
const ray_march_plane = new THREE.Mesh(geometry, material);

// find near plane dimensions
const near_plane_width = near_plane * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera_aspect * 2;
const near_plane_height = near_plane_width / camera_aspect;

// scale the raymarch plane to fit the screen
ray_march_plane.scale.set(near_plane_width, near_plane_height, 1);
scene.add(ray_march_plane);

// position and setup the light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 1, 1);
scene.add(light);

const uniforms = {
  // raymarching
  u_threshold: { value: 0.0001 },
  u_max_distance: { value: far_plane },
  u_max_steps: { value: 100 },

  // camera
  u_clear_color: { value: clear_color },
  u_camera_position: { value: camera.position },
  u_camera_to_world_mat: { value: camera.matrixWorld },
  u_camera_inverse_proj_mat: { value: camera.projectionMatrixInverse },

  // implement lighting
  u_light_direction: { value:  light.position},
  u_light_color: { value:  light.color},

  u_diffuse_intensity: { value:  0.5},
  u_spectral_intensity: { value:  1.5},
  u_ambient_intensity: { value:  0.15},
  u_shininess: { value:  32},

  // time
  u_time: { value: 0},
};

// set material properties
material.uniforms = uniforms;
material.vertexShader = vertex_shader;
material.fragmentShader = fragment_shader;

let camera_forwards = new THREE.Vector3(0, 0, -1);
const VECTOR3ZERO = new THREE.Vector3(0, 0, 0);

const telemetry_overlay = document.querySelector("p#telemetry_overlay");
let init_time = Date.now();
let prev = init_time;

function animate()
{   
  // lock raymarch plane to camera
  camera_forwards = camera.position.clone().add(camera.getWorldDirection(VECTOR3ZERO).multiplyScalar(near_plane));
  ray_march_plane.position.copy(camera_forwards);
  ray_march_plane.rotation.copy(camera.rotation);

  // render
  renderer.render( scene, camera );

  // update uniforms
  const now = Date.now();
  const delta_time = now - prev;
  uniforms.u_time.value = (now - init_time) / 1000;

  telemetry_overlay.textContent = `fps: ${Math.round(1000 / delta_time)}`;

  // update orbit camera
  camera_controls.update();

  prev = now;
}

$("canvas").keydown(function (event) { 
  switch (event.key) {
    case "Backspace":
      renderer.setAnimationLoop(null);
      break;
    
    case "Enter":
      renderer.setAnimationLoop(animate);
      break;
  }
});

renderer.setAnimationLoop( animate );
