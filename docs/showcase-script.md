# Pom-pom — showcase script

**Product:** Pom-pom (Hatch). A student Pomodoro tracker. Focus hours feed an Inklet. Breaks do not count.  
**Live:** https://romeo-04.github.io/pom-pom/  
**Tone:** Quiet, specific, kind. You are not selling a game. You are naming a feeling students already have, then showing one honest tool.

Use **one protagonist**. Do not invent a tragic backstory. The empathy is in *recognition*: “that’s me at 1 a.m.”

---

## The story in one breath (memorize this)

> Mira is a CS student. Her to-do list is honest. Her hours are not. She checks Discord “for one second,” comes back forty minutes later, and hates herself a little. Pom-pom does not yell. It keeps the list as a list. It only feeds a small ink-creature when she actually sits still. If she leaves the tab during focus, it makes a sound — like a roommate tapping the desk, not a boss writing her up. The pet grows because *she stayed*. That is the whole product.

---

## Cast and setup (before you walk on)

| Role | Notes |
| --- | --- |
| You | Speak as a peer, not a pitch deck. |
| Mira | Imagined student. Never mock her. |
| Screen | Fresh private window, or localStorage cleared so the Inklet starts as **Ink drop**. Phone as backup if Wi‑Fi dies. |
| Audio | Unmute. Tab-leave alarm is a beat — warn the room: “You will hear a short sound on purpose.” |
| Fonts | First load needs network; after that the PWA can sit offline. |

**Reset for the demo**

1. Open DevTools → Application → Local storage → clear `hatch.v1`.  
2. Refresh. Confirm **Ink drop**, **0 focused minutes**, **2.00 h until Spark kit**.  
3. Optional: keep **Add 1 focused hour** visible so evolution can happen in under a minute.

If you cannot clear storage, say so: “This Inklet already has hours from earlier today. That’s the point — it remembers that she sat down.”

---

## 90-second version (elevator / judges walking by)

*Do not open the app until the last two lines. Eye contact first.*

**[0:00–0:20] The feeling**  
“Raise your hand if you have ever opened a lecture PDF and woken up inside a group chat.”  
Pause. Let the laugh be small.  
“We don’t lack timers. We lack a way to tell the truth about our hours without turning study into another performance.”

**[0:20–0:45] The promise**  
Open Pom-pom. Point to the empty pet well, then the list.  
“Tasks stay a list. This creature — the Inklet — only eats focus. Breaks don’t count. Checking off a box doesn’t count. Twenty-five honest minutes count.”

**[0:45–1:10] One action**  
Type `Finish lab report intro`. Add. Start focus.  
“Mira is not becoming a new person. She is staying in this tab.”  
Switch to another tab. Let the alarm sound. Come back.  
“That’s not punishment. That’s a roommate. *Hey. You said you were studying.*”

**[1:10–1:30] The land**  
“When the hours stack, the Inklet evolves. Not because she was productive enough to deserve a mascot — because she was *there*. Pom-pom is a PWA. She can install it and keep her hours on the device, even when the campus Wi‑Fi gives up.”  
Close: “We built this for students who are tired of lying to their own timers.”

---

## 5–6 minute live demo (main showcase)

Stage directions in *italics*. Spoken lines in roman. **Do not rush the silences.**

### Beat 0 — Lights (20s)

*Hands off the mouse.*  
“I’m going to tell you about Mira, who is not a persona from a workshop. She is every person in this room who has a deadline and a phone.”

### Beat 1 — The kitchen-table truth (45s)

“It is 10:40 p.m. The lab is due at midnight. Mira’s notes app says: *intro, methods, screenshots, sleep.* She has been ‘working’ since eight. If you asked her how long, she would say three hours. If you asked her laptop, it would say forty minutes of the PDF and the rest of Discord, a recipe, and a video about someone else’s productivity system.”

*Soft.*  
“She doesn’t need another system. She needs something that will not let her confuse motion with sitting still — and will not shame her when she fails, because she will fail, because she is human.”

### Beat 2 — Open the den (30s)

*Open https://romeo-04.github.io/pom-pom/ . Let the dark indigo load. Do not click yet.*  
“This is Pom-pom. It looks like a study den, not a startup. On the left, a creature made of study-ink. It starts as a drop. It has not earned a face yet. That is honest.”

*Point to the headline.*  
“Your Inklet grows on focused hours. Not on streaks you fake. Not on checking every box so you can feel clean.”

### Beat 3 — The list is allowed to be boring (40s)

*Click the task field. Type slowly enough to be read:*

- `Write lab intro`  
- Add  
- `Fix the 401 on Vercel`  
- Add  
- `Text group: I’m on the intro, not the memes`  

*Select **Write lab intro** as Active if it isn’t already.*  
“We did not build a social network for tasks. Mira already has five of those. Today is three lines. The active one is what the hours will feed. If she forgets to pick, the Inklet still eats. The work still happened. We don’t punish a missing click.”

### Beat 4 — The contract of twenty-five minutes (40s)

*Point at 25:00. Hover Start focus. Do not start yet.*  
“Pomodoro is old. Everyone knows 25 and 5. The part people lie about is the 25. Pom-pom’s rule is almost rude: **breaks do not count.** You cannot farm the pet by sitting on the break screen. You cannot evolve it by completing tasks with zero focus time.”

*Click **Start focus**.*  
“Now Mira has made a small promise. Not to us. To the drop of ink.”

*Let the clock tick 5–8 seconds. Do not skip. The room should feel the seconds.*  
“This is the part of the demo that is supposed to be slightly boring. Study is slightly boring. We kept that.”

