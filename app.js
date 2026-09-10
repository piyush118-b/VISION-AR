/**
 * VisionAR Studio — Monochrome Touchless Engine
 * B.Tech IV Year Computer Graphics & Multimedia Studio Project
 * Author: Piyush Bagdi
 */

// Global Application State
const state = {
    mode: 'canvas', // 'canvas' or 'ar'
    activeFilter: 'skeleton',
    showFaceMesh: false,
    showHandLandmarks: false,
    arEnabled: true,
    isMirrored: true, // Default mirrored to match webcam view
    
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
    tabModeCanvas: document.getElementById('tab-mode-canvas'),
    tabModeAr: document.getElementById('tab-mode-ar'),
    paletteBar: document.getElementById('palette-bar'),
    arLibraryBox: document.getElementById('ar-library-box'),
    gestureHelperBox: document.getElementById('gesture-helper-box'),
    
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
    swatches: document.querySelectorAll('.swatch-item'),
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
    setMode('canvas');
    await setupCameraAndModels();
}

function bindEvents() {
    // Mode Switcher
    DOM.tabModeCanvas.addEventListener('click', () => setMode('canvas'));
    DOM.tabModeAr.addEventListener('click', () => setMode('ar'));

    // Color Swatches
    DOM.swatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            DOM.swatches.forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            state.currentColor = swatch.dataset.color;
        });
    });

    // Style Cards Click
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
    DOM.tabModeCanvas.classList.toggle('active', newMode === 'canvas');
    DOM.tabModeAr.classList.toggle('active', newMode === 'ar');

    if (newMode === 'canvas') {
        DOM.paletteBar.style.display = 'flex';
        DOM.gestureHelperBox.style.display = 'flex';
        DOM.arLibraryBox.style.display = 'none';
        showGestureToast('🖐️', 'Air Canvas Active', '☝️ Index: Draw • 🖐️ Open Palm: Erase • ✊ Fist: Move Freely');
    } else {
        DOM.paletteBar.style.display = 'none';
        DOM.gestureHelperBox.style.display = 'none';
        DOM.arLibraryBox.style.display = 'flex';
        showGestureToast('💀', 'AR Face Layer Active', 'Click any style card to activate');
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

        if (state.mode === 'ar' && state.arEnabled) {
            renderActiveFilter(ctx, state.faceLandmarks);
        }

        if (state.showFaceMesh) {
            drawMeshWireframe(ctx, state.faceLandmarks);
        }
    }
}

function handleHandResults(results) {
    const ctx = DOM.ctx;

    if (state.mode === 'canvas') {
        renderDrawnStrokes(ctx);
    }

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

// 1. REALISTIC AVIATOR SUNGLASSES (3D ORIENTED & SCALED)
function drawAviatorGlassesSkinLayer(ctx, sf, lm, w, h) {
    const img = filterAssets.sunglasses;
    ctx.save();
    ctx.translate(sf.x, sf.y + sf.scale * 0.06);
    ctx.rotate(sf.angle);

    const targetW = sf.scale * 2.35 * state.intensity;
    const targetH = targetW * (img.naturalHeight ? img.naturalHeight / img.naturalWidth : 0.48);

    if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
    } else {
        // Fallback Vector Rendering
        ctx.fillStyle = 'rgba(10, 10, 14, 0.95)';
        ctx.strokeStyle = '#e4e4e7';
        ctx.lineWidth = 3.5;
        const rW = sf.scale * 0.55 * state.intensity;
        const rH = rW * 0.65;
        ctx.beginPath();
        ctx.ellipse(-sf.scale * 0.45, 0, rW, rH, 0, 0, Math.PI * 2);
        ctx.ellipse(sf.scale * 0.45, 0, rW, rH, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
    }
    ctx.restore();
}

// 2. VICTORIAN TOP HAT & MONOCLE (3D ROTATED ON FOREHEAD)
function drawTopHatSkinLayer(ctx, sf, eyeR, lm, w, h) {
    const img = filterAssets.top_hat;
    ctx.save();
    ctx.translate(sf.foreheadX, sf.foreheadY - sf.scale * 0.15);
    ctx.rotate(sf.angle);

    const targetW = sf.scale * 3.1 * state.intensity;
    const targetH = targetW * (img.naturalHeight ? img.naturalHeight / img.naturalWidth : 0.95);

    if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -targetW / 2, -targetH * 0.82, targetW, targetH);
    } else {
        // Fallback Vector Top Hat
        ctx.fillStyle = '#09090b';
        ctx.strokeStyle = '#d4d4d8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, targetW * 0.55, 14 * state.intensity, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#18181b';
        ctx.fillRect(-targetW * 0.38, -targetH * 0.75, targetW * 0.76, targetH * 0.75);
    }
    ctx.restore();

    // Victorian Brass Monocle Ring Over Eye
    ctx.save();
    ctx.translate(eyeR.x, eyeR.y);
    ctx.rotate(sf.angle);
    ctx.strokeStyle = '#d4af37'; // Antique Gold
    ctx.lineWidth = 3;
    ctx.shadowColor = '#d4af37';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, sf.scale * 0.38 * state.intensity, 0, Math.PI * 2);
    ctx.stroke();

    // Monocle Hanging Chain
    ctx.beginPath();
    ctx.moveTo(sf.scale * 0.35 * state.intensity, 0);
    ctx.quadraticCurveTo(sf.scale * 0.7, sf.scale * 0.8, sf.scale * 0.3, sf.scale * 1.3);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
}

