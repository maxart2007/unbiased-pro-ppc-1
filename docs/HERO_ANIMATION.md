# Hero Section Animation Implementation

This document explains the hero section scroll-driven animation system.

## Architecture Overview

```
CAMERA_BREAKPOINTS (minimal config)
└── Camera positions per viewport breakpoint

Per-Message Functions (self-contained)
├── initHeroContent()  → Header + content fade out
├── initMessage1()     → Camera + texture + message animations
├── initMessage2()     → Camera + texture + gradient + message
├── initMessage3()     → Camera + texture + message animations
└── initMessage4()     → Camera + texture + gradient + message
```

## Design Principles

1. **Values in GSAP** - All timing values are directly in GSAP calls, not in config
2. **Element-based triggers** - Uses `start: 'top 80%'` instead of progress fractions
3. **Self-contained** - Each message function handles its own camera, texture, and message
4. **Minimal config** - Only camera positions (which vary by breakpoint) are in config

## Camera Breakpoints

The only configuration needed - camera positions vary by viewport width:

```javascript
const CAMERA_BREAKPOINTS = {
    768:  { initial, message1, message2, message3, message4 },  // Mobile
    960:  { ... },  // Tablet
    1080: { ... },  // Small desktop
    1280: { ... },  // Medium desktop
    9999: { ... }   // Large desktop
};
```

Each position contains:
- `rotation` - Orbit angle around the 3D model (radians)
- `zoom` - Distance from model (higher = further away)
- `elevation` - Camera height
- `lookAtX/Y` - Point the camera looks at

## Animation Functions

### initHeroContent()

Handles initial hero content fade out:

```javascript
// Header fades out
scrollTrigger: {
    trigger: '.hero-section',
    start: 'top top',
    end: '8% top',
    scrub: true
}

// Content fades out
scrollTrigger: {
    trigger: '.hero-section',
    start: 'top top',
    end: '5% top',
    scrub: true
}
```

### initMessage1() through initMessage4()

Each message function contains 4 components:

#### 1. Texture Change
```javascript
ScrollTrigger.create({
    trigger: '#message-1',
    start: 'top 80%',
    onEnter: () => transitionToTexture('texture-2.jpg', 0.5),
    onLeaveBack: () => transitionToTexture('texture-1.jpg', 0.5)
});
```

#### 2. Camera Animation
```javascript
gsap.to(cameraState, {
    ...CAM.message1,  // From CAMERA_BREAKPOINTS
    ease: 'none',
    scrollTrigger: {
        trigger: '#message-1',
        start: 'top 90%',
        end: 'top 20%',
        scrub: true,
        onUpdate: updateCameraFromState
    }
});
```

#### 3. Message Fade In
```javascript
gsap.fromTo(message,
    { opacity: 0, y: 50 },
    {
        opacity: 1,
        y: 0,
        scrollTrigger: {
            trigger: '#message-1',
            start: 'top 80%',
            end: 'top 40%',
            scrub: true
        }
    }
);
```

#### 4. Message Fade Out
```javascript
gsap.to(message, {
    opacity: 0,
    y: -50,
    immediateRender: false,
    scrollTrigger: {
        trigger: '#message-1',
        start: 'bottom 60%',
        end: 'bottom 20%',
        scrub: true
    }
});
```

## Message Timeline Summary

| Message | Texture | Gradient | Notes |
|---------|---------|----------|-------|
| 1 | texture-1 → texture-2 | Purple (stays) | First message |
| 2 | texture-2 → texture-3 | Purple → Teal | Gradient fades in |
| 3 | texture-3 → texture-4 | Teal (stays) | - |
| 4 | texture-4 → texture-5 | Teal → Purple | Gradient fades out, no message fade out |

## ScrollTrigger Positions Explained

```
start: 'top 80%'   → When element's top reaches 80% down the viewport
end: 'top 40%'     → When element's top reaches 40% down the viewport
start: 'bottom 60%' → When element's bottom reaches 60% down the viewport
end: 'bottom 20%'   → When element's bottom reaches 20% down the viewport
```

## Orchestrator

```javascript
function initHeroAnimations() {
    // Get camera keyframes for current viewport
    CAM = getCameraForViewport();
    
    // Set initial states
    Object.assign(cameraState, CAM.initial);
    gsap.set('.hero-gradient-teal', { opacity: 0 });

    // Initialize all animations
    initHeroContent();
    initMessage1();
    initMessage2();
    initMessage3();
    initMessage4();
}
```

## Resize Handling

On breakpoint change:
1. Kill all hero-related ScrollTriggers
2. Reinitialize with `initHeroAnimations()`

```javascript
if (breakpointChanged) {
    // Kill hero ScrollTriggers
    ScrollTrigger.getAll().forEach(st => {
        if (isHeroTrigger(st)) st.kill();
    });
    
    // Reinitialize
    initHeroAnimations();
}
```

## Modifying Animations

### To change timing:
Edit values directly in the function:
```javascript
// In initMessage1()
scrollTrigger: {
    start: 'top 70%',  // Change these values
    end: 'top 30%',
    scrub: true
}
```

### To change camera positions:
Edit `CAMERA_BREAKPOINTS`:
```javascript
9999: {
    message1: { rotation: Math.PI / 2 - 0.4, zoom: 10, ... }
}
```

### To change textures:
Edit texture names directly in the function:
```javascript
onEnter: () => transitionToTexture('new-texture.jpg', 0.5)
```

## Benefits of This Architecture

1. **Self-contained** - Each message's animations are in one place
2. **Readable** - Values visible directly in GSAP calls
3. **GSAP-idiomatic** - Uses element-based triggers
4. **Less indirection** - No config lookups for timing
5. **Easier debugging** - Can comment out one message without affecting others
