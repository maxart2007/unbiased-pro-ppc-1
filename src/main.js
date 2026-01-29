import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import Lenis from '@studio-freight/lenis';
import './style.css';

// Scene setup
const scene = new THREE.Scene();
scene.background = null; // Transparent background to show gradient

// Camera setup
const container = document.getElementById('canvas-container');
// Initialize with container dimensions, will be updated on resize
let width = container.clientWidth || window.innerWidth;
let height = container.clientHeight || window.innerHeight;

const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 400);
camera.position.set(0, 0, 0);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(width, height);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x000000, 0); // Transparent background
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

// Preload all textures
const textureLoader = new THREE.TextureLoader();
const textures = {};
const textureFiles = ['texture-1.png', 'texture-2.png', 'texture-3.png', 'texture-4.png'];
let texturesLoaded = 0;
let currentTextureName = null;

// Preload all textures
textureFiles.forEach((filename) => {
    const texture = textureLoader.load(
        `/laptop.fbm/${filename}`,
        (loadedTexture) => {
            loadedTexture.flipY = false;
            loadedTexture.colorSpace = THREE.SRGBColorSpace;
            texturesLoaded++;
            
            // If model is already loaded and this is the first texture, apply it
            if (model && texturesLoaded === 1) {
                applyTextureToMaterials(model, filename);
                currentTextureName = filename;
            }
        },
        undefined,
        (error) => {
            console.error(`Error loading texture ${filename}:`, error);
        }
    );
    textures[filename] = texture;
});

// Function to apply texture to materials (specifically to Display Glass/screen materials)
function applyTextureToMaterials(object, textureName) {
    if (!textures[textureName]) {
        console.warn(`Texture ${textureName} not found`);
        return;
    }

    const targetTexture = textures[textureName];
    
    // Only apply if texture is loaded
    if (!targetTexture.image) {
        console.warn(`Texture ${textureName} image not loaded yet`);
        return;
    }
    
    object.traverse((child) => {
        if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];

            materials.forEach((material, materialIndex) => {
                if (material) {
                    const materialName = (material.name || '').toLowerCase();
                    
                    // Check if this is Display Glass material OR if it's already a MeshBasicMaterial (converted screen)
                    const isDisplayGlass = materialName === 'display glass' || material.type === 'MeshBasicMaterial';
                    
                    if (isDisplayGlass) {
                        // Clone the texture to avoid affecting other uses
                        const flippedTexture = targetTexture.clone();
                        // Flip texture vertically (Y) only
                        flippedTexture.wrapS = THREE.RepeatWrapping;
                        flippedTexture.wrapT = THREE.RepeatWrapping;
                        flippedTexture.repeat.set(1, -1);
                        flippedTexture.needsUpdate = true;
                        
                        // If it's already MeshBasicMaterial, just update the texture
                        if (material.type === 'MeshBasicMaterial') {
                            material.map = flippedTexture;
                            material.needsUpdate = true;
                        } else {
                            // Convert to MeshBasicMaterial so it's not affected by lighting
                            // This makes it constantly bright and emissive
                            const basicMaterial = new THREE.MeshBasicMaterial({
                                map: flippedTexture,
                                color: 0xffffff,
                                transparent: false,
                                opacity: 1.0
                            });
                            
                            // Replace the material
                            if (Array.isArray(child.material)) {
                                child.material[materialIndex] = basicMaterial;
                            } else {
                                child.material = basicMaterial;
                            }
                            
                            console.log(`Converted material "${material.name}" to MeshBasicMaterial for emissive screen`);
                        }
                    }
                }
            });
        }
    });
}

// Load FBX model
const loader = new FBXLoader();

// Set up loading manager to handle texture paths
const loadingManager = new THREE.LoadingManager();
loadingManager.setURLModifier((url) => {
    // If the URL is a texture file, redirect to the .fbm folder
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

        // Log all materials and meshes to identify screen
        console.log('=== Model Materials and Meshes ===');
        object.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((material) => {
                    console.log(`Mesh: "${child.name}", Material: "${material.name}", Has texture: ${!!material.map}`);
                });
            }
        });
        console.log('===================================');

        // Apply default texture if available
        if (texturesLoaded > 0) {
            const defaultTexture = textures['texture-1.png'] || Object.values(textures)[0];
            if (defaultTexture && defaultTexture.image) {
                const textureName = textures['texture-1.png'] ? 'texture-1.png' : Object.keys(textures)[0];
                applyTextureToMaterials(object, textureName);
                currentTextureName = textureName;
            }
        }

        // Scale and position the model
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
    (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
    },
    (error) => {
        console.error('Error loading FBX:', error);
    }
);

