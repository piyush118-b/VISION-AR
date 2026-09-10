/**
 * VisionAR Studio — Monochrome Touchless Engine
 * B.Tech IV Year Computer Graphics & Multimedia Studio Project
 * Author: Piyush Bagdi
 */

// Global Application State
const state = {
    mode: 'facemesh', // 'facemesh', 'canvas', or 'ar'
    activeFilter: 'sunglasses',
    showFaceMesh: true,
    showHandLandmarks: false,
    arEnabled: true,
    isMirrored: true, // Default mirrored to match webcam view
    
    // FaceMesh Display State
    meshColor: '#00f0ff',
    showTesselation: true,
    showNodes: true,
    
    // Air Canvas Drawing State
    currentColor: '#ffffff',
    brushSize: 10,
    intensity: 1.0,
    hueShift: 0,
    particleCount: 150,
    
    // Air Canvas Memory
    drawnStrokes: [], // Array of { color, size, points: [{x, y}] }
    currentStroke: null,
    
    // Smooth Coordinate Tracking (Exponential Filter)
    smoothX: null,
    smoothY: null,
    smoothingFactor: 0.45,
    
    // Smooth Face Pose Tracking (Zero Jitter)
    smoothFace: {
        x: null,
        y: null,
        scale: null,
        angle: null,
        height: null,
        foreheadX: null,
        foreheadY: null
    },
    
    // Tracking Data
    faceLandmarks: null,
    handLandmarks: null,
    currentGesture: 'NONE',
    
    // Timers & Debounce
    fps: 60,
    lastFrameTime: performance.now(),
    gestureDebounceTimer: 0,
    isCountdownRunning: false,
    particles: []
};

const COLOR_PALETTE = ['#ffffff', '#00f0ff', '#d4d4d8', '#a1a1aa', '#3f3f46', '#ff0055'];
const FILTER_KEYS = ['sunglasses', 'batman', 'skeleton', 'top_hat', 'cyberpunk'];

// Preloaded Realistic Transparent Filter Assets
const filterAssets = {
    sunglasses: new Image(),
    batman: new Image(),
    skeleton: new Image(),
    top_hat: new Image()
};
filterAssets.sunglasses.src = 'filter_sunglasses.png';
filterAssets.batman.src = 'filter_batman.png';
filterAssets.skeleton.src = 'filter_skull.png';
filterAssets.top_hat.src = 'filter_tophat.png';

// Web Audio Synthesizer
class SoundSynth {
    constructor() { this.ctx = null; }
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    playTone(freq = 440, duration = 0.1, type = 'sine') {
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {}
    }
    playClick() { this.init(); this.playTone(800, 0.05, 'triangle'); }
    playFilterChange() {
        this.init();
        this.playTone(523.25, 0.08, 'triangle');
        setTimeout(() => this.playTone(659.25, 0.1, 'sine'), 50);
    }
    playShutter() {
        this.init();
        this.playTone(180, 0.05, 'square');
        setTimeout(() => this.playTone(1000, 0.1, 'sine'), 40);
    }
}
const sfx = new SoundSynth();

