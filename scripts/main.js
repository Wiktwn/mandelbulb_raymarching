import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

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
document.querySelector("#render_container").appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, camera_aspect, near_plane, far_plane);
const camera_controls = new PointerLockControls(camera, renderer.domElement);
const clear_color = new THREE.Color(0x000000);
renderer.setClearColor(clear_color, 1);
camera.position.z = 5;
// camera_controls.update();

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
  u_max_steps: { value: 200 },
  u_glow_factor: { value: 200 },

  // camera
  u_clear_color: { value: clear_color },
  u_camera_position: { value: camera.position },
  u_camera_to_world_mat: { value: camera.matrixWorld },
  u_camera_inverse_proj_mat: { value: camera.projectionMatrixInverse },

  // implement lighting
  u_light_direction: { value:  light.position },
  u_light_color: { value:  light.color },

  u_diffuse_intensity: { value:  0.5 },
  u_spectral_intensity: { value:  1.5 },
  u_ambient_intensity: { value:  0.15 },
  u_shininess: { value:  32 },

  // time
  u_time: { value: 0},
  u_time_factor: { value: 1 },

  // mandelbulb values
  u_power_amplitude: { value: 4.0 }, // maximum will be 2x the size of this value (sin curve)
  u_power_offset: { value: 4.0 },
};

// set material properties
material.uniforms = uniforms;
material.vertexShader = vertex_shader;
material.fragmentShader = fragment_shader;

let animate_flag = true;
let wasdss = new Array(6).fill(0);
const move_direction = new THREE.Vector3(0, 0, 0);
const move_direction_norm = new THREE.Vector3(0, 0, 0);

// keyboard inputs
function handle_keydown(event)
{
  switch (event.key) {
    case "w":
      wasdss[0] = 1;
      break;
    case "a":
      wasdss[1] = 1;
      break;
    case "s":
      wasdss[2] = 1;
      break;
    case "d":
      wasdss[3] = 1;
      break;
    case " ":
      wasdss[4] = 1;
      break;
    case "Shift":
      wasdss[5] = 1;
      break;
    case "p":
      animate_flag = !animate_flag;
      break;
    case "ArrowLeft":
      uniforms.u_time.value += 0.2;
      break;
    case "ArrowRight":
      uniforms.u_time.value -= 0.2;
      break;
    case "-":
      uniforms.u_threshold.value *= 0.1;
      break;
    case "=":
      uniforms.u_threshold.value *= 10 ;
      break;
    case ",":
      uniforms.u_max_steps.value -= 10;
      break;
    case ".":
      uniforms.u_max_steps.value += 10;
      break;
  }
  
  const x = -wasdss[1] ^ wasdss[3];
  const y = -wasdss[5] ^ wasdss[4];
  const z = -wasdss[0] ^ wasdss[2];
  move_direction.set(x, y, z);
  move_direction_norm.copy(move_direction).normalize();

  console.log(move_direction_norm);
}

function handle_keyup(event)
{
  switch (event.key) {
    case "w":
      wasdss[0] = 0;
      break;
    case "a":
      wasdss[1] = 0;
      break;
    case "s":
      wasdss[2] = 0;
      break;
    case "d":
      wasdss[3] = 0;
      break;
    case " ":
      wasdss[4] = 0;
      break;
    case "Shift":
      wasdss[5] = 0;
      break;
  }

  const x =-wasdss[1] ^ wasdss[3];
  const y = -wasdss[5] ^ wasdss[4];
  const z = -wasdss[0] ^ wasdss[2];
  move_direction.set(x, y, z);
  move_direction_norm.copy(move_direction).normalize();

  console.log(move_direction_norm);
}

let camera_near_plane = new THREE.Vector3(0, 0, -1);
const VECTOR3ZERO = new THREE.Vector3(0, 0, 0);

const telemetry_overlay = document.querySelector("p#telemetry_overlay");
let init_time = Date.now();
let prev = init_time;

function animate()
{   
  // lock raymarch plane to camera
  camera_near_plane = camera.position.clone().add(camera.getWorldDirection(VECTOR3ZERO).multiplyScalar(near_plane));
  ray_march_plane.position.copy(camera_near_plane);
  ray_march_plane.rotation.copy(camera.rotation);

  // render
  renderer.render( scene, camera );

  // update uniforms
  const now = Date.now();
  const delta_time = now - prev;

  if (animate_flag) uniforms.u_time.value += delta_time / 1000;

  telemetry_overlay.textContent = `fps: ${Math.round(1000 / delta_time)}`;

  // move camera
  const camera_forward = move_direction_norm.clone();
  camera_forward.applyQuaternion(camera.quaternion);
  camera.position.add(camera_forward.multiplyScalar(0.025));

  camera_controls.update(delta_time);

  prev = now;
}

$("#controls_submission").click(function (e) { 
  e.preventDefault();
  camera_controls.lock();
});

camera_controls.addEventListener("lock", function() {
  $("#controls_submission").hide();
  $(document).keyup(handle_keyup);
  $(document).keydown(handle_keydown);
});

camera_controls.addEventListener("unlock", function() {
  $("#controls_submission").show();
  $(document).unbind("keyup");
  $(document).unbind("keydown");
});



renderer.setAnimationLoop(animate);