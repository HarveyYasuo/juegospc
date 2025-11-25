import * as THREE from 'three';

// Scene Setup
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050505, 0.02);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft white light
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0x00ffff, 3, 100);
pointLight.position.set(0, 5, 5);
scene.add(pointLight);

const pointLight2 = new THREE.PointLight(0xff00ff, 2, 100); // Magenta contrast
pointLight2.position.set(-5, -5, 5);
scene.add(pointLight2);

// Objects (Representing the Apps abstractly)

// Material for the "Tech" look
const geometry = new THREE.IcosahedronGeometry(1, 1);
const material = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x004444,
    emissiveIntensity: 0.2,
    wireframe: true
});

const solidMaterial = new THREE.MeshStandardMaterial({
    color: 0x00aaaa,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.8
});

// Object 1: GamesPC (Left)
const obj1Group = new THREE.Group();
const obj1Wire = new THREE.Mesh(geometry, material);
const obj1Solid = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), solidMaterial);
obj1Group.add(obj1Wire);
obj1Group.add(obj1Solid);
obj1Group.position.set(-2.5, 0, 0);
scene.add(obj1Group);

// Object 2: Verificar Web (Right)
const obj2Group = new THREE.Group();
const obj2Wire = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), material);
const obj2Solid = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), solidMaterial);
obj2Group.add(obj2Wire);
obj2Group.add(obj2Solid);
obj2Group.position.set(2.5, 0, 0);
scene.add(obj2Group);

// Particles Background
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 2000;
const posArray = new Float32Array(particlesCount * 3);

for (let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 20; // Spread
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.02,
    color: 0x00ffff,
    transparent: true,
    opacity: 0.5
});

const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

// Mouse Interaction
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;

const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX);
    mouseY = (event.clientY - windowHalfY);
});

// Animation Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;

    // Rotate Objects
    obj1Group.rotation.y += 0.005;
    obj1Group.rotation.x += 0.002;

    obj2Group.rotation.y -= 0.005;
    obj2Group.rotation.x -= 0.002;

    // Float effect
    obj1Group.position.y = Math.sin(elapsedTime) * 0.2;
    obj2Group.position.y = Math.cos(elapsedTime) * 0.2;

    // Interactive Rotation based on mouse
    obj1Group.rotation.y += 0.05 * (targetX - obj1Group.rotation.y);
    obj1Group.rotation.x += 0.05 * (targetY - obj1Group.rotation.x);

    obj2Group.rotation.y += 0.05 * (targetX - obj2Group.rotation.y);
    obj2Group.rotation.x += 0.05 * (targetY - obj2Group.rotation.x);

    // Rotate Particles
    particlesMesh.rotation.y = -elapsedTime * 0.05;
    particlesMesh.rotation.x = mouseY * 0.0001;

    renderer.render(scene, camera);
}

animate();

// Resize Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Modal Logic
window.openModal = function (modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = "flex";
    // Small timeout to allow display:flex to apply before opacity transition
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = "none";
    }, 300); // Match transition duration
}

// Close modal when clicking outside
window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
        setTimeout(() => {
            event.target.style.display = "none";
        }, 300);
    }
}
