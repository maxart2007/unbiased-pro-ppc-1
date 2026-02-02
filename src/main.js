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
// CAMERA STATE (controlled by GSAP)
// ============================================================================

const cameraState = {
    rotation: Math.PI / 2,
    zoom: 5,
    elevation: 4,
    lookAtX: 0,
    lookAtY: 3,
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
// CAMERA KEYFRAME DEFINITIONS
// Breakpoint-based keyframes: keys are max-width in pixels
// The helper function selects the smallest breakpoint >= current viewport width
// ============================================================================

const CAMERA_KEYFRAMES_BY_BREAKPOINT = {
    // Mobile: max-width 768px
    // Push camera back (higher zoom values) to fit model in smaller viewport

    768: {
        initial: {
            rotation: Math.PI / 2,
            zoom: 15,
            elevation: 4,
            lookAtX: 0,
            lookAtY: 3,
            texture: 'texture-1.jpg'
        },
        message1: {
            rotation: Math.PI / 2,
            zoom: 14,
            elevation: 6.5,
            lookAtX: 0,
            lookAtY: 3.5,
            texture: 'texture-2.jpg'
        },
        message2: {
            rotation: Math.PI / 2,
            zoom: 13,
            elevation: 7,
            lookAtX: 0,
            lookAtY: 2.5,
            texture: 'texture-3.jpg'
        },
        message3: {
            rotation: Math.PI / 2,
            zoom: 12,
            elevation: 4,
            lookAtX: 0,
            lookAtY: 2.5,
            texture: 'texture-4.jpg'
        },
        message4: {
            rotation: Math.PI / 2,
            zoom: 11,
            elevation: 4,
            lookAtX: 0,
            lookAtY: 3,
            texture: 'texture-5.jpg'
        }
    },

    960: {
        initial: {
            rotation: Math.PI / 2,
            zoom: 10,
            elevation: 4,
            lookAtX: 0,
            lookAtY: 3,
            texture: 'texture-1.jpg'
        },
        message1: {
            rotation: Math.PI / 2,
            zoom: 14,
            elevation: 6.5,
            lookAtX: 0,
            lookAtY: 3.5,
            texture: 'texture-2.jpg'
        },
        message2: {
            rotation: Math.PI / 2,
            zoom: 13,
            elevation: 7,
            lookAtX: 0,
            lookAtY: 2.5,
            texture: 'texture-3.jpg'
        },
        message3: {
            rotation: Math.PI / 2,
            zoom: 12,
            elevation: 4,
            lookAtX: 0,
            lookAtY: 2.5,
            texture: 'texture-4.jpg'
        },
        message4: {
            rotation: Math.PI / 2,
            zoom: 11,
            elevation: 4,
            lookAtX: 0,
            lookAtY: 3,
            texture: 'texture-5.jpg'
        }
    },

    1080: {
        initial: {
            rotation: Math.PI / 2,
            zoom: 8,
            elevation: 4,
            lookAtX: 0,
            lookAtY: 3,
            texture: 'texture-1.jpg'
        },
        message1: {
            rotation: Math.PI / 2 - 0.4,
            zoom: 10,
            elevation: 2.5,
            lookAtX: -2,
            lookAtY: 0.5,
            texture: 'texture-2.jpg'
        },
        message2: {
            rotation: Math.PI / 2 + 0.4,
            zoom: 9,
            elevation: 2.5,
            lookAtX: 2,
            lookAtY: 0.5,
            texture: 'texture-3.jpg'
        },
        message3: {
            rotation: Math.PI / 2 - 0.4,
            zoom: 9,
            elevation: 2.5,
            lookAtX: -2,
            lookAtY: 0.5,
            texture: 'texture-4.jpg'
        },
        message4: {
            rotation: Math.PI / 2 - 0.4,
            zoom: 12,
            elevation: 2.5,
            lookAtX: -3,
            lookAtY: 0.5,
            texture: 'texture-5.jpg'
        }
    },

    1280: {
        initial: {
            rotation: Math.PI / 2,
            zoom: 7,
            elevation: 4,
            lookAtX: 0,
            lookAtY: 3,
            texture: 'texture-1.jpg'
        },
        message1: {
            rotation: Math.PI / 2 - 0.4,
            zoom: 9,
            elevation: 2.5,
            lookAtX: -2,
            lookAtY: 0.5,
            texture: 'texture-2.jpg'
        },
        message2: {
            rotation: Math.PI / 2 + 0.4,
            zoom: 9,
            elevation: 2.5,
            lookAtX: 2,
            lookAtY: 0.5,
            texture: 'texture-3.jpg'
        },
        message3: {
            rotation: Math.PI / 2 - 0.4,
            zoom: 9,
            elevation: 2.5,
            lookAtX: -2,
            lookAtY: 0.5,
            texture: 'texture-4.jpg'
        },
        message4: {
            rotation: Math.PI / 2 - 0.4,
            zoom: 12,
            elevation: 2.5,
            lookAtX: -3,
            lookAtY: 0.5,
            texture: 'texture-5.jpg'
        }
    },

    // Desktop: min-width 1280px (values optimized for 1280px+)
    // Using 9999 as "infinity" breakpoint for desktop/default
    9999: {
        initial: {
            rotation: Math.PI / 2,
            zoom: 5,
            elevation: 4,
            lookAtX: 0,
            lookAtY: 3,
            texture: 'texture-1.jpg'
        },
        message1: {
            rotation: Math.PI / 2 - 0.4,
            zoom: 10,
            elevation: 2,
            lookAtX: -1,
            lookAtY: 0.3,
            texture: 'texture-2.jpg'
        },
        message2: {
            rotation: Math.PI - 1,
            zoom: 10,
            elevation: 2,
            lookAtX: 1,
            lookAtY: 0.3,
            texture: 'texture-3.jpg'
        },
        message3: {
            rotation: Math.PI / 2 - 0.4,
            zoom: 10,
            elevation: 2,
            lookAtX: -1,
            lookAtY: 0.3,
            texture: 'texture-4.jpg'
        },
        message4: {
            rotation: 1.256,
            zoom: 12,
            elevation: 2.5,
            lookAtX: -2.2,
            lookAtY: 0.66,
            texture: 'texture-5.jpg'
        }
    }
};

/**
 * Get the appropriate keyframes for the current viewport width.
 * Finds the smallest breakpoint that is >= current width.
 */
function getKeyframesForViewport() {
    const width = window.innerWidth;
    const breakpoints = Object.keys(CAMERA_KEYFRAMES_BY_BREAKPOINT)
        .map(Number)
        .sort((a, b) => a - b);

    for (const bp of breakpoints) {
        if (width <= bp) {
            return CAMERA_KEYFRAMES_BY_BREAKPOINT[bp];
        }
    }
    // Fallback to largest breakpoint
    return CAMERA_KEYFRAMES_BY_BREAKPOINT[breakpoints[breakpoints.length - 1]];
}

// Current active keyframes (updated on init and resize)
let CAMERA_KEYFRAMES = getKeyframesForViewport();

// ============================================================================
// GSAP SCROLL ANIMATIONS
// Single timeline for camera with explicit durations for smooth bidirectional scrubbing
// ============================================================================

// Texture thresholds - texture changes at these scroll progress points
const TEXTURE_THRESHOLDS = [
    { progress: 0, texture: 'texture-1.jpg' },
    { progress: 0.08, texture: 'texture-2.jpg' },
    { progress: 0.32, texture: 'texture-3.jpg' },
    { progress: 0.5, texture: 'texture-4.jpg' },
    { progress: 0.75, texture: 'texture-5.jpg' }
];

let lastTextureIndex = 0;

function updateTextureFromProgress(progress) {
    // Find which texture should be active based on progress
    let textureIndex = 0;
    for (let i = TEXTURE_THRESHOLDS.length - 1; i >= 0; i--) {
        if (progress >= TEXTURE_THRESHOLDS[i].progress) {
            textureIndex = i;
            break;
        }
    }

    // Always update texture state based on current progress (ensures bidirectional scrolling works)
    const targetTexture = TEXTURE_THRESHOLDS[textureIndex].texture;
    if (cameraState.texture !== targetTexture) {
        cameraState.texture = targetTexture;
        lastTextureIndex = textureIndex;
        // Apply texture change with smooth crossfade
        if (model) {
            transitionToTexture(targetTexture, 0.5); // 0.5 second crossfade
            currentTextureName = targetTexture;
        }
    }
}

function initCameraAnimations() {
    const heroSection = document.querySelector('.hero-section');
    if (!heroSection) return;

    // Get keyframes for current viewport width
    CAMERA_KEYFRAMES = getKeyframesForViewport();

    // Set initial camera state explicitly
    Object.assign(cameraState, CAMERA_KEYFRAMES.initial);

    // Reset texture index tracking and apply initial texture
    lastTextureIndex = 0;

    // Single timeline with total duration of 1 (representing 0-100% scroll)
    const cameraTl = gsap.timeline({
        scrollTrigger: {
            trigger: heroSection,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.5, // Faster scrub response for smoother feel
            onUpdate: (self) => {
                updateTextureFromProgress(self.progress);
                updateCameraFromState();
            }
        }
    });

    // Timeline positions (as fraction of total timeline)
    // 0.00 → 0.15: Initial → Message 1
    // 0.15 → 0.40: Message 1 → Message 2  
    // 0.40 → 0.65: Message 2 → Message 3
    // 0.65 → 0.85: Message 3 → Message 4
    // 0.85 → 1.00: Hold at Message 4

    // Initial → Message 1 (duration: 0.15)
    cameraTl.to(cameraState, {
        duration: 0.15,
        rotation: CAMERA_KEYFRAMES.message1.rotation,
        zoom: CAMERA_KEYFRAMES.message1.zoom,
        elevation: CAMERA_KEYFRAMES.message1.elevation,
        lookAtX: CAMERA_KEYFRAMES.message1.lookAtX,
        lookAtY: CAMERA_KEYFRAMES.message1.lookAtY,
        ease: 'none'
    });

    // Message 1 → Message 2 (duration: 0.25, from 0.15 to 0.40)
    cameraTl.to(cameraState, {
        duration: 0.25,
        rotation: CAMERA_KEYFRAMES.message2.rotation,
        zoom: CAMERA_KEYFRAMES.message2.zoom,
        elevation: CAMERA_KEYFRAMES.message2.elevation,
        lookAtX: CAMERA_KEYFRAMES.message2.lookAtX,
        lookAtY: CAMERA_KEYFRAMES.message2.lookAtY,
        ease: 'none'
    });

    // Message 2 → Message 3 (duration: 0.25, from 0.40 to 0.65)
    cameraTl.to(cameraState, {
        duration: 0.25,
        rotation: CAMERA_KEYFRAMES.message3.rotation,
        zoom: CAMERA_KEYFRAMES.message3.zoom,
        elevation: CAMERA_KEYFRAMES.message3.elevation,
        lookAtX: CAMERA_KEYFRAMES.message3.lookAtX,
        lookAtY: CAMERA_KEYFRAMES.message3.lookAtY,
        ease: 'none'
    });

    // Message 3 → Message 4 (duration: 0.20, from 0.65 to 0.85)
    cameraTl.to(cameraState, {
        duration: 0.20,
        rotation: CAMERA_KEYFRAMES.message4.rotation,
        zoom: CAMERA_KEYFRAMES.message4.zoom,
        elevation: CAMERA_KEYFRAMES.message4.elevation,
        lookAtX: CAMERA_KEYFRAMES.message4.lookAtX,
        lookAtY: CAMERA_KEYFRAMES.message4.lookAtY,
        ease: 'none'
    });

    // Hold at Message 4 (duration: 0.15, from 0.85 to 1.00)
    // Empty tween to fill the timeline
    cameraTl.to({}, { duration: 0.15 });
}

function initMessageAnimations() {
    // Set initial state for all messages - ensure they start invisible
    // Restore visibility so GSAP can control it
    const messages = ['#message-1 .hero-message', '#message-2 .hero-message', '#message-3 .hero-message', '#message-4 .hero-message'];
    gsap.set(messages, {
        opacity: 0,
        y: 100,
        visibility: 'visible' // Restore visibility so GSAP can animate opacity
    });

    // Header - fades out when you start scrolling
    gsap.fromTo('#hero-header',
        { y: 0, opacity: 1 },
        {
            y: -100,
            opacity: 0,
            ease: 'none',
            scrollTrigger: {
                trigger: '.hero-section',
                start: 'top top',        // When hero section top hits viewport top
                end: '10% top',          // When 10% of hero section passes viewport top
                scrub: true
            }
        }
    );

    // Hero content - fades out quickly
    gsap.fromTo('#hero-content > div',
        { y: 0, opacity: 1 },
        {
            y: 100,
            opacity: 0,
            ease: 'none',
            scrollTrigger: {
                trigger: '.hero-section',
                start: 'top top',
                end: '5% top',
                scrub: true
            }
        }
    );

    // Message 1 - Fade in, stay and fade out
    gsap.fromTo('#message-1 .hero-message',
        { y: 0, opacity: 0 },
        {
            y: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
                trigger: '#message-1',
                start: 'top bottom',    // Start when container top is 80% down viewport
                end: 'bottom top',      // End when container top is 40% down viewport
                scrub: true,
                pin: true,
                pinnedContainer: '#message-1',
                pinSpacing: 400
            }
        }
    );

    // gsap.fromTo('#message-1 .hero-message',
    //     { y: 0, opacity: 1 },
    //     {
    //         y:80,
    //         opacity: 1,
    //         ease: 'none',
    //         immediateRender: false, // Don't apply FROM state until trigger is reached
    //         scrollTrigger: {
    //             trigger: '#message-1',
    //             start: 'bottom 10%',     // Start when container top is 40% down viewport
    //             end: 'bottom 30%',       // End when container bottom is 20% down viewport
    //             scrub: true
    //         }
    //     }
    // );

    // gsap.fromTo('#message-1 .hero-message',
    //     { y: 80, opacity: 1 },
    //     {
    //         y: 800,
    //         opacity: 0,
    //         ease: 'none',
    //         immediateRender: false, // Don't apply FROM state until trigger is reached
    //         scrollTrigger: {
    //             trigger: '#message-1',
    //             start: 'bottom 40%',     // Start when container bottom is 60% down viewport
    //             end: 'bottom top',       // End when container bottom is 20% down viewport
    //             scrub: true
    //         }
    //     }
    // );

    // Message 2 - Fade in
    gsap.fromTo('#message-2 .hero-message',
        { y: 100, opacity: 0 },
        {
            y: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
                trigger: '#message-2',
                start: 'top 80%',
                end: 'top 40%',
                scrub: true
            }
        }
    );

    // Message 2 - Fade out
    gsap.fromTo('#message-2 .hero-message',
        { y: 0, opacity: 1 },
        {
            y: -50,
            opacity: 0,
            ease: 'none',
            immediateRender: false, // Don't apply FROM state until trigger is reached
            scrollTrigger: {
                trigger: '#message-2',
                start: 'bottom 60%',
                end: 'bottom 20%',
                scrub: true
            }
        }
    );

    // Message 3 - Fade in
    gsap.fromTo('#message-3 .hero-message',
        { y: 100, opacity: 0 },
        {
            y: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
                trigger: '#message-3',
                start: 'top 80%',
                end: 'top 40%',
                scrub: true
            }
        }
    );

    // Message 3 - Fade out
    gsap.fromTo('#message-3 .hero-message',
        { y: 0, opacity: 1 },
        {
            y: -50,
            opacity: 0,
            ease: 'none',
            immediateRender: false, // Don't apply FROM state until trigger is reached
            scrollTrigger: {
                trigger: '#message-3',
                start: 'bottom 60%',
                end: 'bottom 20%',
                scrub: true
            }
        }
    );

    // Message 4 - Fade in (no fade out, it's the last one)
    gsap.fromTo('#message-4 .hero-message',
        { y: 100, opacity: 0 },
        {
            y: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
                trigger: '#message-4',
                start: 'top 80%',
                end: 'top 40%',
                scrub: true
            }
        }
    );
}

