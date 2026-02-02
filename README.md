# Financial Advisors Landing Page

A modern webpage featuring a 3D laptop model with scroll-based camera orbiting, built with Vite, Three.js, and Tailwind CSS.

## Features

- **Bold Hero Message**: "Connecting Financial Advisors with the clients they want"
- **3D Model**: Background laptop model with scroll-based camera control
- **Scroll Interaction**: Camera orbits, zooms, and adjusts focus as you scroll
- **Responsive Design**: Works on desktop and mobile devices
- **Modern Stack**: Built with Vite, Three.js, and Tailwind CSS

## Setup

### Prerequisites

- Node.js (v18 or higher)
- pnpm (install with `npm install -g pnpm`)

### Installation

```bash
# Install dependencies
pnpm install
```

## Development

```bash
# Start development server
pnpm dev
```

The development server will start on `http://localhost:3000` and automatically open in your browser.

## Build

```bash
# Build for production
pnpm build
```

The built files will be in the `dist` directory.

## Preview Production Build

```bash
# Preview production build
pnpm preview
```

## Project Structure

```
├── index.html          # Main HTML file
├── src/
│   ├── main.js        # Three.js scene and camera controls
│   └── style.css      # Tailwind CSS styles
├── laptop.fbx         # 3D model file
├── laptop.fbm/        # Model textures folder
├── package.json       # Dependencies and scripts
├── vite.config.js     # Vite configuration
├── tailwind.config.js # Tailwind CSS configuration
└── postcss.config.js  # PostCSS configuration
```

## Camera Controls

The camera behavior is controlled by parameters in `src/main.js`:

- **Rotation**: `startRotation` and `finishRotation` (in radians)
- **Zoom**: `startZoom` and `endZoom` (camera distance)
- **Vertical Position**: `startY` and `endY` (camera height)
- **LookAt Vertical**: `startLookAtY` and `endLookAtY` (focus point height)

## Browser Compatibility

Works best in modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
