"use strict";

/*
 * OpenShare Harmonium Classroom
 * Static website: synthesized audio is generated locally with Web Audio.
 * No accounts, uploads, or sound files are needed.
 */
const NOTE_NAMES = new Map([
  [0, "Sa"], [1, "Komal Re"], [2, "Re"], [3, "Komal Ga"],
  [4, "Ga"], [5, "Ma"], [6, "Tivra Ma"], [7, "Pa"],
  [8, "Komal Dha"], [9, "Dha"], [10, "Komal Ni"], [11, "Ni"],
  [12, "High Sa"]
]);

// Full national anthem melody, organized into 13 short practice lines.
// Sa is movable. Low Ni = -1 semitone relative to Sa.
const ANTHEM_LINES = [
  { lyric:"Jana gana mana adhinayaka jaya he", notes:[0,2,4,4,4,4,4,4,4,4,4,2,4,5] },
  { lyric:"Bharata bhagya vidhata", notes:[4,4,4,2,2,2,-1,2,0] },
  { lyric:"Punjab Sindhu Gujarata Maratha", notes:[0,7,7,7,7,7,7,7,7,7,5,9,7] },
  { lyric:"Dravida Utkala Banga", notes:[5,5,5,4,4,4,2,5,4] },
  { lyric:"Vindhya Himachala Yamuna Ganga", notes:[4,4,4,4,4,2,7,7,7,5,5] },
  { lyric:"Uchchhala jaladhi taranga", notes:[4,4,4,2,2,2,-1,2,0] },
  { lyric:"Tava shubha name jage", notes:[0,2,4,4,4,4,2,4,5] },
  { lyric:"Tava shubha ashisa mage", notes:[4,5,7,7,7,5,4,2,5,4] },
  { lyric:"Gahe tava jaya gatha", notes:[4,4,2,2,2,-1,2,0] },
  { lyric:"Jana gana mangala dayaka jaya he", notes:[7,7,7,7,7,7,7,7,7,7,5,9,7] },
  { lyric:"Bharata bhagya vidhata", notes:[5,5,5,4,4,4,2,5,4] },
  { lyric:"Jaya he, jaya he, jaya he", notes:[11,11,12,11,9,11,9,7,9] },
  { lyric:"Jaya jaya jaya jaya he", notes:[0,0,2,2,4,4,2,4,5] }
];

const LESSONS = {
  aroha: {
    title:"Aroha",
    description:"Play all eight shuddh notes upward, from Sa to high Sa.",
    notes:[0,2,4,5,7,9,11,12]
  },
  avaroha: {
    title:"Avaroha",
    description:"Return from high Sa to low Sa, one note at a time.",
    notes:[12,11,9,7,5,4,2,0]
  },
  anthem: {
    title:"Jana Gana Mana",
    description:"Practice the national anthem one line at a time.",
    notes:ANTHEM_LINES[0].notes
  }
};

const el = id => document.getElementById(id);
const keyboardElement = el("keyboard");
const originalKeyboardMarkup = keyboardElement.innerHTML;
let keyElements = Array.from(keyboardElement.querySelectorAll(".key"));
const keys = new Map(keyElements.map(key => [Number(key.dataset.note), key]));
const lessonSelect = el("lesson-select");
const songLineControls = el("song-line-controls");
const songLineSelect = el("song-line-select");
const previousLineButton = el("previous-line");
const nextLineButton = el("next-line");
const listenAllButton = el("listen-all-button");
const audioStatus = el("audio-status");
const noteDisplay = el("note-display");
const feedback = el("practice-feedback");
const noteSequence = el("note-sequence");
const progressTrack = el("progress-track");
const progressFill = el("progress-fill");
const listenButton = el("listen-button");
const practiceButton = el("practice-button");
const stopButton = el("stop-button");
const droneButton = el("drone-toggle");
const saSelect = el("sa-select");
const tempo = el("tempo");
const tempoValue = el("tempo-value");
const fingeringSelect = el("fingering-mode");
const fingeringHint = el("fingering-hint");

const SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12];
const FINGERING_GUIDES = {
  bb: { midi: 70, name: "B♭", fingers: [4, 1, 2, 3, 1, 2, 3, 4] },
  gsharp: { midi: 68, name: "G♯ / A♭", fingers: [3, 4, 1, 2, 3, 1, 2, 3] }
};
const PHYSICAL_WHITE_PITCHES = new Set([0, 2, 4, 5, 7, 9, 11]);
const PITCH_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "G♯", "A", "B♭", "B"];
const SHORT_SARGAM = {
  0: "Sa", 1: "re♭", 2: "Re", 3: "ga♭", 4: "Ga", 5: "Ma",
  6: "Ma♯", 7: "Pa", 8: "dha♭", 9: "Dha", 10: "ni♭", 11: "Ni", 12: "Sa'"
};
function pitchName(midi) {
  return PITCH_NAMES[((midi % 12) + 12) % 12];
}


/* Full screen: use the browser API when available, with a mobile
   viewport-filling fallback for browsers that do not expose it. */
const fullscreenButton = el("fullscreen-toggle");
const fullscreenLabel = el("fullscreen-label");
const fullscreenStatus = el("fullscreen-status");
const fullscreenTarget = document.querySelector(".page");
// Installed home-screen apps launch directly in the compact immersive view.
// A regular browser page still requires the Full screen button.
const runningInstalled = () =>
  (window.matchMedia && (
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: standalone)").matches
  )) || window.navigator.standalone === true;
let fallbackFocusMode = Boolean(runningInstalled());

function refreshFullscreenMode() {
  const nativeFullscreen = Boolean(document.fullscreenElement);
  const active = nativeFullscreen || fallbackFocusMode;
  document.body.classList.toggle("focus-mode", active);
  fullscreenButton.setAttribute("aria-pressed", String(active));
  fullscreenButton.setAttribute("aria-label", active ? "Exit full-screen view" : "Enter full-screen view");
  fullscreenLabel.textContent = active ? "Exit full screen" : "Full screen";
  fullscreenButton.querySelector(".fullscreen-symbol").textContent = active ? "↙" : "⛶";
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch (error) {
      console.warn("Could not exit browser fullscreen.", error);
      fullscreenStatus.textContent = "Browser fullscreen could not be closed.";
    }
    refreshFullscreenMode();
    return;
  }
  if (fallbackFocusMode) {
    fallbackFocusMode = false;
    refreshFullscreenMode();
    fullscreenStatus.textContent = "Regular view restored.";
    return;
  }

  if (typeof fullscreenTarget.requestFullscreen === "function") {
    try {
      await fullscreenTarget.requestFullscreen({ navigationUI: "hide" });
      refreshFullscreenMode();
      fullscreenStatus.textContent = "Fullscreen is on. Use Exit full screen or your device's back gesture to leave.";
      return;
    } catch (error) {
      // Mobile Safari and some embedded browsers may not support page fullscreen.
      console.info("Using expanded viewport instead of browser fullscreen.", error);
    }
  }
  fallbackFocusMode = true;
  refreshFullscreenMode();
  fullscreenStatus.textContent = "Expanded view enabled. This browser may still show its address bar.";
}

fullscreenButton.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) fallbackFocusMode = false;
  refreshFullscreenMode();
});
document.addEventListener("fullscreenerror", () => {
  fullscreenStatus.textContent = "Full screen was blocked by the browser. Try again or use a different browser.";
});
refreshFullscreenMode();

let saMidi = Number(saSelect.value);
let selectedLesson = "aroha";
let songLineIndex = 0;
let isPracticing = false;
let isCompleted = false;
let practiceIndex = 0;
let demoIndex = -1;
let demoToken = 0;
let demoPlaying = false;
let droneOn = false;
let audioContext = null;
let masterGain = null;
const voices = new Map();
const activePointers = new Map();
const heldKeyboardKeys = new Set();

function setFeedback(message) {
  feedback.textContent = message;
}

function ensureAudio() {
  if (audioContext) {
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {
        audioStatus.textContent = "Audio unavailable";
      });
    }
    return true;
  }

  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType) {
    audioStatus.textContent = "Audio unsupported";
    setFeedback("This browser does not support sound. Try a current version of Chrome or Safari.");
    return false;
  }

  try {
    audioContext = new AudioContextType();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.42;
    masterGain.connect(audioContext.destination);
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {
        audioStatus.textContent = "Tap again to enable audio";
      });
    }
    audioStatus.textContent = "● Sound enabled";
    return true;
  } catch (error) {
    console.error("Unable to start audio:", error);
    audioStatus.textContent = "Audio unavailable";
    setFeedback("Audio could not start. Check your sound settings and try again.");
    return false;
  }
}

