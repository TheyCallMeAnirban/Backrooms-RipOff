import { CONFIG } from '../config.js';

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambienceGain = null;
    this.sfxGain = null;

    this.humOsc = null;
    this.humGain = null;
    this.humFilter = null;

    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // 1. Persistent Master Bus
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(CONFIG.AUDIO.MASTER_GAIN, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // 2. Persistent Ambience Bus
    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.ambienceGain.connect(this.masterGain);

    // 3. Persistent SFX Bus
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    // 4. Start Fluorescent Ambient Hum
    this._startHum();

    this.isInitialized = true;
  }

  _startHum() {
    this.humOsc = this.ctx.createOscillator();
    this.humOsc.type = 'sawtooth';
    this.humOsc.frequency.setValueAtTime(CONFIG.AUDIO.HUM_BASE_FREQ, this.ctx.currentTime);

    this.humFilter = this.ctx.createBiquadFilter();
    this.humFilter.type = 'lowpass';
    this.humFilter.frequency.setValueAtTime(CONFIG.AUDIO.HUM_FILTER_FREQ, this.ctx.currentTime);

    this.humGain = this.ctx.createGain();
    this.humGain.gain.setValueAtTime(CONFIG.AUDIO.HUM_DEFAULT_GAIN, this.ctx.currentTime);

    this.humOsc.connect(this.humFilter);
    this.humFilter.connect(this.humGain);
    this.humGain.connect(this.ambienceGain);

    this.humOsc.start();
  }

  setHumIntensity(factor, timeConstant = 0.4) {
    if (!this.humGain || !this.ctx) return;
    const targetGain = CONFIG.AUDIO.HUM_DEFAULT_GAIN + factor * 0.07;
    this.humGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, timeConstant);
  }

  // Play synthesized tone with strict disconnect cleanup
  playTone(freq, duration, type = 'sine', volume = 0.2) {
    if (!this.ctx || !this.isInitialized) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Play synthesized noise burst with strict disconnect cleanup
  playNoise(duration, volume = 0.25) {
    if (!this.ctx || !this.isInitialized) return;

    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();

    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);

    source.connect(gain);
    gain.connect(this.sfxGain);

    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };

    source.start();
  }
}

