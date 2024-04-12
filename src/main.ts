import { invoke } from "@tauri-apps/api/tauri";
import { Note } from "./model";


let notesMsgEl: HTMLElement | null;
//let createMsgEl: HTMLElement | null;

let createNoteContentEl: HTMLInputElement | null;
let createNoteTagEl: HTMLInputElement | null;

let noteSidebarContainerEl: HTMLDivElement | null;

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
    const notesJson: string = await invoke("get_notes_list");
    const formattedJson = JSON.stringify(JSON.parse(notesJson), null, 2); // Indentation of 2 spaces
    notesMsgEl.textContent = formattedJson;

    const array: Array<any> = await retrieveNotes();

    const noteArray: Note[] = array.map((jsonObj) => ({
      id: jsonObj.id,
      content: jsonObj.content,
      date: jsonObj.date,
      tag: jsonObj.tag
    }));

    console.log(noteArray[0])

    fillNoteSidebar(noteArray);
  }

}
async function retrieveNotes(): Promise<Array<JSON>> {
  const notesString: string = await invoke("get_notes_list");
  const notesJson = JSON.parse(notesString);
  console.log(notesJson);
  return notesJson;
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


function fillNoteSidebar(noteArray: Note[]) {

  noteSidebarContainerEl = document.querySelector("#note-sidebar-container");

  if (noteSidebarContainerEl) {
    noteArray.forEach((note) => {
      // Create HTML elements for each note
      const noteEl: HTMLDivElement = document.createElement('div');
      noteEl.classList.add('sidebar-note');

      const idSpan: HTMLSpanElement = document.createElement('span');
      idSpan.classList.add('sidebar-note-id');
      idSpan.textContent = note.id.toString();

      const contentSpan: HTMLSpanElement = document.createElement('span');
      contentSpan.classList.add('sidebar-note-content');
      contentSpan.textContent = note.content.substring(0, 20);
      contentSpan.title = note.content as string;

      const tagSpan: HTMLSpanElement = document.createElement('span');
      tagSpan.classList.add('sidebar-note-tag');
      tagSpan.textContent = note.tag as string;


      noteEl.appendChild(idSpan);
      noteEl.appendChild(contentSpan);
      noteEl.appendChild(tagSpan);

      // Append noteEl to the container, if it still exists?
      noteSidebarContainerEl ? noteSidebarContainerEl.appendChild(noteEl) : null;
    });
  }
}


