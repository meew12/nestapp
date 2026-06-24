/**
 * ═══════════════════════════════════════════════════════════
 *  NESTOR SHOOT PRO — app.js
 *  Full application logic: splash, menu, countdown,
 *  OpenCV detection, shot scoring, session saving.
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/* ────────────────────────────────────────────────────────────
   1. APP STATE
──────────────────────────────────────────────────────────── */
const App = {
  // OpenCV readiness
  cvReady: false,

  // Current screen
  currentScreen: 'splashScreen',

  // User settings
  settings: {
    targetSize:    'standard',  // standard | large | small
    sensitivity:   5,           // 1–10
    minArea:       80,          // px²
    soundEnabled:  true,
    vibration:     true,
    flashEnabled:  true,
  },

  // Session state
  session: {
    trainingMode:  false,
    shots:         [],          // [{x, y, score, time, radius}]
    totalScore:    0,
    startTime:     null,
    sessionCount:  0,
    allTimeShots:  0,
    bestScore:     null,
  },

  // Camera / detection
  camera: {
    stream:        null,
    animFrameId:   null,
    prevGray:      null,        // OpenCV Mat from previous frame
    running:       false,
    width:         0,
    height:        0,
  },

  // Audio context
  audioCtx: null,

  // Debounce / cooldown to prevent duplicate detections
  shotCooldown: false,
  shotCooldownMs: 1200,         // ms between detections

  // Canvas context
  canvasCtx: null,
};

/* ────────────────────────────────────────────────────────────
   2. DOM REFS
──────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const DOM = {
  // Screens
  splashScreen:      $('splashScreen'),
  mainMenu:          $('mainMenu'),
  countdownScreen:   $('countdownScreen'),
  scanScreen:        $('scanScreen'),
  resultsScreen:     $('resultsScreen'),

  // Splash
  loaderFill:        $('loaderFill'),
  loaderText:        $('loaderText'),

  // Menu
  startBtn:          $('startBtn'),
  btnRipple:         $('btnRipple'),
  settingsBtn:       $('settingsBtn'),
  trainingToggle:    $('trainingToggle'),
  modeDesc:          $('modeDesc'),
  menuTotalShots:    $('menuTotalShots'),
  menuBestScore:     $('menuBestScore'),
  menuSessions:      $('menuSessions'),

  // Settings panel
  settingsPanel:     $('settingsPanel'),
  settingsBackdrop:  $('settingsBackdrop'),
  closeSettings:     $('closeSettings'),
  sensitivitySlider: $('sensitivitySlider'),
  sensitivityVal:    $('sensitivityVal'),
  areaSlider:        $('areaSlider'),
  areaVal:           $('areaVal'),
  soundToggle:       $('soundToggle'),
  vibrationToggle:   $('vibrationToggle'),
  flashToggle:       $('flashToggle'),
  calibrateBtn:      $('calibrateBtn'),

  // Countdown
  countdownNumber:   $('countdownNumber'),
  cdProgressCircle:  $('cdProgressCircle'),

  // Scan screen
  cameraFeed:        $('cameraFeed'),
  detectionCanvas:   $('detectionCanvas'),
  trainingBadge:     $('trainingBadge'),
  statusDot:         $('statusDot'),
  statusText:        $('statusText'),
  flashOverlay:      $('flashOverlay'),
  totalScoreDisplay: $('totalScoreDisplay'),
  lastShotDisplay:   $('lastShotDisplay'),
  shotCountDisplay:  $('shotCountDisplay'),
  stopBtn:           $('stopBtn'),
  saveSessionBtn:    $('saveSessionBtn'),

  // Results
  finalScoreNum:     $('finalScoreNum'),
  finalShots:        $('finalShots'),
  finalBest:         $('finalBest'),
  finalAvg:          $('finalAvg'),
  finalDuration:     $('finalDuration'),
  shotLog:           $('shotLog'),
  newSessionBtn:     $('newSessionBtn'),
  saveResultsBtn:    $('saveResultsBtn'),

  // Calibration
  calibrateOverlay:  $('calibrateOverlay'),
  calibrateBackdrop: $('calibrateBackdrop'),
  calibrateVideo:    $('calibrateVideo'),
  doCalibrateBtn:    $('doCalibrateBtn'),
  closeCalibrateBtn: $('closeCalibrateBtn'),

  // Toast
  toast:             $('toast'),
  toastMsg:          $('toastMsg'),
  toastIcon:         $('toastIcon'),
};

/* ────────────────────────────────────────────────────────────
   3. SCREEN NAVIGATION
──────────────────────────────────────────────────────────── */

