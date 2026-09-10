# VISION-AR: Touchless Air Canvas & 3D AR Studio 🎨✨

**VisionAR Studio** is a real-time computer vision and spatial graphics web application that enables touchless digital drawing in mid-air (Air Canvas) and dynamic 3D Augmented Reality (AR) face mask overlays directly in the browser at 60 FPS without external hardware peripherals or native plugins.

---

## 🚀 Features

### ☝️ Touchless Air Canvas
* **Index Finger Pointing Mode:** Draw fluid neon ribbons and brush paths in free 3D space using 21-point skeletal joint landmark tracking.
* **Whiteboard Palm Eraser:** Sweeping an open palm triggers real-time vector stroke splitting ($R=120\text{px}$) to cleanly erase intersecting lines without raster artifacts.
* **Orientation-Invariant 3D Euclidean Gesture Classification:** Uses relative 3D joint distances from the wrist ($L_0$) to maintain 100% gesture recognition accuracy regardless of hand rotation, pitch, or tilt.
* **Exponential Temporal Low-Pass Filtering:** Low-jitter smoothing ($\alpha = 0.45$) for precision drawing.

### 🎭 3D Augmented Reality Face Filters
* **468-Point Facial Mesh Tracking:** Real-time 3D facial topology registration using MediaPipe FaceMesh.
* **Head Pose & Rotation Estimation:** Automatic 3D roll, yaw, and pitch calculation ensuring filters turn and tilt seamlessly with your head.
* **Filter Suite:**
  * 🕶️ **Aviator Sunglasses:** Tinted glass with metallic rim and specular glares.
  * 🎩 **Victorian Top Hat & Monocle:** Silk cylinder hat with antique gold monocle and chain.
  * 🦇 **Batman Cowl:** Matte black cowl with glowing white ocular lenses.
  * 💀 **3D Skeleton Skull:** Anatomical skull bone structure mapped directly to facial contours.
  * ⚡ **Cyber Matrix HUD:** Rotating targeting reticles, laser scan lines, and real-time telemetry tracking readouts.

---

## 🛠️ Tech Stack & Architecture

* **Frontend:** HTML5, Modern Vanilla JavaScript (ES6+), CSS3 (Dark OLED Monochrome Theme `#09090b` + Frosted Glassmorphism).
* **Computer Vision:** Google MediaPipe Hands (21 3D Landmarks) & MediaPipe FaceMesh (468 3D Landmarks).
* **Rendering & Graphics:** HTML5 Canvas 2D Vector Engine, WebGL.
* **Audio:** Web Audio API Real-Time Sound Synthesizer.

---

## 📦 Getting Started

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/piyush118-b/VISION-AR.git
   cd VISION-AR
   ```

2. **Start a Local Server:**
   ```bash
   # Using Python 3
   python3 -m http.server 8085
   ```

3. **Open in Browser:**
   Navigate to `http://localhost:8085` and allow webcam access when prompted.

---

## 🎮 Gesture Guide

| Gesture | Hand Shape | Action Triggered |
| :--- | :--- | :--- |
| **Index Finger** | ☝️ Only index extended | Air Canvas Drawing |
| **Open Palm** | 🖐️ All 4–5 fingers extended | Whiteboard Palm Eraser ($R=120\text{px}$) |
| **Closed Fist** | ✊ All fingers curled | Free Hover Cursor (Move without drawing) |

---

## 👨‍💻 Author

* **Piyush Bagdi**
* *Department of Information Technology, SGSITS Indore*
