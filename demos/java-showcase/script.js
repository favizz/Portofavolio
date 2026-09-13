const files = [
  { label: 'AssetController.java', path: 'api-source/src/main/java/com/wms/asset/AssetController.java' },
  { label: 'AssetService.java', path: 'api-source/src/main/java/com/wms/asset/AssetService.java' },
  { label: 'Asset.java', path: 'api-source/src/main/java/com/wms/asset/Asset.java' },
  { label: 'AssetMovement.java', path: 'api-source/src/main/java/com/wms/asset/AssetMovement.java' },
  { label: 'SecurityConfig.java', path: 'api-source/src/main/java/com/wms/asset/SecurityConfig.java' },
  { label: 'JwtAuthFilter.java', path: 'api-source/src/main/java/com/wms/asset/JwtAuthFilter.java' },
  { label: 'pom.xml', path: 'api-source/pom.xml', lang: 'xml' },
];

const tabsEl = document.getElementById('tabs');
const codeView = document.getElementById('codeView');

async function showFile(file, tabEl) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  tabEl.classList.add('active');
  codeView.textContent = 'Loading…';
  codeView.className = `language-${file.lang || 'java'}`;
  try {
    const res = await fetch(file.path);
    const text = await res.text();
    codeView.textContent = text;
    hljs.highlightElement(codeView);
  } catch (e) {
    codeView.textContent = `Failed to load ${file.path}: ${e.message}`;
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