/**
 * Show a screen by id, hide all others.
 * @param {string} screenId
 */
function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => s.classList.remove('active'));
  const target = $(screenId);
  if (target) {
    target.classList.add('active');
    App.currentScreen = screenId;
  }
}

/* ────────────────────────────────────────────────────────────
   4. SPLASH SCREEN
──────────────────────────────────────────────────────────── */

const LOADER_STEPS = [
  { pct: 15, msg: 'Cargando módulos…'       },
  { pct: 35, msg: 'Inicializando cámara…'   },
  { pct: 55, msg: 'Cargando OpenCV.js…'     },
  { pct: 75, msg: 'Preparando detección…'   },
  { pct: 90, msg: 'Calibrando sistema…'     },
  { pct: 100, msg: 'Listo para disparar 🎯' },
];

function runSplash() {
  let stepIdx = 0;

  const advance = () => {
    if (stepIdx >= LOADER_STEPS.length) {
      // Transition to main menu after short pause
      setTimeout(() => {
        loadSessionData();
        showScreen('mainMenu');
      }, 600);
      return;
    }
    const step = LOADER_STEPS[stepIdx++];
    DOM.loaderFill.style.width = step.pct + '%';
    DOM.loaderText.textContent = step.msg;
    const delay = stepIdx === LOADER_STEPS.length ? 800 : 350;
    setTimeout(advance, delay);
  };

  advance();
}

/* ────────────────────────────────────────────────────────────
   5. SETTINGS PANEL
──────────────────────────────────────────────────────────── */

function openSettings() {
  DOM.settingsPanel.classList.remove('hidden');
}

function closeSettings() {
  DOM.settingsPanel.classList.add('hidden');
}

function initSettingsListeners() {
  DOM.settingsBtn.addEventListener('click', openSettings);
  DOM.closeSettings.addEventListener('click', closeSettings);
  DOM.settingsBackdrop.addEventListener('click', closeSettings);

  // Target size buttons
  document.querySelectorAll('.opt-btn[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.opt-btn[data-target]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      App.settings.targetSize = btn.dataset.target;
    });
  });

  // Sensitivity slider
  DOM.sensitivitySlider.addEventListener('input', e => {
    App.settings.sensitivity = parseInt(e.target.value);
    DOM.sensitivityVal.textContent = App.settings.sensitivity;
  });

  // Area slider
  DOM.areaSlider.addEventListener('input', e => {
    App.settings.minArea = parseInt(e.target.value);
    DOM.areaVal.textContent = App.settings.minArea;
  });

  // Toggle switches
  DOM.soundToggle.addEventListener('change', e => {
    App.settings.soundEnabled = e.target.checked;
  });
  DOM.vibrationToggle.addEventListener('change', e => {
    App.settings.vibration = e.target.checked;
  });
  DOM.flashToggle.addEventListener('change', e => {
    App.settings.flashEnabled = e.target.checked;
  });

  // Calibrate button
  DOM.calibrateBtn.addEventListener('click', () => {
    closeSettings();
    setTimeout(openCalibration, 300);
  });
}

/* ────────────────────────────────────────────────────────────
   6. TRAINING MODE TOGGLE
──────────────────────────────────────────────────────────── */

function initTrainingToggle() {
  DOM.trainingToggle.addEventListener('change', e => {
    App.session.trainingMode = e.target.checked;
    DOM.modeDesc.textContent = e.target.checked
      ? 'Modo entrenamiento — Sin puntuación, solo detección'
      : 'Modo competencia — Los impactos se puntúan automáticamente';
  });
}

/* ────────────────────────────────────────────────────────────
   7. CAMERA CALIBRATION
──────────────────────────────────────────────────────────── */

let calibStream = null;

async function openCalibration() {
  DOM.calibrateOverlay.classList.remove('hidden');
  try {
    calibStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    DOM.calibrateVideo.srcObject = calibStream;
  } catch (err) {
    showToast('No se pudo acceder a la cámara', 'error');
    closeCalibration();
  }
}

function closeCalibration() {
  DOM.calibrateOverlay.classList.add('hidden');
  if (calibStream) {
    calibStream.getTracks().forEach(t => t.stop());
    calibStream = null;
    DOM.calibrateVideo.srcObject = null;
  }
}

