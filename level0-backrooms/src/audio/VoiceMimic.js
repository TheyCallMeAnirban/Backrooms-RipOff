export class VoiceMimic {
  constructor(monster, spatialAudioSystem) {
    this.monster = monster;
    this.audioSystem = spatialAudioSystem;

    // Attach PositionalAudio emitter to monster head
    this.spatialEmitter = null;
    if (this.audioSystem && this.monster) {
      this.spatialEmitter = this.audioSystem.createSpatialEmitter(this.monster.root, {
        refDistance: 2.5,
        maxDistance: 30.0,
        rolloffFactor: 1.15,
      });
    }

    // Footstep pacing timers
    this.stepTimer = 0;
    this.scratchTimer = 0;
    this.whisperTimer = 45; // Initial delay for whisper
  }

  update(dt, currentState, currentSpeed, wallCount) {
    if (!this.spatialEmitter) return;

    // 1. Update dynamic drywall occlusion
    this.spatialEmitter.updateOcclusion(wallCount);

    // 2. State-driven Footstep Foley
    if (currentSpeed > 0.1) {
      this.stepTimer -= dt;
      // Step rhythm: Walk1 (1.4 m/s) -> 0.72s interval; Walk2 (6.4 m/s) -> 0.28s interval
      const stepInterval = currentState === 'hunt' ? 0.28 : 0.72;

      if (this.stepTimer <= 0) {
        this.stepTimer = stepInterval;
        this.playSpatialSound('footstep_carpet', currentState === 'hunt' ? 0.65 : 0.4);
      }
    }

    // 3. Wall Scratching on Patrol / Stalk
    this.scratchTimer -= dt;
    if (this.scratchTimer <= 0 && (currentState === 'patrol' || currentState === 'stalk')) {
      this.scratchTimer = 18 + Math.random() * 22;
      this.playSpatialSound('wall_scratch', 0.35);
    }

    // 4. Fragmented Human Voice Mimicry
    this.whisperTimer -= dt;
    if (this.whisperTimer <= 0 && (currentState === 'stalk' || currentState === 'search')) {
      this.whisperTimer = 55 + Math.random() * 45;
      this.playSpatialSound('whisper_mimic', 0.55);
    }
  }

  playRoar() {
    this.playSpatialSound('creature_roar', 0.85);
  }

  playSpatialSound(bufferKey, volume = 0.5) {
    if (!this.spatialEmitter || !this.audioSystem.buffers.has(bufferKey)) return;

    const sound = this.spatialEmitter.sound;
    if (sound.isPlaying) sound.stop();

    sound.setBuffer(this.audioSystem.buffers.get(bufferKey));
    sound.setVolume(volume);
    sound.play();
  }
}

