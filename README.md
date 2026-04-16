# 📸 Chroma Studio: Professional AI Portrait Suite

Chroma Studio is a powerful, localized AI-driven portrait enhancement pipeline designed for photographers and creators. It specializes in surgical retouching—removing optical glare from glasses and restoring facial details with high fidelity—while maintaining 100% skin texture integrity.

![Minimalist UI](https://img.shields.io/badge/UI-Minimalist%20White-white?style=for-the-badge)
![M1/M2 Optimized](https://img.shields.io/badge/Platform-M1%20Mac%20Optimized-blue?style=for-the-badge)

## ✨ Core Features

### 👁️ Surgical Optical Glare Removal
Automatically detects and eradicates Green/Cyan monitor reflections and white specular flashes from eyeglasses. Unlike generic AI filters, Chroma Studio preserves the original eye structure and skin surrounding the frames.

### 🖌️ Interactive AI Inpaint Studio
Need more control? Use the built-in Mask Studio to manually paint over blemishes, stray hairs, or complex artifacts.
- **Navier-Stokes Interpolation**: Mathematically erases artifacts.
- **Neural Reconstruction**: GFPGAN hallucinates realistic skin texture over the erasure.
- **Full Control**: Includes high-performance brush size adjustment and an Undo/Redo history stack.

### 💎 High-Fidelity Enhancement
- **Adjustable Fidelity (0-100%)**: Control exactly how much "AI sharpening" is applied, from a subtle clean-up to full studio-grade restoration.
- **Background Removal**: One-click professional headshot generation with clean white-screen extraction.
- **HD Upscaling**: 2x Super-Resolution for crisp, large-format printing.
- **Film Grain Integration**: Inject organic noise to prevent the "AI-plastic" look and maintain photographic soul.

## 🛠️ Tech Stack

- **Backend**: Python 3.9+, FastAPI, OpenCV, PyTorch.
- **Neural Engine**: GFPGAN v1.3 with M1/M2 (MPS) hardware acceleration.
- **Frontend**: React (Vite), Lucide-React, HTML5 Canvas.
- **Design**: Premium Minimalist White Theme with Inter Typography.

## 🚀 Quick Start

### 1. Prerequisites
Ensure you have Python 3.9+ and Node.js installed on your Mac.

### 2. Backend Setup
```bash
# Navigate to project
cd portrait-enhancer

# Set up virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

### 4. Launch Studio
```bash
# From the root directory
./launch.sh
```
Access the studio at `http://localhost:5173`.

## 📸 Usage Workflow
1. **Upload**: Drag-and-drop your raw portraits into the queue.
2. **Mask (Optional)**: If there are specific blemishes, click the **Brush icon** to paint a custom mask.
3. **Configure**: Set your Sharpening Level, Background preferences, and HD toggle.
4. **Process**: Hit **Process Batch** and let the neural engine run.
5. **Download**: Save individual photos or use the **Save All** feature for bulk export.

---
*Created with ❤️ for professional portrait photography.*
