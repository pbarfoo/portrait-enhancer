import os
import cv2
import torch
import numpy as np
import base64
import json
import gc
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from gfpgan import GFPGANer
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer
from basicsr.utils import img2tensor, tensor2img
from torchvision.transforms.functional import normalize
from rembg import remove, new_session

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Device setup
device = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
print(f"Using device: {device}")

# Models Initialization
model_path = 'https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth'

# Bg Upsampler for sharpening non-face areas
bg_upscaler_model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=2)
bg_upscaler = RealESRGANer(
    scale=2,
    model_path='https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth',
    model=bg_upscaler_model,
    tile=400,
    tile_pad=10,
    pre_pad=0,
    half=True,
    device=device
)

restorer = GFPGANer(
    model_path=model_path,
    upscale=1,
    arch='clean',
    channel_multiplier=2,
    bg_upsampler=bg_upscaler,
    device=device
)

# Global session cache for background removal
BG_SESSION = None

def get_subject_bbox(mask, threshold=10, margin=40):
    """Calculate the bounding box around the subject in a mask with a safety margin."""
    rows, cols = np.where(mask > threshold)
    if len(rows) == 0:
        return None
    y1, y2 = np.max([0, np.min(rows) - margin]), np.min([mask.shape[0], np.max(rows) + margin])
    x1, x2 = np.max([0, np.min(cols) - margin]), np.min([mask.shape[1], np.max(cols) + margin])
    return (int(x1), int(y1), int(x2), int(y2))

def apply_portrait_texture(img, mask, strength):
    """Apply a subtle filmic grain only to the subject areas."""
    if strength <= 0:
        return img
    
    h, w, c = img.shape
    # Subtle procedural grain
    noise = np.random.normal(0, 255 * strength * 0.05, (h, w, c)).astype(np.float32)
    
    if mask is not None:
        # Only apply within the mask area
        m_float = mask.astype(np.float32) / 255.0
        m_3d = np.repeat(m_float[:, :, np.newaxis], 3, axis=2)
        img_f = img.astype(np.float32)
        result = img_f + (noise * m_3d)
    else:
        result = img.astype(np.float32) + noise
        
    return np.clip(result, 0, 255).astype(np.uint8)

def remove_optical_glare(face_crop):
    """Detect specular glare in the eye region and inpaint it to allow GFPGAN to hallucinate the eyes."""
    h, w = face_crop.shape[:2]
    # Restrict strictly to the immediate eye band to protect forehead and cheeks
    y_start, y_end = int(h * 0.25), int(h * 0.5)
    
    eye_region = face_crop[y_start:y_end, :]
    hsv = cv2.cvtColor(eye_region, cv2.COLOR_BGR2HSV)
    
    # 1. Pure White Specular Glare (Strictly bright and colorless to protect skin)
    lower_white = np.array([0, 0, 220])
    upper_white = np.array([180, 40, 255])
    white_mask = cv2.inRange(hsv, lower_white, upper_white)
    
    # 2. Cyan/Green/Blue Glare (Monitor and green screen reflections on lenses)
    lower_color = np.array([35, 30, 80])
    upper_color = np.array([140, 255, 255])
    color_mask = cv2.inRange(hsv, lower_color, upper_color)
    
    # Combine masks
    glare_mask_region = cv2.bitwise_or(white_mask, color_mask)
    
    # Gentle dilation to avoid bleeding into skin
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    glare_mask_region = cv2.dilate(glare_mask_region, kernel, iterations=1)
    
    # Full size mask
    full_mask = np.zeros((h, w), dtype=np.uint8)
    full_mask[y_start:y_end, :] = glare_mask_region
    
    # Inpaint the original face crop using Navier-Stokes
    inpainted = cv2.inpaint(face_crop, full_mask, 3, cv2.INPAINT_NS)
    return inpainted, full_mask