// Timeline keyframe system
// Define keyframes at different scroll percentages (0-100)
// Parameters:
//   rotation - controls position on orbit around origin (set by lookAtX/lookAtY)
//   zoom - camera distance from origin (larger = further away)
//   z - camera elevation above ground plane (Y coordinate in Three.js, positive = up, negative = down)
//   lookAtX - horizontal origin point for rotation (optional, defaults to 0)
//   lookAtY - vertical origin point for rotation (optional, defaults to 0)
//   texture - texture filename (e.g., 'texture-1.png', 'texture-2.png', 'texture-3.png') - optional
// If a parameter is not specified, it won't be animated at that keyframe
const keyframes = [
    {
        scrollPercent: 0,        // Start of scroll
        rotation: Math.PI / 2,    // Starting angle (0 = right, π/2 = front, π = left, 3π/2 = back)
        zoom: 5,                 // Camera distance (larger = further away)
        z: 4,                      // Camera elevation (Y coordinate)
        lookAtX: 0,                // Rotation origin X
        lookAtY: 3,               // Rotation origin Y
        texture: 'texture-1.png'
    },
    {
        scrollPercent: 15,
        rotation: Math.PI / 2 - 0.4,
        zoom: 10,
        z: 2,
        lookAtX: -1,
        lookAtY: 0.3,
        texture: 'texture-1.png'
    },
    {
        scrollPercent: 25,
        rotation: Math.PI / 2 - 0.4,
        zoom: 10,
        z: 2,
        lookAtX: -1,
        lookAtY: 0.3,
        texture: 'texture-1.png'
    },
    {
        scrollPercent: 40,
        rotation: Math.PI - 1,
        zoom: 10,
        z: 2,
        lookAtX: 1,
        lookAtY: 0.3,
        texture: 'texture-2.png'
    },
    {
        scrollPercent: 50,
        rotation: Math.PI - 1,
        zoom: 10,
        z: 2,
        lookAtX: 1,
        lookAtY: 0.3,
        texture: 'texture-2.png'
    },
    {
        scrollPercent: 55,
        rotation: Math.PI / 2 - 0.4,
        zoom: 10,
        z: 2,
        lookAtX: -1,
        lookAtY: 0.3,
        texture: 'texture-3.png'
    },
    {
        scrollPercent: 65,
        rotation: Math.PI / 2 - 0.4,
        zoom: 10,
        z: 2,
        lookAtX: -1,
        lookAtY: 0.3,
        texture: 'texture-3.png'
    },
    {
        scrollPercent: 80,
        rotation: 1.256,
        zoom: 12,
        z: 2.5,
        lookAtX: -2.2,
        lookAtY: 0.66,
        texture: 'texture-4.png'
    },
    {
        scrollPercent: 100,
        rotation: 1.256,
        zoom: 12,
        z: 2.5,
        lookAtX: -2.2,
        lookAtY: 0.66,
        texture: 'texture-4.png'
    },
];

// Helper function to interpolate between two values
function lerp(start, end, t) {
    return start + (end - start) * t;
}

// Helper function to get the last known value for an optional parameter
function getLastKnownValue(keyframes, currentIndex, paramName) {
    // Search backwards from current index to find last keyframe with this parameter
    for (let i = currentIndex; i >= 0; i--) {
        if (keyframes[i][paramName] !== undefined) {
            return keyframes[i][paramName];
        }
    }
    // If not found, search from the beginning to get first occurrence
    for (let i = 0; i < keyframes.length; i++) {
        if (keyframes[i][paramName] !== undefined) {
            return keyframes[i][paramName];
        }
    }
    return null;
}

// Helper function to get the next known value for an optional parameter
function getNextKnownValue(keyframes, currentIndex, paramName) {
    // Search forwards from current index to find next keyframe with this parameter
    for (let i = currentIndex; i < keyframes.length; i++) {
        if (keyframes[i][paramName] !== undefined) {
            return keyframes[i][paramName];
        }
    }
    // If not found, search backwards to get last occurrence
    for (let i = keyframes.length - 1; i >= 0; i--) {
        if (keyframes[i][paramName] !== undefined) {
            return keyframes[i][paramName];
        }
    }
    return null;
}