// DOM References
const DOM = {
    webcam: document.getElementById('webcam'),
    canvas: document.getElementById('output-canvas'),
    ctx: document.getElementById('output-canvas').getContext('2d'),
    
    // Mode Buttons
    tabModeFacemesh: document.getElementById('tab-mode-facemesh'),
    tabModeCanvas: document.getElementById('tab-mode-canvas'),
    tabModeAr: document.getElementById('tab-mode-ar'),
    
    // Control Bars
    facemeshBar: document.getElementById('facemesh-bar'),
    paletteBar: document.getElementById('palette-bar'),
    
    // Sidebar Cards
    facemeshBox: document.getElementById('facemesh-box'),
    gestureHelperBox: document.getElementById('gesture-helper-box'),
    arLibraryBox: document.getElementById('ar-library-box'),
    
    // Telemetry Tags
    telemPts: document.getElementById('telem-pts'),
    telemEyes: document.getElementById('telem-eyes'),
    telemMouth: document.getElementById('telem-mouth'),
    telemPose: document.getElementById('telem-pose'),
    
    // Mesh Controls
    meshSwatches: document.querySelectorAll('.mesh-swatch'),
    btnToggleTesselation: document.getElementById('btn-toggle-tesselation'),
    btnToggleNodes: document.getElementById('btn-toggle-nodes'),
    
    // Header Status Pills
    txtCameraStatus: document.getElementById('txt-camera-status'),
    txtGestureEmoji: document.getElementById('txt-gesture-emoji'),
    txtGestureName: document.getElementById('txt-gesture-name'),
    
    // Gesture Toast
    gestureToast: document.getElementById('gesture-toast'),
    toastEmojiBox: document.getElementById('toast-emoji-box'),
    toastTitle: document.getElementById('toast-title'),
    toastSub: document.getElementById('toast-sub'),
    
    // Overlays
    flashScreen: document.getElementById('flash-screen'),
    countdownCircle: document.getElementById('countdown-circle'),
    
    // Palette Controls
    swatches: document.querySelectorAll('.palette-bar .swatch-item'),
    btnClearCanvas: document.getElementById('btn-clear-canvas'),
    btnClearQuick: document.getElementById('btn-clear-quick'),
    
    // Finger Rule Indicators
    ruleIndex: document.getElementById('rule-index'),
    rulePalm: document.getElementById('rule-palm'),
    ruleFist: document.getElementById('rule-fist'),

    // Style Cards
    styleCards: document.querySelectorAll('.style-item'),
    
    // Dock Buttons
    btnToggleCam: document.getElementById('btn-toggle-cam'),
    btnToggleMesh: document.getElementById('btn-toggle-mesh'),
    btnToggleHand: document.getElementById('btn-toggle-hand'),
    btnMirror: document.getElementById('btn-mirror'),
    btnSnapshot: document.getElementById('btn-snapshot'),
    btnGuideModal: document.getElementById('btn-guide-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnModalGotit: document.getElementById('btn-modal-gotit'),
    modalGuide: document.getElementById('modal-guide'),
    
    // Sliders
    sliderBrushSize: document.getElementById('slider-brush-size'),
    sliderIntensity: document.getElementById('slider-intensity'),
    sliderHue: document.getElementById('slider-hue'),
    valBrushSize: document.getElementById('val-brush-size'),
    valIntensity: document.getElementById('val-intensity'),
    valHue: document.getElementById('val-hue')
};

// Initialize Application
async function startApp() {
    bindEvents();
    initParticles();
    setMode('facemesh');
    await setupCameraAndModels();
}

function bindEvents() {
    // Mode Switcher
    if (DOM.tabModeFacemesh) DOM.tabModeFacemesh.addEventListener('click', () => setMode('facemesh'));
    if (DOM.tabModeCanvas) DOM.tabModeCanvas.addEventListener('click', () => setMode('canvas'));
    if (DOM.tabModeAr) DOM.tabModeAr.addEventListener('click', () => setMode('ar'));

    // FaceMesh Color Swatches
    DOM.meshSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            DOM.meshSwatches.forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            state.meshColor = swatch.dataset.meshColor || '#00f0ff';
        });
    });

    // FaceMesh Toggles
    if (DOM.btnToggleTesselation) {
        DOM.btnToggleTesselation.addEventListener('click', () => {
            state.showTesselation = !state.showTesselation;
            DOM.btnToggleTesselation.classList.toggle('active', state.showTesselation);
        });
    }

    if (DOM.btnToggleNodes) {
        DOM.btnToggleNodes.addEventListener('click', () => {
            state.showNodes = !state.showNodes;
            DOM.btnToggleNodes.classList.toggle('active', state.showNodes);
        });
    }

    // Color Swatches (Air Canvas)
    document.querySelectorAll('#palette-bar .swatch-item').forEach(swatch => {
        swatch.addEventListener('click', () => {
            document.querySelectorAll('#palette-bar .swatch-item').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            state.currentColor = swatch.dataset.color;
        });
    });

    // Style Cards Click (AR Filters)
    DOM.styleCards.forEach(card => {
        card.addEventListener('click', () => {
            const filter = card.dataset.filter;
            selectStyle(filter);
        });
    });

    // Clear Canvas
    DOM.btnClearCanvas.addEventListener('click', clearAirCanvas);
    DOM.btnClearQuick.addEventListener('click', clearAirCanvas);

    // Dock Buttons
    DOM.btnToggleMesh.addEventListener('click', () => {
        state.showFaceMesh = !state.showFaceMesh;
        DOM.btnToggleMesh.classList.toggle('active', state.showFaceMesh);
    });

    DOM.btnToggleHand.addEventListener('click', () => {
        state.showHandLandmarks = !state.showHandLandmarks;
        DOM.btnToggleHand.classList.toggle('active', state.showHandLandmarks);
    });

    DOM.btnMirror.addEventListener('click', () => {
        state.isMirrored = !state.isMirrored;
        DOM.canvas.style.transform = state.isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
        DOM.btnMirror.classList.toggle('active', !state.isMirrored);
    });

    DOM.btnSnapshot.addEventListener('click', runCountdownSnapshot);

    // Modal
    DOM.btnGuideModal.addEventListener('click', () => DOM.modalGuide.classList.add('active'));
    DOM.btnCloseModal.addEventListener('click', () => DOM.modalGuide.classList.remove('active'));
    DOM.btnModalGotit.addEventListener('click', () => DOM.modalGuide.classList.remove('active'));
    DOM.modalGuide.addEventListener('click', (e) => {
        if (e.target === DOM.modalGuide) DOM.modalGuide.classList.remove('active');
    });

    // Sliders
    DOM.sliderBrushSize.addEventListener('input', (e) => {
        state.brushSize = parseInt(e.target.value);
        DOM.valBrushSize.textContent = `${state.brushSize}px`;
    });
    DOM.sliderIntensity.addEventListener('input', (e) => {
        state.intensity = e.target.value / 100;
        DOM.valIntensity.textContent = `${e.target.value}%`;
    });
    DOM.sliderHue.addEventListener('input', (e) => {
        state.hueShift = parseInt(e.target.value);
        DOM.valHue.textContent = `${e.target.value}°`;
    });
}

function setMode(newMode) {
    state.mode = newMode;
    if (DOM.tabModeFacemesh) DOM.tabModeFacemesh.classList.toggle('active', newMode === 'facemesh');
    if (DOM.tabModeCanvas) DOM.tabModeCanvas.classList.toggle('active', newMode === 'canvas');
    if (DOM.tabModeAr) DOM.tabModeAr.classList.toggle('active', newMode === 'ar');

    if (newMode === 'facemesh') {
        if (DOM.facemeshBar) DOM.facemeshBar.style.display = 'flex';
        if (DOM.paletteBar) DOM.paletteBar.style.display = 'none';
        if (DOM.facemeshBox) DOM.facemeshBox.style.display = 'flex';
        if (DOM.gestureHelperBox) DOM.gestureHelperBox.style.display = 'none';
        if (DOM.arLibraryBox) DOM.arLibraryBox.style.display = 'none';
        showGestureToast('✨', '468 Face Mesh Active', 'Tracking 468 3D facial landmark points in real-time');
    } else if (newMode === 'canvas') {
        if (DOM.facemeshBar) DOM.facemeshBar.style.display = 'none';
        if (DOM.paletteBar) DOM.paletteBar.style.display = 'flex';
        if (DOM.facemeshBox) DOM.facemeshBox.style.display = 'none';
        if (DOM.gestureHelperBox) DOM.gestureHelperBox.style.display = 'flex';
        if (DOM.arLibraryBox) DOM.arLibraryBox.style.display = 'none';
        showGestureToast('🖐️', 'Air Canvas Active', '☝️ Index: Draw • 🖐️ Open Palm: Erase • ✊ Fist: Move Freely');
    } else {
        if (DOM.facemeshBar) DOM.facemeshBar.style.display = 'none';
        if (DOM.paletteBar) DOM.paletteBar.style.display = 'none';
        if (DOM.facemeshBox) DOM.facemeshBox.style.display = 'none';
        if (DOM.gestureHelperBox) DOM.gestureHelperBox.style.display = 'none';
        if (DOM.arLibraryBox) DOM.arLibraryBox.style.display = 'flex';
        
        // Sync active style card
        DOM.styleCards.forEach(card => {
            card.classList.toggle('active', card.dataset.filter === state.activeFilter);
        });
        showGestureToast('🎭', 'AR Filter Active', `Active: ${state.activeFilter.replace('_', ' ').toUpperCase()}`);
    }
}

