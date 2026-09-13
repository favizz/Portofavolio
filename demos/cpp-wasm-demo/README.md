# C WASM — Stack-Based Expression Evaluator

Real C (`evaluator.c`) — hand-rolled stack ADTs over raw arrays, no
`<stack>`/libc containers — implementing the classic shunting-yard
algorithm: tokenize an infix expression, convert to postfix (RPN), then
evaluate the postfix form. Compiled to WebAssembly via Emscripten and run
entirely client-side.

This is the same custom-ADT-from-scratch style as ITB's Algorithms & Data
Structures coursework (building List/Queue/Stack ADTs over plain arrays
rather than reaching for a standard-library container).

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Rebuild the WASM module after editing evaluator.c

Requires [Emscripten](https://emscripten.org/) (`brew install emscripten`):

```sh
emcc evaluator.c -O2 \
  -s EXPORTED_FUNCTIONS='["_c_run","_c_get_result","_c_get_error","_c_get_tokens","_c_get_postfix","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8","lengthBytesUTF8"]' \
  -s MODULARIZE=1 -s EXPORT_NAME='EvaluatorModule' -s ENVIRONMENT='web' \
  -o evaluator.js
```

This produces `evaluator.js` (glue code, loaded as a plain `<script>`, not
an ES module — it's a UMD-style bundle that defines a global
`EvaluatorModule` factory) and `evaluator.wasm` (the compiled binary).

## Deploy on Vercel

Static site, no build step. Set **Root Directory** to `demos/cpp-wasm-demo`
in the Vercel project settings, leave Build Command / Output Directory
blank, and deploy.