// Function to get camera parameters at a given scroll progress (0-1)
function getCameraParamsAtProgress(progress) {
    // Convert progress (0-1) to scroll percent (0-100)
    const scrollPercent = progress * 100;

    // Find the two keyframes to interpolate between
    let prevKeyframeIndex = 0;
    let nextKeyframeIndex = keyframes.length - 1;
    let prevKeyframe = keyframes[0];
    let nextKeyframe = keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length - 1; i++) {
        if (scrollPercent >= keyframes[i].scrollPercent && scrollPercent <= keyframes[i + 1].scrollPercent) {
            prevKeyframeIndex = i;
            nextKeyframeIndex = i + 1;
            prevKeyframe = keyframes[i];
            nextKeyframe = keyframes[i + 1];
            break;
        }
    }

    // Helper function to check if parameter exists in any keyframe
    const hasParamInKeyframes = (paramName) => {
        return keyframes.some(kf => kf[paramName] !== undefined);
    };

    // Helper function to get value for an optional parameter, handling missing values
    const getParamValue = (paramName) => {
        // If parameter doesn't exist in any keyframe, return null to indicate "not animated"
        if (!hasParamInKeyframes(paramName)) {
            return null;
        }

        const prevValue = prevKeyframe[paramName] !== undefined
            ? prevKeyframe[paramName]
            : getLastKnownValue(keyframes, prevKeyframeIndex, paramName);
        const nextValue = nextKeyframe[paramName] !== undefined
            ? nextKeyframe[paramName]
            : getNextKnownValue(keyframes, nextKeyframeIndex, paramName);

        // If either value is null (shouldn't happen if hasParamInKeyframes is true), return null
        if (prevValue === null || nextValue === null) {
            return null;
        }

        // If both are the same, return that value
        if (prevValue === nextValue) {
            return prevValue;
        }

        // Interpolate between the two values
        const range = nextKeyframe.scrollPercent - prevKeyframe.scrollPercent;
        const t = range > 0 ? (scrollPercent - prevKeyframe.scrollPercent) / range : 0;
        return lerp(prevValue, nextValue, t);
    };

    // Helper function to get texture name (no interpolation, just use current keyframe's texture)
    const getTextureName = () => {
        // Use the next keyframe's texture if we're closer to it, otherwise use previous
        const range = nextKeyframe.scrollPercent - prevKeyframe.scrollPercent;
        const t = range > 0 ? (scrollPercent - prevKeyframe.scrollPercent) / range : 0;
        
        // If we're past halfway, use next texture, otherwise use previous
        if (t >= 0.5 && nextKeyframe.texture !== undefined) {
            return nextKeyframe.texture;
        } else if (prevKeyframe.texture !== undefined) {
            return prevKeyframe.texture;
        }
        // Find last known texture
        return getLastKnownValue(keyframes, prevKeyframeIndex, 'texture');
    };

    // If before first keyframe, use first keyframe (or last known value for optional params)
    if (scrollPercent < prevKeyframe.scrollPercent) {
        return {
            rotation: prevKeyframe.rotation,
            zoom: prevKeyframe.zoom,
            z: prevKeyframe.z !== undefined ? prevKeyframe.z : (hasParamInKeyframes('z') ? getLastKnownValue(keyframes, 0, 'z') : null),
            lookAtY: prevKeyframe.lookAtY,
            lookAtX: getParamValue('lookAtX'),
            texture: prevKeyframe.texture !== undefined ? prevKeyframe.texture : (hasParamInKeyframes('texture') ? getLastKnownValue(keyframes, 0, 'texture') : null)
        };
    }

    // If after last keyframe, use last keyframe (or last known value for optional params)
    if (scrollPercent > nextKeyframe.scrollPercent) {
        return {
            rotation: nextKeyframe.rotation,
            zoom: nextKeyframe.zoom,
            z: nextKeyframe.z !== undefined ? nextKeyframe.z : (hasParamInKeyframes('z') ? getLastKnownValue(keyframes, keyframes.length - 1, 'z') : null),
            lookAtY: nextKeyframe.lookAtY,
            lookAtX: getParamValue('lookAtX'),
            texture: nextKeyframe.texture !== undefined ? nextKeyframe.texture : (hasParamInKeyframes('texture') ? getLastKnownValue(keyframes, keyframes.length - 1, 'texture') : null)
        };
    }

    // Calculate interpolation factor (0-1) between the two keyframes
    const range = nextKeyframe.scrollPercent - prevKeyframe.scrollPercent;
    const t = range > 0 ? (scrollPercent - prevKeyframe.scrollPercent) / range : 0;

    // Handle texture: use the texture from the keyframe we're closest to
    let textureName = null;
    if (prevKeyframe.texture !== undefined || nextKeyframe.texture !== undefined) {
        // If past halfway point, use next texture, otherwise use previous
        if (t >= 0.5 && nextKeyframe.texture !== undefined) {
            textureName = nextKeyframe.texture;
        } else if (prevKeyframe.texture !== undefined) {
            textureName = prevKeyframe.texture;
        } else {
            // Find last known texture
            textureName = getLastKnownValue(keyframes, prevKeyframeIndex, 'texture');
        }
    }

    // Interpolate all parameters (required ones always interpolate, optional ones use helper)
    return {
        rotation: lerp(prevKeyframe.rotation, nextKeyframe.rotation, t),
        zoom: lerp(prevKeyframe.zoom, nextKeyframe.zoom, t),
        z: getParamValue('z'),
        lookAtY: lerp(prevKeyframe.lookAtY, nextKeyframe.lookAtY, t),
        lookAtX: getParamValue('lookAtX'),
        texture: textureName
    };
}

// Parallax scroll speed system
// Parse scroll speed keyframes from data-scroll-speed attribute
// Speed values are intuitive multipliers relative to normal scroll:
//   - speed = 0: element stays fixed (moves opposite to scroll to stay in place)
//   - speed = 1: element scrolls normally with the page (no parallax offset)
//   - speed = 2: element moves twice as fast as scroll
//   - speed = 0.5: element moves half as fast (parallax background effect)
function parseScrollSpeed(attributeValue) {
    try {
        // Parse JSON-like string: "{0:0.5, 25:1}"
        const cleaned = attributeValue.replace(/(\w+):/g, '"$1":');
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('Error parsing scroll speed:', e);
        return { 0: 1 }; // Default to normal speed (1 = scrolls with page)
    }
}

// Get scroll speed at a given progress (0-1) based on keyframes
// Returns speed multiplier: 0 = fixed, 1 = normal scroll, 2 = double speed, etc.
function getScrollSpeedAtProgress(speedKeyframes, progress) {
    const scrollPercent = progress * 100;
    const keys = Object.keys(speedKeyframes).map(Number).sort((a, b) => a - b);

    // If before first keyframe, use first value
    if (scrollPercent <= keys[0]) {
        return speedKeyframes[keys[0]];
    }

    // If after last keyframe, use last value
    if (scrollPercent >= keys[keys.length - 1]) {
        return speedKeyframes[keys[keys.length - 1]];
    }

    // Find the two keyframes to interpolate between
    let prevKey = keys[0];
    let nextKey = keys[keys.length - 1];

    for (let i = 0; i < keys.length - 1; i++) {
        if (scrollPercent >= keys[i] && scrollPercent <= keys[i + 1]) {
            prevKey = keys[i];
            nextKey = keys[i + 1];
            break;
        }
    }

    // Interpolate speed
    const range = nextKey - prevKey;
    const t = range > 0 ? (scrollPercent - prevKey) / range : 0;
    return lerp(speedKeyframes[prevKey], speedKeyframes[nextKey], t);
}

// Calculate integral of linear speed segment
// Integrates (1 - speed(p)) from segmentStart to segmentEnd
// This ensures: speed = 1 → no offset, speed > 1 → moves faster, speed < 1 → moves slower
// where speed(p) = speed1 + (speed2 - speed1) * (p - p1) / (p2 - p1)
function integrateSpeedSegment(speed1, speed2, p1, p2, segmentStart, segmentEnd) {
    // Linear interpolation: speed(p) = speed1 + (speed2 - speed1) * (p - p1) / (p2 - p1)
    // Integral of (1 - speed(p)) from segmentStart to segmentEnd
    const t1 = (segmentStart - p1) / (p2 - p1);
    const t2 = (segmentEnd - p1) / (p2 - p1);
    const speedAtStart = speed1 + (speed2 - speed1) * t1;
    const speedAtEnd = speed1 + (speed2 - speed1) * t2;
    
    // Integral of linear function: average value * width
    const avgSpeed = (speedAtStart + speedAtEnd) / 2;
    const segmentWidth = segmentEnd - segmentStart;
    
    return segmentWidth * (1 - avgSpeed);
}

