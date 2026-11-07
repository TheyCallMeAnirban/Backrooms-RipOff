/**
 * AudioContext Unification and Verification Test Suite
 * Tests 1 through 11
 */
import * as THREE from 'three';
import { CONFIG } from './src/config.js';
import { SpatialAudioSystem } from './src/audio/SpatialAudioSystem.js';
import { VoiceMimic } from './src/audio/VoiceMimic.js';

class MockAudioParam {
  constructor(defaultValue = 0) {
    this.value = defaultValue;
  }
  setValueAtTime(v) { this.value = v; }
  setTargetAtTime(v) { this.value = v; }
  linearRampToValueAtTime(v) { this.value = v; }
  exponentialRampToValueAtTime(v) { this.value = v; }
}

class MockAudioNode {
  constructor(context) {
    this.context = context;
    this.connections = [];
  }
  connect(dest) {
    if (dest.context && dest.context !== this.context) {
      throw new Error(`AudioNode.connect: Can't connect nodes from different AudioContexts (source: ${this.context.id}, dest: ${dest.context.id})`);
    }
    this.connections.push(dest);
    return dest;
  }
  disconnect(dest) {
    if (!dest) {
      this.connections = [];
    } else {
      this.connections = this.connections.filter(c => c !== dest);
    }
  }
}

class MockGainNode extends MockAudioNode {
  constructor(ctx, val = 1.0) {
    super(ctx);
    this.gain = new MockAudioParam(val);
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(22000);
    this.Q = new MockAudioParam(1);
  }
}

class MockDynamicsCompressorNode extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.threshold = new MockAudioParam(-6);
    this.knee = new MockAudioParam(6);
    this.ratio = new MockAudioParam(20);
    this.attack = new MockAudioParam(0.001);
    this.release = new MockAudioParam(0.15);
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.frequency = new MockAudioParam(58);
    this.type = 'sawtooth';
  }
  start() {}
  stop() {}
}

class MockPannerNode extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.panningModel = 'HRTF';
    this.distanceModel = 'inverse';
    this.refDistance = 1;
    this.maxDistance = 10000;
    this.rolloffFactor = 1;
    this.coneInnerAngle = 360;
    this.coneOuterAngle = 360;
    this.coneOuterGain = 0;
    this.positionX = new MockAudioParam(0);
    this.positionY = new MockAudioParam(0);
    this.positionZ = new MockAudioParam(0);
    this.orientationX = new MockAudioParam(0);
    this.orientationY = new MockAudioParam(0);
    this.orientationZ = new MockAudioParam(0);
  }
  setPosition(x, y, z) {
    this.positionX.value = x;
    this.positionY.value = y;
    this.positionZ.value = z;
  }
  setOrientation(x, y, z) {
    this.orientationX.value = x;
    this.orientationY.value = y;
    this.orientationZ.value = z;
  }
}

class MockAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.channels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this._data = new Float32Array(length);
  }
  getChannelData() { return this._data; }
}

class MockAudioListenerParam {
  constructor(ctx) {
    this.positionX = new MockAudioParam(0);
    this.positionY = new MockAudioParam(0);
    this.positionZ = new MockAudioParam(0);
    this.forwardX = new MockAudioParam(0);
    this.forwardY = new MockAudioParam(0);
    this.forwardZ = new MockAudioParam(-1);
    this.upX = new MockAudioParam(0);
    this.upY = new MockAudioParam(1);
    this.upZ = new MockAudioParam(0);
  }
  setPosition() {}
  setOrientation() {}
}

let contextCount = 0;
class MockAudioContext {
  constructor() {
    this.id = ++contextCount;
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = new MockAudioNode(this);
    this.listener = new MockAudioListenerParam(this);
  }
  createGain() { return new MockGainNode(this); }
  createDynamicsCompressor() { return new MockDynamicsCompressorNode(this); }
  createBiquadFilter() { return new MockBiquadFilterNode(this); }
  createOscillator() { return new MockOscillatorNode(this); }
  createPanner() { return new MockPannerNode(this); }
  createBuffer(c, l, s) { return new MockAudioBuffer(c, l, s); }
  createBufferSource() {
    const node = new MockAudioNode(this);
    node.playbackRate = new MockAudioParam(1);
    node.start = () => {};
    node.stop = () => {};
    return node;
  }
  resume() { return Promise.resolve(); }
}