function selectStyle(filterKey) {
    if (state.activeFilter === filterKey) return;
    state.activeFilter = filterKey;
    
    DOM.styleCards.forEach(card => {
        card.classList.toggle('active', card.dataset.filter === filterKey);
    });

    sfx.playFilterChange();
    showGestureToast('🎭', 'AR Filter Selected', `Switched to ${filterKey.replace('_', ' ').toUpperCase()}`);
}

function clearAirCanvas() {
    state.drawnStrokes = [];
    state.currentStroke = null;
    showGestureToast('🧹', 'Air Canvas Cleared', 'Board has been wiped clean');
}

function initParticles() {
    state.particles = [];
    for (let i = 0; i < 300; i++) {
        state.particles.push({
            x: 0, y: 0,
            vx: (Math.random() - 0.5) * 2.5,
            vy: -Math.random() * 4 - 1.5,
            size: Math.random() * 6 + 2,
            life: Math.random(),
            maxLife: Math.random() * 0.6 + 0.4
        });
    }
}

function showGestureToast(emoji, title, sub) {
    DOM.toastEmojiBox.textContent = emoji;
    DOM.toastTitle.textContent = title;
    DOM.toastSub.textContent = sub;
    
    DOM.gestureToast.classList.add('active');
    clearTimeout(DOM.toastTimeout);
    DOM.toastTimeout = setTimeout(() => {
        DOM.gestureToast.classList.remove('active');
    }, 2200);
}

function runCountdownSnapshot() {
    if (state.isCountdownRunning) return;
    state.isCountdownRunning = true;
    
    let count = 3;
    DOM.countdownCircle.textContent = count;
    DOM.countdownCircle.classList.add('show');
    sfx.playTone(600, 0.1);

    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            DOM.countdownCircle.textContent = count;
            sfx.playTone(600, 0.1);
        } else {
            clearInterval(timer);
            DOM.countdownCircle.classList.remove('show');
            executeSnapshot();
            state.isCountdownRunning = false;
        }
    }, 850);
}