function initGradientAnimations() {
    const tealGradient = document.querySelector('.hero-gradient-teal');
    if (!tealGradient) return;

    // Fade in teal gradient when entering message 2 area
    gsap.fromTo(tealGradient,
        { opacity: 0 },
        {
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
                trigger: '#message-2',
                start: 'top 90%',
                end: 'top 50%',
                scrub: true
            }
        }
    );

    // Fade out teal gradient when entering message 4 area (back to purple)
    gsap.fromTo(tealGradient,
        { opacity: 1 },
        {
            opacity: 0,
            ease: 'none',
            immediateRender: false, // Don't apply FROM state until trigger is reached
            scrollTrigger: {
                trigger: '#message-4',
                start: 'top 90%',
                end: 'top 50%',
                scrub: true
            }
        }
    );
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
        initCameraAnimations();
        initMessageAnimations();
        initGradientAnimations();
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
    const breakpoints = Object.keys(CAMERA_KEYFRAMES_BY_BREAKPOINT)
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
            // Breakpoint changed - reinitialize camera animations with new keyframes
            // Kill existing camera ScrollTrigger to prevent duplicates
            ScrollTrigger.getAll().forEach(st => {
                if (st.vars.trigger === document.querySelector('.hero-section')) {
                    st.kill();
                }
            });

            // Reinitialize with new keyframes
            initCameraAnimations();
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
