# Portrait Sharpener Studio

A local AI tool for cleaning up headshots. Upload a portrait, tune the settings, and get a sharper, more polished version back. Built for personal use on an M1 Mac.

> Vibe coded with Claude Code.

## What it does

- Sharpens soft or slightly out-of-focus portraits using GFPGAN
- Removes the background and replaces it with a clean white studio look
- 2x upscaling via Real-ESRGAN for higher resolution output
- Optical glare removal for glasses (experimental — works sometimes)
- Filmic grain to avoid the over-processed AI look
- Batch queue so you can drop in multiple photos and run them all

It processes everything locally — no images are uploaded to any cloud service.

## Limitations

- Best results on forward-facing portraits with a clear face
- Glare removal is hit-or-miss depending on the image
- Slow on the first run (models download ~400MB)
- Only tested on Apple Silicon (M1) — may work on Intel but not guaranteed

## Setup

Requires Python 3.11 and Node.js.

```bash
# Backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Frontend
cd frontend && npm install

# Run
./launch.sh
```

Open **http://localhost:5173**. Models will download automatically on first run.

## Stack

- React + Vite (frontend)
- FastAPI + WebSockets (backend)
- GFPGAN, Real-ESRGAN, rembg (AI models)
- Apple MPS acceleration
