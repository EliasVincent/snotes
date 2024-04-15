import { invoke } from "@tauri-apps/api/tauri";
import { Note } from "./model";


let notesMsgEl: HTMLElement | null;

let createNoteContentEl: HTMLTextAreaElement | null;
let createNoteTagEl: HTMLInputElement | null;

let searchbarEl: HTMLInputElement | null;
let noteSidebarContainerEl: HTMLDivElement | null;
let searchbarContents = "";

let noteArray: Note[] = []

/** ID of current note, if we're editing an existing note */
let currentNoteId: number | null = null;


enum EditorState {
  NEW,
  EDITING
}

enum SearchState {
  EMPTY,
  RESULTS
}

/** Editor always initializes in the NEW state */
let editorState = EditorState.NEW;
let searchState = SearchState.EMPTY;

/**
 * Saves the note.
 * Or updates an existing note depending on editor state
 */
async function saveNote() {
  if (createNoteContentEl && createNoteTagEl) {
    switch (editorState) {
      case EditorState.NEW:
        console.log("creating new note..")
        await invoke("create_note", {
          content: createNoteContentEl.value,
          tag: createNoteTagEl.value
        });
        //clearEditor();
        refreshSidebarAndOpenLatestNote();
        break;
      case EditorState.EDITING:
        console.log("updating existing note..")
        if (currentNoteId !== null) {
          await invoke("update_specific_note", {
            id: currentNoteId,
            content: createNoteContentEl.value,
            tag: createNoteTagEl.value
          });
          // do not clear the editor
          //clearEditor();
        } else {
          console.error("No note is currently being edited");
        }
        break;
    }
    showNotes();
  }
}

/**
 * Retrieve Notes from DB and fill the sidebar with them.
 * 
 * If there's something in the searchbar, do not clear that.
 */
async function showNotes() {
  if (notesMsgEl) {
    if (searchState == SearchState.EMPTY) {
      const array: Array<any> = await retrieveNotes();

      noteArray = array.map((jsonObj) => ({
        id: jsonObj.id,
        content: jsonObj.content,
        date: jsonObj.date,
        tag: jsonObj.tag
      }));

      fillNoteSidebar(noteArray);
    } else {
      searchNote(searchbarContents);
    }
  }

}
async function retrieveNotes(): Promise<Array<JSON>> {
  const notesString: string = await invoke("get_notes_list");
  const notesJson = JSON.parse(notesString);

  return notesJson;
}

/**
 * Handle even listeners on load.
 * This does not handle listeners for generated fields like
 * the Notes in the sidebar.
 */
window.addEventListener("DOMContentLoaded", () => {
  createNoteContentEl = document.querySelector("#create-input");
  createNoteTagEl = document.querySelector("#create-tag");
  searchbarEl = document.querySelector("#note-searchbar");
  notesMsgEl = document.querySelector("#notes-list");
  showNotes();
  document.querySelector("#save-button")?.addEventListener("click", (e) => {
    e.preventDefault();
    saveNote();
    showNotes();
  });
  document.querySelector("#new-button")?.addEventListener("click", (e) => {
    e.preventDefault();
    clearEditor();
    showNotes();
  });
  document.querySelector("#show-notes-button")?.addEventListener("click", (e) => {
    e.preventDefault();
    showNotes();
  });

  // Pressing TAB should insert intends in the editor.
  // This could potentially cause issues later...
  document.querySelector("#create-input")?.addEventListener("keydown", (event: Event) => {
    const e = event as KeyboardEvent;
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      const newValue = target.value.substring(0, start) +
        "\t" + target.value.substring(end);

      target.value = newValue;

      target.setSelectionRange(start + 1, start + 1);
    }
  });

  // searchbar event listener

  document.querySelector("#note-searchbar")?.addEventListener("input", (event: Event) => {
    const target = event.target as HTMLInputElement;
    const input = target.value;

    if (target.value == "") {
      searchState = SearchState.EMPTY;
    } else {
      searchState = SearchState.RESULTS;
    }

    searchbarContents = input;

    searchNote(input);
  })

  refreshContextMenuElements();
});

/**
 * We need to add new event listeners every time we refresh the note list
 */
function refreshContextMenuElements() {
  const elements: NodeListOf<HTMLElement> = document.querySelectorAll(".rightclick-element")
  const contextMenu = document.getElementById('contextMenu');

  if (contextMenu) {
    elements.forEach(element => {

      element.addEventListener("contextmenu", (e: MouseEvent) => {
        e.preventDefault();

        // get the position with mouse and everything
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        // Calculate the position of the context menu relative to the mouse cursor
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let posX = mouseX + menuWidth > viewportWidth ? mouseX - menuWidth : mouseX;
        let posY = mouseY + menuHeight > viewportHeight ? mouseY - menuHeight : mouseY;


        contextMenu.style.display = 'block';
        contextMenu.style.left = `${posX}px`;
        contextMenu.style.top = `${posY}px`;

        const noteIdElement = element.querySelector('.sidebar-note-id');
        if (noteIdElement) {
          const noteIdStr = noteIdElement.textContent;
          if (noteIdStr) {
            const noteId: Number = parseInt(noteIdStr);
            showNoteSidebarContextMenu(noteId);
          }
        } else {
          console.error('.sidebar-note-id element not found within the note.');
        }
      });

    })
  }
}