function doCalibrate() {
  // Sample a frame to estimate ambient brightness for threshold
  const video = DOM.calibrateVideo;
  const canvas = document.createElement('canvas');
  canvas.width  = video.videoWidth  || 320;
  canvas.height = video.videoHeight || 240;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Compute average brightness
  let sum = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    sum += 0.299 * img.data[i] + 0.587 * img.data[i+1] + 0.114 * img.data[i+2];
  }
  const avgBrightness = sum / (img.data.length / 4);

  // Adapt sensitivity based on brightness
  if (avgBrightness < 60) {
    // Dark scene — lower sensitivity to reduce noise
    App.settings.sensitivity = Math.max(2, App.settings.sensitivity - 2);
    DOM.sensitivitySlider.value = App.settings.sensitivity;
    DOM.sensitivityVal.textContent = App.settings.sensitivity;
    showToast('Calibrado: escena oscura detectada', 'info');
  } else if (avgBrightness > 180) {
    // Bright scene — increase sensitivity
    App.settings.sensitivity = Math.min(10, App.settings.sensitivity + 1);
    DOM.sensitivitySlider.value = App.settings.sensitivity;
    DOM.sensitivityVal.textContent = App.settings.sensitivity;
    showToast('Calibrado: escena brillante detectada', 'info');
  } else {
    showToast('Calibración completada ✓', 'success');
  }

  closeCalibration();
}

function initCalibrationListeners() {
  DOM.calibrateBackdrop.addEventListener('click', closeCalibration);
  DOM.closeCalibrateBtn.addEventListener('click', closeCalibration);
  DOM.doCalibrateBtn.addEventListener('click', doCalibrate);
}

/* ────────────────────────────────────────────────────────────
   8. COUNTDOWN
──────────────────────────────────────────────────────────── */

const CIRCUMFERENCE = 2 * Math.PI * 85; // r=85

function runCountdown() {
  showScreen('countdownScreen');
  let count = 3;

  const updateCircle = (progress) => {
    // progress 0→1
    const offset = CIRCUMFERENCE * (1 - progress);
    DOM.cdProgressCircle.style.strokeDashoffset = offset;
    DOM.cdProgressCircle.style.strokeDasharray  = CIRCUMFERENCE;
  };

  const tick = () => {
    DOM.countdownNumber.textContent = count;
    // Force reflow to re-trigger animation
    DOM.countdownNumber.style.animation = 'none';
    void DOM.countdownNumber.offsetHeight;
    DOM.countdownNumber.style.animation = 'cdNumPop 0.3s cubic-bezier(0.4,0,0.2,1) forwards';

    // Progress circle: fill over 1 second
    let start = null;
    const animate = (ts) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      updateCircle(Math.min(elapsed / 950, 1));
      if (elapsed < 950) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    if (count > 1) {
      count--;
      setTimeout(tick, 1000);
    } else {
      // Countdown done → launch camera
      setTimeout(() => startScanning(), 1000);
    }
  };

  tick();
}

/* ────────────────────────────────────────────────────────────
   9. CAMERA ACCESS
──────────────────────────────────────────────────────────── */

async function startCamera() {
  const constraints = {
    video: {
      facingMode: 'environment',
      width:  { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 60 }
    },
    audio: false
  };

  try {
    App.camera.stream = await navigator.mediaDevices.getUserMedia(constraints);
    DOM.cameraFeed.srcObject = App.camera.stream;

    await new Promise((resolve, reject) => {
      DOM.cameraFeed.onloadedmetadata = () => {
        DOM.cameraFeed.play().then(resolve).catch(reject);
      };
      DOM.cameraFeed.onerror = reject;
    });

    App.camera.width  = DOM.cameraFeed.videoWidth;
    App.camera.height = DOM.cameraFeed.videoHeight;

    // Size canvas to match video
    DOM.detectionCanvas.width  = App.camera.width;
    DOM.detectionCanvas.height = App.camera.height;
    App.canvasCtx = DOM.detectionCanvas.getContext('2d');

    return true;
  } catch (err) {
    console.error('[Camera]', err);
    showToast('No se pudo acceder a la cámara', 'error');
    return false;
  }
}

function stopCamera() {
  if (App.camera.stream) {
    App.camera.stream.getTracks().forEach(t => t.stop());
    App.camera.stream = null;
  }
  DOM.cameraFeed.srcObject = null;
}

/* ────────────────────────────────────────────────────────────
   10. SCANNING SESSION LIFECYCLE
──────────────────────────────────────────────────────────── */

