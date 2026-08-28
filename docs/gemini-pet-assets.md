# Hatch — Gemini pet asset brief

Copy each **Prompt** block into Google Gemini (or Gemini in Google AI Studio → Image). Generate **one image per prompt**. Keep the **Style lock** identical in every prompt so the creature is the same character across evolutions.

App filename mapping lives in `public/pets/`. After you download, rename files exactly as listed.

---

## Product

**Hatch** is a student task tracker. Completing Pomodoro **focus** time (not breaks) fills a creature called an **Inklet**: a small fox-kit made of living study-ink. It evolves only from stacked focused hours.

Do not generate UI, phones, timers, or text in the images. The app composites the pet on its own background.

---

## Style lock (paste into every prompt)

Use this paragraph unchanged:

> Illustration for a student productivity app. One character only, centered. Cute but not babyish — studio game-art, not clipart, not chibi meme. Soft volumetric lighting from upper-left, gentle contact shadow under the feet (or base). Clean readable silhouette. Hand-painted digital, visible brush texture, slightly grainy paper. Palette strictly: warm cream `#F4EDE2`, ink indigo `#3D2E8A`, periwinkle `#7B6CFF`, fox-rust `#C45C3E`, gold `#E6B422`, charcoal `#1C1A22`. No neon, no photoreal fur, no 3D render, no watermark, no letters, no numbers, no UI. Square 1:1 composition. Character fills ~70% of the frame. Solid flat background color `#EDE6D8` (we will key/crop later) — not a scene, not a forest, not a classroom.

**Negative (add if the UI has a negative-prompt field):**

> text, letters, watermark, logo, UI, phone, clock, timer, photorealistic, 3D, Unreal, extra limbs, two heads, multiple characters, busy background, landscape, classroom, bookshelves, sparkles overload, horror, blood, weapons, sexy, human

**Settings (AI Studio / Gemini image):**

| Setting | Value |
| --- | --- |
| Aspect | 1:1 |
| Count | 1 per prompt (regenerate if silhouette drifts) |
| Consistency | After stage 0 succeeds, start the next prompt with: “Same Inklet character as the previous image, evolved.” |

If Gemini supports image input: attach the **best stage-0** image as a reference for stages 1–5.

---

## Species bible (do not contradict)

- **Name:** Inklet  
- **Body:** fox-kit proportions — round head, short muzzle, large ears that look like ink-brush tips.  
- **Mark:** a small **gold comma-shaped ink blot** on the forehead (the “focus mark”). Present from hatchling onward; on the egg it is a faint gold crack-line.  
- **Eyes:** dark indigo, round, intelligent, no catchlight overload.  
- **Material:** fur reads as **dry-brush ink + cream paper**, not realistic fox fur.  
- **Personality:** quiet study companion, not a mascot with a grin. Mouth is a small line; emotion is in ears and eyes.

---

## Evolution table (must match app logic)

Focused time only. Thresholds are **cumulative hours**.

| Stage | `id` | Hours (inclusive start) | App file | Short name |
| --- | --- | --- | --- | --- |
| 0 | `egg` | 0.00 | `inklet-egg.png` | Ink drop egg |
| 1 | `hatchling` | 2.00 | `inklet-hatchling.png` | Spark kit |
| 2 | `juvenile` | 8.00 | `inklet-juvenile.png` | Pup |
| 3 | `fledgling` | 20.00 | `inklet-fledgling.png` | Scholar |
| 4 | `adult` | 45.00 | `inklet-adult.png` | Guardian |
| 5 | `mythic` | 80.00 | `inklet-mythic.png` | Constellation |

Mood variants (optional second pass; app falls back to the stage file if missing):

| Mood | When | Filename suffix |
| --- | --- | --- |
| `idle` | default | (no suffix — main stage file) |
| `focus` | Pomodoro running | `-focus.png` |
| `rest` | on a break | `-rest.png` |
| `evolve` | just crossed a threshold | `-evolve.png` |

First delivery: **six idle stage images**. Moods later.

---

## Stage prompts

### Stage 0 — Egg (`inklet-egg.png`)

