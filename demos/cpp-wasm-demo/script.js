const exprInput = document.getElementById('expr');
const runBtn = document.getElementById('run');
const statusEl = document.getElementById('status');
const trace = document.getElementById('trace');
const tokensOut = document.getElementById('tokensOut');
const postfixOut = document.getElementById('postfixOut');
const resultOut = document.getElementById('resultOut');
const resultBox = document.getElementById('result');

let Module = null;

function run() {
  if (!Module) return;
  const expr = exprInput.value;
  const ok = Module.ccall('c_run', 'number', ['string'], [expr]);

  const tokens = Module.ccall('c_get_tokens', 'string', [], []);
  const postfix = Module.ccall('c_get_postfix', 'string', [], []);

  trace.hidden = false;
  tokensOut.textContent = tokens;
  postfixOut.textContent = postfix;

  if (ok) {
    const result = Module.ccall('c_get_result', 'number', [], []);
    resultOut.textContent = String(result);
    resultOut.style.color = '#34d399';
    statusEl.textContent = '';
  } else {
    const error = Module.ccall('c_get_error', 'string', [], []);
    resultOut.textContent = `error: ${error}`;
    resultOut.style.color = '#fb7185';
    statusEl.textContent = '';
  }
}

runBtn.addEventListener('click', run);
exprInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    exprInput.value = chip.dataset.expr;
    run();
  });
});

statusEl.textContent = 'Loading WASM…';
EvaluatorModule().then((mod) => {
  Module = mod;
  statusEl.textContent = 'WASM loaded — ready.';
  run();
});
