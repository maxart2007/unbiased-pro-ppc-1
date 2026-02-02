# Parallax Scroll Effects Documentation

This document describes how to use parallax scroll effects and opacity animations using data attributes in your HTML.

## Overview

The parallax system allows you to control how elements move and fade during page scroll using intuitive keyframe-based animations. You can define different behaviors at different scroll percentages, creating smooth, dynamic scroll effects.

## Data Attributes

### `data-scroll-speed`

Controls the scroll speed multiplier for an element. Speed values are relative to normal page scroll.

**Syntax:**
```html
<div data-scroll-speed="{scrollPercent: speed, scrollPercent: speed, ...}">
```

**Speed Values:**
- `speed = 0` → Element stays fixed (moves opposite to scroll to stay in place)
- `speed = 1` → Element scrolls normally with the page (no parallax offset)
- `speed = 2` → Element moves twice as fast as scroll
- `speed = 0.5` → Element moves half as fast (parallax background effect)

**How it works:**
- Values between 0 and 1 create a parallax effect where the element moves slower than the page
- Values greater than 1 make the element move faster than the page
- The system smoothly interpolates between keyframes as you scroll

### `data-scroll-opacity`

Controls the opacity of an element at different scroll percentages.

**Syntax:**
```html
<div data-scroll-opacity="{scrollPercent: opacity, scrollPercent: opacity, ...}">
```

**Opacity Values:**
- `0` → Fully transparent (invisible)
- `1` → Fully opaque (visible)
- Values between 0 and 1 create partial transparency

## Examples

### Example 1: Fixed Header That Stays in Place

Keep an element fixed on screen while scrolling:

```html
<div data-scroll-speed="{0: 0}">
    <h1>This header stays fixed</h1>
</div>
```

**Explanation:** `speed = 0` means the element moves opposite to scroll, keeping it visually fixed in place.

### Example 2: Parallax Background Effect

Create a slow-moving background element:

```html
<div data-scroll-speed="{0: 0.5, 50: 0.3}">
    <img src="background.jpg" alt="Parallax background">
</div>
```

**Explanation:** 
- At 0% scroll: moves at 0.5x speed (slower than page)
- At 50% scroll: moves at 0.3x speed (even slower)
- Smoothly transitions between these speeds

### Example 3: Element That Accelerates

Make an element start slow and speed up:

```html
<div data-scroll-speed="{0: 0.5, 25: 1, 50: 1.5, 100: 2}">
    <p>This text accelerates as you scroll</p>
</div>
```

**Explanation:**
- Starts at 0.5x speed (slow)
- Reaches normal speed (1x) at 25% scroll
- Accelerates to 1.5x at 50% scroll
- Reaches 2x speed at 100% scroll

### Example 4: Fade In on Scroll

Fade an element in as you scroll:

```html
<div data-scroll-opacity="{0: 0, 25: 1}">
    <h2>This fades in during the first 25% of scroll</h2>
</div>
```

**Explanation:**
- Starts invisible (opacity 0) at 0% scroll
- Becomes fully visible (opacity 1) at 25% scroll
- Smooth fade-in transition

### Example 5: Fade Out on Scroll

Fade an element out:

```html
<div data-scroll-opacity="{0: 1, 50: 1, 75: 0}">
    <p>Visible at start, fades out after 50% scroll</p>
</div>
```

**Explanation:**
- Fully visible from 0% to 50% scroll
- Fades out between 50% and 75% scroll
- Invisible after 75% scroll

### Example 6: Complex Parallax with Fade

Combine speed and opacity for complex effects:

```html
<div 
    data-scroll-speed="{0: 0.3, 25: 0.8, 50: 1.2}" 
    data-scroll-opacity="{0: 0, 15: 1, 85: 1, 100: 0}">
    <div class="hero-content">
        <h1>Complex parallax effect</h1>
        <p>Moves at different speeds and fades in/out</p>
    </div>
</div>
```

