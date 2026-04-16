# Chroma Studio: Portrait Enhancement Suite

This is my first application developed using Antigravity. It is a specialized tool built for professional portrait photographers who need surgical, high-fidelity control over AI-driven restoration.

## Core Functionality

### 1. Neural Face Restoration
The heart of the application is the GFPGAN v1.3 engine. It is configured to enhance facial structures—sharpening eyes, skin textures, and lips—while maintaining the context of the original photograph. The 'Fidelity' slider gives the user direct control over the sharpening weight, allowing for a range between zero-fidelity cleanup and full studio-grade restoration.

### 2. Optical Glare Removal
A surgical pipeline specifically designed to resolve glasses reflections. It identifies Green/Cyan monitor glow and pure white specular flashes. Using Navier-Stokes mathematical inpainting, the engine wipes the glare streaks from the lenses, allowing the neural restorer to hallucinate the missing eye detail perfectly behind the frames.

### 3. Background Removal
Integrated background extraction that isolates the subject and places them on a clean, professional studio-white backdrop.

### 4. HD Upscaling and Film Grain
Utilizes Real-ESRGAN x2 Plus for super-resolution. To combat the often 'plastic' look of AI processing, a custom film-grain injection algorithm allows the user to re-introduce organic photographic noise, ensuring the final portrait feels like a real photograph rather than an AI generation.

### 5. Interactive Inpaint Studio
The latest evolution of the suite allows for manual intervention. Users can paint a custom mask over blemishes, stray hairs, or complex background artifacts. The backend erases the pixels under the mask and forces the neural network to reconstruct that specific area with high-resolution skin texture.

## Technical Foundations

- Hardware Optimization: Fully accelerated for M1/M2 Mac GPUs using Apple's Metal Performance Shaders (MPS).
- Design System: A minimalist, high-contrast white interface built for focus and clarity.
- Architecture: A React (Vite) frontend communicating via high-speed WebSockets to a FastAPI-driven Python neural backend.

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js
- M1/M2/M3 Mac (Recommended for performance)

### Installation
1. Install Python dependencies: `pip install -r backend/requirements.txt`
2. Install Frontend dependencies: `cd frontend && npm install`
3. Launch the suite using the root script: `./launch.sh`

Accessed at http://localhost:5173 🚀📸
