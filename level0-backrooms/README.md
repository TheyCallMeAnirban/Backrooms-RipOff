# 🟨 LEVEL 0 — DON'T LOOK BACK

> *"If you're not careful and you noclip out of reality in the wrong areas, you'll end up in the Backrooms..."*

An immersive, browser-based **psychological liminal horror prototype** built with **Three.js** and **Vite**.

Experience the suffocating dread of the endless mono-yellow corridors, buzzing fluorescent ballasts, damp carpets, and an unpredictable entity that hunts by sound and sight.

---

## ⚡ Highlights

- **Dynamic Encounter System**: Zero hardcoded spawns. The entity location and patrol territories adapt dynamically across runs via a dedicated `SpawnDirector` and BFS pathfinding heatmaps.
- **Skeletal 3D Animated Creature**: Fully rigged humanoid stalker (`Creep`) with smooth skeletal animation blending across 6 AI states (*Dormant*, *Patrol*, *Stalk*, *Hunt*, *Search*, *Kill*).
- **Spatial Audio & Psychoacoustics**:
  - Web Audio API HRTF spatial panner and inverse-distance attenuation.
  - Dynamic drywall sound occlusion (low-pass filtering based on intervening maze walls).
  - Voice mimicry, phantom footsteps with adaptive turn-around reactions, and sudden electrical silence cascades.
- **Continuous Psychological Fear Model**: Stress accumulates dynamically based on flashlight usage, proximity, and hunt states, subtly altering environmental flicker and player hallucination frequency.
- **Zero-Stutter Pre-Warming**: Precompiled WebGL shaders and asynchronous GPU texture uploads to ensure locked 60 FPS gameplay without first-encounter stutters.
- **Dedicated 3D Model Inspector**: Built-in interactive `/preview.html` scene to audit LODs, skeletal animations, and PBR skin variants with studio multi-angle lighting.

---

## 🎮 Controls

| Key | Action |
| :--- | :--- |
| **W, A, S, D** | Move |
| **Mouse** | Look / Aim (Pointer Lock) |
| **Shift** | Sprint (Burns stamina, increases noise radius) |
| **C / Ctrl** | Crouch (Quieter footsteps, reduced eye-height) |
| **F** | Toggle Flashlight |
| **Esc** | Release Mouse Pointer |

---

## 🚀 Quickstart

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.0 or newer recommended)
- `npm` or `pnpm`

### Installation & Run

```bash
# 1. Clone the repository
git clone https://github.com/TheyCallMeAnirban/Backrooms-RipOff.git
cd Backrooms-RipOff/level0-backrooms

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open your browser at `http://localhost:5173/` (or the URL printed in your terminal).

To open the isolated **Creature Preview Scene**, visit:
```
http://localhost:5173/preview.html
```

### Production Build

```bash
npm run build
npm run preview
```

---

## 🏗️ Architecture Overview

The codebase is organized into modular sub-systems inside `level0-backrooms/src/`:

```
src/
├── audio/
│   ├── SpatialAudioSystem.js   # Single-source AudioContext, bus routing, master limiter & hum
│   ├── VoiceMimic.js           # Entity vocalization, footsteps & drywall occlusion filters
│   └── OcclusionRaycaster.js   # Raycasts intervening maze walls between listener and sound
├── engine/
│   ├── Input.js                # Pointer-lock and keyboard input bindings
│   ├── Loop.js                 # Fixed-timestep physics update & decoupled render loop
│   └── State.js                # Game state finite state machine
├── entity/
│   ├── Monster.js              # FBX rig loader, scale normalization & AnimationMixer controller
│   └── CreatureAI.js           # Multi-state AI (Dormant, Patrol, Stalk, Hunt, Search, Kill)
├── player/
│   ├── Controller.js           # First-person camera, headbobbing, smooth crouching & stamina
│   └── Stamina.js              # Sprint exhaustion and recovery mechanics
├── preview/
│   └── creature_preview.js     # Standalone OrbitControls 3D viewer for creature animations
├── systems/
│   ├── SpawnDirector.js        # Graph-distance candidate selection for fair random spawns
│   ├── FearDirector.js         # Activity heatmap tracking, light flickers & auditory lures
│   ├── FearModel.js            # Hidden continuous psychological fear metrics
│   └── HallucinationDirector.js# Phantom footsteps & peripheral shadow silhouette anomalies
├── world/
│   ├── MazeGen.js              # Seeded DFS maze generation with cyclical loops
│   └── PRNG.js                 # Deterministic pseudo-random number generator
├── config.js                   # Unified world, player, monster, and audio parameters
└── main.js                     # Core orchestration and startup loading lifecycle
```

---

## 🛡️ Git & Safe Push Guidelines

This repository includes 3D models and high-resolution textures. Ensure you follow these practices when contributing:

1. **Clean Builds**: `dist/`, `.godot/`, and `node_modules/` are strictly ignored via `.gitignore`. Never use `git add -f` on ignored directories.
2. **Deterministic PRNG Seeds**: Run with `?seed=XXXXX` in the URL to reproduce any specific maze layout and encounter distribution.
3. **Verify Build**: Always run `npm run build` before committing to ensure chunking and module resolution succeed.

---

## 📜 Asset Provenance & Licensing

All external models, textures, and audio algorithms conform strictly to permissive open licenses (CC0, MIT, or Public Domain).
Detailed licensing records and asset origins are tracked in [ASSET_MANIFEST.md](level0-backrooms/ASSET_MANIFEST.md).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
