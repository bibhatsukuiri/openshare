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

const LESSONS = {
  aroha: {
    title: "Aroha",
    description: "Play all eight shuddh notes upward, from Sa to high Sa.",
    notes: [0, 2, 4, 5, 7, 9, 11, 12]
  },
  avaroha: {
    title: "Avaroha",
    description: "Return from high Sa to low Sa, one note at a time.",
    notes: [12, 11, 9, 7, 5, 4, 2, 0]
  },
  three: {
    title: "Sa Re Ga",
    description: "A short practice for learning your first three notes.",
    notes: [0, 2, 4, 2, 0]
  },
  alankar: {
    title: "Simple Alankar",
    description: "Repeat a small ascending pattern to develop finger control.",
    notes: [0, 2, 4, 2, 4, 5, 4, 5, 7, 5, 7, 9]
  },
  sapa: {
    title: "Sa Pa Sa",
    description: "Hear and practice the relationship between Sa and Pa.",
    notes: [0, 7, 12, 7, 0]
  }
};

const el = id => document.getElementById(id);
const keyboardElement = el("keyboard");
const originalKeyboardMarkup = keyboardElement.innerHTML;
let keyElements = Array.from(keyboardElement.querySelectorAll(".key"));
const keys = new Map(keyElements.map(key => [Number(key.dataset.note), key]));
const lessonCards = Array.from(document.querySelectorAll(".lesson-tile"));
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
let fallbackFocusMode = false;

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
    keyboardElement.classList.remove("physical-layout");
    keyboardElement.style.removeProperty("--white-key-count");
    keyboardElement.innerHTML = originalKeyboardMarkup;
    fingeringHint.hidden = true;
    fingeringHint.textContent = "";
  } else {
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
  return LESSONS[selectedLesson];
}

function renderLesson() {
  const lesson = getLesson();
  el("selected-lesson-name").textContent = lesson.title;
  el("selected-lesson-detail").textContent = lesson.description;

  lessonCards.forEach(card => {
    const selected = card.dataset.lesson === selectedLesson;
    card.classList.toggle("is-selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  });

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
  setIdleActions();
  renderLesson();
  setFeedback("Press Listen to hear this exercise, or Start practice to follow the keys.");
  noteDisplay.textContent = "Ready to play";
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

async function playDemo() {
  // Audio must be unlocked directly inside the click handler on mobile.
  if (!ensureAudio()) return;

  endDemo();
  isPracticing = false;
  isCompleted = false;
  practiceIndex = 0;
  demoPlaying = true;
  const currentToken = ++demoToken;
  const notes = [...getLesson().notes];
  const beat = 60000 / Number(tempo.value);
  listenButton.disabled = true;
  listenButton.textContent = "♪ Playing...";
  stopButton.hidden = false;
  setFeedback("Listen to the melody and watch the highlighted keys.");

  for (let i = 0; i < notes.length; i += 1) {
    if (currentToken !== demoToken) return;
    demoIndex = i;
    renderLesson();
    noteDisplay.textContent = "Playing " + NOTE_NAMES.get(notes[i]);
    noteOn(notes[i], "demo");
    await delay(Math.max(180, beat * 0.78));
    noteOff(notes[i], "demo");
    if (currentToken !== demoToken) return;
    await delay(Math.max(65, beat * 0.15));
  }

  if (currentToken !== demoToken) return;
  endDemo();
  setFeedback("Listening finished. Press Start practice to play it yourself.");
  noteDisplay.textContent = "Ready to practice";
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

lessonCards.forEach(card => {
  card.addEventListener("click", () => chooseLesson(card.dataset.lesson));
});
listenButton.addEventListener("click", playDemo);
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
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
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