function noteFrequency(offset) {
  return 440 * Math.pow(2, (saMidi + offset - 69) / 12);
}

function makeVoice(offset) {
  const time = audioContext.currentTime;
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = offset < 0 ? 900 : 1700;
  filter.Q.value = 0.65;

  const envelope = audioContext.createGain();
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(offset < 0 ? 0.026 : 0.105, time + 0.055);
  filter.connect(envelope);
  envelope.connect(masterGain);

  const oscillatorA = audioContext.createOscillator();
  oscillatorA.type = "sawtooth";
  oscillatorA.frequency.value = noteFrequency(offset);
  oscillatorA.detune.value = -2;
  oscillatorA.connect(filter);

  const oscillatorB = audioContext.createOscillator();
  oscillatorB.type = "sawtooth";
  oscillatorB.frequency.value = noteFrequency(offset);
  oscillatorB.detune.value = 2;
  const secondaryVolume = audioContext.createGain();
  secondaryVolume.gain.value = 0.33;
  oscillatorB.connect(secondaryVolume);
  secondaryVolume.connect(filter);

  oscillatorA.start(time);
  oscillatorB.start(time);

  return { sources: new Set(), envelope, oscillators: [oscillatorA, oscillatorB] };
}

function releaseVoice(voice) {
  if (!audioContext) return;
  const time = audioContext.currentTime;
  const gain = voice.envelope.gain;
  gain.cancelScheduledValues(time);
  gain.setTargetAtTime(0.0001, time, 0.055);
  for (const oscillator of voice.oscillators) {
    try {
      oscillator.stop(time + 0.38);
    } catch (error) {
      // An already-stopped oscillator can safely be ignored.
    }
  }
}

function updateKey(offset) {
  const key = keys.get(offset);
  if (!key) return;
  key.classList.toggle("is-pressed", voices.has(offset));
}

function noteOn(offset, source) {
  if (!ensureAudio()) return false;
  let voice = voices.get(offset);
  if (!voice) {
    voice = makeVoice(offset);
    voices.set(offset, voice);
  }
  voice.sources.add(source);
  updateKey(offset);
  return true;
}

function noteOff(offset, source) {
  const voice = voices.get(offset);
  if (!voice) return;
  voice.sources.delete(source);
  if (voice.sources.size === 0) {
    voices.delete(offset);
    releaseVoice(voice);
  }
  updateKey(offset);
}

function stopSource(source) {
  for (const [offset, voice] of Array.from(voices.entries())) {
    if (voice.sources.has(source)) noteOff(offset, source);
  }
}

function stopEverySound() {
  for (const voice of voices.values()) releaseVoice(voice);
  voices.clear();
  activePointers.clear();
  heldKeyboardKeys.clear();
  keyElements.forEach(key => key.classList.remove("is-pressed"));
}

/* Fingering mode uses actual black/white piano key positions.
   The normal transposing sargam layout is preserved when the guide is off. */
function refreshKeyLookup() {
  keyElements = Array.from(keyboardElement.querySelectorAll(".key"));
  keys.clear();
  keyElements.forEach(key => keys.set(Number(key.dataset.note), key));
}

function createPhysicalKey(midi, kind, finger, whiteIndex) {
  const offset = midi - saMidi;
  const key = document.createElement("button");
  key.type = "button";
  key.className = "key " + (kind === "black" ? "black-key" : "white-key");
  key.dataset.note = String(offset);
  const sargam = SHORT_SARGAM[offset] || pitchName(midi);
  key.setAttribute("aria-label",
    sargam + " (" + pitchName(midi) + ")" +
    (finger ? ", right-hand finger " + finger : ""));
  if (kind === "black") {
    key.style.left = "calc(var(--white-key-width) * " + whiteIndex +
      " - var(--black-key-width) / 2)";
  }
  const roman = document.createElement("span");
  roman.className = "key-roman";
  roman.textContent = sargam;
  const name = document.createElement("span");
  name.className = "key-dev";
  name.textContent = pitchName(midi);
  key.append(roman, name);
  if (finger) {
    const number = document.createElement("span");
    number.className = "finger-label";
    number.textContent = String(finger);
    number.setAttribute("aria-hidden", "true");
    key.append(number);
  }
  return key;
}

