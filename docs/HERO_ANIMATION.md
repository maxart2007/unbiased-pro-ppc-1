# Hero Section Animation Implementation

This document explains the hero section scroll-driven animation system, including configuration structure, animation sequencing, and parameter derivation.

## Architecture Overview

```
HERO_CONFIG (Single Source of Truth)
├── textures      → Texture file mappings
├── timeline      → Timing values (scroll progress 0-1)
│   ├── heroContent, heroHeader (Phase 0)
│   ├── message1 (Phase 1)
│   ├── message2 (Phase 2)
│   ├── message3 (Phase 3)
│   └── message4 (Phase 4)
└── camera        → Camera keyframes per breakpoint
    ├── 768  (mobile)
    ├── 960  (tablet)
    ├── 1080 (small desktop)
    ├── 1280 (medium desktop)
    └── 9999 (large desktop)
```

## Configuration Structure

### Textures
```javascript
textures: {
    initial:  'texture-1.jpg',  // Shown at scroll 0
    message1: 'texture-2.jpg',  // Switches at progress 0.08
    message2: 'texture-3.jpg',  // Switches at progress 0.20
    message3: 'texture-4.jpg',  // Switches at progress 0.50
    message4: 'texture-5.jpg'   // Switches at progress 0.75
}
```

### Timeline Values
All timing values are **scroll progress fractions (0-1)** where:
- `0` = top of hero section aligned with viewport top
- `1` = bottom of hero section aligned with viewport bottom

Each phase includes:
- `camera.start/end` - When camera transition begins/ends
- `texture.start` - When texture switches (threshold)
- `fadeIn.start/end` - When message fades in
- `fadeOut.start/end` - When message fades out
- `yFrom/yTo` - Y translation values for animations

### Camera Keyframes
Camera positions vary by viewport breakpoint. Each breakpoint defines positions for:
- `initial` - Starting camera position
- `message1` through `message4` - Target positions for each phase

Camera properties:
- `rotation` - Orbit angle around the 3D model (radians)
- `zoom` - Distance from model (higher = further away)
- `elevation` - Camera height
- `lookAtX/Y` - Point the camera looks at

---

## Phase 0: Initial Fade Out

**What happens:** Hero content and header fade out as user starts scrolling.

| Element | Start | End | Y Movement |
|---------|-------|-----|------------|
| Hero Content | 0.00 | 0.04 | 0 → 50 (down) |
| Hero Header | 0.00 | 0.06 | 0 → -50 (up) |

**Code:**
```javascript
tl.fromTo('#hero-content > div',
    { opacity: 1, y: 0 },
    { 
        opacity: 0, 
        y: TL.heroContent.fadeOut.yTo,  // → 50
        duration: TL.heroContent.fadeOut.end - TL.heroContent.fadeOut.start  // → 0.04
    },
    TL.heroContent.fadeOut.start  // → 0.00
);
```

---

## Phase 1: Message 1 (Detailed Breakdown)

**Gradient:** Purple (initial)
**Texture:** Switches from `texture-1.jpg` to `texture-2.jpg` at progress 0.08

### Timeline Configuration
```javascript
message1: {
    camera:  { start: 0.00, end: 0.12 },
    texture: { start: 0.08 },
    fadeIn:  { start: 0.04, end: 0.10, yFrom: 0, yTo: 0 },
    fadeOut: { start: 0.16, end: 0.22, yTo: 60 }
}
```

### Animation Sequence

```
Scroll Progress: 0.00 -------- 0.04 -------- 0.08 -------- 0.10 -------- 0.12 -------- 0.16 -------- 0.22
                  │             │             │             │             │             │             │
Camera:           ├─────────────────────── Camera moves to message1 position ──────────┤
                  │             │             │             │             │             │             │
Texture:          │             │             ├─ Switch to texture-2.jpg  │             │             │
                  │             │             │             │             │             │             │
Message 1:        │             ├─── Fade In (0→1) ───────┤             │             │             │
                  │             │             │             │             │             ├─ Fade Out ──┤
                  │             │             │             │             │             │   (1→0)     │
```

### Step-by-Step Explanation

#### 1. Camera Movement (0.00 → 0.12)

**Source:** `HERO_CONFIG.camera[breakpoint].message1`