### Beat 5 — Empathy with teeth: she leaves (50s)

*Look at the audience.*  
“And here is the moment of truth, because Mira is us. Someone pings. The muscle memory is already moving.”

*Check that **Sound an alarm if I leave this tab during focus** is on.*  
“We asked the browser for a sound, and if she allows it, a notification. Not a leaderboard. A tap on the shoulder.”

*Switch to a new tab or click away. Let the two-tone alarm play. Wait until it finishes. Come back.*  
“Hear that? That is not a streak dying. That is: *you said you were here.* Mira can ignore it. She is an adult. But she cannot pretend the leaving didn’t happen. Kindness without a spine is just another app she will close.”

*If the sound is blocked, say:* “Browsers are protective — that’s fair. The live region still says she left. The roommate still spoke, even if the speakers didn’t.”

### Beat 6 — She stays; something small changes (50s)

*Reset if you need a clean focus, or keep running.*  
“When she stays, the minutes go into the task and into the creature. The pet is a progress bar with a face. We did that on purpose. Numbers are easy to ignore. A drop of ink becoming a kit is harder to shrug off — not because we tricked her brain with dopamine, but because care wants an object.”

*Click **Add 1 focused hour** twice (or as needed) until **Spark kit** and the Evolved chip.*  
“Two focused hours. Not two hours of ‘I had VS Code open.’ The drop becomes a Spark kit. Later: pup, scholar, guardian, constellation. The stages are slow on purpose. You cannot binge-evolve in an all-nighter and call it growth. Mira’s relationship with this thing is supposed to feel like a plant, not a loot box.”

### Beat 7 — Install, pocket, campus Wi‑Fi (35s)

*Point at Install if it appears; otherwise mention Add to Home Screen.*  
“Pom-pom is a PWA. She can put it on her phone next to Messages. When the library Wi‑Fi dies, the shell is still there. Her hours live on the device first. We designed it so that if a future server has a bad day, she can still sit down and study. The tool should not be more fragile than her deadline.”

### Beat 8 — Close on the human, not the stack (40s)

*Hands off again. Pet still on screen.*  
“We could talk about modules, service workers, GitHub Pages. We will, if you want, in questions.”  
“What I want you to take is this: students are not lazy. They are interrupted, ashamed, and drowning in tools that reward looking busy. Pom-pom is a small den where the only currency is having actually stayed. The Inklet does not love her more if she is gifted. It grows if she comes back tomorrow and sits still again.”

*Last line, slower:*  
“That’s the showcase. Not a dragon. A roommate made of ink, keeping the hours honest.”

---

## What you never say

- “It’s like Tamagotchi plus Todoist.” (They will think it anyway; you don’t have to flatten it.)  
- “It increases productivity by X%.” (You don’t have that number. Inventing it breaks the empathy.)  
- “Users who fail the pomodoro…” (They didn’t fail. They left. Name the leaving.)  
- Joke-shame about Discord, phones, or “Gen Z attention.” Mira is in the room.

---

## Empathic devices (use two, not all)

1. **Specific objects:** lab report, 401 error, group chat — not “tasks.”  
2. **Shared confession:** the raised-hand beat.  
3. **Silence while the clock runs** — let discomfort work.  
4. **The alarm as care** — roommate, not siren-as-comedy.  
5. **Slow evolution** — respect for time, not grind.  
6. **Offline / install** — respect for bad Wi‑Fi and real devices, not a feature dump.

---

## Click track (print this on a sticky)

1. Clear `hatch.v1` → refresh  
2. Add `Write lab intro` → Add `Fix the 401 on Vercel`  
3. Start focus → wait 8 seconds  
4. Leave tab → alarm → return  
5. Add 1 focused hour × 2 → Spark kit  
6. Mention install / PWA  
7. Hands off, last line

---

## Q&A — answer like a human

**“Isn’t this just gamification?”**  
“Gamification is points for clicking. This withholds the pet from busywork. If that’s a game, it’s a strict one.”

**“Why a pet?”**  
“Because a number on a dashboard is easy to emotionally abandon. A creature you didn’t feed is a feeling students already have about themselves. We wanted that feeling to point at *hours*, not at worth.”

**“What if the sound is annoying?”**  
“She can uncheck it. The product still works. We don’t trap her.”

**“Tech community?”**  
“Same student, different Tuesday: the 401, the lab PC, the Discord rabbit hole. Pom-pom is the *now* layer their chats don’t have — stay, or admit you left.”

---

## If something breaks

| Break | What you say | What you do |
| --- | --- | --- |
| Site won’t load | “This is why it’s a PWA — next time it would already be on the phone.” | Open local `npm run preview` or a screenshot of Spark kit. |
| No alarm | “The browser protected your ears. The product still named the leaving.” | Point at the checkbox and the live message. |
| Pet already evolved | “Mira studied before the showcase. We’re not going to pretend she didn’t.” | Skip the two-hour click; tell the stage table. |
| You ramble | Cut to Beat 8. End on the roommate line. |

---

## Optional closer for a tech jury

“Frontend can run the whole den without a backend. If identity or sync is down, she still focuses. We wrote it that way because a student tool that dies with an API is another thing that lets her down at 11 p.m.”  
Then stop. Don’t list tickets.

---

## Aftercare (you, after the demo)

Thank Mira as if she were real: “If this felt slightly uncomfortable when I left the tab — good. That’s the product doing the feeling, not the slides.”  
Do not add a call to “smash follow.” Offer the repo if they ask: https://github.com/Romeo-04/pom-pom
