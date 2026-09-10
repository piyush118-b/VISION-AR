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

// 1. LUXURY AVIATOR SUNGLASSES (POLARIZED LENSES + GOLD FRAME + GLARE)
function drawAviatorGlassesSkinLayer(ctx, sf, lm, w, h) {
    ctx.save();
    ctx.translate(sf.x, sf.y + sf.scale * 0.05);
    ctx.rotate(sf.angle);

    const s = sf.scale * 0.011 * state.intensity; // scale factor
    const eyeDist = sf.scale * 0.48;

    // A) Metallic Gold Frame Gradient
    const goldGrad = ctx.createLinearGradient(-sf.scale, -30 * s, sf.scale, 30 * s);
    goldGrad.addColorStop(0, '#fef08a');
    goldGrad.addColorStop(0.3, '#eab308');
    goldGrad.addColorStop(0.7, '#ca8a04');
    goldGrad.addColorStop(1, '#fef08a');

    // B) Polarized Dark Lens Gradient
    const lensGrad = ctx.createLinearGradient(0, -35 * s, 0, 45 * s);
    lensGrad.addColorStop(0, 'rgba(30, 41, 59, 0.95)');
    lensGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.98)');
    lensGrad.addColorStop(1, 'rgba(2, 6, 23, 0.99)');

    // Function to draw individual teardrop aviator lens
    function drawAviatorLens(centerX, flip) {
        ctx.save();
        ctx.translate(centerX, 0);
        if (flip) ctx.scale(-1, 1);

        // Teardrop Aviator Path
        ctx.beginPath();
        ctx.moveTo(-32 * s, -18 * s);
        ctx.quadraticCurveTo(0, -26 * s, 30 * s, -20 * s); // Top brow curve
        ctx.quadraticCurveTo(40 * s, 0, 32 * s, 26 * s);   // Outer edge
        ctx.quadraticCurveTo(18 * s, 46 * s, -6 * s, 44 * s); // Teardrop bottom
        ctx.quadraticCurveTo(-38 * s, 36 * s, -38 * s, 6 * s); // Inner nasal curve
        ctx.closePath();

        // Fill Polarized Lens
        ctx.fillStyle = lensGrad;
        ctx.fill();

        // Diagonal Specular Reflection Streaks
        ctx.save();
        ctx.clip(); // Clip glare to inside lens
        const glareGrad = ctx.createLinearGradient(-25 * s, -25 * s, 25 * s, 25 * s);
        glareGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        glareGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.05)');
        glareGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.35)');
        glareGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = glareGrad;
        ctx.beginPath();
        ctx.rect(-50 * s, -50 * s, 100 * s, 100 * s);
        ctx.fill();
        ctx.restore();

        // Gold Rim (Outer & Inner)
        ctx.strokeStyle = goldGrad;
        ctx.lineWidth = 3.5 * s;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1 * s;
        ctx.stroke();

        ctx.restore();
    }

    // Draw Left & Right Lenses
    drawAviatorLens(-eyeDist, false);
    drawAviatorLens(eyeDist, true);

    // C) Double Metallic Brow & Nose Bars
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 3 * s;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4 * s;

    // Top Brow Bar
    ctx.beginPath();
    ctx.moveTo(-eyeDist + 15 * s, -24 * s);
    ctx.quadraticCurveTo(0, -28 * s, eyeDist - 15 * s, -24 * s);
    ctx.stroke();

    // Central Bridge
    ctx.beginPath();
    ctx.moveTo(-eyeDist + 26 * s, -8 * s);
    ctx.quadraticCurveTo(0, -14 * s, eyeDist - 26 * s, -8 * s);
    ctx.stroke();

    // Temple Arms (Extending to ears)
    ctx.beginPath();
    ctx.moveTo(-eyeDist - 34 * s, -12 * s);
    ctx.lineTo(-eyeDist - 65 * s, -14 * s);
    ctx.moveTo(eyeDist + 34 * s, -12 * s);
    ctx.lineTo(eyeDist + 65 * s, -14 * s);
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