**Prompt:**

```
[STYLE LOCK PASTE]

Subject: an Inklet egg. A plump teardrop of living indigo ink sitting upright on a tiny cream paper saucer. Surface is glossy ink with paper-fiber edges. A faint gold comma-shaped crack on the upper front (the future focus mark). No face yet, or at most two tiny darker dots suggesting eyes under the shell. Small, precious, still. No fox body yet.
```

### Stage 1 — Hatchling · 2h (`inklet-hatchling.png`)

**Prompt:**

```
[STYLE LOCK PASTE]
Same Inklet species. Tiny fox-kit just hatched from ink: oversized round head, stubby body, ears like short ink-brush tips. Gold comma mark on the forehead. Sits on haunches. Cream chest patch. Looks curious, ears slightly forward. Proportion: chibi but with painterly rendering, not sticker-flat.
```

### Stage 2 — Juvenile · 8h (`inklet-juvenile.png`)

**Prompt:**

```
[STYLE LOCK PASTE]
Same Inklet, older pup. Longer legs, fuller tail with rust-ink tip, still round. Gold comma mark. A thin periwinkle scarf loosely looped (student, not winter fashion shoot). Standing three-quarter view, one paw slightly lifted. Calm confidence.
```

### Stage 3 — Fledgling · 20h (`inklet-fledgling.png`)

**Prompt:**

```
[STYLE LOCK PASTE]
Same Inklet as a young scholar fox. Leaner muzzle, taller ears, tail sweeping. Gold comma mark now slightly larger. Wears a simple folded cream paper collar like a page from a notebook (origami hint, not text on paper). Sits upright, composed, ready to study. Still clearly the same face as the pup.
```

### Stage 4 — Adult · 45h (`inklet-adult.png`)

**Prompt:**

```
[STYLE LOCK PASTE]
Same Inklet as a guardian fox. Full adult proportions, still cute, not feral. Ink-indigo coat with cream chest and rust socks. Gold comma mark. A short cloak of folded paper at the shoulders. Tail long, brush-like. Stance: planted, protective, facing slightly left of camera. Noble, not aggressive.
```

### Stage 5 — Mythic · 80h (`inklet-mythic.png`)

**Prompt:**

```
[STYLE LOCK PASTE]
Same Inklet at mythic evolution. Adult guardian fox whose ink coat now holds a faint map of gold constellation dots (sparse, elegant, not a galaxy wallpaper). Ears and tail tips glow softly periwinkle. Gold comma mark is a small solid gold leaf shape. Paper cloak has indigo ink-wash edges. Same face as previous stages. Magical but quiet — a study spirit, not a battle Pokémon.
```

---

## Optional mood pass (same stage, attach that stage’s image)

**Focus** — eyes half-lidded in concentration, ears angled back 10°, a faint gold shimmer on the forehead mark. No sweat drops, no headphones unless very subtle paper ones.

**Rest** — curled or sitting, eyes closed or nearly closed, scarf/cloak relaxed.

**Evolve** — same pose as idle, brief gold ink-particles around the silhouette (few particles, not a VFX explosion).

Example focus prompt for stage 2:

```
[STYLE LOCK PASTE]
Edit this exact Inklet juvenile: concentrating during a study session. Ears angled slightly back, eyes half-lidded, gold comma mark faintly brighter. Same clothes, same colors, same camera. No new props.
```

---

## Quality checklist (reject and regenerate if)

- Face or ear shape does not match the previous stage  
- Extra animals, humans, or books as characters  
- Text or watermarks  
- Background is a full environment  
- Photoreal fox  
- Colors drift to brown-generic “stock fox” — must stay **indigo + cream + rust**

---

## Drop-in for this repo

Save PNGs here:

```
public/pets/inklet-egg.png
public/pets/inklet-hatchling.png
public/pets/inklet-juvenile.png
public/pets/inklet-fledgling.png
public/pets/inklet-adult.png
public/pets/inklet-mythic.png
```

The app already maps `stage.id` → `/pets/inklet-{id}.png` and uses SVG placeholders until these files exist.
