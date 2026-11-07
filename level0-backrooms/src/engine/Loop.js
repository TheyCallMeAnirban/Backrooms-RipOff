export class Loop {
  constructor({ onFixedUpdate, onRender, fixedStep = 1 / 60, maxSubSteps = 5 }) {
    this.onFixedUpdate = onFixedUpdate;
    this.onRender = onRender;
    this.fixedStep = fixedStep;
    this.maxSubSteps = maxSubSteps;

    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.rafId = null;

    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  _tick(currentTime) {
    if (!this.running) return;

    let delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Prevent spiral of death on long lag spikes or background tab
    if (delta > 0.2) delta = 0.2;

    this.accumulator += delta;

    let steps = 0;
    while (this.accumulator >= this.fixedStep && steps < this.maxSubSteps) {
      this.onFixedUpdate(this.fixedStep);
      this.accumulator -= this.fixedStep;
      steps++;
    }

    // Alpha for interpolation if needed: this.accumulator / this.fixedStep
    const alpha = this.accumulator / this.fixedStep;
    this.onRender(delta, alpha);

    this.rafId = requestAnimationFrame(this._tick);
  }
}