async function startScanning() {
  // Reset session
  App.session.shots      = [];
  App.session.totalScore = 0;
  App.session.startTime  = Date.now();

  // Start camera
  const ok = await startCamera();
  if (!ok) {
    showScreen('mainMenu');
    return;
  }

  // Show scan screen
  showScreen('scanScreen');

  // Training badge
  DOM.trainingBadge.style.display = App.session.trainingMode ? 'flex' : 'none';

  // Reset HUD
  DOM.totalScoreDisplay.textContent = '0';
  DOM.lastShotDisplay.textContent   = '—';
  DOM.shotCountDisplay.textContent  = '0';

  // Status indicator
  DOM.statusDot.classList.add('active');
  DOM.statusText.textContent = 'DETECTANDO';

  App.camera.running = true;

  // Wait for OpenCV, then start detection loop
  waitForOpenCV(() => {
    App.camera.prevGray = null;
    requestAnimationFrame(detectionLoop);
  });
}

function stopScanning() {
  App.camera.running = false;

  if (App.camera.animFrameId) {
    cancelAnimationFrame(App.camera.animFrameId);
  }

  // Free OpenCV matrices
  if (App.camera.prevGray) {
    try { App.camera.prevGray.delete(); } catch(_) {}
    App.camera.prevGray = null;
  }

  stopCamera();
  showResults();
}

/* ────────────────────────────────────────────────────────────
   11. OPENCV LOADING
──────────────────────────────────────────────────────────── */

function waitForOpenCV(callback) {
  if (typeof cv !== 'undefined' && cv.Mat) {
    App.cvReady = true;
    callback();
  } else if (window._opencvReady) {
    // Script loaded but cv object may need a moment
    const check = setInterval(() => {
      if (typeof cv !== 'undefined' && cv.Mat) {
        clearInterval(check);
        App.cvReady = true;
        callback();
      }
    }, 100);
  } else {
    // Fallback: poll every 200ms, max 15s
    let waited = 0;
    const poll = setInterval(() => {
      waited += 200;
      if (typeof cv !== 'undefined' && cv.Mat) {
        clearInterval(poll);
        App.cvReady = true;
        callback();
      } else if (waited >= 15000) {
        clearInterval(poll);
        console.warn('[OpenCV] Timeout — using fallback detector');
        App.cvReady = false;
        callback(); // Continue with fallback
      }
    }, 200);
  }
}

/* ────────────────────────────────────────────────────────────
   12. DETECTION LOOP (requestAnimationFrame)
──────────────────────────────────────────────────────────── */

/**
 * Main detection loop. Runs every animation frame.
 * Uses OpenCV if available, else a pure Canvas fallback.
 */
function detectionLoop() {
  if (!App.camera.running) return;

  if (App.cvReady && typeof cv !== 'undefined' && cv.Mat) {
    detectWithOpenCV();
  } else {
    detectWithCanvas();
  }

  // Redraw all markers on canvas
  drawShots();

  App.camera.animFrameId = requestAnimationFrame(detectionLoop);
}

/* ── 12a. OpenCV Detection Pipeline ─────────────────────── */

function detectWithOpenCV() {
  const video = DOM.cameraFeed;
  if (video.readyState < 2) return;

  let src, gray, blurred, diff, thresh, contours, hierarchy;

  try {
    // Capture frame
    src = new cv.Mat(App.camera.height, App.camera.width, cv.CV_8UC4);
    const ctx = document.createElement('canvas').getContext('2d');
    // Use an offscreen canvas to capture the video frame
    const offscreen = document.createElement('canvas');
    offscreen.width  = App.camera.width;
    offscreen.height = App.camera.height;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(video, 0, 0, App.camera.width, App.camera.height);
    const imageData = offCtx.getImageData(0, 0, App.camera.width, App.camera.height);

    src = cv.matFromImageData(imageData);

    // Convert to grayscale
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Gaussian blur to reduce noise
    blurred = new cv.Mat();
    const ksize = new cv.Size(5, 5);
    cv.GaussianBlur(gray, blurred, ksize, 1.5);

    // Frame differencing
    if (!App.camera.prevGray || App.camera.prevGray.rows !== blurred.rows) {
      if (App.camera.prevGray) App.camera.prevGray.delete();
      App.camera.prevGray = blurred.clone();
      src.delete(); gray.delete(); blurred.delete();
      return;
    }

    diff = new cv.Mat();
    cv.absdiff(App.camera.prevGray, blurred, diff);

    // Update prev frame
    App.camera.prevGray.delete();
    App.camera.prevGray = blurred.clone();

    // Adaptive threshold — sensitivity affects the block size
    thresh = new cv.Mat();
    const sensitivity = App.settings.sensitivity;
    const threshValue = Math.max(5, 30 - sensitivity * 2); // 5–28
    cv.threshold(diff, thresh, threshValue, 255, cv.THRESH_BINARY);

    // Morphological operations to clean noise
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    cv.morphologyEx(thresh, thresh, cv.MORPH_CLOSE, kernel);
    cv.morphologyEx(thresh, thresh, cv.MORPH_OPEN, kernel);
    kernel.delete();

    // Find contours
    contours  = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const minArea = App.settings.minArea;
    const maxArea = App.camera.width * App.camera.height * 0.05; // max 5% of frame

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area    = cv.contourArea(contour);

      if (area < minArea || area > maxArea) { contour.delete(); continue; }

      // Circularity check: C = 4π·A / P²
      const perimeter = cv.arcLength(contour, true);
      const circularity = perimeter > 0
        ? (4 * Math.PI * area) / (perimeter * perimeter)
        : 0;

      if (circularity < 0.3) { contour.delete(); continue; } // Not round enough

      // Get bounding rect → center point
      const rect   = cv.boundingRect(contour);
      const cx     = rect.x + rect.width  / 2;
      const cy     = rect.y + rect.height / 2;
      const radius = Math.sqrt(area / Math.PI);

      registerShot(cx, cy, radius);
      contour.delete();
      break; // Only one shot per frame to avoid duplicates
    }

    // Cleanup
    src.delete(); gray.delete(); diff.delete(); thresh.delete();
    blurred.delete(); contours.delete(); hierarchy.delete();

  } catch (err) {
    console.error('[OpenCV detect]', err);
    // Safety cleanup
    try { if (src)      src.delete();      } catch(_) {}
    try { if (gray)     gray.delete();     } catch(_) {}
    try { if (blurred)  blurred.delete();  } catch(_) {}
    try { if (diff)     diff.delete();     } catch(_) {}
    try { if (thresh)   thresh.delete();   } catch(_) {}
    try { if (contours) contours.delete(); } catch(_) {}
    try { if (hierarchy)hierarchy.delete();} catch(_) {}
  }
}

