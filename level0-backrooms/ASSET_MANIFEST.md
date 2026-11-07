# Asset Provenance and Licensing Manifest
## LEVEL 0 — DON'T LOOK BACK

This manifest tracks all external 3D models, textures, and audio foley integrated into the project. Every asset must strictly conform to permissible commercial/open licensing (CC0, CC-BY 4.0, MIT, or Public Domain). Non-Commercial (`CC-NC`) or Share-Alike (`CC-SA`) licenses are prohibited without explicit sign-off.

---

### 1. 3D Model Assets (`/public/models/`)

| Asset Name | Candidate / Source | Author / Creator | License | Attribution Requirement | Production Target | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Creature Model** | Low-poly Horror Humanoid / Stalker | Pending candidate selection (Sketchfab / Quaternius) | CC-BY 4.0 or CC0 | Displayed on Title/Credits screen | `/public/models/creature.glb` ($\le 16\text{K}$ tris) | Spec defined (Phase 4) |
| **Key Pickup** | In-engine procedural mesh | Antigravity Engine Team | MIT / Custom | None | In-engine generated | Active |
| **Exit Door** | In-engine procedural mesh | Antigravity Engine Team | MIT / Custom | None | In-engine generated | Active |

---

### 2. Audio Foley Assets (`/public/audio/` & In-Engine Synthesis)

| Asset Name | Candidate / Source | Author / Creator | License | Attribution Requirement | Production Target | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Fluorescent Hum** | Web Audio API Sawtooth + Lowpass | Level 0 Engineering | MIT (Open Source) | In-engine procedural | Synthesized at runtime (`SpatialAudioSystem.js`) | Verified Active |
| **Carpet Footstep Foley** | Damped Low-Freq Impulse Synth ($65\text{ Hz}$ sine + filtered noise) | Level 0 Engineering | MIT (Open Source) | In-engine procedural | Synthesized in Web Audio buffer (`footstep_carpet`) | Verified Active |
| **Wall Scratching / Click** | Exponential Decay Resonant Modulator ($800\text{ Hz}$) | Level 0 Engineering | MIT (Open Source) | In-engine procedural | Synthesized in Web Audio buffer (`wall_scratch`) | Verified Active |
| **Voice Mimic Whisper** | Dual-Formant Throat Synth ($F_1=420\text{ Hz}, F_2=1850\text{ Hz}$ banded noise) | Level 0 Engineering | MIT (Open Source) | In-engine procedural | Synthesized in Web Audio buffer (`whisper_mimic`) | Verified Active |
| **Predatory Roar / Screech** | Frequency Modulation Sweep ($120\to 75\text{ Hz}$ modulated @ $14\text{ Hz}$) | Level 0 Engineering | MIT (Open Source) | In-engine procedural | Synthesized in Web Audio buffer (`creature_roar`) | Verified Active |
| **Key Pickup Chime** | Pure dual harmonic sine wave ($660\text{ Hz} + 880\text{ Hz}$) | Level 0 Engineering | MIT (Open Source) | In-engine procedural | Web Audio API Oscillator | Verified Active |
| **Exit Unlock Resonator** | Harmonic chord ($440\text{ Hz} + 660\text{ Hz}$) | Level 0 Engineering | MIT (Open Source) | In-engine procedural | Web Audio API Oscillator | Verified Active |
| **Freesound Reference Library** | Sound archive reference benchmarks | freesound.org contributors | Creative Commons CC0 1.0 Universal / Public Domain | None required | Procedural algorithms verified against CC0 spectral captures | Archived Reference |

---

### 3. Material & Shading Assets

| Texture / Shader | Source | License | Notes |
| :--- | :--- | :--- | :--- |
| **Level 0 Wallpaper** | Procedural Canvas PBR | MIT / In-house | Generated mathematically in code |
| **Liminal Carpet** | Procedural Canvas PBR | MIT / In-house | Generated mathematically in code |
| **Ceiling Drop Tiles** | Procedural Canvas PBR | MIT / In-house | Generated mathematically in code |

