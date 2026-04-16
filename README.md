# Chroma Studio: Portrait Enhancement Suite (BETA)

Chroma Studio is an AI-powered tool designed to rescue and refine portraits. Its core mission is to slightly enhance under-focus photography and remove backgrounds to make images instantly "website ready" for professional headshots and profiles.

This application is currently in **BETA**. It was videcoded using the Antigravity AI assistant.

## Core Process

The primary workflow focuses on taking raw, slightly soft portraits and transforming them into clear, high-fidelity assets. By applying neural sharpening and professional background extraction, it creates a polished look suitable for any digital platform.

### Feature Highights (BETA Phase)

- **Website Readiness**: Built-in background removal that replaces busy or distracting environments with a clean, studio-white backdrop.
- **Under-Focus Rescue**: A neural restoration engine (GFPGAN) that adds sharpness and clarity back into the subject's features.
- **High-Definition Scaling [BETA]**: Integrated Real-ESRGAN scaling for high-resolution output.
- **Optical Glare Removal [BETA]**: A surgical tool designed to identify and erase specular glare and monitor reflections from eyeglasses.
- **Custom Inpaint Masking [BETA]**: A manual paintbrush tool for directive cleanup of blemishes or stray hairs.

## Technical Environment

- **Hardware Optimization**: Fully accelerated for M1/M2/M3 Mac hardware (specifically optimized for **iMac M1 16GB**) using Metal Performance Shaders (MPS).
- **Architecture**: Python/FastAPI driving a localized AI pipeline.
- **Frontend**: React (Vite) with a minimalist, high-contrast design system.
- **Developer Note**: This was my first application developed while videcoding with Antigravity.

## Setup & Launch

1. **Hardware**: Recommended for Apple Silicon (M1/M1 Pro/M1 Max/M2/M3) with at least 16GB RAM.
2. **Prepare Environment**: `pip install -r backend/requirements.txt`
3. **Install Frontend**: `cd frontend && npm install`
4. **Launch Suite**: `./launch.sh`

Navigate to: http://localhost:5173 📸🚀