// Calculate parallax offset deterministically by integrating speed function
// Returns exact pixel offset for given scroll position
function calculateParallaxOffset(speedKeyframes, progress, maxScroll) {
    const keys = Object.keys(speedKeyframes).map(Number).sort((a, b) => a - b);
    
    // If no keyframes, return 0
    if (keys.length === 0) {
        return 0;
    }
    
    let totalOffset = 0;
    let currentProgress = 0;
    
    // Handle segment from 0 to first keyframe if first keyframe is not at 0
    const firstKeyProgress = keys[0] / 100;
    if (firstKeyProgress > 0 && progress > 0) {
        const firstSpeed = speedKeyframes[keys[0]];
        const segmentEnd = Math.min(firstKeyProgress, progress);
        // Constant speed from 0 to first keyframe
        totalOffset += segmentEnd * (1 - firstSpeed);
        currentProgress = segmentEnd;
    }
    
    // Integrate through each segment between keyframes up to current progress
    for (let i = 0; i < keys.length - 1; i++) {
        const p1 = keys[i] / 100;
        const p2 = keys[i + 1] / 100;
        const speed1 = speedKeyframes[keys[i]];
        const speed2 = speedKeyframes[keys[i + 1]];
        
        // Skip segments we've already processed
        if (p2 <= currentProgress) continue;
        
        // Stop if we've passed the current progress
        if (p1 > progress) break;
        
        // Calculate integral for the portion of this segment up to current progress
        const segmentStart = Math.max(p1, currentProgress);
        const segmentEnd = Math.min(p2, progress);
        
        // Only process if there's actually a segment to integrate
        if (segmentEnd > segmentStart) {
            // Calculate integral for this linear segment
            const segmentOffset = integrateSpeedSegment(
                speed1, speed2, 
                p1, p2, 
                segmentStart, segmentEnd
            );
            
            totalOffset += segmentOffset;
            currentProgress = segmentEnd;
        }
    }
    
    // Handle case where we're past all keyframes
    const lastKeyProgress = keys[keys.length - 1] / 100;
    if (progress > lastKeyProgress) {
        const lastSpeed = speedKeyframes[keys[keys.length - 1]];
        const remainingProgress = progress - lastKeyProgress;
        totalOffset += remainingProgress * (1 - lastSpeed);
    }
    
    return totalOffset * maxScroll; // Convert to pixels
}

// Initialize parallax elements
function initParallaxElements() {
    const elements = document.querySelectorAll('[data-scroll-speed]');
    return Array.from(elements).map(el => {
        const speedAttr = el.getAttribute('data-scroll-speed');
        const speedKeyframes = parseScrollSpeed(speedAttr);
        // Find the closest parent container (.container) or fall back to parent element
        const parentContainer = el.closest('.container') || el.parentElement;
        return {
            element: el,
            speedKeyframes: speedKeyframes,
            parentContainer: parentContainer
        };
    });
}

// Calculate scroll progress for a container's journey through the viewport
// Returns progress (0-1) where:
//   0% = container first appears on screen (top of container reaches bottom of viewport)
//   100% = container completely leaves the screen (bottom of container reaches top of viewport)
function getContainerScrollProgress(container) {
    const scrollY = currentScrollY;
    const viewportHeight = window.innerHeight;
    
    // Use getBoundingClientRect for reliable positioning
    const rect = container.getBoundingClientRect();
    const containerTop = rect.top + scrollY; // Convert to absolute position
    const containerHeight = rect.height;
    const containerBottom = containerTop + containerHeight;
    
    // When container first appears: top of container reaches bottom of viewport
    // At this point: scrollY + viewportHeight = containerTop
    // So: scrollY = containerTop - viewportHeight
    const enterPoint = containerTop - viewportHeight;
    
    // When container completely leaves: bottom of container reaches top of viewport
    // At this point: scrollY = containerBottom
    const exitPoint = containerBottom;
    
    // Total scroll range is: viewport height + container height
    const scrollRange = exitPoint - enterPoint; // = containerHeight + viewportHeight
    
    if (scrollRange <= 0) {
        return 0;
    }
    
    const progress = (scrollY - enterPoint) / scrollRange;
    return Math.max(0, Math.min(1, progress)); // Clamp between 0 and 1
}

// Update parallax elements based on scroll
// Speed values are intuitive multipliers relative to normal scroll:
//   - speed = 1: element scrolls normally (no parallax offset)
//   - speed = 2: element moves twice as fast (forward/down)
//   - speed = 0.5: element moves half as fast (parallax background effect, moves slower)
//   - speed = 0: element stays fixed (moves opposite to scroll to stay in place)
//   - speed = -2: element moves backwards (up) twice as fast
// Progress is based on the closest parent .container's journey through the viewport
function updateParallax(parallaxElements, scrollY) {
    parallaxElements.forEach(({ element, speedKeyframes, parentContainer }) => {
        // Skip if element also has scale keyframes (scale system will handle combined transform)
        if (element.hasAttribute('data-scale-keyframes')) {
            return;
        }
        
        if (!parentContainer) {
            return;
        }
        
        // Calculate progress based on parent container's position in viewport
        // 0% = container enters viewport, 100% = container completely leaves viewport
        const progress = getContainerScrollProgress(parentContainer);
        
        // Calculate maxScroll for pixel conversion
        // Use container height + viewport height as the total scroll distance
        const viewportHeight = window.innerHeight;
        const maxScroll = parentContainer.offsetHeight + viewportHeight;
        
        // Calculate exact offset deterministically by integrating speed function
        // Formula integrates (1 - speed) so: speed=1 → 0 offset, speed>1 → negative offset (moves faster forward)
        const translateY = calculateParallaxOffset(speedKeyframes, progress, maxScroll);
        element.style.transform = `translateY(${translateY}px)`;
        element.style.willChange = 'transform'; // Hardware acceleration hint
    });
}