/* ── 12b. Canvas Fallback (no OpenCV) ───────────────────── */

let fallbackPrevData = null;
let fallbackLastSample = 0;

function detectWithCanvas() {
  const video = DOM.cameraFeed;
  if (video.readyState < 2) return;

  const now = performance.now();
  if (now - fallbackLastSample < 100) return; // 10fps sampling
  fallbackLastSample = now;

  const w = App.camera.width;
  const h = App.camera.height;

  const offscreen = document.createElement('canvas');
  offscreen.width  = Math.floor(w / 4);  // Downscale for perf
  offscreen.height = Math.floor(h / 4);
  const ctx = offscreen.getContext('2d');
  ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
  const curr = ctx.getImageData(0, 0, offscreen.width, offscreen.height).data;

  if (!fallbackPrevData || fallbackPrevData.length !== curr.length) {
    fallbackPrevData = new Uint8ClampedArray(curr);
    return;
  }

  // Find region of maximum change
  let maxDiff = 0;
  let maxIdx  = 0;
  for (let i = 0; i < curr.length; i += 4) {
    const d = Math.abs(curr[i] - fallbackPrevData[i])
            + Math.abs(curr[i+1] - fallbackPrevData[i+1])
            + Math.abs(curr[i+2] - fallbackPrevData[i+2]);
    if (d > maxDiff) { maxDiff = d; maxIdx = i; }
  }

  fallbackPrevData.set(curr);

  const threshold = Math.max(40, 90 - App.settings.sensitivity * 5);
  if (maxDiff > threshold) {
    const pixel = maxIdx / 4;
    const px = (pixel % offscreen.width) * 4;
    const py = Math.floor(pixel / offscreen.width) * 4;
    registerShot(px, py, 12);
  }
}

/* ────────────────────────────────────────────────────────────
   13. SHOT REGISTRATION
──────────────────────────────────────────────────────────── */

/**
 * Register a newly detected shot.
 * @param {number} x      - Canvas x coordinate
 * @param {number} y      - Canvas y coordinate
 * @param {number} radius - Detected blob radius
 */
function registerShot(x, y, radius) {
  if (App.shotCooldown) return;

  // Cooldown to prevent rapid duplicates
  App.shotCooldown = true;
  setTimeout(() => { App.shotCooldown = false; }, App.shotCooldownMs);

  // De-duplicate: ignore if very close to an existing shot
  const tooClose = App.session.shots.some(s => {
    const dx = s.x - x;
    const dy = s.y - y;
    return Math.sqrt(dx*dx + dy*dy) < 20;
  });
  if (tooClose) return;

  const score = App.session.trainingMode
    ? 0
    : calculateScore(x, y);

  const shot = {
    x,
    y,
    radius: Math.min(Math.max(radius, 6), 18),
    score,
    time: Date.now(),
  };

  App.session.shots.push(shot);

  if (!App.session.trainingMode) {
    App.session.totalScore += score;
  }

  // Update HUD
  updateScoreHUD(score);

  // Feedback
  triggerShotFeedback();

  console.log(`[Shot] x=${x.toFixed(0)} y=${y.toFixed(0)} score=${score}`);
}