```javascript
tl.to(cameraState, {
    rotation: CAM.message1.rotation,    // From HERO_CONFIG.camera[bp].message1
    zoom: CAM.message1.zoom,
    elevation: CAM.message1.elevation,
    lookAtX: CAM.message1.lookAtX,
    lookAtY: CAM.message1.lookAtY,
    ease: 'none',
    duration: TL.message1.camera.end - TL.message1.camera.start  // 0.12 - 0.00 = 0.12
}, TL.message1.camera.start);  // Starts at 0.00
```

**Parameter derivation:**
- `duration` = `end - start` = `0.12 - 0.00` = `0.12` (12% of scroll)
- Position argument = `start` = `0.00` (begins immediately)
- Camera values depend on viewport breakpoint (e.g., desktop 9999px: rotation=1.17, zoom=10)

#### 2. Texture Switch (at 0.08)

**Source:** `HERO_CONFIG.timeline.message1.texture.start` + `HERO_CONFIG.textures.message1`

The texture switch is handled by `updateTextureFromProgress()` which runs on every scroll update:

```javascript
// Called via ScrollTrigger onUpdate
onUpdate: (self) => {
    updateTextureFromProgress(self.progress);  // Checks thresholds, triggers crossfade
    updateCameraFromState();
}
```

When progress >= 0.08, `texture-2.jpg` is applied with a 0.5s crossfade.

#### 3. Message 1 Fade In (0.04 → 0.10)

**Source:** `HERO_CONFIG.timeline.message1.fadeIn`

```javascript
tl.to('#message-1 .hero-message', {
    opacity: 1, 
    y: TL.message1.fadeIn.yTo,  // → 0
    duration: TL.message1.fadeIn.end - TL.message1.fadeIn.start  // 0.10 - 0.04 = 0.06
}, TL.message1.fadeIn.start);  // Starts at 0.04
```

**Parameter derivation:**
- `duration` = `0.10 - 0.04` = `0.06` (6% of scroll)
- Position = `0.04` (starts after hero content begins fading)
- `yTo` = `0` (message slides to final position)

#### 4. Message 1 Fade Out (0.16 → 0.22)

**Source:** `HERO_CONFIG.timeline.message1.fadeOut`

```javascript
tl.to('#message-1 .hero-message', {
    opacity: 0, 
    y: TL.message1.fadeOut.yTo,  // → 60 (slides down)
    duration: TL.message1.fadeOut.end - TL.message1.fadeOut.start  // 0.22 - 0.16 = 0.06
}, TL.message1.fadeOut.start);  // Starts at 0.16
```

**Note:** There's a gap (0.10 → 0.16) where message 1 is fully visible before fading out.

---

## Phase 2: Message 2 + Gradient (Detailed Breakdown)

**Gradient:** Transitions from Purple → Teal
**Texture:** Switches to `texture-3.jpg` at progress 0.20

### Timeline Configuration
```javascript
message2: {
    camera:   { start: 0.12, end: 0.35 },
    texture:  { start: 0.20 },
    gradient: { start: 0.20, end: 0.28 },
    fadeIn:   { start: 0.22, end: 0.28, yFrom: 0, yTo: 0 },
    fadeOut:  { start: 0.38, end: 0.44, yTo: -30 }
}
```

### Animation Sequence

```
Progress: 0.12 -------- 0.20 -------- 0.22 -------- 0.28 -------- 0.35 -------- 0.38 -------- 0.44
           │             │             │             │             │             │             │
Camera:    ├───────────────────── Camera moves to message2 position ───────────┤
           │             │             │             │             │             │             │
Texture:   │             ├─ Switch to texture-3.jpg  │             │             │             │
           │             │             │             │             │             │             │
Gradient:  │             ├────── Teal gradient fades in (0→1) ────┤             │             │
           │             │             │             │             │             │             │
Message 2: │             │             ├─── Fade In ─┤             │             │             │
           │             │             │             │             │             ├─ Fade Out ──┤
```

### Step-by-Step Explanation

#### 1. Camera Movement (0.12 → 0.35)

**Source:** `HERO_CONFIG.camera[breakpoint].message2`

```javascript
tl.to(cameraState, {
    rotation: CAM.message2.rotation,
    zoom: CAM.message2.zoom,
    elevation: CAM.message2.elevation,
    lookAtX: CAM.message2.lookAtX,
    lookAtY: CAM.message2.lookAtY,
    ease: 'none',
    duration: TL.message2.camera.end - TL.message2.camera.start  // 0.35 - 0.12 = 0.23
}, TL.message2.camera.start);  // Starts at 0.12
```

**Parameter derivation:**
- `duration` = `0.35 - 0.12` = `0.23` (23% of scroll - longer transition)
- Position = `0.12` (starts when Phase 1 camera ends)
- Desktop example: rotation swings to opposite side (Math.PI - 1 ≈ 2.14 rad)