// Scroll opacity system
// Parse scroll opacity keyframes from data-scroll-opacity attribute
function parseScrollOpacity(attributeValue) {
    try {
        // Parse JSON-like string: "{0:1, 15:1, 25:0}"
        const cleaned = attributeValue.replace(/(\w+):/g, '"$1":');
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('Error parsing scroll opacity:', e);
        return { 0: 1 }; // Default to fully visible
    }
}

// Get opacity at a given progress (0-1) based on keyframes
function getOpacityAtProgress(opacityKeyframes, progress) {
    const scrollPercent = progress * 100;
    const keys = Object.keys(opacityKeyframes).map(Number).sort((a, b) => a - b);

    // If before first keyframe, use first value
    if (scrollPercent <= keys[0]) {
        return opacityKeyframes[keys[0]];
    }

    // If after last keyframe, use last value
    if (scrollPercent >= keys[keys.length - 1]) {
        return opacityKeyframes[keys[keys.length - 1]];
    }

    // Find the two keyframes to interpolate between
    let prevKey = keys[0];
    let nextKey = keys[keys.length - 1];

    for (let i = 0; i < keys.length - 1; i++) {
        if (scrollPercent >= keys[i] && scrollPercent <= keys[i + 1]) {
            prevKey = keys[i];
            nextKey = keys[i + 1];
            break;
        }
    }

    // Interpolate opacity
    const range = nextKey - prevKey;
    const t = range > 0 ? (scrollPercent - prevKey) / range : 0;
    return lerp(opacityKeyframes[prevKey], opacityKeyframes[nextKey], t);
}

// Initialize opacity elements
function initOpacityElements() {
    const elements = document.querySelectorAll('[data-scroll-opacity]');
    return Array.from(elements).map(el => {
        const opacityAttr = el.getAttribute('data-scroll-opacity');
        const opacityKeyframes = parseScrollOpacity(opacityAttr);
        // Find the closest parent container (.container) or fall back to parent element
        const parentContainer = el.closest('.container') || el.parentElement;
        return {
            element: el,
            opacityKeyframes: opacityKeyframes,
            parentContainer: parentContainer
        };
    });
}

// Update opacity elements based on scroll
// Progress is based on the closest parent .container's journey through the viewport
function updateOpacity(opacityElements, scrollY) {
    opacityElements.forEach(({ element, opacityKeyframes, parentContainer }) => {
        if (!parentContainer) {
            return;
        }
        
        // Calculate progress based on parent container's position in viewport
        // 0% = container enters viewport, 100% = container completely leaves viewport
        const progress = getContainerScrollProgress(parentContainer);
        
        const opacity = getOpacityAtProgress(opacityKeyframes, progress);
        element.style.opacity = opacity;
        element.style.willChange = 'opacity'; // Hardware acceleration hint
    });
}

// Scale keyframe system
// Parse scale keyframes from data-scale-keyframes attribute
function parseScaleKeyframes(attributeValue) {
    try {
        // Parse JSON-like string: "{0:2, 1:1}"
        const cleaned = attributeValue.replace(/(\w+):/g, '"$1":');
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('Error parsing scale keyframes:', e);
        return { 0: 1 }; // Default to no scaling
    }
}

// Get scale at a given progress (0-1) based on keyframes
function getScaleAtProgress(scaleKeyframes, progress) {
    const progressPercent = progress * 100;
    const keys = Object.keys(scaleKeyframes).map(Number).sort((a, b) => a - b);

    // If before first keyframe, use first value
    if (progressPercent <= keys[0]) {
        return scaleKeyframes[keys[0]];
    }

    // If after last keyframe, use last value
    if (progressPercent >= keys[keys.length - 1]) {
        return scaleKeyframes[keys[keys.length - 1]];
    }

    // Find the two keyframes to interpolate between
    let prevKey = keys[0];
    let nextKey = keys[keys.length - 1];

    for (let i = 0; i < keys.length - 1; i++) {
        if (progressPercent >= keys[i] && progressPercent <= keys[i + 1]) {
            prevKey = keys[i];
            nextKey = keys[i + 1];
            break;
        }
    }

    // Interpolate scale
    const range = nextKey - prevKey;
    const t = range > 0 ? (progressPercent - prevKey) / range : 0;
    return lerp(scaleKeyframes[prevKey], scaleKeyframes[nextKey], t);
}

// Calculate scroll progress for a specific element
// Returns progress (0-1) where:
//   0 = section enters viewport (top of section reaches bottom of viewport)
//   1 = bottom of viewport touches end of section (viewport bottom reaches section bottom)
function getElementScrollProgress(element) {
    const scrollY = currentScrollY;
    const viewportHeight = window.innerHeight;
    
    // Use getBoundingClientRect for more reliable positioning
    const rect = element.getBoundingClientRect();
    const elementTop = rect.top + scrollY; // Convert to absolute position
    const elementHeight = rect.height;
    const elementBottom = elementTop + elementHeight;
    
    // When section enters viewport: top of section reaches bottom of viewport
    // At this point: scrollY + viewportHeight = elementTop
    // So: scrollY = elementTop - viewportHeight
    const enterPoint = elementTop - viewportHeight;
    
    // When bottom of viewport touches end of section: viewport bottom reaches section bottom
    // At this point: scrollY + viewportHeight = elementBottom
    // So: scrollY = elementBottom - viewportHeight
    const exitPoint = elementBottom - viewportHeight;
    
    const scrollRange = exitPoint - enterPoint;
    if (scrollRange <= 0) {
        // Element is smaller than viewport or already past
        if (scrollY >= exitPoint) return 1;
        if (scrollY >= enterPoint) return 0;
        return 0;
    }
    
    const progress = (scrollY - enterPoint) / scrollRange;
    return Math.max(0, Math.min(1, progress)); // Clamp between 0 and 1
}

