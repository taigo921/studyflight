// 機内音などの環境音を Web Audio で合成する（外部音源を使わないためライセンス問題がない）。
// iOS の自動再生制約のため、必ずユーザー操作の中で start() を呼ぶ。

import type { SoundMode } from "@/domain/types";

type Ctx = AudioContext;

function noiseBuffer(ctx: Ctx, kind: "white" | "pink" | "brown", seconds = 4): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let last = 0;
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === "white") data[i] = white * 0.5;
      else if (kind === "brown") {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    // ループ継ぎ目のクリックを防ぐため端をフェード
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
      const g = i / fade;
      data[i] *= g;
      data[len - 1 - i] *= g;
    }
  }
  return buf;
}

export class AmbientSound {
  private ctx: Ctx | null = null;
  private nodes: AudioNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  private master: GainNode | null = null;
  mode: SoundMode = "off";

  get supported(): boolean {
    return typeof window !== "undefined" && ("AudioContext" in window || "webkitAudioContext" in window);
  }

  async start(mode: Exclude<SoundMode, "off">, volume = 0.5): Promise<void> {
    if (!this.supported) return;
    this.stopSources();
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    const ctx = this.ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(volume * 0.35, ctx.currentTime + 1.2);
    master.connect(ctx.destination);
    this.master = master;

    const src = ctx.createBufferSource();
    src.loop = true;
    if (mode === "cabin") {
      // 低く柔らかい機内のゴー音
      src.buffer = noiseBuffer(ctx, "brown");
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      const hum = ctx.createOscillator();
      hum.type = "sine";
      hum.frequency.value = 96;
      const humGain = ctx.createGain();
      humGain.gain.value = 0.025;
      hum.connect(humGain).connect(master);
      src.connect(lp).connect(master);
      hum.start();
      this.sources.push(hum);
      this.nodes.push(lp, humGain);
    } else if (mode === "rain") {
      src.buffer = noiseBuffer(ctx, "pink");
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 500;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 6000;
      // ゆっくりした強弱で雨脚を表現
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.25;
      const amp = ctx.createGain();
      amp.gain.value = 0.75;
      lfo.connect(lfoGain).connect(amp.gain);
      src.connect(hp).connect(lp).connect(amp).connect(master);
      lfo.start();
      this.sources.push(lfo);
      this.nodes.push(hp, lp, lfoGain, amp);
    } else {
      src.buffer = noiseBuffer(ctx, "white");
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 9000;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(lp).connect(g).connect(master);
      this.nodes.push(lp, g);
    }
    src.start();
    this.sources.push(src);
    this.mode = mode;
  }

  private stopSources(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* noop */
      }
    }
    for (const n of [...this.nodes, this.master]) n?.disconnect();
    this.sources = [];
    this.nodes = [];
    this.master = null;
  }

  stop(): void {
    if (this.ctx && this.master) {
      const m = this.master;
      m.gain.cancelScheduledValues(this.ctx.currentTime);
      m.gain.setValueAtTime(m.gain.value, this.ctx.currentTime);
      m.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
      setTimeout(() => this.stopSources(), 350);
    } else this.stopSources();
    this.mode = "off";
  }

  dispose(): void {
    this.stopSources();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}

export const SOUND_LABELS: Record<SoundMode, string> = {
  off: "オフ",
  cabin: "機内",
  rain: "雨音",
  white_noise: "ホワイトノイズ",
};
