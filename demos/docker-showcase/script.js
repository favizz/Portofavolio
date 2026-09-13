import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/+esm';

mermaid.initialize({ startOnLoad: false, theme: 'dark' });

const diagramSource = `
graph TB
    client[Client] -->|":8080"| nginx[nginx]
    nginx -->|proxy_pass /api/| api[api service]
    meters[IoT meters] -->|MQTT publish| mosquitto[mosquitto broker]
    mosquitto -->|subscribe| api
    api -->|INSERT reading| postgres[(postgres)]
    api -->|LPUSH anomaly-queue| redis[(redis)]
    worker1[worker replica 1] -->|BLPOP| redis
    worker2[worker replica 2] -->|BLPOP| redis
    worker1 -->|INSERT anomaly| postgres
    worker2 -->|INSERT anomaly| postgres
`.trim();

async function renderDiagram() {
  const { svg } = await mermaid.render('topology-svg', diagramSource);
  document.getElementById('diagram').innerHTML = svg;
}

const files = [
  { label: 'docker-compose.yml', path: 'stack/docker-compose.yml', lang: 'yaml' },
  { label: 'api/Dockerfile', path: 'stack/api/Dockerfile', lang: 'dockerfile' },
  { label: 'api/index.js', path: 'stack/api/index.js', lang: 'javascript' },
  { label: 'worker/Dockerfile', path: 'stack/worker/Dockerfile', lang: 'dockerfile' },
  { label: 'worker/index.js', path: 'stack/worker/index.js', lang: 'javascript' },
  { label: 'nginx/nginx.conf', path: 'stack/nginx/nginx.conf', lang: 'nginx' },
];

const tabsEl = document.getElementById('fileTabs');
const fileView = document.getElementById('fileView');

async function showFile(file, tabEl) {
  document.querySelectorAll('#fileTabs .tab').forEach((t) => t.classList.remove('active'));
  tabEl.classList.add('active');
  fileView.textContent = 'Loading…';
  try {
    const res = await fetch(file.path);
    const text = await res.text();
    fileView.textContent = text;
    fileView.className = `language-${file.lang}`;
    hljs.highlightElement(fileView);
  } catch (e) {
    fileView.textContent = `Failed to load ${file.path}: ${e.message}`;
  }
}

files.forEach((file, i) => {
  const tab = document.createElement('button');
  tab.className = 'tab';
  tab.textContent = file.label;
  tab.addEventListener('click', () => showFile(file, tab));
  tabsEl.appendChild(tab);
  if (i === 0) showFile(file, tab);
});

renderDiagram();