@app.websocket("/ws/enhance")
async def websocket_enhance(websocket: WebSocket):
    global BG_SESSION
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        image_data = data.get("image")
        custom_mask_data = data.get("custom_mask")
        fidelity = float(data.get("fidelity", 0.5))
        remove_bg = bool(data.get("remove_bg", False))
        remove_glare = bool(data.get("remove_glare", False))
        upscale_factor = int(data.get("upscale", 1)) # 1 or 2
        grain_strength = float(data.get("grain", 0.0)) # 0 to 1
        
        # LOGGING: Verify parameters
        print(f"--- ENHANCEMENT START ---")
        print(f"Fidelity: {fidelity}, Removal: {remove_bg}, Glare-Opt: {remove_glare}, Custom Mask: {custom_mask_data is not None}")
        
        # 1. Decode (5%)
        await websocket.send_json({"status": "Decoding...", "progress": 5})
        img_bytes = base64.b64decode(image_data.split(",")[1])
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        h_orig, w_orig = img.shape[:2]
        
        # 1.5. Interactive AI Inpainting Overrides
        if custom_mask_data:
            await websocket.send_json({"status": "Executing Custom Interpolation...", "progress": 8})
            mask_bytes = base64.b64decode(custom_mask_data.split(",")[1])
            mask_arr = np.frombuffer(mask_bytes, np.uint8)
            custom_mask_img = cv2.imdecode(mask_arr, cv2.IMREAD_GRAYSCALE)
            
            # Ensure the mask perfectly aligns mathematically with the original high-res image
            if custom_mask_img.shape[:2] != (h_orig, w_orig):
                custom_mask_img = cv2.resize(custom_mask_img, (w_orig, h_orig), interpolation=cv2.INTER_NEAREST)
                
            # Mathematically erase the user's manual mask before the AI processes the canvas
            img = cv2.inpaint(img, custom_mask_img, 3, cv2.INPAINT_NS)
            
        # Adjust upscaler internal upscale
        cur_outscale = upscale_factor if upscale_factor <= 2 else 2

        # 2. Setup (10%)
        await websocket.send_json({"status": "Preparing canvas...", "progress": 10})
        restorer.face_helper.clean_all()
        restorer.face_helper.read_image(img)
        
        # 3. Detect (15%)
        await websocket.send_json({"status": "Searching for focus...", "progress": 15})
        restorer.face_helper.get_face_landmarks_5(only_center_face=False, eye_dist_threshold=5)
        restorer.face_helper.align_warp_face()
        num_faces = len(restorer.face_helper.cropped_faces)
        
        # 4. Restore Faces (20-40%)
        # Always run face restoration if fidelity > 0 OR if optical glare removal is requested
        if fidelity > 0 or remove_glare:
            for i, cropped_face in enumerate(restorer.face_helper.cropped_faces):
                original_crop = cropped_face.copy() # Preserve purely original skin for 0% fidelity requests
                
                if remove_glare:
                    cropped_face, glare_mask = remove_optical_glare(cropped_face)
                    
                cropped_face_t = img2tensor(cropped_face / 255., bgr2rgb=True, float32=True)
                normalize(cropped_face_t, (0.5, 0.5, 0.5), (0.5, 0.5, 0.5), inplace=True)
                cropped_face_t = cropped_face_t.unsqueeze(0).to(restorer.device)
                
                output = restorer.gfpgan(cropped_face_t, return_rgb=False, weight=0)[0]
                restored_raw = tensor2img(output.squeeze(0), rgb2bgr=True, min_max=(-1, 1)).astype('uint8')
                
                # Base face blend governed strictly by user Sharpening Level
                blended_face = cv2.addWeighted(restored_raw, fidelity, original_crop, 1.0 - fidelity, 0)
                
                # Localized Eye/Glare Reconstruction Override
                if remove_glare:
                    # Step 1: Find glasses -> Grow the exact glare locations to perfectly cover just the lenses
                    grow_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
                    dynamic_glasses_mask = cv2.dilate(glare_mask, grow_kernel, iterations=4)
                    
                    # Convert to float 0.0-1.0
                    mask = dynamic_glasses_mask.astype(np.float32) / 255.0
                    
                    # Heavy feathering for a seamless transition into un-AI-processed skin
                    mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=15, sigmaY=15)
                    
                    # Expand back to 3D for RGB compositing
                    mask_3d = np.repeat(mask[:, :, np.newaxis], 3, axis=2)
                    
                    # Composite 100% AI Eyes inside the newly mapped Glasses frame
                    ai_eyes = restored_raw.astype(np.float32)
                    base_face = blended_face.astype(np.float32)
                    blended_face = (ai_eyes * mask_3d + base_face * (1.0 - mask_3d)).astype(np.uint8)
                
                restorer.face_helper.add_restored_face(blended_face)
                
                progress = 20 + int((i + 1) / num_faces * 15)
                await websocket.send_json({"status": f"Polishing face {i+1}/{num_faces}...", "progress": progress})
        else:
            # Skip AI restoration for maximum speed
            for cropped_face in restorer.face_helper.cropped_faces:
                restorer.face_helper.add_restored_face(cropped_face)

        # 5. Isolation Pass (40-55%)
        final_mask_full = None
        if remove_bg:
            if BG_SESSION is None:
                await websocket.send_json({"status": "Initializing Studio Isolation...", "progress": 40})
                BG_SESSION = new_session("u2net")
            
            await websocket.send_json({"status": "Analyzing studio background...", "progress": 45})
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            h, w = img_rgb.shape[:2]
            
            MAX_ISO_DIM = 2048
            if max(h, w) > MAX_ISO_DIM:
                scale = MAX_ISO_DIM / max(h, w)
                img_small = cv2.resize(img_rgb, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
                output_rgba_small = remove(
                    img_small, 
                    session=BG_SESSION, 
                    alpha_matting=True,
                    alpha_matting_foreground_threshold=240,
                    alpha_matting_background_threshold=10,
                    alpha_matting_erode_size=5, # Reduced from 15/10 to preserve fine hair
                    post_process_mask=True
                )
                mask_small = output_rgba_small[:, :, 3]
                final_mask_full = cv2.resize(mask_small, (w, h), interpolation=cv2.INTER_LANCZOS4)
            else:
                output_rgba = remove(
                    img_rgb, 
                    session=BG_SESSION, 
                    alpha_matting=True,
                    alpha_matting_foreground_threshold=240,
                    alpha_matting_background_threshold=10,
                    alpha_matting_erode_size=5, # Reduced from 15/10 to preserve fine hair
                    post_process_mask=True
                )
                final_mask_full = output_rgba[:, :, 3]

            # Soften the mask contrast boost to avoid destroying semi-transparent fine hairs
            mask_f = final_mask_full.astype(np.float32) / 255.0
            final_mask_full = (np.clip((mask_f - 0.5) * 1.1 + 0.5, 0, 1) * 255).astype(np.uint8)

        # 6. Targeted HD Sharpening (55-85%)
        await websocket.send_json({"status": f"Applying {cur_outscale}x AI Clarity...", "progress": 55})
        
        if fidelity > 0:
            bbox = get_subject_bbox(final_mask_full) if final_mask_full is not None else None
            
            if bbox:
                x1, y1, x2, y2 = bbox
                subject_crop = img[y1:y2, x1:x2]
                sharpened_crop = restorer.bg_upsampler.enhance(subject_crop, outscale=cur_outscale)[0]
                
                # If upscaling, we need to scale the original crop to match for blending
                if cur_outscale > 1:
                    subject_crop_scaled = cv2.resize(subject_crop, (sharpened_crop.shape[1], sharpened_crop.shape[0]), interpolation=cv2.INTER_CUBIC)
                    blended_crop = cv2.addWeighted(sharpened_crop, fidelity, subject_crop_scaled, 1.0 - fidelity, 0)
                else:
                    blended_crop = cv2.addWeighted(sharpened_crop, fidelity, subject_crop, 1.0 - fidelity, 0)
                
                # Combine back
                if cur_outscale > 1:
                    # Need to upscale the base image to receive the HD crop
                    final_h, final_w = h_orig * cur_outscale, w_orig * cur_outscale
                    sharpened_bg = cv2.resize(img, (final_w, final_h), interpolation=cv2.INTER_CUBIC)
                    sharpened_bg[y1*cur_outscale:y2*cur_outscale, x1*cur_outscale:x2*cur_outscale] = blended_crop
                else:
                    sharpened_bg = img.copy()
                    sharpened_bg[y1:y2, x1:x2] = blended_crop
            else:
                sharpened_full = restorer.bg_upsampler.enhance(img, outscale=cur_outscale)[0]
                if cur_outscale > 1:
                    img_scaled = cv2.resize(img, (sharpened_full.shape[1], sharpened_full.shape[0]), interpolation=cv2.INTER_CUBIC)
                    sharpened_bg = cv2.addWeighted(sharpened_full, fidelity, img_scaled, 1.0 - fidelity, 0)
                else:
                    sharpened_bg = cv2.addWeighted(sharpened_full, fidelity, img, 1.0 - fidelity, 0)
        else:
            # Skip AI sharpening for maximum speed, standard bicubic resize if HD mode is active
            if cur_outscale > 1:
                final_h, final_w = h_orig * cur_outscale, w_orig * cur_outscale
                sharpened_bg = cv2.resize(img, (final_w, final_h), interpolation=cv2.INTER_CUBIC)
            else:
                sharpened_bg = img.copy()

        # 7. Final Composition & Grain (85-95%)
        await websocket.send_json({"status": "Finalizing studio finish...", "progress": 85})
        
        # Paste faces (face helper handles its own upscaling if needed)
        restorer.face_helper.get_inverse_affine(None)
        # Note: paste_faces_to_input_image handles the scale internally via upsample_img dimensions
        restored_img = restorer.face_helper.paste_faces_to_input_image(upsample_img=sharpened_bg)
        
        # Apply Filmic Grain
        if grain_strength > 0:
            # Scale mask if we upscaled
            m_final = final_mask_full
            if cur_outscale > 1 and m_final is not None:
                m_final = cv2.resize(m_final, (restored_img.shape[1], restored_img.shape[0]), interpolation=cv2.INTER_LANCZOS4)
            restored_img = apply_portrait_texture(restored_img, m_final, grain_strength)

        if final_mask_full is not None:
            # Scale mask for composition
            m_final = final_mask_full
            if cur_outscale > 1:
                m_final = cv2.resize(m_final, (restored_img.shape[1], restored_img.shape[0]), interpolation=cv2.INTER_LANCZOS4)
            
            h_f, w_f = restored_img.shape[:2]
            rgba = cv2.cvtColor(restored_img, cv2.COLOR_BGR2RGB)
            white = np.full((h_f, w_f, 3), 255, dtype=np.uint8)
            a = m_final / 255.0
            
            for c in range(3):
                white[:, :, c] = (a * rgba[:, :, c] + (1 - a) * white[:, :, c]).astype(np.uint8)
            restored_img = cv2.cvtColor(white, cv2.COLOR_RGB2BGR)

        # 8. Encode (100%)
        await websocket.send_json({"status": "Exporting HD Portrait...", "progress": 98})
        _, buffer = cv2.imencode('.png', restored_img)
        restored_base64 = base64.b64encode(buffer).decode('utf-8')
        
        gc.collect()
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()
            
        await websocket.send_json({"status": "Complete!", "progress": 100, "image": f"data:image/png;base64,{restored_base64}"})

    except Exception as e:
        print(f"Error: {e}")
        await websocket.send_json({"status": f"Error: {str(e)}", "progress": 0, "error": True})
    finally:
        await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
