const CELL_SIZE = 6;
const CELL_GAP = 1;
const TICK_INTERVAL = 50;
const INITIAL_DENSITY = 0.2;
const GLIDER_SPAWN_INTERVAL = 1000;
const DRAG_SPAWN_INTERVAL = 100;
const EXPLOSION_RADIUS = 6;
const FADE_DURATION = 300;

const GLIDER_PATTERNS = [
  [
    [0, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  [
    [0, 1],
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
    [2, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [2, 1],
  ],
];

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_position * 0.5 + 0.5;
}`;

const COMPUTE_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_state;
uniform vec2 u_resolution;
in vec2 v_texCoord;
out vec4 outColor;

int getCell(vec2 offset) {
  return texture(u_state, v_texCoord + offset / u_resolution).r > 0.5 ? 1 : 0;
}

void main() {
  int n = getCell(vec2(-1, -1)) + getCell(vec2(0, -1)) + getCell(vec2(1, -1)) +
          getCell(vec2(-1,  0)) +                        getCell(vec2(1,  0)) +
          getCell(vec2(-1,  1)) + getCell(vec2(0,  1)) + getCell(vec2(1,  1));
  int alive = texture(u_state, v_texCoord).r > 0.5 ? 1 : 0;
  int next = (alive == 1 && (n == 2 || n == 3)) || (alive == 0 && n == 3) ? 1 : 0;
  outColor = vec4(float(next), 0.0, 0.0, 1.0);
}`;

const RENDER_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_state;
uniform float u_opacity;
uniform vec2 u_gridSize;
uniform vec2 u_cellParams;
in vec2 v_texCoord;
out vec4 outColor;

void main() {
  vec2 cellFrac = fract(v_texCoord * u_gridSize);
  float gapRatio = u_cellParams.y / u_cellParams.x;
  float isGap = min(step(1.0 - gapRatio, cellFrac.x) + step(1.0 - gapRatio, cellFrac.y), 1.0);
  float isCell = texture(u_state, v_texCoord).r * (1.0 - isGap);
  float gray = mix(1.0, 0.92, isCell * u_opacity);
  outColor = vec4(gray, gray, gray, 1.0);
}`;

let canvas: OffscreenCanvas | null = null;
let gl: WebGL2RenderingContext | null = null;
let computeProgram: WebGLProgram;
let renderProgram: WebGLProgram;
let quadBuffer: WebGLBuffer;
let textures: WebGLTexture[];
let framebuffers: WebGLFramebuffer[];

let width = 1;
let height = 1;
let canvasWidth = 1;
let canvasHeight = 1;
let current = 0;
let initialized = false;

let running = false;
let lastStep = 0;
let lastGliderSpawn = 0;
let lastDragSpawn = 0;

let opacity = 0;
let fadeDirection: "in" | "out" | "none" = "none";
let fadeStartTime = 0;

let mouseX = -1;
let mouseY = -1;
let mouseDown = false;

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function createShader(type: number, source: string): WebGLShader {
  const shader = gl!.createShader(type)!;
  gl!.shaderSource(shader, source);
  gl!.compileShader(shader);
  return shader;
}

function createProgram(vertexSrc: string, fragmentSrc: string): WebGLProgram {
  const program = gl!.createProgram()!;
  gl!.attachShader(program, createShader(gl!.VERTEX_SHADER, vertexSrc));
  gl!.attachShader(program, createShader(gl!.FRAGMENT_SHADER, fragmentSrc));
  gl!.linkProgram(program);
  return program;
}

function createTexture(w: number, h: number, data?: Uint8Array): WebGLTexture {
  const tex = gl!.createTexture()!;
  gl!.bindTexture(gl!.TEXTURE_2D, tex);
  gl!.pixelStorei(gl!.UNPACK_ALIGNMENT, 1);
  gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.R8, w, h, 0, gl!.RED, gl!.UNSIGNED_BYTE, data ?? null);
  gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.NEAREST);
  gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.NEAREST);
  gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.REPEAT);
  gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.REPEAT);
  return tex;
}

function createFramebuffer(tex: WebGLTexture): WebGLFramebuffer {
  const fb = gl!.createFramebuffer()!;
  gl!.bindFramebuffer(gl!.FRAMEBUFFER, fb);
  gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0);
  return fb;
}

function setup(): void {
  width = Math.max(1, Math.ceil(canvasWidth / CELL_SIZE));
  height = Math.max(1, Math.ceil(canvasHeight / CELL_SIZE));

  const size = width * height;
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = Math.random() < INITIAL_DENSITY ? 255 : 0;
  }

  textures = [createTexture(width, height, data), createTexture(width, height)];
  framebuffers = [createFramebuffer(textures[0]), createFramebuffer(textures[1])];
  current = 0;
}

function screenToCell(px: number, py: number): { x: number; y: number } {
  return {
    x: Math.floor(px / CELL_SIZE),
    y: height - 1 - Math.floor(py / CELL_SIZE),
  };
}

function writePattern(x: number, y: number, size: number, data: Uint8Array): void {
  const clampedX = Math.max(0, Math.min(x, width - size));
  const clampedY = Math.max(0, Math.min(y, height - size));
  gl!.bindTexture(gl!.TEXTURE_2D, textures[current]);
  gl!.pixelStorei(gl!.UNPACK_ALIGNMENT, 1);
  gl!.texSubImage2D(
    gl!.TEXTURE_2D,
    0,
    clampedX,
    clampedY,
    size,
    size,
    gl!.RED,
    gl!.UNSIGNED_BYTE,
    data,
  );
}

function spawnGlider(px: number, py: number): void {
  const cell = screenToCell(px, py);
  const pattern = GLIDER_PATTERNS[Math.floor(Math.random() * GLIDER_PATTERNS.length)];
  const data = new Uint8Array(9);

  for (const [dy, dx] of pattern) {
    const idx = (2 - dy) * 3 + dx;
    if (idx >= 0 && idx < 9) data[idx] = 255;
  }

  writePattern(cell.x - 1, cell.y - 1, 3, data);
}

function spawnExplosion(px: number, py: number): void {
  const cell = screenToCell(px, py);
  const r = EXPLOSION_RADIUS;
  const size = r * 2 + 1;
  const data = new Uint8Array(size * size);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r && Math.random() < 0.7 - (dist / r) * 0.5) {
        data[(r - dy) * size + (dx + r)] = 255;
      }
    }
  }

  writePattern(cell.x - r, cell.y - r, size, data);
}

function bindQuad(program: WebGLProgram): void {
  const posLoc = gl!.getAttribLocation(program, "a_position");
  gl!.bindBuffer(gl!.ARRAY_BUFFER, quadBuffer);
  gl!.enableVertexAttribArray(posLoc);
  gl!.vertexAttribPointer(posLoc, 2, gl!.FLOAT, false, 0, 0);
}

function step(): void {
  const next = 1 - current;
  gl!.bindFramebuffer(gl!.FRAMEBUFFER, framebuffers[next]);
  gl!.viewport(0, 0, width, height);
  gl!.useProgram(computeProgram);
  bindQuad(computeProgram);

  gl!.activeTexture(gl!.TEXTURE0);
  gl!.bindTexture(gl!.TEXTURE_2D, textures[current]);
  gl!.uniform1i(gl!.getUniformLocation(computeProgram, "u_state"), 0);
  gl!.uniform2f(gl!.getUniformLocation(computeProgram, "u_resolution"), width, height);

  gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  current = next;
}

function render(): void {
  gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
  gl!.viewport(0, 0, canvas!.width, canvas!.height);
  gl!.clearColor(0, 0, 0, 0);
  gl!.clear(gl!.COLOR_BUFFER_BIT);

  gl!.useProgram(renderProgram);
  gl!.enable(gl!.BLEND);
  gl!.blendFunc(gl!.SRC_ALPHA, gl!.ONE_MINUS_SRC_ALPHA);
  bindQuad(renderProgram);

  gl!.activeTexture(gl!.TEXTURE0);
  gl!.bindTexture(gl!.TEXTURE_2D, textures[current]);
  gl!.uniform1i(gl!.getUniformLocation(renderProgram, "u_state"), 0);
  gl!.uniform1f(gl!.getUniformLocation(renderProgram, "u_opacity"), opacity);
  gl!.uniform2f(gl!.getUniformLocation(renderProgram, "u_gridSize"), width, height);
  gl!.uniform2f(gl!.getUniformLocation(renderProgram, "u_cellParams"), CELL_SIZE, CELL_GAP);

  gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
}

function updateFade(time: number): boolean {
  if (fadeDirection === "none") return true;

  const elapsed = time - fadeStartTime;
  const progress = Math.min(elapsed / FADE_DURATION, 1);
  const eased = easeOut(progress);

  if (fadeDirection === "in") {
    opacity = eased;
    if (progress >= 1) fadeDirection = "none";
  } else {
    opacity = 1 - eased;
    if (progress >= 1) {
      running = false;
      self.postMessage({ type: "fadeOutComplete" });
      return false;
    }
  }

  return true;
}

function updateSpawns(time: number): void {
  if (mouseX < 0 || mouseY < 0) return;

  if (mouseDown && time - lastDragSpawn > DRAG_SPAWN_INTERVAL) {
    spawnExplosion(mouseX, mouseY);
    lastDragSpawn = time;
  } else if (!mouseDown && time - lastGliderSpawn > GLIDER_SPAWN_INTERVAL) {
    spawnGlider(mouseX, mouseY);
    lastGliderSpawn = time;
  }
}

function loop(time: number): void {
  if (!running) return;
  if (!updateFade(time)) return;

  updateSpawns(time);

  if (time - lastStep > TICK_INTERVAL) {
    step();
    lastStep = time;
  }

  render();
  requestAnimationFrame(loop);
}

function initGL(offscreen: OffscreenCanvas): void {
  canvas = offscreen;
  gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false })!;
  computeProgram = createProgram(VERTEX_SHADER, COMPUTE_SHADER);
  renderProgram = createProgram(VERTEX_SHADER, RENDER_SHADER);
  quadBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  initialized = true;
}

function startSimulation(w: number, h: number, time: number): void {
  canvasWidth = w;
  canvasHeight = h;
  canvas!.width = canvasWidth;
  canvas!.height = canvasHeight;

  setup();
  running = true;
  fadeDirection = "in";
  fadeStartTime = time;
  opacity = 0;
  mouseX = -1;
  mouseY = -1;

  requestAnimationFrame(loop);
}

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case "init":
      initGL(payload.canvas as OffscreenCanvas);
      requestAnimationFrame((time) => startSimulation(payload.width, payload.height, time));
      break;

    case "start":
      if (initialized) {
        requestAnimationFrame((time) => startSimulation(payload.width, payload.height, time));
      }
      break;

    case "resize":
      canvasWidth = payload.width;
      canvasHeight = payload.height;
      if (canvas) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
      }
      if (running && gl) setup();
      break;

    case "mousemove":
      mouseX = payload.x;
      mouseY = payload.y;
      break;

    case "mousedown":
      mouseDown = true;
      break;

    case "mouseup":
      mouseDown = false;
      break;

    case "stop":
      fadeDirection = "out";
      fadeStartTime = performance.now();
      break;
  }
};
