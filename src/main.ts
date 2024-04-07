import { invoke } from "@tauri-apps/api/tauri";

let greetInputEl: HTMLInputElement | null;
let greetMsgEl: HTMLElement | null;

let notesMsgEl: HTMLElement | null;

async function greet() {
  if (greetMsgEl && greetInputEl) {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    greetMsgEl.textContent = await invoke("greet", {
      name: greetInputEl.value,
    });
  }
}

async function showNotes() {
  if (notesMsgEl) {
    notesMsgEl.textContent = await invoke("get_notes_list");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  notesMsgEl = document.querySelector("#notes-list");
  document.querySelector("#greet-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    greet();
  });
  document.querySelector("#show-notes-button")?.addEventListener("click", (e) => {
    e.preventDefault();
    showNotes();
  })
});