// Initialize scale elements
function initScaleElements() {
    const elements = document.querySelectorAll('[data-scale-keyframes]');
    console.log(`Found ${elements.length} scale elements`);
    return Array.from(elements).map(el => {
        const scaleAttr = el.getAttribute('data-scale-keyframes');
        const scaleKeyframes = parseScaleKeyframes(scaleAttr);
        console.log('Scale keyframes:', scaleKeyframes);
        return {
            element: el,
            scaleKeyframes: scaleKeyframes
        };
    });
}

// Update scale elements based on scroll
function updateScale(scaleElements) {
    scaleElements.forEach(({ element, scaleKeyframes }) => {
        // Calculate progress for this specific element (0 = enters viewport, 1 = exits viewport)
        const progress = getElementScrollProgress(element);
        
        // Get interpolated scale value (progress is 0-1, keyframes are 0-100)
        const scale = getScaleAtProgress(scaleKeyframes, progress);
        
        // Check if element also has parallax (translateY)
        const hasParallax = element.hasAttribute('data-scroll-speed');
        let parallaxTranslateY = '';
        
        if (hasParallax) {
            // Get parallax offset if element has parallax
            const parallaxData = parallaxElements.find(p => p.element === element);
            if (parallaxData && parallaxData.parentContainer) {
                // Use container-based progress for parallax
                const containerProgress = getContainerScrollProgress(parallaxData.parentContainer);
                const viewportHeight = window.innerHeight;
                const maxScroll = parallaxData.parentContainer.offsetHeight + viewportHeight;
                const translateY = calculateParallaxOffset(parallaxData.speedKeyframes, containerProgress, maxScroll);
                parallaxTranslateY = ` translateY(${translateY}px)`;
            }
        }
        
        // Apply combined transform (scale + optional translateY)
        element.style.transform = `scale(${scale})${parallaxTranslateY}`;
        element.style.willChange = 'transform'; // Hardware acceleration hint
    });
}

// Initialize parallax elements
const parallaxElements = initParallaxElements();

// Initialize opacity elements
const opacityElements = initOpacityElements();

// Initialize scale elements
const scaleElements = initScaleElements();

let scrollProgress = 0;
let heroSectionOriginalTop = null; // Store original hero section position
let heroSectionOriginalHeight = null;

// Initialize Lenis smooth scroll
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
    smooth: true,
    smoothTouch: false, // Disable smooth scrolling on touch devices for better performance
    touchMultiplier: 2,
});

// Store current scroll position from Lenis
let currentScrollY = 0;

// Logo scroll animation
let logoScrollContainer = null;
let logoSetWidth = 0;

// Initialize logo scroll container
function initLogoScroll() {
    logoScrollContainer = document.getElementById('logo-scroll-container');
    if (!logoScrollContainer) return;
    
    // Calculate width of one logo set (including gaps)
    // Wait for images to load to get accurate width
    const images = logoScrollContainer.querySelectorAll('img');
    let imagesLoaded = 0;
    
    if (images.length === 0) {
        // No images, calculate width immediately
        const firstSet = logoScrollContainer.querySelector('.logo-set');
        if (firstSet) {
            logoSetWidth = firstSet.offsetWidth;
            updateLogoScroll(); // Initial position
        }
        return;
    }
    
    // Wait for all images to load
    images.forEach((img) => {
        if (img.complete) {
            imagesLoaded++;
            if (imagesLoaded === images.length) {
                calculateLogoSetWidth();
            }
        } else {
            img.addEventListener('load', () => {
                imagesLoaded++;
                if (imagesLoaded === images.length) {
                    calculateLogoSetWidth();
                }
            });
        }
    });
}

function calculateLogoSetWidth() {
    const firstSet = logoScrollContainer?.querySelector('.logo-set');
    if (firstSet) {
        logoSetWidth = firstSet.offsetWidth;
        updateLogoScroll(); // Set initial position
    }
}

// Update logo scroll position based on page scroll
// Track the scroll position when logos section becomes visible
let logoScrollStartY = null;
let logoInitialOffset = 0;

function updateLogoScroll() {
    if (!logoScrollContainer) return;
    
    // Calculate initial offset to center logos (only once)
    if (logoInitialOffset === 0 && logoSetWidth > 0) {
        // Start with logos shifted left so they fill the visible area
        logoInitialOffset = logoSetWidth * 0.5;
    }
    
    // Get the logo container's position relative to viewport
    const containerRect = logoScrollContainer.getBoundingClientRect();
    const isVisible = containerRect.top < window.innerHeight && containerRect.bottom > 0;
    
    // Initialize start position when logos first become visible
    if (isVisible && logoScrollStartY === null) {
        logoScrollStartY = currentScrollY;
    }
    
    // Only animate when visible and initialized
    if (logoScrollStartY === null) return;
    
    // Calculate relative scroll (how much we've scrolled since logos became visible)
    const relativeScroll = currentScrollY - logoScrollStartY;
    
    // Speed multiplier: pixels of logo movement per pixel of page scroll
    const speedMultiplier = 0.4;
    
    // Simple linear translation - no modulo, no jumps
    // Start with initial offset so logos fill the visible area from the left
    const translateX = -logoInitialOffset - (relativeScroll * speedMultiplier);
    
    logoScrollContainer.style.transform = `translateX(${translateX}px)`;
    logoScrollContainer.style.willChange = 'transform';
}