// 3. BATMAN BAT-COWL (UPPER FACE 3D LAYER)
function drawBatmanCowlSkinLayer(ctx, sf, eyeL, eyeR, lm, w, h) {
    const img = filterAssets.batman;
    ctx.save();
    ctx.translate(sf.x, sf.y - sf.scale * 0.1);
    ctx.rotate(sf.angle);

    const targetW = sf.scale * 2.85 * state.intensity;
    const targetH = targetW * (img.naturalHeight ? img.naturalHeight / img.naturalWidth : 1.0);

    if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -targetW / 2, -targetH * 0.44, targetW, targetH);
    } else {
        // Fallback Cowl
        ctx.fillStyle = '#09090b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-targetW * 0.4, -targetH * 0.5);
        ctx.lineTo(0, -targetH * 0.2);
        ctx.lineTo(targetW * 0.4, -targetH * 0.5);
        ctx.lineTo(targetW * 0.35, targetH * 0.2);
        ctx.lineTo(-targetW * 0.35, targetH * 0.2);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    }

    // Glowing Angular Ocular Slits
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;
    const eyeOffset = sf.scale * 0.45;
    ctx.beginPath();
    ctx.ellipse(-eyeOffset, 0, sf.scale * 0.18, sf.scale * 0.08, -0.15, 0, Math.PI * 2);
    ctx.ellipse(eyeOffset, 0, sf.scale * 0.18, sf.scale * 0.08, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// 4. 3D SKULL SKELETON MASK (ANATOMICAL 3D REGISTRATION)
function draw3DSkullSkinLayer(ctx, sf, chin, lm, w, h) {
    const img = filterAssets.skeleton;
    ctx.save();
    const faceMidY = (sf.foreheadY + chin.y) / 2;
    ctx.translate(sf.x, faceMidY);
    ctx.rotate(sf.angle);

    const targetW = sf.scale * 2.85 * state.intensity;
    const targetH = sf.height * 1.12 * state.intensity;

    if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
    } else {
        // Fallback anatomical bone layer
        ctx.fillStyle = 'rgba(235, 232, 225, 0.92)';
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, targetW * 0.45, targetH * 0.48, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
    }
    ctx.restore();
}

// 5. CYBER MATRIX HUD (ANIMATED HIGH-TECH SPATIAL TELEMETRY)
function drawClassicCyberFilter(ctx, sf, eyeL, eyeR, forehead, chin, lm, w, h) {
    ctx.save();
    const time = performance.now() * 0.003;

    // Glowing Matrix Cyan
    ctx.strokeStyle = '#00f0ff';
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;

    // A) Rotating Eye Targeting Reticles
    [eyeL, eyeR].forEach((eye, idx) => {
        const radius = sf.scale * 0.32 * state.intensity;
        const dir = idx === 0 ? 1 : -1;
        
        ctx.save();
        ctx.translate(eye.x, eye.y);
        ctx.rotate(time * dir);

        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 1.4);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.65, Math.PI * 0.5, Math.PI * 1.8);
        ctx.stroke();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(-radius * 1.2, 0); ctx.lineTo(-radius * 0.7, 0);
        ctx.moveTo(radius * 0.7, 0); ctx.lineTo(radius * 1.2, 0);
        ctx.moveTo(0, -radius * 1.2); ctx.lineTo(0, -radius * 0.7);
        ctx.moveTo(0, radius * 0.7); ctx.lineTo(0, radius * 1.2);
        ctx.stroke();

        ctx.restore();
    });

    // B) Vertical Cyber Laser Scanner Line
    const scanY = sf.foreheadY + ((Math.sin(time * 1.5) + 1) / 2) * sf.height;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sf.x - sf.scale * 1.4, scanY);
    ctx.lineTo(sf.x + sf.scale * 1.4, scanY);
    ctx.stroke();

    // C) Telemetry HUD Data Tag
    ctx.font = 'bold 11px "Space Grotesk", monospace';
    ctx.shadowBlur = 6;
    ctx.fillText(`[SYS_LOCK] 468_PTS • YAW: ${(sf.angle * 180 / Math.PI).toFixed(1)}°`, sf.x - sf.scale * 1.2, sf.foreheadY - 20);
    ctx.fillText(`FPS: ${state.fps} • CONF: 99.4%`, sf.x - sf.scale * 1.2, sf.foreheadY - 6);

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