#### 2. Texture Switch (at 0.20)

Triggered by `updateTextureFromProgress()` when progress >= 0.20.
Applies `texture-3.jpg` with 0.5s crossfade.

#### 3. Gradient Transition (0.20 → 0.28)

**Source:** `HERO_CONFIG.timeline.message2.gradient`

```javascript
if (tealGradient) {
    tl.to(tealGradient, {
        opacity: 1,  // Teal gradient becomes visible
        ease: 'none',
        duration: TL.message2.gradient.end - TL.message2.gradient.start  // 0.28 - 0.20 = 0.08
    }, TL.message2.gradient.start);  // Starts at 0.20
}
```

**How it works:**
- Two gradient overlays exist in the DOM: `.hero-gradient-purple` and `.hero-gradient-teal`
- Purple is always at opacity 1 (base layer)
- Teal starts at opacity 0, fades to 1 to cover purple
- Result: smooth purple → teal transition

#### 4. Message 2 Fade In (0.22 → 0.28)

```javascript
tl.to('#message-2 .hero-message', {
    opacity: 1, 
    y: TL.message2.fadeIn.yTo,  // → 0
    duration: TL.message2.fadeIn.end - TL.message2.fadeIn.start  // 0.28 - 0.22 = 0.06
}, TL.message2.fadeIn.start);  // Starts at 0.22
```

**Note:** Message fade-in is slightly delayed (0.22) compared to gradient (0.20) for visual layering.

#### 5. Message 2 Fade Out (0.38 → 0.44)

```javascript
tl.to('#message-2 .hero-message', {
    opacity: 0, 
    y: TL.message2.fadeOut.yTo,  // → -30 (slides up, unlike message 1)
    duration: TL.message2.fadeOut.end - TL.message2.fadeOut.start  // 0.44 - 0.38 = 0.06
}, TL.message2.fadeOut.start);
```

**Note:** Message 2 slides **up** (yTo: -30) when fading out, creating variety from Message 1's downward slide.

---

## Parameter Reference

### Duration Calculation
```javascript
duration = end - start
```
All durations are fractions of total scroll. A duration of `0.06` means the animation takes 6% of the total hero section scroll.

### Position Calculation
The third argument to `tl.to()` or `tl.fromTo()` is the **absolute position** on the timeline:
```javascript
tl.to(element, { ...properties }, position);  // position = start value from config
```

### Y Movement Patterns
| Phase | Fade In Y | Fade Out Y | Effect |
|-------|-----------|------------|--------|
| Hero Content | 0 | 50 | Slides down and out |
| Hero Header | 0 | -50 | Slides up and out |
| Message 1 | 0 | 60 | Stays in place, then slides down |
| Message 2 | 0 | -30 | Stays in place, then slides up |
| Message 3 | 0 | -30 | Stays in place, then slides up |
| Message 4 | 0 | (none) | Stays visible |

---

## Runtime Flow

```
1. Page Load
   └── initHeroTimeline() called
       ├── Get camera keyframes for current breakpoint
       ├── Set initial states (opacity: 0, cameraState = initial)
       └── Create GSAP timeline with ScrollTrigger

2. User Scrolls
   └── ScrollTrigger.onUpdate fires
       ├── updateTextureFromProgress(progress)
       │   └── Check thresholds, apply texture crossfade if needed
       └── updateCameraFromState()
           └── Apply cameraState to Three.js camera

3. Window Resize
   └── If breakpoint changed
       ├── Kill existing ScrollTrigger
       ├── Get new camera keyframes
       └── Reinitialize timeline
```

---

## Modifying Animations

### To change timing:
Edit values in `HERO_CONFIG.timeline`:
```javascript
message1: {
    fadeIn: { start: 0.04, end: 0.10, ... }  // Change these values
}
```

### To change camera positions:
Edit values in `HERO_CONFIG.camera[breakpoint]`:
```javascript
9999: {
    message1: { rotation: Math.PI / 2 - 0.4, zoom: 10, ... }  // Adjust these
}
```

### To change textures:
Edit `HERO_CONFIG.textures`:
```javascript
textures: {
    message1: 'new-texture.jpg',  // Change filename
}
```

### To add new breakpoint:
Add new key to `HERO_CONFIG.camera`:
```javascript
camera: {
    1440: {  // New breakpoint
        initial: { ... },
        message1: { ... },
        // etc.
    }
}
```