// Calculate scroll progress based on .hero-section instead of full page
// Returns progress (0-1) where 0 = hero section at top of viewport, 1 = hero section fully scrolled past
function getHeroSectionProgress() {
    const heroSection = document.querySelector('.hero-section');
    if (!heroSection) {
        // Fallback to full page scroll if hero section not found
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        return Math.min(currentScrollY / maxScroll, 1);
    }
    
    const scrollY = currentScrollY;
    const heroSectionTop = heroSection.offsetTop;
    const heroSectionHeight = heroSection.offsetHeight;
    const viewportHeight = window.innerHeight;
    
    // When hero section starts entering viewport
    const heroSectionStart = heroSectionTop;
    // When hero section is fully scrolled past (bottom reaches top of viewport)
    const heroSectionEnd = heroSectionTop + heroSectionHeight - viewportHeight;
    
    // Calculate progress within hero section
    const scrollRange = heroSectionEnd - heroSectionStart;
    if (scrollRange <= 0) {
        // If section is smaller than viewport, return 0 or 1 based on position
        return scrollY >= heroSectionStart ? 1 : 0;
    }
    
    const progress = (scrollY - heroSectionStart) / scrollRange;
    return Math.max(0, Math.min(1, progress)); // Clamp between 0 and 1
}

function updateCamera() {
    const scrollY = currentScrollY;
    scrollProgress = getHeroSectionProgress();

    // Get interpolated camera parameters from keyframes
    const params = getCameraParamsAtProgress(scrollProgress);

    // Update debug panel with all animated properties
    const scrollPercentElement = document.getElementById('scroll-percent');
    if (scrollPercentElement) {
        const scrollPercent = (scrollProgress * 100).toFixed(2);
        scrollPercentElement.textContent = scrollPercent;
    }
    
    const rotationElement = document.getElementById('debug-rotation');
    if (rotationElement) {
        rotationElement.textContent = params.rotation.toFixed(3);
    }
    
    const zoomElement = document.getElementById('debug-zoom');
    if (zoomElement) {
        zoomElement.textContent = params.zoom.toFixed(2);
    }
    
    const zElement = document.getElementById('debug-z');
    if (zElement) {
        zElement.textContent = (params.z !== null && params.z !== undefined ? params.z : 0).toFixed(2);
    }
    
    const lookAtXElement = document.getElementById('debug-lookatx');
    if (lookAtXElement) {
        const lookAtX = params.lookAtX !== null && params.lookAtX !== undefined ? params.lookAtX : 0;
        lookAtXElement.textContent = lookAtX.toFixed(2);
    }
    
    const lookAtYElement = document.getElementById('debug-lookaty');
    if (lookAtYElement) {
        const lookAtY = params.lookAtY !== null && params.lookAtY !== undefined ? params.lookAtY : 0;
        lookAtYElement.textContent = lookAtY.toFixed(2);
    }
    
    const textureElement = document.getElementById('debug-texture');
    if (textureElement) {
        textureElement.textContent = params.texture !== null && params.texture !== undefined ? params.texture : '-';
    }

    // Set camera position based on rotation and zoom
    // X and Z are always calculated from rotation and zoom (circular orbit)
    // Z parameter controls camera elevation (Y coordinate in Three.js)
    camera.position.x = Math.cos(params.rotation) * params.zoom;
    camera.position.z = Math.sin(params.rotation) * params.zoom;
    camera.position.y = params.z !== null && params.z !== undefined ? params.z : 0;

    // Set camera lookAt point (rotation origin)
    // If lookAtX/lookAtY are specified in keyframes, use them; otherwise use defaults
    const lookAtX = params.lookAtX !== null && params.lookAtX !== undefined ? params.lookAtX : 0;
    const lookAtY = params.lookAtY !== null && params.lookAtY !== undefined ? params.lookAtY : 0;
    
    camera.lookAt(lookAtX, lookAtY, 0);

    // Handle texture swaps
    if (model && params.texture !== null && params.texture !== undefined) {
        const targetTexture = params.texture;
        
        // Only update if texture changed
        if (targetTexture !== currentTextureName) {
            currentTextureName = targetTexture;
            applyTextureToMaterials(model, targetTexture);
        }
    }

    // Update parallax elements
    updateParallax(parallaxElements, scrollY);
    
    // Update opacity elements
    updateOpacity(opacityElements, scrollY);
    
    // Update scale elements
    updateScale(scaleElements);
    
    // Handle hero section freezing: when fully scrolled, freeze at bottom and let next sections cover it
    const heroSection = document.querySelector('.hero-section');
    const spacer = document.getElementById('hero-section-spacer');
    
    if (heroSection && spacer) {
        const scrollY = currentScrollY;
        const viewportHeight = window.innerHeight;
        
        // Store original position/height on first run (before it becomes fixed)
        if (heroSectionOriginalTop === null || !heroSection.classList.contains('hero-section-frozen')) {
            heroSectionOriginalTop = heroSection.offsetTop;
            heroSectionOriginalHeight = heroSection.offsetHeight;
        }
        
        // Calculate when hero section should freeze (using original position)
        const heroSectionBottom = heroSectionOriginalTop + heroSectionOriginalHeight;
        const freezeThreshold = heroSectionBottom - viewportHeight;
        
        // When hero section is fully scrolled past (bottom reaches top of viewport)
        const shouldFreeze = scrollY >= freezeThreshold;
        
        if (shouldFreeze) {
            // Freeze hero section at bottom of viewport
            if (!heroSection.classList.contains('hero-section-frozen')) {
                heroSection.classList.add('hero-section-frozen');
                heroSection.style.position = 'fixed';
                heroSection.style.bottom = '0';
                heroSection.style.top = 'auto';
                heroSection.style.left = '0';
                heroSection.style.width = '100%';
                heroSection.style.zIndex = '1';
                
                // Show spacer to maintain scroll position (prevents jump)
                spacer.style.display = 'block';
                spacer.style.height = `${heroSectionOriginalHeight}px`;
            }
        } else {
            // Unfreeze when scrolling back up
            if (heroSection.classList.contains('hero-section-frozen')) {
                heroSection.classList.remove('hero-section-frozen');
                heroSection.style.position = '';
                heroSection.style.bottom = '';
                heroSection.style.top = '';
                heroSection.style.left = '';
                heroSection.style.width = '';
                heroSection.style.zIndex = '';
                
                // Hide spacer
                spacer.style.display = 'none';
                spacer.style.height = '';
                
                // Reset stored values so they can be recalculated
                heroSectionOriginalTop = null;
                heroSectionOriginalHeight = null;
            }
        }
    }
}

