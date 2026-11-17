"use strict";

const STORAGE_KEY = "openshare.ideas.v1";
const form = document.getElementById("idea-form");
const titleInput = document.getElementById("idea-title");
const descriptionInput = document.getElementById("idea-description");
const searchInput = document.getElementById("search");
const list = document.getElementById("idea-list");
const count = document.getElementById("idea-count");
const emptyState = document.getElementById("empty-state");
const status = document.getElementById("status");

function loadIdeas() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.title === "string") : [];
  } catch (error) {
    console.warn("Could not load saved ideas.", error);
    return [];
  }
}

let ideas = loadIdeas();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
  } catch (error) {
    console.warn("Could not save ideas to this browser.", error);
    status.textContent = "Unable to save. Check browser storage settings.";
  }
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = ideas.filter(idea =>
    (idea.title + " " + (idea.description || "")).toLowerCase().includes(query)
  );
  count.textContent = String(ideas.length);
  list.replaceChildren();
  emptyState.hidden = filtered.length > 0;
  emptyState.querySelector("h3").textContent = query ? "No matching ideas" : "Nothing here yet";
  emptyState.querySelector("p").textContent = query
    ? "Try a different search term."
    : "Add your first idea using the form. It will appear here.";

  for (const idea of filtered) {
    const card = document.createElement("article");
    card.className = "idea-card";
    const header = document.createElement("div");
    header.className = "idea-card-header";
    const heading = document.createElement("h3");
    heading.textContent = idea.title;
    const remove = document.createElement("button");
    remove.className = "remove-button";
    remove.type = "button";
    remove.textContent = "Delete";
    remove.setAttribute("aria-label", "Delete " + idea.title);
    remove.addEventListener("click", () => {
      ideas = ideas.filter(item => item.id !== idea.id);
      persist();
      render();
      status.textContent = "Idea deleted.";
    });
    header.append(heading, remove);
    card.append(header);
    if (idea.description) {
      const description = document.createElement("p");
      description.textContent = idea.description;
      card.append(description);
    }
    const date = document.createElement("p");
    date.className = "idea-meta";
    date.textContent = idea.createdAt ? "Added " + new Date(idea.createdAt).toLocaleDateString() : "";
    card.append(date);
    list.append(card);
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.focus();
    return;
  }
  ideas.unshift({
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    title: title.slice(0, 80),
    description: descriptionInput.value.trim().slice(0, 500),
    createdAt: new Date().toISOString()
  });
  persist();
  form.reset();
  searchInput.value = "";
  render();
  titleInput.focus();
  status.textContent = "Idea saved.";
});

searchInput.addEventListener("input", render);
render();
