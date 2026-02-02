import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './style.css';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// ============================================================================
// IMMEDIATE MESSAGE HIDING - Run before page fully loads
// ============================================================================
// Use GSAP to set opacity to 0 immediately when DOM is ready
function hideMessagesWithGSAP() {
    const messages = ['#message-1 .hero-message', '#message-2 .hero-message', '#message-3 .hero-message', '#message-4 .hero-message'];
    gsap.set(messages, {
        opacity: 0,
        y: 100,
        visibility: 'visible', // Ensure visible so GSAP can control opacity
        immediateRender: true // Apply immediately, don't wait for animation
    });
}

// Run immediately if DOM is ready, otherwise wait for DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideMessagesWithGSAP);
} else {
    hideMessagesWithGSAP();
}

// ============================================================================
// SCROLL RESTORATION PREVENTION
// Prevents browser from restoring scroll position on reload, which causes
// ScrollTrigger initialization issues (gaps, visual glitches)
// ============================================================================

if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// Force scroll to top immediately on page load
window.scrollTo(0, 0);

// ============================================================================
// THREE.JS SETUP
// ============================================================================

const scene = new THREE.Scene();
scene.background = null;

const container = document.getElementById('canvas-container');
// Use viewport dimensions directly for fixed-position elements
// container.clientWidth can return incorrect values when ScrollTrigger manipulates DOM
let width = window.innerWidth;
let height = window.innerHeight;

const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 400);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(width, height);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x000000, 0);
container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);

const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
directionalLight1.position.set(0, 5, 5);
directionalLight1.castShadow = true;
scene.add(directionalLight1);

const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
directionalLight2.position.set(-5, 5, -5);
scene.add(directionalLight2);

// Texture loading
const textureLoader = new THREE.TextureLoader();
const textures = {};
const textureFiles = ['texture-1.jpg', 'texture-2.jpg', 'texture-3.jpg', 'texture-4.jpg', 'texture-5.jpg'];
let texturesLoaded = 0;
let currentTextureName = null;

// Cross-fade shader material for smooth texture transitions
let screenMaterial = null;
let isTransitioning = false;

