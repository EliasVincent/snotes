import { invoke } from "@tauri-apps/api/tauri";
//import { Note } from "./model";


let notesMsgEl: HTMLElement | null;
//let createMsgEl: HTMLElement | null;

let createNoteContentEl: HTMLInputElement | null;
let createNoteTagEl: HTMLInputElement | null;

// create
async function createNote() {
  console.log("reached ssssjs")
  if (createNoteContentEl && createNoteTagEl) {
    console.log("reached js")
    await invoke("create_note", {
      content: createNoteContentEl.value,
      tag: createNoteTagEl.value
    });
  }
}

// read
async function showNotes() {
  if (notesMsgEl) {
    notesMsgEl.textContent = await invoke("get_notes_list");
  }
}

// TODO: read better array of note elements with id iterable the whole thing

// update
// async function updateNote()  {
//   if (true) {
//     await invoke("update_note", {
//       id: null,
//       content: null,
//       tag: null
//     });
//   }
// }

// delete
// async function deleteNote() {
//   if (true) {
//     await invoke("delete_note", {
//         id: null
//       }
//     )
//   }
// }


window.addEventListener("DOMContentLoaded", () => {
  createNoteContentEl = document.querySelector("#create-input");
  createNoteTagEl = document.querySelector("#create-tag");
 // createMsgEl = document.querySelector("#create-msg");
  notesMsgEl = document.querySelector("#notes-list");
  showNotes();
  document.querySelector("#create-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    createNote();
    showNotes();
  });
  document.querySelector("#show-notes-button")?.addEventListener("click", (e) => {
    e.preventDefault();
    showNotes();
  })
});
