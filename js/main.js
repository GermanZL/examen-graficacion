import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';

let camera, scene, renderer, stats, mixer, character;
const clock = new THREE.Clock();
const assets = ['Idle', 'Walking', 'animacion1', 'animacion2', 'animacion3', 'animacion4'];
const actions = {};
const params = { action: 'Idle' };
const keys = {
    'W': false, 'A': false, 'S': false, 'D': false, 'Z': false, 'X': false, 'C': false, 'V': false, 'B': false, 'N': false, 'O': false, 'P': false  
};

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

const groundMaterial = new CANNON.Material('groundMaterial');
const characterMaterial = new CANNON.Material('characterMaterial');
const contactMaterial = new CANNON.ContactMaterial(groundMaterial, characterMaterial, {
    friction: 0.4,
    restitution: 0.3,
});
world.addContactMaterial(contactMaterial);

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(100, 200, 300);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xda21ff);
    scene.fog = new THREE.Fog(0xcf34eb, 150, 1000);

    const hemiLight = new THREE.HemisphereLight(0x21a6ff, 0x444444, 5);
    hemiLight.position.set(22, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 5);
    dirLight.position.set(0, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 900;
    dirLight.shadow.camera.bottom = -900;
    dirLight.shadow.camera.left = -900;
    dirLight.shadow.camera.right = 900;
    scene.add(dirLight);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.MeshPhongMaterial({ color: 0x25ff21, depthWrite: false })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(2000, 20, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add(grid);

    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    const numSpheres = Math.floor(Math.random() * 36) + 30;
    const sphereRadius = 40;

    for (let i = 0; i < numSpheres; i++) {
        const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 32, 32);
        const sphereColor = new THREE.Color(0x474747, Math.random(), 0x474747);
        const sphereMaterial = new THREE.MeshPhongMaterial({ color: sphereColor });

        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

        sphere.position.x = Math.random() * 1800 - 900;
        sphere.position.z = Math.random() * 1800 - 900;
        sphere.position.y = sphereRadius;

        sphere.castShadow = true;
        sphere.receiveShadow = true;

        scene.add(sphere);

        const sphereShape = new CANNON.Sphere(sphereRadius);
        const sphereBody = new CANNON.Body({ mass: 1 });
        sphereBody.addShape(sphereShape);
        sphereBody.position.set(sphere.position.x, sphere.position.y, sphere.position.z);

        world.addBody(sphereBody);

        sphere.userData.physicsBody = sphereBody;
    }

    const loader = new FBXLoader();
    loader.load('models/fbx/character.fbx', function (object) {  // Cambio a character.fbx
        mixer = new THREE.AnimationMixer(object);
        character = object;

        const characterShape = new CANNON.Box(new CANNON.Vec3(15, 15, 15));
        const characterBody = new CANNON.Body({ mass: 1, material: characterMaterial });
        characterBody.addShape(characterShape);
        characterBody.position.set(0, 15, 0);

        characterBody.fixedRotation = true;
        characterBody.updateMassProperties();

        world.addBody(characterBody);

        character.userData.physicsBody = characterBody;

        assets.forEach(asset => {
            loader.load(`models/fbx/${asset}.fbx`, function (anim) {
                const action = mixer.clipAction(anim.animations[0]);
                actions[asset] = action;
                if (asset === 'animacion2') {
                    action.play();
                }
            }, undefined, function (error) {
                console.error(`Error loading ${asset}:`, error);
            });
        });

        object.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        scene.add(object);
    }, undefined, function (error) {
        console.error('Error loading character:', error);
    });

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 100, 0);
    controls.update();

    window.addEventListener('resize', onWindowResize);

    stats = new Stats();
    container.appendChild(stats.dom);

    const gui = new GUI();
    gui.add(params, 'action', assets).onChange(function (value) {
        if (actions[params.action]) {
            actions[params.action].stop();
        }
        params.action = value;
        if (actions[params.action]) {
            actions[params.action].play();
        }
    });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    world.step(1 / 60);

    scene.traverse(function (object) {
        if (object.userData.physicsBody) {
            object.position.copy(object.userData.physicsBody.position);
            object.quaternion.copy(object.userData.physicsBody.quaternion);
        }
    });

    if (character) updateCharacterMovement();
    updateCameraPosition();

    renderer.render(scene, camera);
    stats.update();
}

function updateCharacterMovement() {
    const moveDistance = 2;
    const characterBody = character.userData.physicsBody;

    if (keys['S']) {
        characterBody.position.z -= moveDistance;
    }
    if (keys['W']) {
        characterBody.position.z += moveDistance;
    }
    if (keys['D']) {
        characterBody.position.x -= moveDistance;
    }
    if (keys['A']) {
        characterBody.position.x += moveDistance;
    }
}

function updateCameraPosition() {
    const moveDistance = 5;

    if (keys['O']) {
        camera.position.x += moveDistance;
    }
    if (keys['P']) {
        camera.position.x -= moveDistance;
    }
}

function onKeyDown(event) {
    switch (event.key) {
        case 'Z':
            keys[event.key] = true;
            changeAnimation(assets[0]);
            break;
        case 'X':
            keys[event.key] = true;
            changeAnimation(assets[1]);
            break;
        case 'C':
            keys[event.key] = true;
            changeAnimation(assets[2]);
            break;
        case 'V':
            keys[event.key] = true;
            changeAnimation(assets[3]);
            break;
            case 'B':
                keys[event.key] = true;
                changeAnimation(assets[4]);
                break;
            case 'N':
                keys[event.key] = true;
                changeAnimation(assets[5]);
                break;
            case 'S':
            case 'D':
            case 'W':
            case 'A':
            case 'O':
            case 'P':
                keys[event.key] = true;
                break;
        }
    }
    
    function onKeyUp(event) {
        switch (event.key) {
            case 'Z':
            case 'X':
            case 'C':
            case 'V':
            case 'B':
            case 'N':
            case 'S':
            case 'D':
            case 'W':
            case 'A':
            case 'O':
            case 'P':
                keys[event.key] = false;
                break;
        }
    }
    
    function changeAnimation(actionName) {
        if (params.action !== actionName) {
            if (actions[params.action]) {
                actions[params.action].stop();
            }
            params.action = actionName;
            if (actions[params.action]) {
                actions[params.action].play();
            }
        }
    }
    
    init();
    animate();
    