**Explanation:**
- **Speed:** Starts slow (0.3x), speeds up to normal (0.8x), then faster (1.2x)
- **Opacity:** Fades in from 0% to 15%, stays visible until 85%, then fades out

### Example 7: Multiple Keyframes for Smooth Transitions

Create smooth, multi-stage animations:

```html
<div data-scroll-speed="{0: 1, 20: 0.5, 40: 0.3, 60: 0.5, 80: 1, 100: 1.5}">
    <div class="animated-section">
        <p>Complex speed curve with multiple transitions</p>
    </div>
</div>
```

**Explanation:**
- Normal speed at start (1x)
- Slows down progressively (0.5x → 0.3x)
- Speeds back up (0.5x → 1x)
- Accelerates at the end (1.5x)
- All transitions are smoothly interpolated

### Example 8: Real-World Use Case - Hero Section

A typical hero section with parallax and fade effects:

```html
<section class="hero-section">
    <div 
        class="hero-content"
        data-scroll-speed="{0: 1, 15: 1.8}" 
        data-scroll-opacity="{5: 1, 25: 0}">
        <h1>Hero Title</h1>
        <p>Hero description text</p>
        <button>Call to Action</button>
    </div>
</section>
```

**Explanation:**
- Content scrolls normally at start, then speeds up
- Fades in slightly after 5% scroll
- Fades out completely by 25% scroll
- Creates a dynamic hero section effect

## Keyframe Format

Both attributes use the same keyframe format:

```javascript
{
    scrollPercent: value,
    scrollPercent: value,
    ...
}
```

**Rules:**
- Scroll percentages are numbers from 0 to 100
- Values are interpolated smoothly between keyframes
- Before the first keyframe, the first value is used
- After the last keyframe, the last value is used
- Keyframes don't need to be in order (they're automatically sorted)

## Tips and Best Practices

1. **Start Simple:** Begin with 2-3 keyframes and add more as needed
2. **Test Incrementally:** Test your parallax effects as you add keyframes
3. **Use the Debug Panel:** The scroll percentage debug panel (top-right) helps you find the right scroll percentages
4. **Performance:** Parallax effects use hardware acceleration (`will-change: transform`) for smooth performance
5. **Mobile Considerations:** Test parallax effects on mobile devices, as scroll behavior can differ

## Common Patterns

### Pattern 1: Fixed Element
```html
data-scroll-speed="{0: 0}"
```
Element stays visually fixed while scrolling.

### Pattern 2: Slow Parallax Background
```html
data-scroll-speed="{0: 0.3, 100: 0.5}"
```
Background moves slower than foreground, creating depth.

### Pattern 3: Fade In
```html
data-scroll-opacity="{0: 0, 20: 1}"
```
Element fades in during first 20% of scroll.

### Pattern 4: Fade Out
```html
data-scroll-opacity="{0: 1, 80: 0}"
```
Element fades out during last 20% of scroll.

### Pattern 5: Reveal Effect
```html
data-scroll-opacity="{0: 0, 10: 0, 20: 1}"
```
Element stays hidden, then reveals at 10-20% scroll.

## Troubleshooting

**Element moves in wrong direction:**
- Check your speed values. Remember: `speed = 0` is fixed, `speed = 1` is normal scroll
- Values less than 1 create parallax (slower movement)
- Values greater than 1 create acceleration (faster movement)

**Opacity not working:**
- Ensure opacity values are between 0 and 1
- Check that the element doesn't have conflicting CSS opacity rules
- Verify the keyframe percentages are correct

**Jumpy animations:**
- Add more keyframes for smoother transitions
- Ensure keyframes are properly ordered
- Check browser console for parsing errors

## Technical Details

- Parallax uses `translateY` transforms for hardware-accelerated performance
- Opacity animations use CSS `opacity` property
- Both systems interpolate linearly between keyframes
- Scroll progress is calculated as: `scrollY / (documentHeight - windowHeight)`