function renderFingeringKeyboard() {
  const guide = FINGERING_GUIDES[fingeringSelect.value];
  stopEverySound();
  keyboardElement.replaceChildren();
  if (!guide) {
    keyboardElement.classList.remove("physical-layout", "anthem-layout");
    keyboardElement.style.removeProperty("--white-key-count");
    keyboardElement.innerHTML = originalKeyboardMarkup;
    if (selectedLesson === "anthem") {
      const lowerNi = document.createElement("button");
      lowerNi.type = "button";
      lowerNi.className = "key white-key";
      lowerNi.dataset.note = "-1";
      lowerNi.setAttribute("aria-label", "Low Ni, note below Sa");
      const roman = document.createElement("span");
      roman.className = "key-roman";
      roman.textContent = "Ni↓";
      const dev = document.createElement("span");
      dev.className = "key-dev";
      dev.textContent = "नि";
      lowerNi.append(roman, dev);
      keyboardElement.insertBefore(lowerNi, keyboardElement.firstElementChild);
      const boundaries = {1:2, 3:3, 6:5, 8:6, 10:7};
      for (const black of keyboardElement.querySelectorAll(".black-key")) {
        const boundary = boundaries[Number(black.dataset.note)];
        if (boundary !== undefined) black.style.left =
          "calc(var(--white-key-width) * " + boundary + " - var(--black-key-width) / 2)";
      }
      keyboardElement.classList.add("anthem-layout");
      keyboardElement.style.setProperty("--white-key-count", "9");
    }
    fingeringHint.hidden = true;
    fingeringHint.textContent = "";
  } else {
    keyboardElement.classList.remove("anthem-layout");
    // Both guides begin on a black key. Include the natural white
    // keys immediately before and after the one-octave scale.
    const whites = [];
    for (let midi = saMidi - 1; midi <= saMidi + 13; midi++) {
      if (PHYSICAL_WHITE_PITCHES.has((midi + 120) % 12)) whites.push(midi);
    }
    const fingerMap = new Map(SCALE_OFFSETS.map((offset, i) => [offset, guide.fingers[i]]));
    const blackKeys = [];
    whites.forEach((midi, i) => {
      keyboardElement.append(createPhysicalKey(
        midi, "white", fingerMap.get(midi - saMidi), i
      ));
      if (i + 1 < whites.length && whites[i + 1] - midi === 2) {
        const blackMidi = midi + 1;
        blackKeys.push(createPhysicalKey(
          blackMidi, "black", fingerMap.get(blackMidi - saMidi), i + 1
        ));
      }
    });
    keyboardElement.append(...blackKeys);
    keyboardElement.classList.add("physical-layout");
    keyboardElement.style.setProperty("--white-key-count", String(whites.length));
    fingeringHint.hidden = false;
    fingeringHint.textContent = guide.name + " · Right hand: " +
      guide.fingers.join("–") + "  (1 thumb, 2 index, 3 middle, 4 ring, 5 little)";
  }
  refreshKeyLookup();
  if (droneOn) {
    noteOn(-12, "drone");
    noteOn(-5, "drone");
  }
}

function getLesson() {
  if (selectedLesson !== "anthem") return LESSONS[selectedLesson];
  const line = ANTHEM_LINES[songLineIndex];
  return {
    title:"Jana Gana Mana",
    description:line.lyric,
    notes:line.notes
  };
}