function fillNoteSidebar(noteArray: Note[]) {

  noteSidebarContainerEl = document.querySelector("#note-sidebar-container");

  if (noteSidebarContainerEl) {
    // clear previously existing elements
    noteSidebarContainerEl.innerHTML = "";

    noteArray.forEach((note) => {
      // Create HTML elements for each note
      const noteEl: HTMLDivElement = document.createElement('div');
      noteEl.classList.add('sidebar-note');
      noteEl.classList.add('rightclick-element');
      noteEl.addEventListener("click", () => handleSidebarNoteClick(note.id), false);

      const idSpan: HTMLSpanElement = document.createElement('span');
      idSpan.classList.add('sidebar-note-id');
      idSpan.textContent = note.id.toString();

      const contentSpan: HTMLSpanElement = document.createElement('span');
      contentSpan.classList.add('sidebar-note-content');

      // Show ... when text is too long
      contentSpan.textContent = note.content.length > 20 ? note.content.substring(0, 20) + "..." : note.content as string;
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

    refreshContextMenuElements();
  }
}


function handleSidebarNoteClick(id: Number): any {
  console.log("clicked note " + id);
  if (createNoteContentEl && createNoteTagEl) {
    // search for note
    let n: Note = {
      id: 0,
      content: "undefined",
      date: "undefined",
      tag: "undefined"
    };

    noteArray.forEach(note => {
      if (note.id === id) {
        n = note;
      }
    });

    if (n) {
      openNote(n);
    } else {
      // don't destory currently editing note if this fails
      console.error("Error fetching note");
    }

  }
}

function showNoteSidebarContextMenu(noteId: Number) {
  const contextMenu = document.getElementById('contextMenu');
  const deleteButton = document.getElementById('deleteButton');

  if (contextMenu && deleteButton) {
    deleteButton.addEventListener('click', async function () {
      console.log('Deleting...');
      await invoke("delete_specific_note", {
        id: noteId
      });
      // hide after delete
      contextMenu.style.display = 'none';
      showNotes();
    });

    // hide when clicking outside of it
    document.addEventListener('click', function (event) {
      if (!contextMenu.contains(event.target as Node)) {
        contextMenu.style.display = 'none';
      }
    });
  }
}

/**
 * When a note is opened, the editor will switch to the EDITING state and get filled with
 * Note content
 */
function openNote(note: Note) {
  if (createNoteContentEl && createNoteTagEl) {
    createNoteContentEl.value = note.content as string;
    createNoteTagEl.value = note.tag as string;
    currentNoteId = note.id as number;
    // switch state
    editorState = EditorState.EDITING;
  }
}

/**
 * When new note is clicked, clear the editor content and switch Editor state
 */
function clearEditor() {
  if (createNoteContentEl && createNoteTagEl) {
    createNoteContentEl.value = "";
    createNoteTagEl.value = "";
    currentNoteId = null;
    editorState = EditorState.NEW;
  }
}

// Listen for global key presses
document.addEventListener('keydown', (e) => handleKeyboardShortcuts(e));

/**
 * Handle global keyboard shortcuts like save, search, new
 */
function handleKeyboardShortcuts(event: KeyboardEvent) {
  // save
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault();
    saveNote();
  }
  // new
  if (event.ctrlKey && event.key === 'n') {
    event.preventDefault();
    clearEditor();
  }
  // refresh
  if (event.ctrlKey && event.key === 'r') {
    event.preventDefault();
    showNotes();
  }
  // focus searchbox
  if (event.ctrlKey && event.key === 'f') {
    event.preventDefault();
    if (searchbarEl) {
      searchbarEl.focus();
    } else {
      console.error("failed to focus on searchbar");
    }
  }
  // open by id
  // quick switch note 1-9
}

/**
 * Searches for note and displays the results accordingly
 */
async function searchNote(input: string) {
  if (notesMsgEl) {
    const array: Array<any> = await getSearchResults(input);

    noteArray = array.map((jsonObj) => ({
      id: jsonObj.id,
      content: jsonObj.content,
      date: jsonObj.date,
      tag: jsonObj.tag
    }));

    fillNoteSidebar(noteArray);
  }
}

async function getSearchResults(input: string): Promise<Array<JSON>> {
  const resultsString: string = await invoke("search_notes", {
    query: input
  });
  const resultsJson = JSON.parse(resultsString);
  return resultsJson;
}

/**
 * When we save a new note, we want to keep that note
 * in the editor, so we switch out the New note for
 * Editing an existing note (the latest one, the one
 * we just created)
 */
async function refreshSidebarAndOpenLatestNote() {
  showNotes();

  const noteString = await invoke("get_latest_note");
  const noteJson = JSON.parse(noteString as string);

  const latestNote: Note = {
    id: noteJson[0].id,
    content: noteJson[0].content,
    date: noteJson[0].date,
    tag: noteJson[0].tag
  }

  openNote(latestNote);
}

