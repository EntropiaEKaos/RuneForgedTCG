import type { GameEvent } from "@/game/events";
import type { FxExecutionPlan, FxQuality } from "@/game/fx-plan";
import { buildFxVisualBudget, resolveFxVisualProfile } from "@/game/fx-visual-identity";

export interface FxGpuHandle { cancel(): void; }

const QUALITY_POINTS: Record<FxQuality, number> = { low: 0, medium: 0, high: 14, ultra: 24 };
const COLORS: Record<string, readonly [number, number, number]> = {
  neutral: [0.75, 0.82, 1], impact: [1, 0.48, 0.2], vitality: [0.25, 1, 0.55], death: [0.58, 0.62, 0.72], poison: [0.55, 1, 0.18], barrier: [0.25, 0.9, 1], frost: [0.45, 0.8, 1], stun: [0.72, 0.58, 1], ascension: [1, 0.84, 0.34],
};

/** Disposable GPU accent layer. Gameplay never depends on WebGL availability or completion. */
export function playFxGpuOverlay(target: Element | null, event: GameEvent, plan: FxExecutionPlan, quality: FxQuality): FxGpuHandle | null {
  if (!target || QUALITY_POINTS[quality] === 0 || typeof document === "undefined") return null;
  const rect = target.getBoundingClientRect(); if (rect.width <= 0 || rect.height <= 0) return null;
  const canvas = document.createElement("canvas"); const dpr = Math.min(window.devicePixelRatio || 1, 1.5); const size = Math.max(96, Math.min(320, Math.ceil(Math.max(rect.width, rect.height) * 1.7)));
  canvas.width = Math.ceil(size * dpr); canvas.height = Math.ceil(size * dpr); Object.assign(canvas.style, { position: "fixed", left: `${rect.left + rect.width / 2 - size / 2}px`, top: `${rect.top + rect.height / 2 - size / 2}px`, width: `${size}px`, height: `${size}px`, pointerEvents: "none", zIndex: "92", mixBlendMode: "screen" });
  let gl: WebGLRenderingContext | null = null; try { gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false }); } catch { return null; } if (!gl) return null;
  const vertex = gl.createShader(gl.VERTEX_SHADER); const fragment = gl.createShader(gl.FRAGMENT_SHADER); const program = gl.createProgram(); const buffer = gl.createBuffer(); if (!vertex || !fragment || !program || !buffer) return null;
  const cleanupGpu = () => { try { gl?.deleteBuffer(buffer); gl?.deleteProgram(program); gl?.deleteShader(vertex); gl?.deleteShader(fragment); } catch {} canvas.remove(); };
  try {
    gl.shaderSource(vertex, "attribute vec2 p; uniform float t; uniform float s; void main(){ float a=atan(p.y,p.x)+t*0.0018; float r=length(p)*(0.55+0.45*s); gl_Position=vec4(cos(a)*r,sin(a)*r,0.,1.); gl_PointSize=3.0+5.0*(1.0-s); }");
    gl.shaderSource(fragment, "precision mediump float; uniform vec3 c; uniform float a; void main(){ vec2 q=gl_PointCoord-.5; float d=dot(q,q); if(d>.25) discard; gl_FragColor=vec4(c,a*(1.0-d*4.0)); }");
    gl.compileShader(vertex); gl.compileShader(fragment); if (!gl.getShaderParameter(vertex, gl.COMPILE_STATUS) || !gl.getShaderParameter(fragment, gl.COMPILE_STATUS)) { cleanupGpu(); return null; }
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { cleanupGpu(); return null; } gl.useProgram(program);
    const profile = resolveFxVisualProfile(event); const budget = buildFxVisualBudget(plan, quality); const count = Math.min(QUALITY_POINTS[quality], Math.max(8, budget.particles)); const points = new Float32Array(count * 2); for (let i = 0; i < count; i += 1) { const angle = (i / count) * Math.PI * 2; const ring = 0.28 + ((i * 17) % 9) / 18; points[i * 2] = Math.cos(angle) * ring; points[i * 2 + 1] = Math.sin(angle) * ring; }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW); const p = gl.getAttribLocation(program, "p"); gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0); const t = gl.getUniformLocation(program, "t"); const s = gl.getUniformLocation(program, "s"); const c = gl.getUniformLocation(program, "c"); const a = gl.getUniformLocation(program, "a"); const color = COLORS[profile.identity] ?? COLORS.neutral; gl.uniform3f(c, color[0], color[1], color[2]); gl.viewport(0, 0, canvas.width, canvas.height); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); document.body.appendChild(canvas);
    const started = performance.now(); const duration = Math.max(260, Math.min(900, plan.durationMs + 120)); let frame = 0; let stopped = false;
    const draw = (now: number) => { if (stopped) return; const progress = Math.min(1, (now - started) / duration); gl!.clearColor(0, 0, 0, 0); gl!.clear(gl!.COLOR_BUFFER_BIT); gl!.uniform1f(t, now - started); gl!.uniform1f(s, progress); gl!.uniform1f(a, Math.sin(progress * Math.PI) * 0.72); gl!.drawArrays(gl!.POINTS, 0, count); if (progress < 1) frame = requestAnimationFrame(draw); else cleanupGpu(); }; frame = requestAnimationFrame(draw);
    return { cancel() { stopped = true; cancelAnimationFrame(frame); cleanupGpu(); } };
  } catch { cleanupGpu(); return null; }
}