function renderLesson() {
  const lesson = getLesson();
  const isSong = selectedLesson === "anthem";
  el("selected-lesson-name").textContent = isSong
    ? "Jana Gana Mana · " + (songLineIndex + 1) + "/13"
    : lesson.title;
  el("selected-lesson-detail").textContent = lesson.description;
  lessonSelect.value = selectedLesson;
  songLineControls.hidden = !isSong;
  listenAllButton.hidden = !isSong;
  if (isSong) {
    songLineSelect.value = String(songLineIndex);
    previousLineButton.disabled = songLineIndex === 0;
    nextLineButton.disabled = songLineIndex === ANTHEM_LINES.length - 1;
  }

  noteSequence.replaceChildren();
  lesson.notes.forEach((offset, index) => {
    const chip = document.createElement("span");
    chip.className = "note-chip";
    chip.textContent = NOTE_NAMES.get(offset) === "High Sa" ? "Sa'" : NOTE_NAMES.get(offset);
    if ((isPracticing || isCompleted) && index < practiceIndex) chip.classList.add("is-done");
    if ((isPracticing && index === practiceIndex) || (demoPlaying && index === demoIndex)) {
      chip.classList.add("is-current");
      chip.setAttribute("aria-current", "step");
    }
    noteSequence.appendChild(chip);
  });

  keyElements.forEach(key => key.classList.remove("is-target"));
  if (isPracticing) {
    const nextOffset = lesson.notes[practiceIndex];
    const nextKey = keys.get(nextOffset);
    if (nextKey) {
      nextKey.classList.add("is-target");
      // Scroll just enough to reveal the guided key on small phones.
      nextKey.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  } else if (demoPlaying && demoIndex >= 0) {
    const demoKey = keys.get(lesson.notes[demoIndex]);
    if (demoKey) demoKey.classList.add("is-target");
  }

  const percent = Math.round(100 * practiceIndex / lesson.notes.length);
  progressFill.style.width = percent + "%";
  progressTrack.setAttribute("aria-valuenow", String(percent));
}

function setIdleActions() {
  listenButton.disabled = false;
  listenAllButton.disabled = false;
  listenButton.textContent = "▶ Listen";
  practiceButton.textContent = isCompleted ? "Practice again →" : "Start practice →";
  stopButton.hidden = !isPracticing && !demoPlaying;
}

function endDemo() {
  demoToken += 1;
  demoPlaying = false;
  demoIndex = -1;
  stopSource("demo");
  setIdleActions();
  renderLesson();
}

function stopSession() {
  endDemo();
  isPracticing = false;
  isCompleted = false;
  practiceIndex = 0;
  setIdleActions();
  renderLesson();
  setFeedback("Ready when you are. Choose Listen or Start practice.");
}

function chooseLesson(id) {
  if (!Object.prototype.hasOwnProperty.call(LESSONS, id)) return;
  endDemo();
  isPracticing = false;
  isCompleted = false;
  practiceIndex = 0;
  selectedLesson = id;
  songLineIndex = 0;
  renderFingeringKeyboard();
  setIdleActions();
  renderLesson();
  setFeedback("Press Listen to hear this exercise, or Start practice to follow the keys.");
  noteDisplay.textContent = "Ready to play";
}

function chooseSongLine(index) {
  if (selectedLesson !== "anthem" || !Number.isInteger(index) ||
      index < 0 || index >= ANTHEM_LINES.length) return;
  endDemo();
  isPracticing = false;
  isCompleted = false;
  practiceIndex = 0;
  songLineIndex = index;
  setIdleActions();
  renderLesson();
  setFeedback("Line " + (index + 1) + ": Listen, then practise the highlighted notes.");
}

function recordAttempt(offset) {
  noteDisplay.textContent = "Playing " + (NOTE_NAMES.get(offset) || pitchName(saMidi + offset));
  if (!isPracticing) return;

  const expected = getLesson().notes[practiceIndex];
  if (offset !== expected) {
    setFeedback("Try " + NOTE_NAMES.get(expected) + ". Follow the glowing key.");
    return;
  }

  practiceIndex += 1;
  if (practiceIndex >= getLesson().notes.length) {
    isPracticing = false;
    isCompleted = true;
    setFeedback("Exercise complete! You played every note in order. Try again or choose another exercise.");
    noteDisplay.textContent = "✓ Exercise completed";
    setIdleActions();
  } else {
    setFeedback("Good. Next: " + NOTE_NAMES.get(getLesson().notes[practiceIndex]) + ".");
  }

  renderLesson();
}

function pressKey(offset, source) {
  if (noteOn(offset, source)) recordAttempt(offset);
}

function startPractice() {
  endDemo();
  isPracticing = true;
  isCompleted = false;
  practiceIndex = 0;
  setIdleActions();
  renderLesson();
  setFeedback("Tap the glowing " + NOTE_NAMES.get(getLesson().notes[0]) + " key to begin.");
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function playDemo(fullSong = false) {
  // Unlock audio within the click event so mobile audio is allowed.
  if (!ensureAudio()) return;

  endDemo();
  isPracticing = false;
  isCompleted = false;
  practiceIndex = 0;
  demoPlaying = true;
  const currentToken = ++demoToken;
  const allLines = fullSong && selectedLesson === "anthem";
  const lineIndices = allLines
    ? ANTHEM_LINES.map((_, index) => index)
    : [songLineIndex];
  const beat = 60000 / Number(tempo.value);
  listenButton.disabled = true;
  listenAllButton.disabled = true;
  listenButton.textContent = allLines ? "♪ Full song..." : "♪ Playing...";
  stopButton.hidden = false;
  setFeedback(allLines
    ? "Playing the full anthem, one line at a time."
    : "Listen and watch the highlighted keys.");

  for (const lineIndex of lineIndices) {
    if (currentToken !== demoToken) return;
    if (selectedLesson === "anthem") songLineIndex = lineIndex;
    const notes = [...getLesson().notes];

    for (let i = 0; i < notes.length; i += 1) {
      if (currentToken !== demoToken) return;
      demoIndex = i;
      renderLesson();
      noteDisplay.textContent = "Playing " +
        (NOTE_NAMES.get(notes[i]) || pitchName(saMidi + notes[i]));
      noteOn(notes[i], "demo");
      const held = (i === notes.length - 1) ? 1.55 : 0.78;
      await delay(Math.max(180, beat * held));
      noteOff(notes[i], "demo");
      if (currentToken !== demoToken) return;
      await delay(Math.max(55, beat * 0.12));
    }
    if (allLines && lineIndex < ANTHEM_LINES.length - 1) await delay(beat * 0.45);
  }

  if (currentToken !== demoToken) return;
  endDemo();
  setFeedback(allLines
    ? "Full-song playback finished. Select a line to practise."
    : "Listening finished. Press Start practice to play this line yourself.");
  noteDisplay.textContent = "Ready to practise";
}

keyboardElement.addEventListener("pointerdown", event => {
  const key = event.target.closest(".key");
  if (!key || !keyboardElement.contains(key)) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (activePointers.has(event.pointerId)) return;
  const offset = Number(key.dataset.note);
  const source = "pointer:" + event.pointerId;
  activePointers.set(event.pointerId, { offset, source });
  pressKey(offset, source);
});

function finishPointer(event) {
  const active = activePointers.get(event.pointerId);
  if (!active) return;
  activePointers.delete(event.pointerId);
  noteOff(active.offset, active.source);
}

document.addEventListener("pointerup", finishPointer);
document.addEventListener("pointercancel", finishPointer);
window.addEventListener("blur", () => {
  for (const active of activePointers.values()) noteOff(active.offset, active.source);
  activePointers.clear();
  for (const key of heldKeyboardKeys) {
    const offset = KEYBOARD_NOTES[key];
    noteOff(offset, "keyboard:" + key);
  }
  heldKeyboardKeys.clear();
});

const KEYBOARD_NOTES = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6,
  g: 7, y: 8, h: 9, u: 10, j: 11, k: 12
};

document.addEventListener("keydown", event => {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  const target = event.target;
  if (target instanceof HTMLElement &&
      (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)) return;
  const key = event.key.toLowerCase();
  if (!(key in KEYBOARD_NOTES) || heldKeyboardKeys.has(key)) return;
  event.preventDefault();
  heldKeyboardKeys.add(key);
  pressKey(KEYBOARD_NOTES[key], "keyboard:" + key);
});

document.addEventListener("keyup", event => {
  const key = event.key.toLowerCase();
  if (!heldKeyboardKeys.has(key)) return;
  heldKeyboardKeys.delete(key);
  noteOff(KEYBOARD_NOTES[key], "keyboard:" + key);
});

// Populate the compact line selector for guided anthem practice.
ANTHEM_LINES.forEach((line, index) => {
  const option = document.createElement("option");
  option.value = String(index);
  option.textContent = (index + 1) + ". " + line.lyric;
  songLineSelect.append(option);
});
lessonSelect.addEventListener("change", () => chooseLesson(lessonSelect.value));
songLineSelect.addEventListener("change", () => chooseSongLine(Number(songLineSelect.value)));
previousLineButton.addEventListener("click", () => chooseSongLine(songLineIndex - 1));
nextLineButton.addEventListener("click", () => chooseSongLine(songLineIndex + 1));
listenButton.addEventListener("click", () => playDemo(false));
listenAllButton.addEventListener("click", () => playDemo(true));
practiceButton.addEventListener("click", startPractice);
stopButton.addEventListener("click", stopSession);

fingeringSelect.addEventListener("change", () => {
  endDemo();
  isPracticing = false;
  isCompleted = false;
  practiceIndex = 0;
  const guide = FINGERING_GUIDES[fingeringSelect.value];
  if (guide) {
    saMidi = guide.midi;
    saSelect.value = String(saMidi);
  }
  renderFingeringKeyboard();
  setIdleActions();
  renderLesson();
  noteDisplay.textContent = guide ? guide.name + " fingering" : "Ready to play";
  setFeedback(guide
    ? "Numbered keys show suggested right-hand fingers. Choose Start practice to follow the scale."
    : "Fingering hidden. Select a lesson to practise.");
});

saSelect.addEventListener("change", () => {
  saMidi = Number(saSelect.value);
  endDemo();
  if (fingeringSelect.value !== "off") {
    fingeringSelect.value = "off";
    renderFingeringKeyboard();
  }
  stopEverySound();
  if (droneOn) {
    noteOn(-12, "drone");
    noteOn(-5, "drone");
  }
  noteDisplay.textContent = "Sa set to " + saSelect.options[saSelect.selectedIndex].text;
  setFeedback(isPracticing
    ? "Sa changed. Continue with the highlighted key."
    : "Scale changed. Tap a key to hear the new pitch.");
});

tempo.addEventListener("input", () => {
  tempoValue.textContent = tempo.value + " BPM";
});

droneButton.addEventListener("click", () => {
  if (!droneOn && !ensureAudio()) return;
  droneOn = !droneOn;
  if (droneOn) {
    noteOn(-12, "drone");
    noteOn(-5, "drone");
  } else {
    stopSource("drone");
  }
  droneButton.setAttribute("aria-pressed", String(droneOn));
  droneButton.textContent = "♫ Sa-Pa drone: " + (droneOn ? "On" : "Off");
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    endDemo();
    stopEverySound();
    if (droneOn) {
      droneOn = false;
      droneButton.setAttribute("aria-pressed", "false");
      droneButton.textContent = "♫ Sa-Pa drone: Off";
    }
  }
});

