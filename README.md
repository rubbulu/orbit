# ORBIT — "Meetings That Remember"

> **Mission Control for Institutional Memory.**  
> Ingests meeting transcripts, maps decisions as an interactive force-directed constellation, and detects cross-meeting contradictions before teams ship broken commitments.

---

## The Metaphor: Mission Control / Night Sky
The UI abandons conventional SaaS cards and tables in favor of a deep-space telemetry canvas:
- **Decision Stars**: Every decision is a glowing star whose diameter scales with importance (`critical`, `high`, `medium`) and color reflects state:
  - 🌌 **Cool White-Blue (`#38bdf8`)**: Active commitment
  - ⚡ **Hot Neon Red (`#ef4444`)**: Contradiction / Conflict detected
  - 🌕 **Amber (`#f59e0b`)**: Pending ratification
  - 🌑 **Dim Grey (`#64748b`)**: Superseded / Archived
- **Meeting Mission Clusters**: Decisions from the same meeting orbit loosely around labeled cluster coordinates (`[MTG-01]`, `[MTG-02]`, `[MTG-03]`, `[MTG-04]`, `[MTG-05]`).
- **Conflict Electric Tether**: Direct contradictions across meetings ignite a pulsing, high-voltage red line with crackling animation and tension markers.
- **Action Item Satellites**: Tasks orbit their parent decision star with owner monograms (`MV`, `SJ`, `DC`, `AM`) and countdown rings.
- **Hold-to-Launch**: Task dispatching requires a 1.0s physical hold confirmation with circular progress charging, audio synthesizer tones, and confetti confirmation.
- **Transmission Uplink**: Bottom-center transceiver with scanning-line telemetry for pasting or dictating transcripts (`/` hotkey).

---

## Semantic Cross-Meeting Conflict Detection (Phase 3)
1. **Auditing Engine**:
   - Compares all newly ingested commitments against historical active decisions in memory.
   - Uses **Gemini AI** with a conservative, high-precision decision-integrity system prompt.
   - Requires confidence >= 0.7 to avoid false positives.
   - Categorizes conflicts into `direct_contradiction`, `resource_conflict`, `timeline_conflict`, or `scope_change`.
2. **"THE MOMENT" Cinematic Ignition**:
   - New cluster blooms into the night sky.
   - Viewport camera eases to frame both conflicting stars.
   - Red screen-edge vignette flashes with high-voltage alert hum.
   - Tether draws itself from the older star to the newer one with crackling electric sparks and floating type badge (e.g. `⚡ RESOURCE CONFLICT`).
3. **Arbitration & Resolution Hub**:
   - Side Inspector presents side-by-side comparison of conflicting commitments with quotes, dates, and AI rationale.
   - 3 One-Click Resolutions:
     - **KEEP ORIGINAL**: Supersedes the new decision, keeps earlier commitment active.
     - **ACCEPT NEW**: Supersedes the earlier decision, ratifies the new commitment.
     - **KEEP BOTH**: Ratifies coexistence, returning both stars to active.
   - Tether dissolves into space upon resolution!

---

## Test Results for MTG-04 and MTG-05

| Meeting Preset | Decisions Extracted | Conflicts Detected | Result |
| :--- | :--- | :--- | :--- |
| **MTG-04 (Enterprise Pilot Review)** | 2 Decisions (`DEC-010`, `DEC-011`) | **0 Conflicts** | ✅ **100% Precision**: Zero false positives detected against existing pricing or architecture commitments. |
| **MTG-05 (Q4 Emergency Budget)** | 2 Decisions (`DEC-012`, `DEC-013`) | **1 Critical Conflict** | ⚡ **Exact Match**: `DEC-012` (engineering hiring freeze) was flagged against `DEC-003` (opened requisition for 2 Senior Distributed Systems Engineers) with 100% confidence. |

---

## How to Test in 3 Steps

1. **Launch App**:
   ```bash
   npm run dev
   ```
   Open **[http://localhost:5173](http://localhost:5173)**.

2. **Test Clean Preset (MTG-04)**:
   - Press `/` to open Transmission Uplink.
   - Click **PRESET SIGNALS** → **MTG-04 (Pilot Review)** → **TRANSMIT SIGNAL**.
   - Watch MTG-04 bloom cleanly with **0 conflicts**.

3. **Test Conflict Ignition (MTG-05)**:
   - Press `/` → **PRESET SIGNALS** → **MTG-05 (Budget Sync)** → **TRANSMIT SIGNAL**.
   - Watch the cinematic sequence: MTG-05 materializes, then the camera sweeps across the cosmos to frame `DEC-012` and `DEC-003`.
   - The red tether ignites with high-voltage sound and the banner appears.
   - Click **KEEP ORIGINAL** or **ACCEPT NEW** in the Inspector to arbitrate and dissolve the conflict!
   - Click the top-bar **Refresh/Reset** icon anytime to revert to pristine seed state.