/**
 * Calculate score based on distance from canvas center.
 * Scoring zones: 10 (bullseye) → 1 (edge)
 */
function calculateScore(x, y) {
  const cx = App.camera.width  / 2;
  const cy = App.camera.height / 2;
  const maxDist = Math.min(App.camera.width, App.camera.height) * 0.45;

  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  const ratio = Math.min(dist / maxDist, 1);

  // Score tiers
  if (ratio < 0.05) return 10;
  if (ratio < 0.15) return 9;
  if (ratio < 0.25) return 8;
  if (ratio < 0.35) return 7;
  if (ratio < 0.45) return 6;
  if (ratio < 0.55) return 5;
  if (ratio < 0.65) return 4;
  if (ratio < 0.75) return 3;
  if (ratio < 0.85) return 2;
  return 1;
}

/* ────────────────────────────────────────────────────────────
   14. CANVAS RENDERING — SHOT MARKERS
──────────────────────────────────────────────────────────── */

/**
 * Color for a score value (1–10)
 */
function scoreColor(score) {
  if (score >= 9) return '#ff3a28';  // Red-hot (bullseye)
  if (score >= 7) return '#ffb830';  // Amber
  if (score >= 4) return '#00e5ff';  // Cyan
  return '#4da6ff';                   // Blue
}

/**
 * Draw all shots on the detection canvas.
 * Latest shot = RED glowing, previous = their score color.
 */
