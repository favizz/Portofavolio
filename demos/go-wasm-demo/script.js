const statusEl = document.getElementById('status');
const toggleBtn = document.getElementById('toggle');
const spikeBtn = document.getElementById('injectSpike');
const voltBtn = document.getElementById('injectVoltage');
const logList = document.getElementById('logList');
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');

const MAX_POINTS = 80;
const voltages = [];
const flows = [];
let running = true;
let forceSpike = 0;
let forceVoltFault = 0;
let t = 0;

function nextReading() {
  t += 1;
  let voltage = 220 + Math.sin(t / 15) * 3 + (Math.random() - 0.5) * 1.5;
  let flow = 4 + Math.sin(t / 9) * 0.6 + (Math.random() - 0.5) * 0.3;

  if (forceVoltFault > 0) {
    voltage = Math.random() > 0.5 ? 260 + Math.random() * 10 : 170 - Math.random() * 10;
    forceVoltFault--;
  }
  if (forceSpike > 0) {
    flow *= 4 + Math.random();
    forceSpike--;
  }
  return { voltage, flow };
}

function pushPoint(arr, v) {
  arr.push(v);
  if (arr.length > MAX_POINTS) arr.shift();
}

function drawChart() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#26262e';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const plot = (arr, color, min, max) => {
    if (arr.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    arr.forEach((v, i) => {
      const x = (i / (MAX_POINTS - 1)) * w;
      const norm = (v - min) / (max - min);
      const y = h - norm * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  plot(voltages, '#fbbf24', 160, 280);
  plot(flows, '#7dd3fc', 0, 20);

  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('voltage', 8, 14);
  ctx.fillStyle = '#7dd3fc';
  ctx.fillText('flow', 68, 14);
}

function logAnomaly(kind, reading) {
  if (logList.firstChild && logList.firstChild.classList.contains('muted')) {
    logList.innerHTML = '';
  }
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString();
  li.textContent = `[${time}] ${kind} — voltage=${reading.voltage.toFixed(1)}V flow=${reading.flow.toFixed(2)}L/min`;
  logList.prepend(li);
  while (logList.children.length > 30) logList.removeChild(logList.lastChild);
}

function tick() {
  if (!running) return;
  const r = nextReading();
  pushPoint(voltages, r.voltage);
  pushPoint(flows, r.flow);
  drawChart();

  if (window.goReady) {
    const anomalies = window.goAnalyze(r.voltage, r.flow);
    if (anomalies && anomalies.length) {
      for (const a of anomalies) logAnomaly(a, r);
    }
  }
}

toggleBtn.addEventListener('click', () => {
  running = !running;
  toggleBtn.textContent = running ? 'Pause stream' : 'Resume stream';
});
spikeBtn.addEventListener('click', () => { forceSpike = 3; });
voltBtn.addEventListener('click', () => { forceVoltFault = 2; });

const go = new Go();
statusEl.textContent = 'Loading WASM…';
WebAssembly.instantiateStreaming(fetch('main.wasm'), go.importObject)
  .then((result) => {
    go.run(result.instance);
    statusEl.textContent = 'Go WASM running.';
  })
  .catch((err) => {
    statusEl.textContent = `WASM load failed: ${err.message}`;
  });

setInterval(tick, 250);