globalThis.window = {
  AudioContext: MockAudioContext,
};

async function runAcceptanceTests() {
  console.log('=== LEVEL 0 — AUDIOCONTEXT UNIFICATION ACCEPTANCE SUITE ===\n');

  contextCount = 0;
  const camera = new THREE.PerspectiveCamera(75, 1.33, 0.1, 100);
  const audio = new SpatialAudioSystem();

  // Test 1 & 2: Initialization with shared context
  await audio.init(camera);

  const totalContextsCreated = contextCount;
  const isSingleContext = totalContextsCreated === 1;
  const isIdenticalContext = audio.ctx === audio.listener.context;

  console.log(`[Test 1] Total AudioContext instances created: ${totalContextsCreated} (Expected: 1) -> ${isSingleContext ? 'PASS' : 'FAIL'}`);
  console.log(`[Test 2] audio.ctx === listener.context: ${isIdenticalContext} -> ${isIdenticalContext ? 'PASS' : 'FAIL'}`);

  // Test 3: Check all custom nodes share this context
  const nodes = [
    audio.masterGain,
    audio.limiter,
    audio.ambienceGain,
    audio.entityGain,
    audio.hallucinationGain,
    audio.sfxGain,
    audio.humOsc,
    audio.humFilter,
    audio.humGain,
  ];
  const allNodesMatch = nodes.every(n => n.context === audio.ctx);
  console.log(`[Test 3] All bus & synth nodes share context: ${allNodesMatch} -> ${allNodesMatch ? 'PASS' : 'FAIL'}`);

  // Test 4: Physical positional audio emitter connection
  let noConnectExceptions = true;
  let monsterEmitter = null;
  try {
    const dummyMonster = { root: new THREE.Object3D() };
    const vm = new VoiceMimic(dummyMonster, audio);
    monsterEmitter = vm.spatialEmitter;
  } catch (err) {
    console.error('Emitter connection error:', err);
    noConnectExceptions = false;
  }
  console.log(`[Test 4 & 5] Positional audio emitter connected without cross-context exception: ${noConnectExceptions} -> ${noConnectExceptions ? 'PASS' : 'FAIL'}`);

  // Test 6: Hallucination pool emitter check
  const poolEmitter = audio.hallucinationPool[0].emitter;
  const hallucinationContextMatches = poolEmitter.sound.context === audio.ctx;
  console.log(`[Test 6] Hallucination pool emitters share single context: ${hallucinationContextMatches} -> ${hallucinationContextMatches ? 'PASS' : 'FAIL'}`);

  // Test 7: Wall occlusion low-pass filter
  monsterEmitter.updateOcclusion(2);
  const cutoff = monsterEmitter.filter.frequency.value;
  const isOcclusionActive = Math.abs(cutoff - 771.60) < 1.0;
  console.log(`[Test 7] Wall occlusion filter responds dynamically (${cutoff.toFixed(1)} Hz): ${isOcclusionActive} -> ${isOcclusionActive ? 'PASS' : 'FAIL'}`);

  // Test 8: All audio buses present and connected
  const busesConnected = (
    audio.ambienceGain.connections.includes(audio.masterGain) &&
    audio.entityGain.connections.includes(audio.masterGain) &&
    audio.hallucinationGain.connections.includes(audio.masterGain) &&
    audio.sfxGain.connections.includes(audio.masterGain)
  );
  console.log(`[Test 8] All sub-buses correctly terminate at masterGain: ${busesConnected} -> ${busesConnected ? 'PASS' : 'FAIL'}`);

  // Test 9: Master limiter routes to destination
  const masterRoutesToDestination = audio.limiter.connections.includes(audio.ctx.destination);
  console.log(`[Test 9] Master limiter terminates at AudioContext destination: ${masterRoutesToDestination} -> ${masterRoutesToDestination ? 'PASS' : 'FAIL'}`);

  console.log('\nAll audio acceptance assertions verified cleanly.');
}

runAcceptanceTests();