function drawShots() {
  if (!App.canvasCtx) return;

  const ctx = App.canvasCtx;
  const w   = DOM.detectionCanvas.width;
  const h   = DOM.detectionCanvas.height;

  ctx.clearRect(0, 0, w, h);

  App.session.shots.forEach((shot, idx) => {
    const isLatest = idx === App.session.shots.length - 1;
    const color    = isLatest ? '#ff3a28' : scoreColor(shot.score);
    const radius   = shot.radius;

    // Glow shadow
    ctx.save();
    ctx.shadowColor  = color;
    ctx.shadowBlur   = isLatest ? 24 : 12;

    // Outer ring
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = isLatest ? 2.5 : 1.5;
    ctx.globalAlpha = isLatest ? 1 : 0.75;
    ctx.stroke();

    // Inner filled circle
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, radius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle   = color;
    ctx.globalAlpha = isLatest ? 0.9 : 0.45;
    ctx.fill();

    // Shot number label
    ctx.globalAlpha  = isLatest ? 1 : 0.7;
    ctx.shadowBlur   = 0;
    ctx.fillStyle    = '#fff';
    ctx.font         = `bold ${isLatest ? 12 : 10}px "Share Tech Mono", monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(idx + 1, shot.x, shot.y);

    // Score badge (latest only)
    if (isLatest && !App.session.trainingMode) {
      ctx.globalAlpha = 1;
      ctx.shadowColor = '#ff3a28';
      ctx.shadowBlur  = 10;
      const badgeX = shot.x + radius + 16;
      const badgeY = shot.y - radius - 8;

      ctx.fillStyle = 'rgba(10,14,26,0.85)';
      ctx.beginPath();
      ctx.roundRect(badgeX - 16, badgeY - 12, 32, 22, 4);
      ctx.fill();

      ctx.strokeStyle = '#ff3a28';
      ctx.lineWidth   = 1;
      ctx.stroke();

      ctx.fillStyle    = '#ff3a28';
      ctx.font         = 'bold 13px Orbitron, monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shot.score, badgeX, badgeY);
    }

    ctx.restore();
  });

  // Crosshair at canvas center (subtle)
  const cx = w / 2, cy = h / 2;
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = '#ff3a28';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 6]);

  ctx.beginPath(); ctx.moveTo(cx - 30, cy); ctx.lineTo(cx + 30, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - 30); ctx.lineTo(cx, cy + 30); ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.strokeStyle = '#ff3a28';
  ctx.stroke();

  ctx.restore();
}

/* ────────────────────────────────────────────────────────────
   15. HUD UPDATES
──────────────────────────────────────────────────────────── */

function updateScoreHUD(lastScore) {
  const count = App.session.shots.length;

  DOM.shotCountDisplay.textContent  = count;
  DOM.totalScoreDisplay.textContent = App.session.trainingMode
    ? count
    : App.session.totalScore;
  DOM.lastShotDisplay.textContent   = App.session.trainingMode
    ? '—'
    : lastScore;

  // Pulse animation on score change
  animateNum(DOM.totalScoreDisplay);
  animateNum(DOM.lastShotDisplay);
}

function animateNum(el) {
  el.style.transform = 'scale(1.3)';
  el.style.transition = 'transform 0.15s ease';
  setTimeout(() => {
    el.style.transform = 'scale(1)';
  }, 150);
}

/* ────────────────────────────────────────────────────────────
   16. SHOT FEEDBACK (sound + vibration + flash)
──────────────────────────────────────────────────────────── */

/**
 * Initialize Web Audio API context lazily.
 */
function ensureAudio() {
  if (!App.audioCtx) {
    try {
      App.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(_) {}
  }
}

/**
 * Synthesize a gunshot-like "crack" sound using the Web Audio API.
 * No external file required.
 */
function playShotSound() {
  if (!App.settings.soundEnabled) return;
  ensureAudio();
  if (!App.audioCtx) return;

  try {
    const ctx = App.audioCtx;

    // White noise burst (the "crack")
    const bufferSize = ctx.sampleRate * 0.12; // 120ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.06));
    }

    const noise  = ctx.createBufferSource();
    noise.buffer = buffer;

    // Band-pass filter to shape sound
    const filter = ctx.createBiquadFilter();
    filter.type  = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;

    // Gain envelope
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.25);
  } catch(err) {
    console.warn('[Audio]', err);
  }
}

/**
 * Trigger vibration if available.
 */
function triggerVibration() {
  if (!App.settings.vibration) return;
  if (navigator.vibrate) {
    navigator.vibrate([30, 10, 20]);
  }
}

/**
 * Flash the screen red briefly.
 */
function triggerFlash() {
  if (!App.settings.flashEnabled) return;
  const overlay = DOM.flashOverlay;
  overlay.style.opacity = '0.5';
  setTimeout(() => { overlay.style.opacity = '0'; }, 120);
}

function triggerShotFeedback() {
  playShotSound();
  triggerVibration();
  triggerFlash();
}

/* ────────────────────────────────────────────────────────────
   17. RESULTS SCREEN
──────────────────────────────────────────────────────────── */

function showResults() {
  const shots    = App.session.shots;
  const count    = shots.length;
  const total    = App.session.totalScore;
  const duration = Math.round((Date.now() - App.session.startTime) / 1000);

  const scores   = shots.map(s => s.score);
  const best     = count ? Math.max(...scores) : null;
  const avg      = count ? (scores.reduce((a,b)=>a+b,0) / count).toFixed(1) : null;

  // Update DOM
  DOM.finalScoreNum.textContent = App.session.trainingMode ? count : total;
  DOM.finalShots.textContent    = count;
  DOM.finalBest.textContent     = best !== null ? best : '—';
  DOM.finalAvg.textContent      = avg  !== null ? avg  : '—';
  DOM.finalDuration.textContent = duration + 's';

  // Animate score number counting up
  animateCountUp(DOM.finalScoreNum, App.session.trainingMode ? count : total);

  // Build shot log
  DOM.shotLog.innerHTML = '';
  if (count === 0) {
    DOM.shotLog.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">Sin impactos registrados</div>';
  } else {
    shots.forEach((shot, i) => {
      const item = document.createElement('div');
      item.className = 'shot-log-item';
      item.style.animationDelay = (i * 50) + 'ms';

      const color = scoreColor(shot.score);
      item.innerHTML = `
        <span class="sli-num">#${i+1}</span>
        <span class="sli-pos">x:${Math.round(shot.x)} y:${Math.round(shot.y)}</span>
        <span class="sli-score" style="color:${color}">${App.session.trainingMode ? '—' : shot.score + ' pts'}</span>
      `;
      DOM.shotLog.appendChild(item);
    });
  }

  // Update global stats
  App.session.allTimeShots  += count;
  App.session.sessionCount  += 1;
  if (best !== null) {
    App.session.bestScore = App.session.bestScore !== null
      ? Math.max(App.session.bestScore, best)
      : best;
  }

  updateMenuStats();
  showScreen('resultsScreen');
}

function animateCountUp(el, target) {
  let current = 0;
  const step  = Math.ceil(target / 30);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 40);
}

/* ────────────────────────────────────────────────────────────
   18. SESSION SAVE / LOAD
──────────────────────────────────────────────────────────── */

function saveSession() {
  const data = {
    date:         new Date().toISOString(),
    trainingMode: App.session.trainingMode,
    shots:        App.session.shots,
    totalScore:   App.session.totalScore,
    duration:     Math.round((Date.now() - App.session.startTime) / 1000),
  };

  try {
    const key      = 'nestor_sessions';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(data);
    localStorage.setItem(key, JSON.stringify(existing));
    showToast('Sesión guardada correctamente', 'success');
  } catch(err) {
    showToast('Error al guardar la sesión', 'error');
    console.error('[Save]', err);
  }
}

function loadSessionData() {
  try {
    const sessions = JSON.parse(localStorage.getItem('nestor_sessions') || '[]');
    App.session.sessionCount = sessions.length;

    let allShots   = 0;
    let globalBest = null;

    sessions.forEach(s => {
      allShots += s.shots.length;
      s.shots.forEach(sh => {
        if (globalBest === null || sh.score > globalBest) {
          globalBest = sh.score;
        }
      });
    });

    App.session.allTimeShots = allShots;
    App.session.bestScore    = globalBest;

    updateMenuStats();
  } catch(err) {
    console.warn('[Load sessions]', err);
  }
}

function updateMenuStats() {
  DOM.menuTotalShots.textContent = App.session.allTimeShots;
  DOM.menuBestScore.textContent  = App.session.bestScore !== null
    ? App.session.bestScore
    : '—';
  DOM.menuSessions.textContent   = App.session.sessionCount;
}

/* ────────────────────────────────────────────────────────────
   19. TOAST NOTIFICATION
──────────────────────────────────────────────────────────── */

let toastTimer = null;

/**
 * Show a toast message.
 * @param {string} msg
 * @param {'success'|'error'|'info'} type
 */
function showToast(msg, type = 'success') {
  DOM.toastMsg.textContent = msg;
  DOM.toast.className = `toast show ${type}`;

  // Icon
  const icons = {
    success: '<polyline points="20 6 9 17 4 12"/>',
    error:   '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    info:    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  };
  DOM.toastIcon.innerHTML = icons[type] || icons.success;

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    DOM.toast.classList.remove('show');
  }, 3000);
}

/* ────────────────────────────────────────────────────────────
   20. START BUTTON — ripple + countdown
──────────────────────────────────────────────────────────── */

function initStartButton() {
  DOM.startBtn.addEventListener('click', () => {
    // Ripple animation
    const ripple = DOM.btnRipple;
    ripple.classList.remove('active');
    void ripple.offsetWidth; // force reflow
    ripple.classList.add('active');

    // Audio context unlock (iOS requires user gesture)
    ensureAudio();
    if (App.audioCtx && App.audioCtx.state === 'suspended') {
      App.audioCtx.resume().catch(() => {});
    }

    setTimeout(() => runCountdown(), 200);
  });
}

/* ────────────────────────────────────────────────────────────
   21. STOP & SAVE BUTTONS
──────────────────────────────────────────────────────────── */

function initScanControls() {
  DOM.stopBtn.addEventListener('click', () => {
    stopScanning();
  });

  DOM.saveSessionBtn.addEventListener('click', () => {
    saveSession();
  });
}

function initResultsButtons() {
  DOM.newSessionBtn.addEventListener('click', () => {
    showScreen('mainMenu');
  });

  DOM.saveResultsBtn.addEventListener('click', () => {
    saveSession();
  });
}

/* ────────────────────────────────────────────────────────────
   22. CANVAS RESIZE HANDLER
──────────────────────────────────────────────────────────── */

function handleResize() {
  if (App.currentScreen === 'scanScreen' && App.camera.width) {
    DOM.detectionCanvas.width  = App.camera.width;
    DOM.detectionCanvas.height = App.camera.height;
  }
}

/* ────────────────────────────────────────────────────────────
   23. INITIALIZATION
──────────────────────────────────────────────────────────── */

function init() {
  // Start splash immediately
  showScreen('splashScreen');
  runSplash();

  // Wire up all listeners
  initSettingsListeners();
  initTrainingToggle();
  initCalibrationListeners();
  initStartButton();
  initScanControls();
  initResultsButtons();

  // Resize
  window.addEventListener('resize', handleResize);

  // Prevent default touch events that cause white flash on iOS
  document.addEventListener('touchmove', e => {
    if (e.target.closest('.shot-log, .settings-body, .results-body')) return;
    e.preventDefault();
  }, { passive: false });

  // Unlock audio on first interaction
  document.addEventListener('touchstart', () => {
    ensureAudio();
    if (App.audioCtx && App.audioCtx.state === 'suspended') {
      App.audioCtx.resume().catch(() => {});
    }
  }, { once: true });

  console.log('[NestorShootPro] Initialized ✓');
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
