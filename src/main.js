import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './style.css';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

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
let width = container.clientWidth || window.innerWidth;
let height = container.clientHeight || window.innerHeight;

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
const textureFiles = ['texture-1.png', 'texture-2.png', 'texture-3.png', 'texture-4.png'];
let texturesLoaded = 0;
let currentTextureName = null;

textureFiles.forEach((filename) => {
    const texture = textureLoader.load(
        `/laptop.fbm/${filename}`,
        (loadedTexture) => {
            loadedTexture.flipY = false;
            loadedTexture.colorSpace = THREE.SRGBColorSpace;
            texturesLoaded++;

            if (model && texturesLoaded === 1) {
                applyTextureToMaterials(model, filename);
                currentTextureName = filename;
            }
        },
        undefined,
        (error) => console.error(`Error loading texture ${filename}:`, error)
    );
    textures[filename] = texture;
});

function applyTextureToMaterials(object, textureName) {
    if (!textures[textureName]) return;
    const targetTexture = textures[textureName];
    if (!targetTexture.image) return;

    object.traverse((child) => {
        if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material, materialIndex) => {
                if (material) {
                    const materialName = (material.name || '').toLowerCase();
                    const isDisplayGlass = materialName === 'display glass' || material.type === 'MeshBasicMaterial';

                    if (isDisplayGlass) {
                        const flippedTexture = targetTexture.clone();
                        flippedTexture.wrapS = THREE.RepeatWrapping;
                        flippedTexture.wrapT = THREE.RepeatWrapping;
                        flippedTexture.repeat.set(1, -1);
                        flippedTexture.needsUpdate = true;

                        if (material.type === 'MeshBasicMaterial') {
                            material.map = flippedTexture;
                            material.needsUpdate = true;
                        } else {
                            const basicMaterial = new THREE.MeshBasicMaterial({
                                map: flippedTexture,
                                color: 0xffffff,
                                transparent: false,
                                opacity: 1.0
                            });

                            if (Array.isArray(child.material)) {
                                child.material[materialIndex] = basicMaterial;
                            } else {
                                child.material = basicMaterial;
                            }
                        }
                    }
                }
            });
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

        if (texturesLoaded > 0) {
            const textureName = textures['texture-1.png'] ? 'texture-1.png' : Object.keys(textures)[0];
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
    texture: 'texture-1.png'
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
// Each keyframe is tied to a specific message container
// ============================================================================

const CAMERA_KEYFRAMES = {
    initial: {
        rotation: Math.PI / 2,
        zoom: 5,
        elevation: 4,
        lookAtX: 0,
        lookAtY: 3,
        texture: 'texture-1.png'
    },
    message1: {
        rotation: Math.PI / 2 - 0.4,
        zoom: 10,
        elevation: 2,
        lookAtX: -1,
        lookAtY: 0.3,
        texture: 'texture-1.png'
    },
    message2: {
        rotation: Math.PI - 1,
        zoom: 10,
        elevation: 2,
        lookAtX: 1,
        lookAtY: 0.3,
        texture: 'texture-2.png'
    },
    message3: {
        rotation: Math.PI / 2 - 0.4,
        zoom: 10,
        elevation: 2,
        lookAtX: -1,
        lookAtY: 0.3,
        texture: 'texture-3.png'
    },
    message4: {
        rotation: 1.256,
        zoom: 12,
        elevation: 2.5,
        lookAtX: -2.2,
        lookAtY: 0.66,
        texture: 'texture-4.png'
    }
};

// ============================================================================
// GSAP SCROLL ANIMATIONS
// Single timeline for camera with explicit durations for smooth bidirectional scrubbing
// ============================================================================

// Texture thresholds - texture changes at these scroll progress points
const TEXTURE_THRESHOLDS = [
    { progress: 0, texture: 'texture-1.png' },
    { progress: 0.27, texture: 'texture-2.png' },
    { progress: 0.52, texture: 'texture-3.png' },
    { progress: 0.75, texture: 'texture-4.png' }
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

    // Only update if texture changed
    if (textureIndex !== lastTextureIndex) {
        cameraState.texture = TEXTURE_THRESHOLDS[textureIndex].texture;
        lastTextureIndex = textureIndex;
    }
}

function initCameraAnimations() {
    const heroSection = document.querySelector('.hero-section');
    if (!heroSection) return;

    // Set initial camera state explicitly
    Object.assign(cameraState, CAMERA_KEYFRAMES.initial);

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
    // Header - fades out when you start scrolling
    gsap.to('#hero-header', {
        y: -100,
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
            trigger: '.hero-section',
            start: 'top top',        // When hero section top hits viewport top
            end: '10% top',          // When 10% of hero section passes viewport top
            scrub: true
        }
    });

    // Hero content - fades out quickly
    gsap.to('#hero-content > div', {
        y: 100,
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
            trigger: '.hero-section',
            start: 'top top',
            end: '5% top',
            scrub: true
        }
    });

    // Message 1 - Fade in
    gsap.fromTo('#message-1 .hero-message',
        { y: 100, opacity: 0 },
        {
            y: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
                trigger: '#message-1',
                start: 'top 80%',    // Start when container top is 80% down viewport
                end: 'top 40%',      // End when container top is 40% down viewport
                scrub: true
            }
        }
    );

    // Message 1 - Fade out
    gsap.to('#message-1 .hero-message', {
        y: -50,
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
            trigger: '#message-1',
            start: 'bottom 60%',     // Start when container bottom is 60% down viewport
            end: 'bottom 20%',       // End when container bottom is 20% down viewport
            scrub: true
        }
    });

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
    gsap.to('#message-2 .hero-message', {
        y: -50,
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
            trigger: '#message-2',
            start: 'bottom 60%',
            end: 'bottom 20%',
            scrub: true
        }
    });

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
    gsap.to('#message-3 .hero-message', {
        y: -50,
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
            trigger: '#message-3',
            start: 'bottom 60%',
            end: 'bottom 20%',
            scrub: true
        }
    });

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
    gsap.fromTo('#aum-content',
        { scale: 1.4 },
        {
            scale: 1,
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
            y: 300
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

    gsap.fromTo('#aum-video',
        {
            x: "-25%"
        },
        {
            x: 0,
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
    gsap.to('#logo-scroll-container', {
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

function onWindowResize() {
    // Debounce resize to prevent rapid recalculations
    clearTimeout(resizeTimeout);
    
    resizeTimeout = setTimeout(() => {
        width = container.clientWidth || window.innerWidth;
        height = container.clientHeight || window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);

        // Force complete ScrollTrigger recalculation
        ScrollTrigger.refresh(true);
    }, 150);
}

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
