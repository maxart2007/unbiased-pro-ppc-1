import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './style.css';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

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
        
        // Initialize camera animations after model loads
        initCameraAnimations();
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

// Connect Lenis to GSAP ScrollTrigger
lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

// ============================================================================
// CAMERA ANIMATION STATE (controlled by GSAP)
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
// GSAP SCROLL ANIMATIONS
// ============================================================================

function initCameraAnimations() {
    const heroSection = document.querySelector('.hero-section');
    if (!heroSection) return;

    // Main camera timeline - tied to hero section scroll
    const cameraTl = gsap.timeline({
        scrollTrigger: {
            trigger: heroSection,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1, // Smooth scrubbing
            onUpdate: updateCameraFromState
        }
    });

    // Camera keyframes - direct value animation, much more predictable!
    // Keyframe 1: Initial view (0% - 15%)
    cameraTl.to(cameraState, {
        rotation: Math.PI / 2 - 0.4,
        zoom: 10,
        elevation: 2,
        lookAtX: -1,
        lookAtY: 0.3,
        duration: 15,
        ease: 'none'
    });

    // Keyframe 2: Hold (15% - 25%)
    cameraTl.to(cameraState, {
        duration: 10,
        ease: 'none'
    });

    // Keyframe 3: Rotate to right side (25% - 40%)
    cameraTl.to(cameraState, {
        rotation: Math.PI - 1,
        lookAtX: 1,
        texture: 'texture-2.png',
        duration: 15,
        ease: 'none'
    });

    // Keyframe 4: Hold (40% - 50%)
    cameraTl.to(cameraState, {
        duration: 10,
        ease: 'none'
    });

    // Keyframe 5: Rotate back to left (50% - 55%)
    cameraTl.to(cameraState, {
        rotation: Math.PI / 2 - 0.4,
        lookAtX: -1,
        texture: 'texture-3.png',
        duration: 5,
        ease: 'none'
    });

    // Keyframe 6: Hold (55% - 65%)
    cameraTl.to(cameraState, {
        duration: 10,
        ease: 'none'
    });

    // Keyframe 7: Final position (65% - 80%)
    cameraTl.to(cameraState, {
        rotation: 1.256,
        zoom: 12,
        elevation: 2.5,
        lookAtX: -2.2,
        lookAtY: 0.66,
        texture: 'texture-4.png',
        duration: 15,
        ease: 'none'
    });

    // Keyframe 8: Hold at end (80% - 100%)
    cameraTl.to(cameraState, {
        duration: 20,
        ease: 'none'
    });
}

function initMessageAnimations() {
    // Header animation - fades out as you scroll
    const header = document.querySelector('#hero-header');
    if (header) {
        gsap.to(header, {
            y: 100,
            opacity: 0,
            scrollTrigger: {
                trigger: '.hero-section',
                start: 'top top',
                end: '15% top',
                scrub: 1
            }
        });
    }

    // Hero content animation - fades out quickly
    const heroContent = document.querySelector('#hero-content > div');
    if (heroContent) {
        gsap.to(heroContent, {
            y: -150,
            opacity: 0,
            scrollTrigger: {
                trigger: '.hero-section',
                start: 'top top',
                end: '20% top',
                scrub: 1
            }
        });
    }

    // All hero messages - animate in and out based on their container
    const messages = document.querySelectorAll('.hero-message');
    messages.forEach((message, index) => {
        const container = message.closest('.container');
        if (!container) return;

        // Fade in animation
        gsap.fromTo(message, 
            { y: 100, opacity: 0 },
            {
                y: 0,
                opacity: 1,
                scrollTrigger: {
                    trigger: container,
                    start: 'top 80%',
                    end: 'top 30%',
                    scrub: 1
                }
            }
        );
        
        // Fade out animation (except for the last message)
        if (index < messages.length - 1) {
            gsap.to(message, {
                y: -50,
                opacity: 0,
                scrollTrigger: {
                    trigger: container,
                    start: 'bottom 70%',
                    end: 'bottom 20%',
                    scrub: 1
                }
            });
        }
    });
}

function initScaleAnimations() {
    // Scale animation for sections with data-scale-keyframes
    const scaleElements = document.querySelectorAll('[data-scale-keyframes]');
    
    scaleElements.forEach(element => {
        const keyframesAttr = element.getAttribute('data-scale-keyframes');
        try {
            const cleaned = keyframesAttr.replace(/(\w+):/g, '"$1":');
            const keyframes = JSON.parse(cleaned);
            const keys = Object.keys(keyframes).map(Number).sort((a, b) => a - b);
            
            if (keys.length >= 2) {
                const startScale = keyframes[keys[0]];
                const endScale = keyframes[keys[keys.length - 1]];
                
                gsap.fromTo(element,
                    { scale: startScale },
                    {
                        scale: endScale,
                        ease: 'none',
                        scrollTrigger: {
                            trigger: element,
                            start: 'top bottom',
                            end: 'bottom top',
                            scrub: 1
                        }
                    }
                );
            }
        } catch (e) {
            console.error('Error parsing scale keyframes:', e);
        }
    });
}

function initHeroFreezing() {
    const heroSection = document.querySelector('.hero-section');
    const spacer = document.getElementById('hero-section-spacer');
    
    if (!heroSection || !spacer) return;

    ScrollTrigger.create({
        trigger: heroSection,
        start: 'bottom bottom',
        end: 'bottom top',
        onEnter: () => {
            heroSection.style.position = 'fixed';
            heroSection.style.bottom = '0';
            heroSection.style.top = 'auto';
            heroSection.style.left = '0';
            heroSection.style.width = '100%';
            heroSection.style.zIndex = '1';
            spacer.style.display = 'block';
            spacer.style.height = `${heroSection.offsetHeight}px`;
        },
        onLeaveBack: () => {
            heroSection.style.position = '';
            heroSection.style.bottom = '';
            heroSection.style.top = '';
            heroSection.style.left = '';
            heroSection.style.width = '';
            heroSection.style.zIndex = '';
            spacer.style.display = 'none';
        }
    });
}

function initLogoScroll() {
    const logoContainer = document.getElementById('logo-scroll-container');
    if (!logoContainer) return;

    gsap.to(logoContainer, {
        x: -500,
        ease: 'none',
        scrollTrigger: {
            trigger: logoContainer,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1
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
            const startPercent = (index / wordSpans.length) * 80; // Spread across 80% of scroll
            const endPercent = startPercent + 5; // Each word takes 5% to transition
            
            ScrollTrigger.create({
                trigger: parentSection,
                start: `top+=${startPercent}% bottom`,
                end: `top+=${endPercent}% bottom`,
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
    initMessageAnimations();
    initScaleAnimations();
    initHeroFreezing();
    initLogoScroll();
    initStickyImageSection();
    initQuoteAnimation();
}

// Initialize after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ============================================================================
// RESIZE HANDLING
// ============================================================================

function onWindowResize() {
    width = container.clientWidth || window.innerWidth;
    height = container.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    
    // Refresh ScrollTrigger calculations
    ScrollTrigger.refresh();
}

window.addEventListener('resize', onWindowResize);
onWindowResize();

// ============================================================================
// ANIMATION LOOP
// ============================================================================

function animate() {
    requestAnimationFrame(animate);
    updateCameraFromState();
    renderer.render(scene, camera);
}

animate();