window.addEventListener("pagehide", () => {
  endDemo();
  stopEverySound();
});

renderLesson();
setIdleActions();

/* Installable PWA and offline service worker. */
(() => {
  const installButton = document.getElementById("install-button");
  const installHelp = document.getElementById("install-help");
  let installPrompt = null;
  const isStandalone = () =>
    (window.matchMedia && (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches
    )) ||
    window.navigator.standalone === true;

  if (isStandalone()) {
    installButton.hidden = true;
    installHelp.hidden = true;
  } else {
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      installPrompt = event;
      installButton.hidden = false;
      installHelp.hidden = true;
    });
    installButton.addEventListener("click", async () => {
      if (!installPrompt) {
        installHelp.hidden = false;
        installHelp.open = true;
        return;
      }
      const request = installPrompt;
      installPrompt = null;
      installButton.hidden = true;
      try {
        await request.prompt();
        const choice = await request.userChoice;
        if (!choice || choice.outcome !== "accepted") installHelp.hidden = false;
      } catch (error) {
        console.warn("App installation prompt was unavailable.", error);
        installHelp.hidden = false;
      }
    });
    window.addEventListener("appinstalled", () => {
      installButton.hidden = true;
      installHelp.hidden = true;
      installPrompt = null;
    });
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" })
        .catch(error => console.warn("Offline mode unavailable:", error));
    });
  }
})();
