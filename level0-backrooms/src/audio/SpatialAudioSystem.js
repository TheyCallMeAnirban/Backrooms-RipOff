import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class SpatialAudioSystem {
  constructor() {
    this.ctx = null;
    this.listener = null;

    // Bus Gain Nodes
    this.masterGain = null;
    this.limiter = null;
    this.ambienceGain = null;
    this.entityGain = null;
    this.hallucinationGain = null;
    this.sfxGain = null;

    // Fluorescent Ambience Synth
    this.humOsc = null;
    this.humGain = null;
    this.humFilter = null;

    // Pre-allocated Audio Buffers
    this.buffers = new Map();

    // Virtual Hallucination Emitter Pool
    this.hallucinationPool = [];

    this.isInitialized = false;
  }

  _assertContext(sourceNode, targetNode, label = 'AudioNode') {
    if (!sourceNode || !targetNode) return;
    const srcCtx = sourceNode.context || sourceNode;
    const tgtCtx = targetNode.context || targetNode;
    if (srcCtx !== tgtCtx) {
      throw new Error(`[SpatialAudioSystem] Context Mismatch in ${label}: source context !== target context.`);
    }
  }

  async init(camera) {
    if (this.isInitialized) return;

    // 1. Establish SINGLE SOURCE OF TRUTH: Three.js AudioListener's context
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.ctx = this.listener.context;

    // Disconnect default listener gain to route entire Three.js audio tree through our master bus
    this.listener.gain.disconnect();

    // 2. Resume context cleanly under user gesture
    if (this.ctx.state === 'suspended') {
      try {
        await Promise.race([
          this.ctx.resume(),
          new Promise((resolve) => setTimeout(resolve, 800)),
        ]);
      } catch (e) {
        console.warn('[SpatialAudioSystem] ctx.resume() non-blocking warning:', e);
      }
    }

    // 3. Master Dynamics Compressor / Brick-wall Protection Stage
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-6, this.ctx.currentTime);
    this.limiter.knee.setValueAtTime(6, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(20, this.ctx.currentTime);
    this.limiter.attack.setValueAtTime(0.001, this.ctx.currentTime);
    this.limiter.release.setValueAtTime(0.15, this.ctx.currentTime);
    this.limiter.connect(this.ctx.destination);

    // 4. Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(CONFIG.AUDIO.MASTER_GAIN, this.ctx.currentTime);
    this._assertContext(this.masterGain, this.limiter, 'masterGain -> limiter');
    this.masterGain.connect(this.limiter);

    // 5. Connect Three.js AudioListener.gain into Master Bus (unifying all positional audio)
    this._assertContext(this.listener.gain, this.masterGain, 'listener.gain -> masterGain');
    this.listener.gain.connect(this.masterGain);

    // 6. Sub-Buses
    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this._assertContext(this.ambienceGain, this.masterGain, 'ambienceGain -> masterGain');
    this.ambienceGain.connect(this.masterGain);

    this.entityGain = this.ctx.createGain();
    this.entityGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this._assertContext(this.entityGain, this.masterGain, 'entityGain -> masterGain');
    this.entityGain.connect(this.masterGain);

    this.hallucinationGain = this.ctx.createGain();
    this.hallucinationGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
    this._assertContext(this.hallucinationGain, this.masterGain, 'hallucinationGain -> masterGain');
    this.hallucinationGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this._assertContext(this.sfxGain, this.masterGain, 'sfxGain -> masterGain');
    this.sfxGain.connect(this.masterGain);

    // 7. Synthesize Procedural Reusable Audio Buffers
    this._generateProceduralBuffers();

    // 8. Start Fluorescent Ambient Hum
    this._startHum();

    // 9. Setup Hallucination Virtual Emitter Pool
    this._setupHallucinationPool();

    this.isInitialized = true;
    console.log('[SpatialAudioSystem] Unified single-context audio hierarchy and HRTF listener initialized.');
  }

  _generateProceduralBuffers() {
    const sampleRate = this.ctx.sampleRate;

    // A. Carpet Footstep Thud (0.18s, low-frequency damped impulse)
    const stepLen = Math.floor(sampleRate * 0.18);
    const stepBuf = this.ctx.createBuffer(1, stepLen, sampleRate);
    const stepData = stepBuf.getChannelData(0);
    for (let i = 0; i < stepLen; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 22);
      const freq = 65 + Math.sin(t * 180) * 15;
      const noise = (Math.random() * 2 - 1) * 0.25;
      stepData[i] = (Math.sin(2 * Math.PI * freq * t) * 0.75 + noise) * decay;
    }
    this.buffers.set('footstep_carpet', stepBuf);

    // B. Wall Scratch / Joint Click (0.35s)
    const scratchLen = Math.floor(sampleRate * 0.35);
    const scratchBuf = this.ctx.createBuffer(1, scratchLen, sampleRate);
    const scratchData = scratchBuf.getChannelData(0);
    for (let i = 0; i < scratchLen; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 9);
      scratchData[i] = (Math.random() * 2 - 1) * Math.sin(t * 800) * decay;
    }
    this.buffers.set('wall_scratch', scratchBuf);

    // C. Mimic Whisper Fragment (0.75s, airy breathing formant)
    const whisperLen = Math.floor(sampleRate * 0.75);
    const whisperBuf = this.ctx.createBuffer(1, whisperLen, sampleRate);
    const whisperData = whisperBuf.getChannelData(0);
    for (let i = 0; i < whisperLen; i++) {
      const t = i / sampleRate;
      const env = Math.sin((Math.PI * i) / whisperLen);
      const formant = Math.sin(2 * Math.PI * 420 * t) * Math.sin(2 * Math.PI * 1850 * t);
      whisperData[i] = (Math.random() * 0.5 - 0.25 + formant * 0.3) * env * 0.45;
    }
    this.buffers.set('whisper_mimic', whisperBuf);

    // D. Sub-bass Screech / Roar (1.2s, predatory hunt cue)
    const roarLen = Math.floor(sampleRate * 1.2);
    const roarBuf = this.ctx.createBuffer(1, roarLen, sampleRate);
    const roarData = roarBuf.getChannelData(0);
    for (let i = 0; i < roarLen; i++) {
      const t = i / sampleRate;
      const env = Math.sin((Math.PI * i) / roarLen);
      const freq = 120 - t * 45;
      const mod = Math.sin(2 * Math.PI * 14 * t);
      roarData[i] = (Math.sin(2 * Math.PI * freq * t + mod * 4) + (Math.random() * 0.4 - 0.2)) * env * 0.7;
    }
    this.buffers.set('creature_roar', roarBuf);
  }

  _startHum() {
    this.humOsc = this.ctx.createOscillator();
    this.humOsc.type = 'sawtooth';
    const baseFreq = (CONFIG.AUDIO && CONFIG.AUDIO.HUM_BASE_FREQ) ? CONFIG.AUDIO.HUM_BASE_FREQ : 58;
    this.humOsc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

    this.humFilter = this.ctx.createBiquadFilter();
    this.humFilter.type = 'lowpass';
    this.humFilter.frequency.setValueAtTime(CONFIG.AUDIO.HUM_FILTER_FREQ, this.ctx.currentTime);

    this.humGain = this.ctx.createGain();
    this.humGain.gain.setValueAtTime(CONFIG.AUDIO.HUM_DEFAULT_GAIN, this.ctx.currentTime);

    this._assertContext(this.humOsc, this.humFilter, 'humOsc -> humFilter');
    this._assertContext(this.humFilter, this.humGain, 'humFilter -> humGain');
    this._assertContext(this.humGain, this.ambienceGain, 'humGain -> ambienceGain');

    this.humOsc.connect(this.humFilter);
    this.humFilter.connect(this.humGain);
    this.humGain.connect(this.ambienceGain);

    this.humOsc.start();
  }

  setHumIntensity(factor, timeConstant = 0.4) {
    if (!this.humGain || !this.ctx) return;
    const targetGain = CONFIG.AUDIO.HUM_DEFAULT_GAIN + factor * 0.06;
    this.humGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, timeConstant);
  }

  setHumFrequency(freq, timeConstant = 0.1) {
    if (!this.humOsc || !this.ctx) return;
    this.humOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, timeConstant);
  }

  triggerElectricalSilence(duration = 4.0) {
    if (!this.ambienceGain || !this.ctx) return;
    // Mute ONLY ambience bus, leaving gameplay SFX, footsteps, and entity vocalizations intact
    this.ambienceGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);

    setTimeout(() => {
      if (this.ambienceGain && this.ctx) {
        this.ambienceGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.35);
      }
    }, duration * 1000);
  }

  // Create and configure a spatial emitter on a 3D Object
  createSpatialEmitter(object3D, options = {}) {
    if (!this.listener) return null;

    const sound = new THREE.PositionalAudio(this.listener);

    // Occlusion low-pass filter
    const occlusionFilter = this.ctx.createBiquadFilter();
    occlusionFilter.type = 'lowpass';
    occlusionFilter.frequency.setValueAtTime(22000, this.ctx.currentTime);

    // Assert context match
    this._assertContext(sound.gain, occlusionFilter, 'sound.gain -> occlusionFilter');
    this._assertContext(occlusionFilter, options.targetBus || this.entityGain, 'occlusionFilter -> targetBus');

    // Configure HRTF & Inverse Distance attenuation
    sound.setRefDistance(options.refDistance || 2.5);
    sound.setMaxDistance(options.maxDistance || 32.0);
    sound.setRolloffFactor(options.rolloffFactor || 1.15);
    sound.setDistanceModel('inverse');

    // Attach occlusion filter to the PositionalAudio processing pipeline
    sound.setFilter(occlusionFilter);

    // Route: panner -> sound.gain -> bus (instead of directly to listener.getInput())
    const targetBus = options.targetBus || this.entityGain;
    sound.gain.disconnect();
    sound.gain.connect(targetBus);

    object3D.add(sound);

    return {
      sound,
      filter: occlusionFilter,
      updateOcclusion: (wallCount) => {
        if (!this.ctx) return;
        if (wallCount === 0) {
          occlusionFilter.frequency.setTargetAtTime(22000, this.ctx.currentTime, 0.1);
        } else {
          const cutoff = Math.max(350, 2500 / Math.pow(1.8, wallCount));
          occlusionFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.15);
        }
      },
    };
  }

  _setupHallucinationPool() {
    this.hallucinationPool = [];
    for (let i = 0; i < 3; i++) {
      const dummy = new THREE.Object3D();
      const emitter = this.createSpatialEmitter(dummy, {
        refDistance: 2.0,
        maxDistance: 24.0,
        rolloffFactor: 1.2,
        targetBus: this.hallucinationGain,
      });
      this.hallucinationPool.push({ dummy, emitter, inUse: false });
    }
  }

  playOneShotAt(bufferKey, position, volume = 0.5) {
    const pooled = this.hallucinationPool.find((p) => !p.inUse);
    if (!pooled || !this.buffers.has(bufferKey)) return;

    pooled.inUse = true;
    pooled.dummy.position.copy(position);

    const sound = pooled.emitter.sound;
    sound.setBuffer(this.buffers.get(bufferKey));
    sound.setVolume(volume);

    sound.onEnded = () => {
      pooled.inUse = false;
    };

    sound.play();
  }

  playTone(freq, duration, type = 'sine', volume = 0.2) {
    if (!this.ctx || !this.isInitialized) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    this._assertContext(osc, gain, 'playTone: osc -> gain');
    this._assertContext(gain, this.sfxGain, 'playTone: gain -> sfxGain');
    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

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

    this._assertContext(source, gain, 'playNoise: source -> gain');
    this._assertContext(gain, this.sfxGain, 'playNoise: gain -> sfxGain');
    source.connect(gain);
    gain.connect(this.sfxGain);

    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };

    source.start();
  }
}