// Simple cross-fade shader (no Three.js includes to avoid conflicts)
const crossFadeVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const crossFadeFragmentShader = `
    uniform sampler2D map1;
    uniform sampler2D map2;
    uniform float mixFactor;
    varying vec2 vUv;
    
    void main() {
        // Only flip Y axis
        vec2 flippedUv = vec2(vUv.x, 1.0 - vUv.y);
        
        vec4 color1 = texture2D(map1, flippedUv);
        vec4 color2 = texture2D(map2, flippedUv);
        
        // Blend colors and force alpha to 1.0 (fully opaque)
        vec3 finalColor = mix(color1.rgb, color2.rgb, mixFactor);
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

function createScreenMaterial(texture) {
    const material = new THREE.ShaderMaterial({
        uniforms: {
            map1: { value: texture },
            map2: { value: texture },
            mixFactor: { value: 0.0 }
        },
        vertexShader: crossFadeVertexShader,
        fragmentShader: crossFadeFragmentShader,
        transparent: false,
        depthWrite: true,
        depthTest: true,
        side: THREE.DoubleSide,
        toneMapped: false  // Bypass Three.js color processing
    });
    material._isScreenMaterial = true;
    return material;
}

textureFiles.forEach((filename) => {
    const texture = textureLoader.load(
        `/laptop.fbm/${filename}`,
        (loadedTexture) => {
            loadedTexture.flipY = false;
            loadedTexture.colorSpace = THREE.NoColorSpace;  // Pass colors through exactly as-is
            loadedTexture.needsUpdate = true;
            texturesLoaded++;
            console.log(`Texture loaded: ${filename} (${texturesLoaded}/${textureFiles.length})`);

            // Apply first texture when it loads and model is ready
            if (model && texturesLoaded === 1) {
                console.log('Model ready, applying first texture:', filename);
                applyTextureToMaterials(model, filename);
                currentTextureName = filename;
            }
        },
        undefined,
        (error) => console.error(`Error loading texture ${filename}:`, error)
    );
    textures[filename] = texture;
});

// Store reference to the screen mesh for direct texture application
let screenMesh = null;

function applyTextureToMaterials(object, textureName) {
    if (!textures[textureName]) {
        console.warn('Texture not found:', textureName);
        return;
    }
    const targetTexture = textures[textureName];
    if (!targetTexture.image) {
        console.warn('Texture image not loaded yet:', textureName);
        return;
    }

    object.traverse((child) => {
        if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material, materialIndex) => {
                if (material) {
                    const materialName = (material.name || '').toLowerCase();
                    const meshName = (child.name || '').toLowerCase();
                    
                    // Check if this is the display/screen material using flexible matching
                    const isDisplayGlass = materialName.includes('display') || 
                        materialName.includes('screen') || 
                        materialName.includes('glass') ||
                        materialName.includes('lcd') ||
                        meshName.includes('display') ||
                        meshName.includes('screen') ||
                        meshName.includes('glass') ||
                        meshName.includes('lcd') ||
                        material._isScreenMaterial; // Our marker

                    if (isDisplayGlass) {
                        screenMesh = child; // Store reference
                        console.log('Applying texture to screen:', textureName);
                        
                        // Update existing shader material or create new one
                        if (material._isScreenMaterial && material.uniforms) {
                            // Instant swap - set both textures to target
                            material.uniforms.map1.value = targetTexture;
                            material.uniforms.map2.value = targetTexture;
                            material.uniforms.mixFactor.value = 0.0;
                        } else {
                            screenMaterial = createScreenMaterial(targetTexture);

                            if (Array.isArray(child.material)) {
                                child.material[materialIndex] = screenMaterial;
                            } else {
                                child.material = screenMaterial;
                            }
                        }
                    }
                }
            });
        }
    });
}

/**
 * Smoothly transition to a new texture using cross-fade
 * @param {string} textureName - Name of the target texture
 * @param {number} duration - Transition duration in seconds (default 0.4)
 */
function transitionToTexture(textureName, duration = 0.4) {
    if (!textures[textureName]) return;
    if (!textures[textureName].image) return;
    if (!screenMaterial || !screenMaterial.uniforms) {
        // Fallback: try to apply directly
        if (model) applyTextureToMaterials(model, textureName);
        return;
    }
    
    const targetTexture = textures[textureName];
    const uniforms = screenMaterial.uniforms;
    
    // If already showing this texture and not transitioning, skip
    if (uniforms.map1.value === targetTexture && uniforms.mixFactor.value === 0 && !isTransitioning) {
        return;
    }
    
    // If transitioning to the same target, skip
    if (isTransitioning && uniforms.map2.value === targetTexture) {
        return;
    }

    // Kill any existing transition
    gsap.killTweensOf(uniforms.mixFactor);

    // If we're mid-transition, figure out current state
    const currentMix = uniforms.mixFactor.value;
    if (currentMix > 0.5) {
        // More than halfway - treat map2 as current
        uniforms.map1.value = uniforms.map2.value;
        uniforms.mixFactor.value = 0;
    } else if (currentMix > 0) {
        // Less than halfway - reset to map1
        uniforms.mixFactor.value = 0;
    }

    // Set up new transition
    uniforms.map2.value = targetTexture;
    isTransitioning = true;

    gsap.to(uniforms.mixFactor, {
        value: 1.0,
        duration: duration,
        ease: 'power2.inOut',
        onComplete: () => {
            // Swap textures so map1 is the current texture
            uniforms.map1.value = targetTexture;
            uniforms.map2.value = targetTexture;
            uniforms.mixFactor.value = 0;
            isTransitioning = false;
        }
    });
}

// Load FBX model
const loader = new FBXLoader();
const loadingManager = new THREE.LoadingManager();
loadingManager.setURLModifier((url) => {
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg')) {
        return '/laptop.fbm/' + url.split('/').pop();
    }
    return url;
});
loader.manager = loadingManager;

let model = null;
const modelGroup = new THREE.Group();
scene.add(modelGroup);

loader.load(
    '/laptop.fbx',
    (object) => {
        model = object;

        // Debug: Log all mesh and material names to find the screen
        console.log('=== FBX Model Structure ===');
        object.traverse((child) => {
            if (child.isMesh) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                console.log(`Mesh: "${child.name}"`, materials.map(m => `Material: "${m?.name}" (${m?.type})`));
            }
        });

        // First, ensure the display glass material is not transparent
        // This must happen before texture application to fix the transparent screen issue
        object.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((material, materialIndex) => {
                    if (material) {
                        const materialName = (material.name || '').toLowerCase();
                        const meshName = (child.name || '').toLowerCase();
                        
                        // Check if this is the display/screen material by various patterns
                        const isScreen = materialName.includes('display') || 
                            materialName.includes('screen') || 
                            materialName.includes('glass') ||
                            materialName.includes('lcd') ||
                            materialName.includes('monitor') ||
                            meshName.includes('display') ||
                            meshName.includes('screen') ||
                            meshName.includes('glass') ||
                            meshName.includes('lcd') ||
                            meshName.includes('monitor') ||
                            // Check if material is transparent (glass materials often are)
                            (material.transparent === true && material.opacity < 1);
                        
                        if (isScreen) {
                            console.log(`Found screen: Mesh="${child.name}", Material="${material.name}"`);
                            screenMesh = child;
                            
                            // Create a base opaque material for the screen
                            // This will be replaced by the cross-fade material when textures load
                            const baseMaterial = new THREE.MeshBasicMaterial({
                                color: 0x111111, // Dark gray placeholder (visible)
                                transparent: false,
                                opacity: 1.0,
                                side: THREE.DoubleSide
                            });
                            baseMaterial.name = 'Display Glass';
                            baseMaterial._isScreenMaterial = true;
                            
                            if (Array.isArray(child.material)) {
                                child.material[materialIndex] = baseMaterial;
                            } else {
                                child.material = baseMaterial;
                            }
                        }
                    }
                });
            }
        });

        // Apply texture if already loaded
        if (texturesLoaded > 0) {
            const textureName = textures['texture-1.jpg'] ? 'texture-1.jpg' : Object.keys(textures)[0];
            console.log('Applying initial texture:', textureName);
            applyTextureToMaterials(object, textureName);
            currentTextureName = textureName;
        }

        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 8 / maxDim;
        object.scale.multiplyScalar(scale);

        object.position.x = -center.x * scale;
        object.position.y = -center.y * scale;
        object.position.z = -center.z * scale;

        modelGroup.add(object);
    },
    (progress) => console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%'),
    (error) => console.error('Error loading FBX:', error)
);

// ============================================================================
// LENIS SMOOTH SCROLL
// ============================================================================

const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true,
    smoothTouch: false,
    touchMultiplier: 2,
});

// Reset Lenis scroll position to top immediately
lenis.scrollTo(0, { immediate: true });

// Connect Lenis to GSAP ScrollTrigger
lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

// ============================================================================
// CAMERA BREAKPOINTS
// Only configuration needed - camera positions vary by viewport width
// All other animation values are directly in GSAP calls
// ============================================================================

const CAMERA_BREAKPOINTS = {
    // Mobile: max-width 768px
    768: {
        initial:  { rotation: Math.PI / 2, zoom: 15, elevation: 4, lookAtX: 0, lookAtY: 3 },
        message1: { rotation: Math.PI / 2, zoom: 14, elevation: 6.5, lookAtX: 0, lookAtY: 3.5 },
        message2: { rotation: Math.PI / 2, zoom: 13, elevation: 7, lookAtX: 0, lookAtY: 2.5 },
        message3: { rotation: Math.PI / 2, zoom: 12, elevation: 4, lookAtX: 0, lookAtY: 2.5 },
        message4: { rotation: Math.PI / 2, zoom: 11, elevation: 4, lookAtX: 0, lookAtY: 3 }
    },

    // Tablet: max-width 960px
    960: {
        initial:  { rotation: Math.PI / 2, zoom: 10, elevation: 4, lookAtX: 0, lookAtY: 3 },
        message1: { rotation: Math.PI / 2 - 0.3, zoom: 16, elevation: 6.5, lookAtX: 0.5, lookAtY: 3.5 },
        message2: { rotation: Math.PI / 2, zoom: 13, elevation: 6, lookAtX: 0, lookAtY: 3 },
        message3: { rotation: Math.PI / 2, zoom: 12, elevation: 4, lookAtX: 0, lookAtY: 2.5 },
        message4: { rotation: Math.PI / 2, zoom: 11, elevation: 4, lookAtX: 0, lookAtY: 3 }
    },

    // Small desktop: max-width 1080px
    1080: {
        initial:  { rotation: Math.PI / 2, zoom: 8, elevation: 4, lookAtX: 0, lookAtY: 3 },
        message1: { rotation: Math.PI / 2 - 0.4, zoom: 10, elevation: 2.5, lookAtX: -2, lookAtY: 0.5 },
        message2: { rotation: Math.PI / 2 + 0.4, zoom: 9, elevation: 2.5, lookAtX: 2, lookAtY: 0.5 },
        message3: { rotation: Math.PI / 2 - 0.4, zoom: 9, elevation: 2.5, lookAtX: -2, lookAtY: 0.5 },
        message4: { rotation: Math.PI / 2 - 0.4, zoom: 12, elevation: 2.5, lookAtX: -3, lookAtY: 0.5 }
    },

    // Medium desktop: max-width 1280px
    1280: {
        initial:  { rotation: Math.PI / 2, zoom: 7, elevation: 4, lookAtX: 0, lookAtY: 3 },
        message1: { rotation: Math.PI / 2 - 0.4, zoom: 9, elevation: 2.5, lookAtX: -2, lookAtY: 0.5 },
        message2: { rotation: Math.PI / 2 + 0.4, zoom: 9, elevation: 2.5, lookAtX: 2, lookAtY: 0.5 },
        message3: { rotation: Math.PI / 2 - 0.4, zoom: 9, elevation: 2.5, lookAtX: -2, lookAtY: 0.5 },
        message4: { rotation: Math.PI / 2 - 0.4, zoom: 12, elevation: 2.5, lookAtX: -3, lookAtY: 0.5 }
    },

    // Large desktop: > 1280px (9999 = infinity)
    9999: {
        initial:  { rotation: Math.PI / 2, zoom: 5, elevation: 4, lookAtX: 0, lookAtY: 3 },
        message1: { rotation: Math.PI / 2 - 0.4, zoom: 10, elevation: 2, lookAtX: -1, lookAtY: 0.3 },
        message2: { rotation: Math.PI - 1, zoom: 10, elevation: 2, lookAtX: 1, lookAtY: 0.3 },
        message3: { rotation: Math.PI / 2 - 0.4, zoom: 10, elevation: 2, lookAtX: -1, lookAtY: 0.3 },
        message4: { rotation: 1.256, zoom: 12, elevation: 2.5, lookAtX: -2.2, lookAtY: 0.66 }
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get camera keyframes for current viewport width
 */
function getCameraForViewport() {
    const width = window.innerWidth;
    const breakpoints = Object.keys(CAMERA_BREAKPOINTS).map(Number).sort((a, b) => a - b);
    
    for (const bp of breakpoints) {
        if (width <= bp) return CAMERA_BREAKPOINTS[bp];
    }
    return CAMERA_BREAKPOINTS[breakpoints[breakpoints.length - 1]];
}

// Current camera keyframes (updated on init and resize)
let CAM = getCameraForViewport();

// ============================================================================
// CAMERA STATE (controlled by GSAP)
// Initialized from CAMERA_BREAKPOINTS for correct values from first frame
// ============================================================================

const cameraState = {
    ...getCameraForViewport().initial,
    texture: 'texture-1.jpg'
};

function updateCameraFromState() {
    camera.position.x = Math.cos(cameraState.rotation) * cameraState.zoom;
    camera.position.z = Math.sin(cameraState.rotation) * cameraState.zoom;
    camera.position.y = cameraState.elevation;
    camera.lookAt(cameraState.lookAtX, cameraState.lookAtY, 0);

    // Handle texture changes
    if (model && cameraState.texture !== currentTextureName) {
        currentTextureName = cameraState.texture;
        applyTextureToMaterials(model, cameraState.texture);
    }
}

// ============================================================================
// HERO CONTENT ANIMATIONS
// Header and initial content fade out
// ============================================================================

function initHeroContent() {
    // Hero header fades out
    gsap.fromTo('#hero-header',
        { opacity: 1, y: 0 },
        {
            opacity: 0,
            y: -50,
            ease: 'none',
            scrollTrigger: {
                trigger: '.hero-section',
                start: 'top top',
                end: '8% top',
                scrub: true
            }
        }
    );

    // Hero content fades out
    gsap.fromTo('#hero-content',
        { opacity: 1, y: 0 },
        {
            opacity: 0,
            y: 50,
            ease: 'none',
            scrollTrigger: {
                trigger: '.hero-section',
                start: 'top top',
                end: '5% top',
                scrub: true
            }
        }
    );
}

// ============================================================================
// MESSAGE 1 ANIMATIONS
// Texture: texture-1.jpg → texture-2.jpg
// Gradient: Purple (stays)
// ============================================================================

function initMessage1() {
    const trigger = '#message-1';
    const message = '#message-1 .hero-message';

    // Initial state
    gsap.set(message, { opacity: 0, y: 50, visibility: 'visible' });

    // Texture change
    ScrollTrigger.create({
        trigger,
        start: 'top 80%',
        onEnter: () => transitionToTexture('texture-2.jpg', 0.5),
        onLeaveBack: () => transitionToTexture('texture-1.jpg', 0.5)
    });

    // Camera animation: initial → message1
    gsap.fromTo(cameraState,
        { ...CAM.initial },
        {
            ...CAM.message1,
            ease: 'none',
            immediateRender: false,
            scrollTrigger: {
                trigger,
                start: 'top 65%',
                end: 'top 20%',
                scrub: true,
                onUpdate: updateCameraFromState
            }
        }
    );

    // Message fade in
    gsap.fromTo(message,
        { opacity: 0, y: 50 },
        {
            opacity: 1,
            y: 0,
            ease: 'none',
            scrollTrigger: {
                trigger,
                start: 'top 80%',
                end: 'top 40%',
                scrub: true
            }
        }
    );

    // Message fade out
    gsap.to(message, {
        opacity: 0,
        y: -50,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: {
            trigger,
            start: 'bottom 60%',
            end: 'bottom 20%',
            scrub: true
        }
    });
}

// ============================================================================
// MESSAGE 2 ANIMATIONS
// Texture: texture-2.jpg → texture-3.jpg
// Gradient: Purple → Teal
// ============================================================================

function initMessage2() {
    const trigger = '#message-2';
    const message = '#message-2 .hero-message';
    const gradient = document.querySelector('.hero-gradient-teal');

    // Initial state
    gsap.set(message, { opacity: 0, y: 50, visibility: 'visible' });

    // Texture change
    ScrollTrigger.create({
        trigger,
        start: 'top 60%',
        onEnter: () => transitionToTexture('texture-3.jpg', 0.5),
        onLeaveBack: () => transitionToTexture('texture-2.jpg', 0.5)
    });

    // Camera animation: message1 → message2
    gsap.fromTo(cameraState,
        { ...CAM.message1 },
        {
            ...CAM.message2,
            ease: 'none',
            immediateRender: false,
            scrollTrigger: {
                trigger,
                start: 'top 80%',
                end: 'top 20%',
                scrub: true,
                onUpdate: updateCameraFromState
            }
        }
    );

    // Gradient: Teal fades in
    if (gradient) {
        gsap.to(gradient, {
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
                trigger,
                start: 'top 70%',
                end: 'top 30%',
                scrub: true
            }
        });
    }

    // Message fade in
    gsap.fromTo(message,
        { opacity: 0, y: 50 },
        {
            opacity: 1,
            y: 0,
            ease: 'none',
            scrollTrigger: {
                trigger,
                start: 'top 80%',
                end: 'top 40%',
                scrub: true
            }
        }
    );

    // Message fade out
    gsap.to(message, {
        opacity: 0,
        y: -30,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: {
            trigger,
            start: 'bottom 60%',
            end: 'bottom 20%',
            scrub: true
        }
    });
}

// ============================================================================
// MESSAGE 3 ANIMATIONS
// Texture: texture-3.jpg → texture-4.jpg
// Gradient: Teal (stays)
// ============================================================================

function initMessage3() {
    const trigger = '#message-3';
    const message = '#message-3 .hero-message';

    // Initial state
    gsap.set(message, { opacity: 0, y: 50, visibility: 'visible' });

    // Texture change
    ScrollTrigger.create({
        trigger,
        start: 'top 60%',
        onEnter: () => transitionToTexture('texture-4.jpg', 0.5),
        onLeaveBack: () => transitionToTexture('texture-3.jpg', 0.5)
    });

    // Camera animation: message2 → message3
    gsap.fromTo(cameraState,
        { ...CAM.message2 },
        {
            ...CAM.message3,
            ease: 'none',
            immediateRender: false,
            scrollTrigger: {
                trigger,
                start: 'top 80%',
                end: 'top 20%',
                scrub: true,
                onUpdate: updateCameraFromState
            }
        }
    );

    // Message fade in
    gsap.fromTo(message,
        { opacity: 0, y: 50 },
        {
            opacity: 1,
            y: 0,
            ease: 'none',
            scrollTrigger: {
                trigger,
                start: 'top 80%',
                end: 'top 40%',
                scrub: true
            }
        }
    );

    // Message fade out
    gsap.to(message, {
        opacity: 0,
        y: -30,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: {
            trigger,
            start: 'bottom 60%',
            end: 'bottom 20%',
            scrub: true
        }
    });
}

// ============================================================================
// MESSAGE 4 ANIMATIONS
// Texture: texture-4.jpg → texture-5.jpg
// Gradient: Teal → Purple
// ============================================================================

function initMessage4() {
    const trigger = '#message-4';
    const message = '#message-4 .hero-message';
    const gradient = document.querySelector('.hero-gradient-teal');

    // Initial state
    gsap.set(message, { opacity: 0, y: 50, visibility: 'visible' });

    // Texture change
    ScrollTrigger.create({
        trigger,
        start: 'top 60%',
        onEnter: () => transitionToTexture('texture-5.jpg', 0.5),
        onLeaveBack: () => transitionToTexture('texture-4.jpg', 0.5)
    });

    // Camera animation: message3 → message4
    gsap.fromTo(cameraState,
        { ...CAM.message3 },
        {
            ...CAM.message4,
            ease: 'none',
            immediateRender: false,
            scrollTrigger: {
                trigger,
                start: 'top 80%',
                end: 'top 20%',
                scrub: true,
                onUpdate: updateCameraFromState
            }
        }
    );

    // Gradient: Teal fades out (back to purple)
    if (gradient) {
        gsap.to(gradient, {
            opacity: 0,
            ease: 'none',
            scrollTrigger: {
                trigger,
                start: 'top 70%',
                end: 'top 30%',
                scrub: true
            }
        });
    }

    // Message fade in (stays visible - no fade out)
    gsap.fromTo(message,
        { opacity: 0, y: 50 },
        {
            opacity: 1,
            y: 0,
            ease: 'none',
            scrollTrigger: {
                trigger,
                start: 'top 80%',
                end: 'top 40%',
                scrub: true
            }
        }
    );
}

// ============================================================================
// HERO ANIMATIONS ORCHESTRATOR
// Initializes all hero section animations
// ============================================================================

function initHeroAnimations() {
    // Get camera keyframes for current viewport
    CAM = getCameraForViewport();
    
    // Set initial camera state and apply immediately
    Object.assign(cameraState, CAM.initial);
    updateCameraFromState();
    
    // Set initial gradient state
    const tealGradient = document.querySelector('.hero-gradient-teal');
    if (tealGradient) {
        gsap.set(tealGradient, { opacity: 0 });
    }

    // Initialize all animations
    initHeroContent();
    initMessage1();
    initMessage2();
    initMessage3();
    initMessage4();
}

function initHeroFreezing() {
    // Use GSAP's native pin feature instead of manual CSS manipulation
    ScrollTrigger.create({
        trigger: '.hero-section',
        start: 'bottom bottom',
        endTrigger: '#aum-section',
        end: 'top top',
        pin: true,
        pinSpacing: false
    });

    // Fade out the 3D model only when AUM section covers the viewport
    // The model is position:fixed, so it stays in place - we fade it as next section comes in
    gsap.to('.model-section', {
        // opacity: 0,
        ease: 'none',
        scrollTrigger: {
            trigger: '#aum-section',
            start: 'top bottom',         // When AUM section enters viewport
            end: 'top 70%',              // Quickly fade out
            scrub: true
        }
    });
}

function initScaleAnimations() {
    // AUM section - scales down as it enters viewport

    gsap.fromTo('#aum-text',
        {
            y: -100
        },
        {
            y: 0,
            ease: 'none',
            scrollTrigger: {
                trigger: '#aum-section',
                start: 'top bottom',     // When section top hits viewport bottom
                end: 'top top',          // When section top is 20% down viewport
                scrub: true
            }
        }
    );

    gsap.fromTo('#aum-video',
        {
            y: -100
        },
        {
            y: 0,
            ease: 'none',
            scrollTrigger: {
                trigger: '#aum-section',
                start: 'top bottom',     // When section top hits viewport bottom
                end: 'top 20%',          // When section top is 20% down viewport
                scrub: true
            }
        }
    );

    gsap.fromTo('#aum-text',
        {
            y: 0
        },
        {
            y: 300,
            ease: 'none',
            scrollTrigger: {
                trigger: '#aum-section',
                start: 'top top',     // When section top hits viewport bottom
                end: 'bottom top',          // When section top is 20% down viewport
                scrub: true
            }
        }
    );

    gsap.fromTo('#aum-video',
        {
            y: 0
        },
        {
            y: 300,
            ease: 'none',
            scrollTrigger: {
                trigger: '#aum-section',
                start: 'top top',     // When section top hits viewport bottom
                end: 'bottom top',          // When section top is 20% down viewport
                scrub: true
            }
        }
    );
}

function initLogoScroll() {
    gsap.fromTo('#logo-scroll-container',
        { x: 0 },
        {
            x: -500,
            ease: 'none',
            scrollTrigger: {
                trigger: '#logo-scroll-container',
                start: 'top bottom',
                end: 'bottom top',
                scrub: true
            }
        });
}

function initStickyImageSection() {
    const stickyImage = document.getElementById('sticky-section-image');
    const messageTriggers = document.querySelectorAll('.message-trigger');

    if (!stickyImage || messageTriggers.length === 0) return;

    messageTriggers.forEach((trigger) => {
        const imageSrc = trigger.getAttribute('data-image');

        ScrollTrigger.create({
            trigger: trigger,
            start: 'top center',
            end: 'bottom center',
            onEnter: () => {
                if (imageSrc) stickyImage.src = imageSrc;
            },
            onEnterBack: () => {
                if (imageSrc) stickyImage.src = imageSrc;
            }
        });
    });
}

function initQuoteAnimation() {
    const quoteElement = document.getElementById('quote');
    if (!quoteElement) return;

    // Check if already initialized
    if (quoteElement.querySelector('.quote-word')) return;

    const text = quoteElement.textContent;
    const parts = text.split(/(\s+)/);

    quoteElement.innerHTML = '';
    const wordSpans = [];

    parts.forEach(part => {
        if (part.trim().length === 0) {
            quoteElement.appendChild(document.createTextNode(part));
        } else {
            const span = document.createElement('span');
            span.className = 'quote-word';
            span.textContent = part;
            span.style.color = 'rgb(148, 163, 184)'; // Initial gray (slate-400)
            span.style.transition = 'color 0.4s ease-out';
            quoteElement.appendChild(span);
            wordSpans.push(span);
        }
    });

    // Animate words one by one based on scroll
    const parentSection = quoteElement.closest('section');
    if (parentSection && wordSpans.length > 0) {
        wordSpans.forEach((span, index) => {
            // Each word triggers at a specific scroll position
            const progress = index / wordSpans.length;
            const startPercent = progress * 60 + 30; // Spread from 10% to 70%

            ScrollTrigger.create({
                trigger: parentSection,
                start: `top+=${startPercent}% bottom`,
                onEnter: () => {
                    span.style.color = 'rgb(15, 23, 42)'; // Black (slate-900)
                },
                onLeaveBack: () => {
                    span.style.color = 'rgb(148, 163, 184)'; // Gray (slate-400)
                }
            });
        });
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    // Clear any cached scroll calculations from previous sessions
    ScrollTrigger.clearScrollMemory();

    // Reset scroll position again to ensure clean state
    window.scrollTo(0, 0);
    lenis.scrollTo(0, { immediate: true });

    // Small delay to ensure DOM has fully reflowed after scroll reset
    requestAnimationFrame(() => {
        initHeroAnimations();  // Per-message ScrollTriggers for camera, messages, gradients
        initScaleAnimations();
        initHeroFreezing();
        initLogoScroll();
        initStickyImageSection();
        initQuoteAnimation();

        // Force ScrollTrigger to recalculate after all animations are set up
        ScrollTrigger.refresh(true);
    });
}

// Wait for full page load (images, fonts, etc.) before initializing ScrollTrigger
// This ensures accurate measurements for pinning and scroll calculations
window.addEventListener('load', () => {
    // Additional small delay to ensure everything is painted
    setTimeout(init, 100);
});

// ============================================================================
// RESIZE HANDLING
// ============================================================================

let resizeTimeout;
let lastBreakpoint = null;

/**
 * Get the current breakpoint based on viewport width
 */
function getCurrentBreakpoint() {
    const width = window.innerWidth;
    const breakpoints = Object.keys(CAMERA_BREAKPOINTS)
        .map(Number)
        .sort((a, b) => a - b);

    for (const bp of breakpoints) {
        if (width <= bp) {
            return bp;
        }
    }
    return breakpoints[breakpoints.length - 1];
}

function onWindowResize() {
    // Debounce resize to prevent rapid recalculations
    clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(() => {
        // Use viewport dimensions directly - container dimensions can be
        // corrupted by ScrollTrigger pin calculations
        width = window.innerWidth;
        height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);

        // Check if breakpoint changed
        const currentBreakpoint = getCurrentBreakpoint();
        const breakpointChanged = lastBreakpoint !== null && lastBreakpoint !== currentBreakpoint;
        lastBreakpoint = currentBreakpoint;

        if (breakpointChanged) {
            // Breakpoint changed - reinitialize hero animations with new keyframes
            // Kill all hero-related ScrollTriggers to prevent duplicates
            const heroTriggers = ['.hero-section', '#message-1', '#message-2', '#message-3', '#message-4'];
            ScrollTrigger.getAll().forEach(st => {
                const trigger = st.vars.trigger;
                if (heroTriggers.some(sel => 
                    trigger === sel || 
                    trigger === document.querySelector(sel) ||
                    (typeof trigger === 'string' && trigger.includes('message'))
                )) {
                    st.kill();
                }
            });

            // Reinitialize with new keyframes
            initHeroAnimations();
        }

        // Force complete ScrollTrigger recalculation
        ScrollTrigger.refresh(true);
    }, 150);
}

// Initialize lastBreakpoint
lastBreakpoint = getCurrentBreakpoint();

window.addEventListener('resize', onWindowResize);

// ============================================================================
// ANIMATION LOOP
// ============================================================================

function animate() {
    requestAnimationFrame(animate);
    updateCameraFromState();
    renderer.render(scene, camera);
}

animate();