// Handle window resize
function onWindowResize() {
    width = container.clientWidth || window.innerWidth;
    height = container.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// Initial resize to set proper dimensions
onWindowResize();

window.addEventListener('resize', () => {
    onWindowResize();
    // Recalculate logo set width on resize
    calculateLogoSetWidth();
});

// Initialize logo scroll after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initLogoScroll();
        initQuoteWords();
    });
} else {
    initLogoScroll();
    initQuoteWords();
}

// Sticky image section - change image based on which message is in view
function updateStickyImage() {
    const stickyImage = document.getElementById('sticky-section-image');
    const messageTriggers = document.querySelectorAll('.message-trigger');
    
    if (!stickyImage || messageTriggers.length === 0) return;
    
    const viewportCenter = window.innerHeight / 2;
    let activeImageSrc = null;
    
    messageTriggers.forEach((trigger) => {
        const rect = trigger.getBoundingClientRect();
        // Check if the message is in the center area of the viewport
        if (rect.top <= viewportCenter && rect.bottom >= viewportCenter) {
            activeImageSrc = trigger.getAttribute('data-image');
        }
    });
    
    // Update image if a new one should be shown
    if (activeImageSrc && stickyImage.src !== new URL(activeImageSrc, window.location.origin).href) {
        stickyImage.src = activeImageSrc;
    }
}

// Initialize quote words - wrap each word in a span for individual animation
function initQuoteWords() {
    const quoteElement = document.getElementById('quote');
    if (!quoteElement) return;
    
    // Check if already initialized
    if (quoteElement.querySelector('.quote-word')) return;
    
    // Get the text content (this will convert &nbsp; to regular spaces)
    const text = quoteElement.textContent;
    
    // Split text into words and spaces, preserving whitespace
    const parts = text.split(/(\s+)/);
    
    // Clear and rebuild with wrapped words
    quoteElement.innerHTML = '';
    parts.forEach(part => {
        if (part.trim().length === 0) {
            // Preserve spaces (including multiple spaces and line breaks)
            quoteElement.appendChild(document.createTextNode(part));
        } else {
            // Wrap word in span
            const span = document.createElement('span');
            span.className = 'quote-word';
            span.textContent = part;
            span.style.color = 'rgb(148, 163, 184)'; // Initial gray color (slate-400)
            span.style.transition = 'color 0.4s ease-out'; // Smooth transition
            quoteElement.appendChild(span);
        }
    });
}

// Update quote color based on scroll progress - word by word
function updateQuoteColor() {
    const quoteElement = document.getElementById('quote');
    if (!quoteElement) return;
    
    // Find the parent section element
    const parentSection = quoteElement.closest('section');
    if (!parentSection) return;
    
    // Calculate scroll progress for the parent section
    // 0 = section enters viewport (top reaches bottom of viewport)
    // 1 = section bottom reaches bottom of viewport
    const progress = getElementScrollProgress(parentSection);
    
    // Get all word spans
    const wordSpans = quoteElement.querySelectorAll('.quote-word');
    if (wordSpans.length === 0) return;
    
    // Color values
    // slate-400: rgb(148, 163, 184) - gray
    // slate-900: rgb(15, 23, 42) - black
    const startR = 148;
    const startG = 163;
    const startB = 184;
    const endR = 15;
    const endG = 23;
    const endB = 42;
    
    // Each word transitions over a portion of the scroll progress
    // Adjust this value to control how quickly words transition (smaller = faster, more overlap)
    const transitionDuration = 0.1; // Each word takes 10% of scroll progress to transition
    
    // Animate each word with staggered timing
    wordSpans.forEach((span, index) => {
        // Distribute words evenly across the scroll progress
        // First word starts at 0, last word finishes at 1
        const wordStart = (index / wordSpans.length) * (1 - transitionDuration);
        const wordEnd = wordStart + transitionDuration;
        
        // Binary state: either gray (0) or black (1)
        // CSS transition will handle the smooth animation between states
        let wordProgress = 0;
        if (progress >= wordStart) {
            // Word should be black (transition will animate smoothly)
            wordProgress = 1;
        }
        // else wordProgress stays 0 (gray)
        
        // Apply binary color - either gray or black
        if (wordProgress === 1) {
            span.style.color = `rgb(${endR}, ${endG}, ${endB})`; // Black
        } else {
            span.style.color = `rgb(${startR}, ${startG}, ${startB})`; // Gray
        }
    });
    
    quoteElement.style.willChange = 'contents'; // Hardware acceleration hint
}

// Update scroll position from Lenis and trigger camera update
lenis.on('scroll', ({ scroll, limit, velocity, direction, progress }) => {
    currentScrollY = scroll;
    updateCamera();
    updateLogoScroll();
    updateStickyImage();
    updateQuoteColor();
});

// Animation loop - integrate Lenis RAF
function animate(time) {
    requestAnimationFrame(animate);
    
    // Update Lenis (handles smooth scrolling)
    lenis.raf(time);

    renderer.render(scene, camera);
}

animate();
updateCamera(); // Initial camera position
updateLogoScroll(); // Initial logo position
updateStickyImage(); // Initial sticky image
updateQuoteColor(); // Initial quote color