function executeSnapshot() {
    sfx.playShutter();
    DOM.flashScreen.classList.add('flash');
    setTimeout(() => DOM.flashScreen.classList.remove('flash'), 250);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = DOM.canvas.width;
    exportCanvas.height = DOM.canvas.height;
    const eCtx = exportCanvas.getContext('2d');

    if (state.isMirrored) {
        eCtx.translate(exportCanvas.width, 0);
        eCtx.scale(-1, 1);
    }
    eCtx.drawImage(DOM.canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `VisionAR_Studio_${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
}

async function setupCameraAndModels() {
    const faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    faceMesh.onResults(handleFaceResults);

    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    hands.onResults(handleHandResults);

    const camera = new Camera(DOM.webcam, {
        onFrame: async () => {
            await faceMesh.send({ image: DOM.webcam });
            await hands.send({ image: DOM.webcam });
        },
        width: 1280,
        height: 720
    });
    
    await camera.start();
    DOM.txtCameraStatus.textContent = 'Camera Live • 60 FPS';
}

function handleFaceResults(results) {
    if (DOM.canvas.width !== DOM.webcam.videoWidth) {
        DOM.canvas.width = DOM.webcam.videoWidth || 1280;
        DOM.canvas.height = DOM.webcam.videoHeight || 720;
    }

    const ctx = DOM.ctx;
    ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);

    ctx.save();
    ctx.drawImage(results.image, 0, 0, DOM.canvas.width, DOM.canvas.height);
    ctx.restore();

    const now = performance.now();
    state.fps = Math.round(1000 / (now - state.lastFrameTime));
    state.lastFrameTime = now;
    DOM.txtCameraStatus.textContent = `Camera Live • ${state.fps} FPS`;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        state.faceLandmarks = results.multiFaceLandmarks[0];

        // Only process & render FaceMesh in 'facemesh' mode
        if (state.mode === 'facemesh') {
            updateFacialTelemetry(state.faceLandmarks);
            if (state.showFaceMesh) {
                drawDetailedFaceMesh(ctx, state.faceLandmarks);
            }
        } else if (state.mode === 'ar' && state.arEnabled) {
            // In AR mode, only render the selected AR filter (sunglasses, hat, batman, skull, cyber)
            renderActiveFilter(ctx, state.faceLandmarks);
        }
    } else {
        if (DOM.telemPts) DOM.telemPts.textContent = 'Searching...';
        if (DOM.telemEyes) DOM.telemEyes.textContent = '---';
        if (DOM.telemMouth) DOM.telemMouth.textContent = '---';
        if (DOM.telemPose) DOM.telemPose.textContent = '---';
    }
}

function updateFacialTelemetry(landmarks) {
    if (!landmarks || landmarks.length < 468) return;

    // Eye Aspect Ratio (EAR)
    const p33 = landmarks[33], p133 = landmarks[133], p160 = landmarks[160], p144 = landmarks[144], p158 = landmarks[158], p153 = landmarks[153];
    const ear = (Math.hypot(p160.x - p144.x, p160.y - p144.y) + Math.hypot(p158.x - p153.x, p158.y - p153.y)) / (2 * Math.hypot(p33.x - p133.x, p33.y - p133.y));

    // Mouth Aspect Ratio (MAR)
    const p13 = landmarks[13], p14 = landmarks[14], p61 = landmarks[61], p291 = landmarks[291];
    const mar = Math.hypot(p13.x - p14.x, p13.y - p14.y) / Math.hypot(p61.x - p291.x, p61.y - p291.y);

    // Head Pose (Roll & Yaw)
    const p263 = landmarks[263], p1 = landmarks[1];
    const rollDeg = (Math.atan2(p263.y - p33.y, p263.x - p33.x) * 180 / Math.PI).toFixed(1);
    const yawDeg = ((p1.x - (p33.x + p263.x) / 2) * 100).toFixed(1);

    if (DOM.telemPts) DOM.telemPts.textContent = '468 / 468 (100%)';
    if (DOM.telemEyes) DOM.telemEyes.textContent = ear < 0.20 ? 'Blinking 👁️' : `Open (${ear.toFixed(2)})`;
    if (DOM.telemMouth) DOM.telemMouth.textContent = mar > 0.35 ? 'Open / Smile 😃' : 'Neutral 😐';
    if (DOM.telemPose) DOM.telemPose.textContent = `${rollDeg}° / ${yawDeg}°`;
}

function drawDetailedFaceMesh(ctx, landmarks) {
    if (!landmarks) return;
    const w = DOM.canvas.width, h = DOM.canvas.height;
    ctx.save();

    // 1. Draw Mesh Triangulation Tessellation
    if (state.showTesselation && typeof FACEMESH_TESSELATION !== 'undefined') {
        drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, { 
            color: state.meshColor + '55', 
            lineWidth: 1 
        });
    }

    // 2. Draw Key Facial Contours (Eyes, Lips, Face Oval)
    if (typeof FACEMESH_RIGHT_EYE !== 'undefined') {
        drawConnectors(ctx, landmarks, FACEMESH_RIGHT_EYE, { color: '#ffffff', lineWidth: 1.8 });
        drawConnectors(ctx, landmarks, FACEMESH_LEFT_EYE, { color: '#ffffff', lineWidth: 1.8 });
        drawConnectors(ctx, landmarks, FACEMESH_LIPS, { color: '#ffffff', lineWidth: 2 });
        drawConnectors(ctx, landmarks, FACEMESH_FACE_OVAL, { color: state.meshColor, lineWidth: 2.2 });
    }

    // 3. Draw 468 Landmark Node Points
    if (state.showNodes) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = state.meshColor;
        ctx.shadowBlur = 6;
        for (let i = 0; i < landmarks.length; i += 2) {
            const px = landmarks[i].x * w;
            const py = landmarks[i].y * h;
            ctx.beginPath();
            ctx.arc(px, py, 1.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 4. Live Floating HUD Box above head
    const forehead = landmarks[10];
    if (forehead) {
        const hx = forehead.x * w;
        const hy = forehead.y * h - 25;
        ctx.font = 'bold 12px "Space Grotesk", monospace';
        ctx.fillStyle = state.meshColor;
        ctx.shadowColor = state.meshColor;
        ctx.shadowBlur = 10;
        ctx.fillText(`[468 FACE MESH] LIVE 60 FPS`, hx - 85, hy);
    }

    ctx.restore();
}

function handleHandResults(results) {
    const ctx = DOM.ctx;

    // Only process & render hand gestures in 'canvas' mode
    if (state.mode === 'canvas') {
        renderDrawnStrokes(ctx);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            state.handLandmarks = results.multiHandLandmarks[0];
            
            if (state.showHandLandmarks) {
                drawConnectors(ctx, state.handLandmarks, HAND_CONNECTIONS, { color: '#ffffff', lineWidth: 2 });
                drawLandmarks(ctx, state.handLandmarks, { color: '#e4e4e7', lineWidth: 1, radius: 3 });
            }

            const gesture = classifyFingerGesture(state.handLandmarks);
            processFingerDrawing(ctx, state.handLandmarks, gesture);
        } else {
            state.handLandmarks = null;
            state.currentStroke = null;
            state.smoothX = null;
            state.smoothY = null;
            updateRuleHighlight(null);
        }
    }
}

function isFingerExtended(landmarks, tipIdx, pipIdx) {
    const wrist = landmarks[0];
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    
    const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y, (tip.z || 0) - (wrist.z || 0));
    const pipDist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y, (pip.z || 0) - (wrist.z || 0));
    
    return tipDist > (pipDist * 1.10);
}

function classifyFingerGesture(landmarks) {
    const isIndexExt = isFingerExtended(landmarks, 8, 6);
    const isMiddleExt = isFingerExtended(landmarks, 12, 10);
    const isRingExt = isFingerExtended(landmarks, 16, 14);
    const isPinkyExt = isFingerExtended(landmarks, 20, 18);

    const countFingers = [isIndexExt, isMiddleExt, isRingExt, isPinkyExt].filter(Boolean).length;

    if (countFingers >= 4 || (isIndexExt && isMiddleExt && isRingExt && isPinkyExt)) {
        return 'ERASE_PALM';
    }
    if (countFingers === 1 && isIndexExt) {
        return 'DRAW_INDEX';
    }
    if (countFingers === 0) {
        return 'MOVE_NAVIGATE';
    }
    return 'MOVE_NAVIGATE';
}

function processFingerDrawing(ctx, landmarks, gesture) {
    const w = DOM.canvas.width, h = DOM.canvas.height;
    
    const targetLm = (gesture === 'DRAW_INDEX') ? landmarks[8] : landmarks[9];

    const rawX = state.isMirrored ? (targetLm.x * w) : ((1 - targetLm.x) * w);
    const rawY = targetLm.y * h;

    if (state.smoothX === null) {
        state.smoothX = rawX;
        state.smoothY = rawY;
    } else {
        state.smoothX += (rawX - state.smoothX) * state.smoothingFactor;
        state.smoothY += (rawY - state.smoothY) * state.smoothingFactor;
    }

    const ptX = state.smoothX;
    const ptY = state.smoothY;

    updateRuleHighlight(gesture);

    if (state.mode === 'canvas') {
        switch (gesture) {
            case 'DRAW_INDEX':
                DOM.txtGestureEmoji.textContent = '☝️';
                DOM.txtGestureName.textContent = 'Index: DRAWING';

                if (!state.currentStroke) {
                    state.currentStroke = {
                        color: state.currentColor,
                        size: state.brushSize,
                        points: []
                    };
                    state.drawnStrokes.push(state.currentStroke);
                }
                state.currentStroke.points.push({ x: ptX, y: ptY });

                ctx.save();
                ctx.fillStyle = state.currentColor;
                ctx.shadowColor = state.currentColor;
                ctx.shadowBlur = 18;
                ctx.beginPath();
                ctx.arc(ptX, ptY, state.brushSize * 0.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                break;

            case 'ERASE_PALM':
                DOM.txtGestureEmoji.textContent = '🖐️';
                DOM.txtGestureName.textContent = 'Open Palm: WHITEBOARD ERASER';
                state.currentStroke = null;

                const eraseRadius = Math.max(state.brushSize * 9, 120);
                eraseStrokesAtPoint(ptX, ptY, eraseRadius);

                ctx.save();
                ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 3.5;
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 22;
                ctx.beginPath();
                ctx.arc(ptX, ptY, eraseRadius, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();
                
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px Plus Jakarta Sans, sans-serif';
                ctx.fillText('PALM ERASER', ptX - 48, ptY + 4);
                ctx.restore();
                break;

            case 'MOVE_NAVIGATE':
                DOM.txtGestureEmoji.textContent = '✊';
                DOM.txtGestureName.textContent = 'Fist: MOVE FREELY';
                state.currentStroke = null;

                ctx.save();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2.5;
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(ptX, ptY, 14, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                break;
        }
    }
}

function eraseStrokesAtPoint(x, y, radius) {
    const newStrokes = [];
    state.drawnStrokes.forEach(stroke => {
        let currentSegment = [];
        stroke.points.forEach(pt => {
            const dist = Math.hypot(pt.x - x, pt.y - y);
            if (dist > radius) {
                currentSegment.push(pt);
            } else {
                if (currentSegment.length > 0) {
                    newStrokes.push({ color: stroke.color, size: stroke.size, points: currentSegment });
                    currentSegment = [];
                }
            }
        });
        if (currentSegment.length > 0) {
            newStrokes.push({ color: stroke.color, size: stroke.size, points: currentSegment });
        }
    });
    state.drawnStrokes = newStrokes;
}

function renderDrawnStrokes(ctx) {
    ctx.save();
    state.drawnStrokes.forEach(stroke => {
        if (stroke.points.length < 2) return;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = stroke.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
    });
    ctx.restore();
}

function updateRuleHighlight(gesture) {
    if (!DOM.ruleIndex) return;
    DOM.ruleIndex.classList.toggle('active-spec', gesture === 'DRAW_INDEX');
    DOM.rulePalm.classList.toggle('active-spec', gesture === 'ERASE_PALM');
    DOM.ruleFist.classList.toggle('active-spec', gesture === 'MOVE_NAVIGATE');
}

// -------------------------------------------------------------
// 3D FACEMESH SKIN CONTOUR AR LAYER MAPPING ENGINE
// -------------------------------------------------------------

function getPoint(lm, idx, w, h) {
    return { x: lm[idx].x * w, y: lm[idx].y * h };
}

function renderActiveFilter(ctx, landmarks) {
    const w = DOM.canvas.width, h = DOM.canvas.height;
    if (state.hueShift !== 0) ctx.filter = `hue-rotate(${state.hueShift}deg)`;

    // 1. Extract 3D Key Landmarks
    const eyeL = getPoint(landmarks, 33, w, h);
    const eyeR = getPoint(landmarks, 263, w, h);
    const noseBridge = getPoint(landmarks, 6, w, h);
    const noseTip = getPoint(landmarks, 1, w, h);
    const forehead = getPoint(landmarks, 10, w, h);
    const chin = getPoint(landmarks, 152, w, h);
    const cheekL = getPoint(landmarks, 234, w, h);
    const cheekR = getPoint(landmarks, 454, w, h);

    // 2. Compute Raw Transformation Metrics (Roll Angle, Scale, Center)
    const rawAngle = Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x);
    const rawEyeMidX = (eyeL.x + eyeR.x) / 2;
    const rawEyeMidY = (eyeL.y + eyeR.y) / 2;
    const rawEyeDist = Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y);
    const rawFaceH = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);

    // 3. Temporal Exponential Low-Pass Filter (Eliminates Jitter)
    const sf = state.smoothFace;
    const alpha = 0.35;

    if (sf.x === null) {
        sf.x = rawEyeMidX;
        sf.y = rawEyeMidY;
        sf.scale = rawEyeDist;
        sf.angle = rawAngle;
        sf.height = rawFaceH;
        sf.foreheadX = forehead.x;
        sf.foreheadY = forehead.y;
    } else {
        sf.x = alpha * rawEyeMidX + (1 - alpha) * sf.x;
        sf.y = alpha * rawEyeMidY + (1 - alpha) * sf.y;
        sf.scale = alpha * rawEyeDist + (1 - alpha) * sf.scale;
        sf.angle = alpha * rawAngle + (1 - alpha) * sf.angle;
        sf.height = alpha * rawFaceH + (1 - alpha) * sf.height;
        sf.foreheadX = alpha * forehead.x + (1 - alpha) * sf.foreheadX;
        sf.foreheadY = alpha * forehead.y + (1 - alpha) * sf.foreheadY;
    }

    // 4. Render Active AR Filter Layer
    switch (state.activeFilter) {
        case 'sunglasses':
            drawAviatorGlassesSkinLayer(ctx, sf, landmarks, w, h);
            break;
        case 'top_hat':
            drawTopHatSkinLayer(ctx, sf, eyeR, landmarks, w, h);
            break;
        case 'batman':
            drawBatmanCowlSkinLayer(ctx, sf, eyeL, eyeR, landmarks, w, h);
            break;
        case 'skeleton':
            draw3DSkullSkinLayer(ctx, sf, chin, landmarks, w, h);
            break;
        case 'cyberpunk':
            drawClassicCyberFilter(ctx, sf, eyeL, eyeR, forehead, chin, landmarks, w, h);
            break;
    }

    ctx.filter = 'none';
}

// 1. MODERN LUXURY BLACK WAYFARER SUNGLASSES (GLOSS ONYX ACETATE + SMOKED POLARIZED LENSES + SILVER RIVETS + SPECULAR GLARES)
function drawAviatorGlassesSkinLayer(ctx, sf, lm, w, h) {
    ctx.save();
    // Anchor over the eyes & nose bridge for realistic ergonomic fit
    ctx.translate(sf.x, sf.y + sf.scale * 0.04);
    ctx.rotate(sf.angle);

    const s = sf.scale * 0.0105 * (state.intensity || 1.0);
    const eyeDist = sf.scale * 0.46;

    // A) Frame Colors & Gradients
    const frameGrad = ctx.createLinearGradient(0, -35 * s, 0, 35 * s);
    frameGrad.addColorStop(0, '#27272a'); // subtle light on top rim
    frameGrad.addColorStop(0.2, '#18181b');
    frameGrad.addColorStop(0.8, '#09090b');
    frameGrad.addColorStop(1, '#000000');

    const frameHighlight = ctx.createLinearGradient(0, -30 * s, 0, -15 * s);
    frameHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    frameHighlight.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

    // B) Smoked Polarized Lens Gradient (Deep tinted black/charcoal)
    const lensGrad = ctx.createLinearGradient(0, -25 * s, 0, 35 * s);
    lensGrad.addColorStop(0, 'rgba(10, 15, 25, 0.96)');
    lensGrad.addColorStop(0.45, 'rgba(18, 24, 38, 0.92)');
    lensGrad.addColorStop(1, 'rgba(30, 41, 59, 0.85)');

    // Helper: Create smooth Wayfarer lens path
    function createLensPath(centerX, flip) {
        ctx.beginPath();
        const dir = flip ? -1 : 1;
        ctx.moveTo(centerX - 24 * s * dir, -18 * s);
        ctx.lineTo(centerX + 26 * s * dir, -22 * s);
        ctx.quadraticCurveTo(centerX + 34 * s * dir, -20 * s, centerX + 32 * s * dir, -10 * s);
        ctx.lineTo(centerX + 24 * s * dir, 16 * s);
        ctx.quadraticCurveTo(centerX + 18 * s * dir, 28 * s, centerX + 8 * s * dir, 28 * s);
        ctx.lineTo(centerX - 10 * s * dir, 26 * s);
        ctx.quadraticCurveTo(centerX - 24 * s * dir, 24 * s, centerX - 25 * s * dir, 10 * s);
        ctx.lineTo(centerX - 25 * s * dir, -8 * s);
        ctx.quadraticCurveTo(centerX - 25 * s * dir, -18 * s, centerX - 24 * s * dir, -18 * s);
        ctx.closePath();
    }

    // 1. Cast Subtle Drop Shadow onto Face
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 12 * s;
    ctx.shadowOffsetY = 6 * s;

    // 2. Draw Acetate Frame Wings / Temples (extending toward ears)
    ctx.fillStyle = frameGrad;
    ctx.beginPath();
    ctx.moveTo(-eyeDist - 30 * s, -24 * s);
    ctx.lineTo(-eyeDist - 65 * s, -20 * s);
    ctx.lineTo(-eyeDist - 65 * s, -6 * s);
    ctx.lineTo(-eyeDist - 30 * s, -2 * s);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(eyeDist + 30 * s, -24 * s);
    ctx.lineTo(eyeDist + 65 * s, -20 * s);
    ctx.lineTo(eyeDist + 65 * s, -6 * s);
    ctx.lineTo(eyeDist + 30 * s, -2 * s);
    ctx.closePath();
    ctx.fill();

    // 3. Central Keyhole Nose Bridge
    ctx.beginPath();
    ctx.moveTo(-eyeDist + 24 * s, -20 * s);
    ctx.quadraticCurveTo(0, -23 * s, eyeDist - 24 * s, -20 * s);
    ctx.lineTo(eyeDist - 24 * s, -6 * s);
    ctx.quadraticCurveTo(0, -15 * s, -eyeDist + 24 * s, -6 * s);
    ctx.closePath();
    ctx.fill();

    // Reset shadow for lens interiors
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 4. Draw Left & Right Lenses + Gloss Rims
    [-1, 1].forEach((dir) => {
        const flip = dir > 0;
        const centerX = dir * eyeDist;

        // Draw Thick Acetate Outer Rim
        createLensPath(centerX, flip);
        ctx.fillStyle = frameGrad;
        ctx.lineWidth = 10 * s;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = frameGrad;
        ctx.stroke();

        // Fill Smoked Lens
        createLensPath(centerX, flip);
        ctx.fillStyle = lensGrad;
        ctx.fill();

        // Lens Inner Rim Bevel
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 1.5 * s;
        ctx.stroke();

        // Premium Specular Glare Reflection (Diagonal Highlights)
        ctx.save();
        createLensPath(centerX, flip);
        ctx.clip(); // Strictly clip reflection to inside lens

        const glare1 = ctx.createLinearGradient(centerX - 35 * s, -35 * s, centerX + 35 * s, 35 * s);
        glare1.addColorStop(0.15, 'rgba(255, 255, 255, 0.0)');
        glare1.addColorStop(0.35, 'rgba(255, 255, 255, 0.40)');
        glare1.addColorStop(0.48, 'rgba(255, 255, 255, 0.08)');
        glare1.addColorStop(0.55, 'rgba(255, 255, 255, 0.22)');
        glare1.addColorStop(0.70, 'rgba(255, 255, 255, 0.0)');

        ctx.fillStyle = glare1;
        ctx.fillRect(centerX - 50 * s, -50 * s, 100 * s, 100 * s);

        const skyGrad = ctx.createLinearGradient(0, -20 * s, 0, 5 * s);
        skyGrad.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
        skyGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(centerX - 50 * s, -30 * s, 100 * s, 35 * s);

        ctx.restore();

        // Iconic Silver Metallic Pill Rivet on outer frame corner
        const rivetX = centerX + (flip ? 31 * s : -31 * s);
        const rivetY = -21 * s;
        ctx.save();
        ctx.translate(rivetX, rivetY);
        ctx.rotate(flip ? -0.15 : 0.15);
        ctx.fillStyle = '#e4e4e7';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        ctx.shadowBlur = 2 * s;
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.2 * s, 1.6 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // 5. Glossy Frame Top Highlight (Catching light along upper brow)
    ctx.strokeStyle = frameHighlight;
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.moveTo(-eyeDist - 26 * s, -25 * s);
    ctx.quadraticCurveTo(0, -29 * s, eyeDist + 26 * s, -25 * s);
    ctx.stroke();

    ctx.restore();
}

// 2. VICTORIAN TOP HAT & GOLDEN MONOCLE
function drawTopHatSkinLayer(ctx, sf, eyeR, lm, w, h) {
    const s = sf.scale * 0.01 * state.intensity;

    // --- A) TOP HAT ---
    ctx.save();
    ctx.translate(sf.foreheadX, sf.foreheadY - 20 * s);
    ctx.rotate(sf.angle);

    const hatW = 140 * s;
    const hatH = 130 * s;

    // 1. Curved Velvet Brim
    const brimGrad = ctx.createRadialGradient(0, 0, 10 * s, 0, 0, hatW * 0.7);
    brimGrad.addColorStop(0, '#27272a');
    brimGrad.addColorStop(0.7, '#09090b');
    brimGrad.addColorStop(1, '#000000');

    ctx.fillStyle = brimGrad;
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.ellipse(0, 0, hatW * 0.72, 22 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. Satin Silk Crown
    const crownGrad = ctx.createLinearGradient(-hatW * 0.5, 0, hatW * 0.5, 0);
    crownGrad.addColorStop(0, '#18181b');
    crownGrad.addColorStop(0.3, '#3f3f46');
    crownGrad.addColorStop(0.7, '#18181b');
    crownGrad.addColorStop(1, '#09090b');

    ctx.fillStyle = crownGrad;
    ctx.beginPath();
    ctx.moveTo(-hatW * 0.48, -4 * s);
    ctx.lineTo(-hatW * 0.52, -hatH);
    ctx.quadraticCurveTo(0, -hatH - 12 * s, hatW * 0.52, -hatH);
    ctx.lineTo(hatW * 0.48, -4 * s);
    ctx.quadraticCurveTo(0, 8 * s, -hatW * 0.48, -4 * s);
    ctx.closePath();
    ctx.fill();

    // 3. Satin Ribbon Band with Gold Buckle
    ctx.fillStyle = '#dc2626'; // Deep Crimson Satin Band
    ctx.beginPath();
    ctx.ellipse(0, -12 * s, hatW * 0.48, 14 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gold Buckle
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3.5 * s;
    ctx.strokeRect(-12 * s, -18 * s, 24 * s, 14 * s);

    ctx.restore();

    // --- B) ANTIQUE GOLDEN MONOCLE ---
    ctx.save();
    ctx.translate(eyeR.x, eyeR.y);
    ctx.rotate(sf.angle);

    const monoRadius = 26 * s;

    // Translucent Blue Glass Lens
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, monoRadius, 0, Math.PI * 2);
    ctx.fill();

    // Specular Glint
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(0, 0, monoRadius * 0.75, Math.PI * 1.1, Math.PI * 1.6);
    ctx.stroke();

    // Antique Gold Rim
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 3.5 * s;
    ctx.shadowColor = '#eab308';
    ctx.shadowBlur = 8 * s;
    ctx.beginPath();
    ctx.arc(0, 0, monoRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Golden Chain Link Draping Down
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.85)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(monoRadius * 0.8, monoRadius * 0.6);
    ctx.quadraticCurveTo(monoRadius * 2.2, monoRadius * 3, monoRadius * 1.2, monoRadius * 5.5);
    ctx.stroke();

    ctx.restore();
}

// 3. BATMAN DARK KNIGHT TACTICAL COWL
function drawBatmanCowlSkinLayer(ctx, sf, eyeL, eyeR, lm, w, h) {
    const s = sf.scale * 0.01 * state.intensity;
    ctx.save();
    ctx.translate(sf.x, sf.y);
    ctx.rotate(sf.angle);

    const faceW = sf.scale * 1.4;

    // Matte Carbon Fiber Gradient
    const cowlGrad = ctx.createLinearGradient(0, -120 * s, 0, 60 * s);
    cowlGrad.addColorStop(0, '#09090b');
    cowlGrad.addColorStop(0.5, '#18181b');
    cowlGrad.addColorStop(1, '#020617');

    ctx.fillStyle = cowlGrad;
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2 * s;

    // Bat Cowl Polygon (Pointed Bat Ears + Brow + Nose + Cheeks)
    ctx.beginPath();
    ctx.moveTo(0, -60 * s); // Forehead center
    // Left Ear
    ctx.lineTo(-40 * s, -50 * s);
    ctx.lineTo(-65 * s, -145 * s); // Ear peak
    ctx.lineTo(-80 * s, -35 * s);
    // Left Temple & Cheek Guard
    ctx.lineTo(-75 * s, 25 * s);
    ctx.lineTo(-45 * s, 45 * s); // Cheek contour
    // Nose Armor Bevel
    ctx.lineTo(-14 * s, 15 * s);
    ctx.lineTo(0, 38 * s); // Nose point
    ctx.lineTo(14 * s, 15 * s);
    // Right Cheek Guard
    ctx.lineTo(45 * s, 45 * s);
    ctx.lineTo(75 * s, 25 * s);
    // Right Ear
    ctx.lineTo(80 * s, -35 * s);
    ctx.lineTo(65 * s, -145 * s); // Ear peak
    ctx.lineTo(40 * s, -50 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Chiseled Center Crease Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(0, -60 * s);
    ctx.lineTo(0, 38 * s);
    ctx.stroke();

    // Glowing Tactical White-Cyan Ocular Lenses
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 20 * s;

    const eyeOffsetX = sf.scale * 0.45;
    [-eyeOffsetX, eyeOffsetX].forEach((ex, idx) => {
        ctx.save();
        ctx.translate(ex, 0);
        ctx.rotate(idx === 0 ? -0.15 : 0.15);
        ctx.beginPath();
        ctx.moveTo(-18 * s, -6 * s);
        ctx.lineTo(18 * s, -4 * s);
        ctx.lineTo(12 * s, 6 * s);
        ctx.lineTo(-16 * s, 2 * s);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    });

    ctx.restore();
}

// 4. 3D CYBER SKULL / ANATOMICAL MASK
function draw3DSkullSkinLayer(ctx, sf, chin, lm, w, h) {
    const s = sf.scale * 0.01 * state.intensity;
    ctx.save();
    const faceMidY = (sf.foreheadY + chin.y) / 2;
    ctx.translate(sf.x, faceMidY);
    ctx.rotate(sf.angle);

    const skullW = 85 * s;
    const skullH = sf.height * 0.58;

    // Bone Ivory Radial Shading
    const boneGrad = ctx.createRadialGradient(0, -10 * s, 10 * s, 0, 0, skullW * 1.1);
    boneGrad.addColorStop(0, '#f4f4f5');
    boneGrad.addColorStop(0.6, '#e4e4e7');
    boneGrad.addColorStop(1, '#a1a1aa');

    ctx.fillStyle = boneGrad;
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 3 * s;

    // Skull Outer Shell
    ctx.beginPath();
    ctx.ellipse(0, 0, skullW, skullH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hollow Orbital Sockets (Black with Glowing Cyan Pupils)
    [-34 * s, 34 * s].forEach(ex => {
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.ellipse(ex, -18 * s, 20 * s, 24 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glowing Pupil
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 15 * s;
        ctx.beginPath();
        ctx.arc(ex, -18 * s, 5 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Inverted Triangular Nasal Cavity
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.moveTo(0, 4 * s);
    ctx.lineTo(10 * s, 22 * s);
    ctx.lineTo(-10 * s, 22 * s);
    ctx.closePath();
    ctx.fill();

    // Anatomical Teeth Line & Enamel Separators
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.moveTo(-45 * s, 46 * s);
    ctx.lineTo(45 * s, 46 * s);
    ctx.stroke();

    for (let i = -36 * s; i <= 36 * s; i += 12 * s) {
        ctx.beginPath();
        ctx.moveTo(i, 36 * s);
        ctx.lineTo(i, 56 * s);
        ctx.stroke();
    }

    ctx.restore();
}

// 5. CYBER MATRIX HUD (ANIMATED SCI-FI RETICLES)
function drawClassicCyberFilter(ctx, sf, eyeL, eyeR, forehead, chin, lm, w, h) {
    ctx.save();
    const time = performance.now() * 0.003;

    ctx.strokeStyle = '#00f0ff';
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 14;

    // A) Rotating Eye Targeting Reticles
    [eyeL, eyeR].forEach((eye, idx) => {
        const radius = sf.scale * 0.34 * state.intensity;
        const dir = idx === 0 ? 1 : -1;
        
        ctx.save();
        ctx.translate(eye.x, eye.y);
        ctx.rotate(time * dir);

        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 1.4);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.65, Math.PI * 0.5, Math.PI * 1.8);
        ctx.stroke();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(-radius * 1.25, 0); ctx.lineTo(-radius * 0.75, 0);
        ctx.moveTo(radius * 0.75, 0); ctx.lineTo(radius * 1.25, 0);
        ctx.moveTo(0, -radius * 1.25); ctx.lineTo(0, -radius * 0.75);
        ctx.moveTo(0, radius * 0.75); ctx.lineTo(0, radius * 1.25);
        ctx.stroke();

        ctx.restore();
    });

    // B) Vertical Hologram Scan Beam
    const scanY = sf.foreheadY + ((Math.sin(time * 1.8) + 1) / 2) * sf.height;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sf.x - sf.scale * 1.4, scanY);
    ctx.lineTo(sf.x + sf.scale * 1.4, scanY);
    ctx.stroke();

    // C) Telemetry Data Readout
    ctx.font = 'bold 12px "Space Grotesk", monospace';
    ctx.shadowBlur = 8;
    ctx.fillText(`[TARGET_LOCKED] 468_PTS • ROLL: ${(sf.angle * 180 / Math.PI).toFixed(1)}°`, sf.x - sf.scale * 1.2, sf.foreheadY - 24);
    ctx.fillText(`FPS: ${state.fps} • CONFIDENCE: 99.8%`, sf.x - sf.scale * 1.2, sf.foreheadY - 8);

    ctx.restore();
}

function drawMeshWireframe(ctx, landmarks) {
    ctx.save();
    const w = DOM.canvas.width, h = DOM.canvas.height;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < landmarks.length; i += 3) {
        ctx.fillRect(landmarks[i].x * w, landmarks[i].y * h, 1.5, 1.5);
    }
    ctx.restore();
}

window.addEventListener('DOMContentLoaded', startApp);
