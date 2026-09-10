# VISION-AR: 468 Face Mesh, Touchless Air Canvas & 3D AR Studio 👁️🎨✨

[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-FaceMesh%20%26%20Hands-00f0ff?style=for-the-badge&logo=google)](https://developers.google.com/mediapipe)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/)
[![Status](https://img.shields.io/badge/Status-Live%20Production-10b981?style=for-the-badge)](#)

**VisionAR Studio** is a real-time computer vision and spatial graphics web application that integrates:
1. **468-Point 3D Facial Landmark Tracking & Live Telemetry** (EAR Blinks, MAR Smiles, Head Pose).
2. **Touchless Mid-Air Drawing & Palm Erasing** (21-Point Skeletal Hand Tracking).
3. **Dynamic 3D Augmented Reality (AR) Face Filters** with real-time head rotation and lighting shaders.

Operating at **60 FPS** directly inside the web browser with **zero external hardware or plugins required**.

---

## 🌟 Key Modules & Features

### 1. 👁️ 468 Face Mesh Detection & Live Telemetry
* **468 3D Landmark Topology:** Real-time dense facial surface mesh registration using MediaPipe FaceMesh.
* **Live Biometric Telemetry:**
  * **Eye Aspect Ratio (EAR):** Real-time blink tracking ($\text{EAR} < 0.20$).
  * **Mouth Aspect Ratio (MAR):** Expression & smile detection ($\text{MAR} > 0.35$).
  * **Head Pose Estimation:** 3D Roll ($\theta_{\text{roll}}$) and Yaw ($\theta_{\text{yaw}}$) calculation.
* **Customizable Shaders:** Toggle triangulation tessellation, landmark nodes, and switch neon glow colors (Cyber Cyan, Neon Lime, Hot Magenta, Gold Amber).

### 2. ☝️ Touchless Air Canvas (Hand Gesture Engine)
* **Index Finger Drawing:** Paint fluid neon ribbon strokes in free 3D space with exponential low-pass smoothing ($\alpha = 0.45$).
* **Whiteboard Open Palm Eraser:** Sweeping an open palm triggers real-time Euclidean distance stroke splitting ($R = 120\text{px}$) to cleanly erase intersecting vector paths without raster artifacts.
* **Orientation-Invariant 3D Classification:** Measures relative Euclidean joint distances from the wrist ($L_0$), ensuring 100% gesture recognition accuracy regardless of hand rotation or tilt.
* **Closed Fist Free Hover:** Move cursor across the canvas freely without drawing or erasing.

### 3. 🎭 3D Augmented Reality Face Filters
* **Luxury Onyx Wayfarers:** Glossy black acetate frames, smoked polarized lenses, realistic specular glares, and silver corner rivets.
* **Batman Bat-Cowl:** Matte black Dark Knight cowl with glowing white ocular lenses and sculpted bat-horns.
* **3D Skeleton Skull:** Anatomical skull bone structure mapped directly to facial contours with hollow eye sockets and nasal cavity.
* **Victorian Top Hat & Monocle:** Silk cylinder hat with an antique gold monocle and hanging chain.
* **Monochrome Cyber Matrix HUD:** Rotating targeting reticles, real-time telemetry readouts, and animated laser scan lines.

---

## 🎮 Hand Gesture Navigation Guide

| Gesture | Hand Shape | Action Triggered |
| :--- | :--- | :--- |
| **Index Finger** | ☝️ Only index finger extended | Air Canvas Drawing (Smooth Neon Strokes) |
| **Open Palm** | 🖐️ All 4–5 fingers extended | Whiteboard Eraser ($R=120\text{px}$ radius) |
| **Closed Fist** | ✊ All fingers curled | Free Hover Cursor (Navigate without marks) |

---

## 🛠️ Tech Stack & Architecture

* **Frontend:** HTML5, Modern Vanilla JavaScript (ES6+), CSS3 (Dark OLED Monochrome Theme `#09090b` + Frosted Glassmorphism).
* **Computer Vision:** Google MediaPipe Hands (21 3D Landmarks) & MediaPipe FaceMesh (468 3D Landmarks).
* **Rendering & Graphics:** HTML5 Canvas 2D Vector Engine, WebGL Shaders.
* **Audio Synthesis:** Web Audio API Procedural Sound Synthesizer for tactile feedback.
* **Deployment:** Vercel (Edge Network with automatic HTTPS for camera permissions).

---

## 💡 Practical Applications

* 🔹 **Augmented Reality (AR) & Virtual Try-On:** Realistic sunglasses, hats, and digital accessories try-on systems.
* 🔹 **Touchless Human-Computer Interaction (HCI):** Sterile touchless digital whiteboards for medical, classroom, or public kiosk environments.
* 🔹 **Driver Drowsiness & Attention Monitoring:** Real-time Eye Aspect Ratio (EAR) blink frequency and head nod tracking.
* 🔹 **Facial Expression & Sentiment Analysis:** Real-time MAR smile and emotion tracking.
* 🔹 **Spatial Animation & Gaming:** Real-time head pose tracking and virtual puppeteering.

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/piyush118-b/VISION-AR.git
cd VISION-AR
```

### 2. Run Locally
```bash
# Using Python 3
python3 -m http.server 8085
```
Open **`http://localhost:8085`** in Google Chrome or any modern web browser and grant webcam permissions when prompted.

---

## ☁️ Deploy to Vercel

1. Push your repository to GitHub.
2. Log in to [Vercel](https://vercel.com) and click **"Add New" $\rightarrow$ "Project"**.
3. Import `piyush118-b/VISION-AR` and click **"Deploy"**.
4. Vercel automatically deploys with full **HTTPS** support for instant camera access on desktop and mobile devices.

---

## 👨‍💻 Author

* **Piyush Bagdi**
* *Department of Information Technology, SGSITS Indore*
* GitHub: [@piyush118-b](https://github.com/piyush118-b)
