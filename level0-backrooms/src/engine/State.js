export const GAME_STATES = {
  TITLE: 'TITLE',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  JUMPSCARE: 'JUMPSCARE',
  DEAD: 'DEAD',
  ESCAPED: 'ESCAPED',
};

export class GameState {
  constructor(initialState = GAME_STATES.TITLE) {
    this.current = initialState;
    this.listeners = [];
  }

  set(newState) {
    if (this.current === newState) return;
    const oldState = this.current;
    this.current = newState;
    for (const listener of this.listeners) {
      listener(newState, oldState);
    }
  }

  is(state) {
    return this.current === state;
  }

  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }
}

