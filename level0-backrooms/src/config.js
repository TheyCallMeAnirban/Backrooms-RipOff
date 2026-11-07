export const CONFIG = {
  WORLD: {
    GRID_WIDTH: 15,
    GRID_HEIGHT: 15,
    CELL_SIZE: 6.4,
    WALL_HEIGHT: 3.8,
    WALL_THICKNESS: 0.24,
    CYCLES_COUNT: 18,
    DEFAULT_SEED: 4207,
    LIGHT_FIXTURE_CHANCE: 0.65,
  },
  PLAYER: {
    EYE_HEIGHT_STAND: 1.70,
    EYE_HEIGHT_CROUCH: 0.85,
    COLLISION_RADIUS: 0.32,
    COLLISION_HEIGHT_STAND: 1.80,
    COLLISION_HEIGHT_CROUCH: 1.00,
    WALK_SPEED: 3.10,
    SPRINT_SPEED: 5.80, // Tuned baseline sprint speed
    CROUCH_SPEED: 1.35,
    HEADBOB_SPEED_WALK: 0.009,
    HEADBOB_AMP_WALK: 0.035,
    HEADBOB_SPEED_SPRINT: 0.014,
    HEADBOB_AMP_SPRINT: 0.075,
    MOUSE_SENSITIVITY: 0.0022,
    MAX_PITCH: 1.35,
  },
  MONSTER: {
    SPEED_PATROL: 1.20,
    SPEED_STALK: 1.40,
    SPEED_HUNT: 6.40, // Faster than player sprint (5.8 m/s)
    ACCELERATION_HUNT: 8.0, // Acceleration rate entering hunt
  },
  FLASHLIGHT: {
    INTENSITY: 45, // High-contrast beam illumination
    DISTANCE: 32,
    ANGLE: Math.PI / 6.0,
    PENUMBRA: 0.40,
    DECAY: 1.2,
  },
  AUDIO: {
    HUM_BASE_FREQ: 58,
    HUM_FILTER_FREQ: 115,
    HUM_DEFAULT_GAIN: 0.045,
    MASTER_GAIN: 0.18, // Conservative gain staging to preserve headroom below 0 dBFS
  },
  RENDER: {
    FOG_COLOR: 0x8f8868,
    FOG_DENSITY: 0.022,
    WALL_COLOR: 0xc8bd82,
    CARPET_COLOR: 0x71633d,
    CEILING_COLOR: 0x9a916e,
    TRIM_COLOR: 0x9b8c5d,
  }
};
