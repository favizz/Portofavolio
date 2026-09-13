const video = document.getElementById('video');
const still = document.getElementById('still');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const statusEl = document.getElementById('status');
const startCamBtn = document.getElementById('startCam');
const stopBtn = document.getElementById('stop');
const fileInput = document.getElementById('fileInput');
const detectionList = document.getElementById('detectionList');

let model = null;
let stream = null;
let rafId = null;
let activeSource = null; // 'video' | 'still'

async function loadModel() {
  statusEl.textContent = 'Loading model…';
  model = await cocoSsd.load();
  statusEl.textContent = 'Model ready.';
}

function resizeOverlayTo(el) {
  const rect = el.getBoundingClientRect();
  overlay.width = rect.width;
  overlay.height = rect.height;
}

function drawPredictions(predictions, sourceEl, naturalW, naturalH) {
  resizeOverlayTo(sourceEl);
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  const scaleX = overlay.width / naturalW;
  const scaleY = overlay.height / naturalH;

  ctx.lineWidth = 2;
  ctx.font = '13px sans-serif';
  ctx.textBaseline = 'top';

  detectionList.innerHTML = '';
  if (predictions.length === 0) {
    detectionList.innerHTML = '<li class="muted">Nothing detected.</li>';
    return;
  }

  predictions.forEach((p) => {
    const [x, y, w, h] = p.bbox;
    const bx = x * scaleX, by = y * scaleY, bw = w * scaleX, bh = h * scaleY;
    ctx.strokeStyle = '#5eead4';
    ctx.strokeRect(bx, by, bw, bh);
    const label = `${p.class} ${Math.round(p.score * 100)}%`;
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = '#5eead4';
    ctx.fillRect(bx, by - 18, textWidth + 8, 18);
    ctx.fillStyle = '#0a0a0c';
    ctx.fillText(label, bx + 4, by - 16);

    const li = document.createElement('li');
    li.textContent = label;
    detectionList.appendChild(li);
  });
}

async function detectLoop() {
  if (activeSource !== 'video' || video.readyState < 2) {
    rafId = requestAnimationFrame(detectLoop);
    return;
  }
  const predictions = await model.detect(video);
  drawPredictions(predictions, video, video.videoWidth, video.videoHeight);
  rafId = requestAnimationFrame(detectLoop);
}

async function startWebcam() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
  } catch (err) {
    statusEl.textContent = `Camera error: ${err.message}`;
    return;
  }
  still.hidden = true;
  video.hidden = false;
  video.srcObject = stream;
  await video.play();
  activeSource = 'video';
  startCamBtn.disabled = true;
  stopBtn.disabled = false;
  statusEl.textContent = 'Detecting…';
  detectLoop();
}

function stopAll() {
  activeSource = null;
  if (rafId) cancelAnimationFrame(rafId);
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  detectionList.innerHTML = '<li class="muted">Nothing detected yet.</li>';
  startCamBtn.disabled = false;
  stopBtn.disabled = true;
  statusEl.textContent = 'Stopped.';
}

async function handleFile(e) {
  const file = e.target.files[0];
  if (!file || !model) return;
  stopAll();
  video.hidden = true;
  still.hidden = false;
  still.src = URL.createObjectURL(file);
  await new Promise((resolve) => { still.onload = resolve; });
  activeSource = 'still';
  statusEl.textContent = 'Detecting…';
  const predictions = await model.detect(still);
  drawPredictions(predictions, still, still.naturalWidth, still.naturalHeight);
  statusEl.textContent = 'Done.';
}

startCamBtn.addEventListener('click', startWebcam);
stopBtn.addEventListener('click', stopAll);
fileInput.addEventListener('change', handleFile);
window.addEventListener('resize', () => {
  if (activeSource === 'still') resizeOverlayTo(still);
});

loadModel();
