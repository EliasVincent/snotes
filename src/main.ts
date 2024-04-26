import { invoke } from "@tauri-apps/api/tauri";
import { save } from "@tauri-apps/api/dialog";
import { Note, Settings } from "./model";
import { createWorker } from 'tesseract.js';
import { writeTextFile } from "@tauri-apps/api/fs";
import { homeDir } from "@tauri-apps/api/path";

let notesMsgEl: HTMLElement | null;

let createNoteContentEl: HTMLTextAreaElement | null;
let createNoteTagEl: HTMLInputElement | null;

let searchbarEl: HTMLInputElement | null;
let noteSidebarContainerEl: HTMLDivElement | null;
let noteSidebarReverseCheckboxEl: HTMLInputElement | null;
let searchbarContents = "";

let noteArray: Note[] = []

/** ID of current note, if we're editing an existing note */
let currentNoteId: number | null = null;
/** reverse the order of note by id in the sidebar */
let reversed = true;
let idModalActive = false;

let typingTimer: number | null = null;
const AUTOSAVE_DELAY = 5000;

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

let settings: Settings | null = null;

/**
 * Saves the note.
 * Or updates an existing note depending on editor state
 * TODO: save note when switching to prevent data loss
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

      fillNoteSidebar(noteArray, reversed);
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
 * TODO: consistency
 */
window.addEventListener("DOMContentLoaded", async () => {
  // settings
  settings = await loadSettings();
  // db
  await invoke("init_db");

  console.log("ACTUAL SETTINGS IN FRONTEND: ", settings.fontSize)
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
  document.querySelector('#export-button')?.addEventListener("click", (e) => {
    e.preventDefault();
    exportNote(createNoteContentEl ? createNoteContentEl.value : null);
  })
  document.querySelector('#settings-button')?.addEventListener("click", (e) => {
    e.preventDefault();
    handleOpenSettingsModal();
  })

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

  // sidebar reverse toggle
  noteSidebarReverseCheckboxEl = document.querySelector('#reverse-toggle');
  if (noteSidebarReverseCheckboxEl) {
    console.log(noteSidebarReverseCheckboxEl.value);
    noteSidebarReverseCheckboxEl.addEventListener("click", (e: Event) => {
      const target = e.target as HTMLInputElement
      toggleReverse(target.checked);
    })
  }

  // auto-save timer
  createNoteContentEl?.addEventListener("keyup", () => {
    if (editorState === EditorState.EDITING) {
      if (typingTimer) {
        clearTimeout(typingTimer);
      }
      typingTimer = window.setTimeout(() => saveNote(), AUTOSAVE_DELAY);
    }
  });

  if (createNoteContentEl) {
    createNoteContentEl.style.fontSize = settings.fontSize
  }

  // OCR
  const uploadOcrImageButtonEl = document.getElementById('image-button') as HTMLButtonElement;
  const ocrFileInputEl = document.getElementById('fileInput') as HTMLInputElement;

  uploadOcrImageButtonEl.addEventListener('click', () => {
    ocrFileInputEl.click(); // Simulate click on the file input
  });

  ocrFileInputEl.addEventListener('change', (event) => {
    const files = (event.target as HTMLInputElement).files;
    if (files) {
      console.log('Selected file:', files[0].name);
      ocrFileInputEl.src = URL.createObjectURL(files[0]);
      (async () => {
        // TODO: change ocr language in settings
        const worker = await createWorker('eng');
        const ret = await worker.recognize(files[0]);
        console.log(ret.data.text);
        if (createNoteContentEl) [
          createNoteContentEl.value += ret.data.text
        ]
        await worker.terminate();
      })();
    }
  });


  refreshContextMenuElements();
});

async function loadSettings(): Promise<Settings> {
  const defaultSettings: Settings = {
    fontSize: "16px"
  };

  try {
    let loadedSettingsString: string = await invoke("load_settings");
    console.log(loadedSettingsString);

    if (loadedSettingsString === "") {
      await invoke("init_settings");
      return defaultSettings;
    }

    const loadedSettings = JSON.parse(loadedSettingsString);
    return loadedSettings as Settings;
  } catch (error) {
    console.error("An error occurred while loading settings:", error);
    return defaultSettings;
  }
}

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

function fillNoteSidebar(noteArray: Note[], reverse: boolean) {

  noteSidebarContainerEl = document.querySelector("#note-sidebar-container");

  if (noteSidebarContainerEl) {
    // clear previously existing elements
    noteSidebarContainerEl.innerHTML = "";

    reverse ? noteArray.reverse() : noteArray;

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
      // save if there's something in the editor currently 
      // before we open the new note to prevent data loss
      if (createNoteContentEl.value != "") {
        saveNote();
      }

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
    createNoteContentEl.focus();
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
  // open by id: open modal
  if (event.ctrlKey && event.key === 't') {
    event.preventDefault();
    const modalBg = document.getElementById("id-modal-bg");
    const modal = document.getElementById("id-modal-container");
    const idSearchBar = document.getElementById("id-search")
    if (modalBg && modal && idSearchBar) {
      modalBg.style.display = "block";
      modal.style.display = "block";
      idSearchBar.focus();
      (idSearchBar as HTMLInputElement).value = "";
      idModalActive = true;

      modalBg.addEventListener("click", () => {
        modal.style.display = "none";
        modalBg.style.display = "none";
        idModalActive = false;
      })

      idSearchBar.addEventListener("keydown", async (event: KeyboardEvent) => {
        if (event.key === "Enter" && idModalActive) {
          let value = (idSearchBar as HTMLInputElement).value;
          console.log("value: " + value);
          if (await openNoteById(value)) {
            modal.style.display = "none";
            modalBg.style.display = "none";
            idModalActive = false;
          } else {
            (idSearchBar as HTMLInputElement).value = "";
            (idSearchBar as HTMLInputElement).placeholder = "no Note found for ID";
          }
        }
        if (event.key === "Escape" && idModalActive) {
          modal.style.display = "none";
          modalBg.style.display = "none";
          idModalActive = false;
        }
      });

    } else { console.error("failed to get modal"); }
  }
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

    fillNoteSidebar(noteArray, reversed);
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

function toggleReverse(val: boolean) {
  reversed = val;
  showNotes();
}

async function openNoteById(value: string): Promise<boolean> {
  const id: Number | null = parseInt(value);
  if (id) {
    const noteString = await invoke("get_note_by_id", {
      id: id
    });
    console.log("id called: " + id)
    console.log("note string: " + noteString)
    const noteJson = JSON.parse(noteString as string);

    if (noteJson.length == 0) {
      return false;
    }

    const foundNote: Note = {
      id: noteJson[0].id,
      content: noteJson[0].content,
      date: noteJson[0].date,
      tag: noteJson[0].tag
    }

    openNote(foundNote);
    return true;
  }
  return false;
}

async function exportNote(contents: string | null) {
  if (contents) {
    const title = contents.slice(0, 10).trim();
    const filePath = await save({
      defaultPath: (await homeDir()) + "/" + title + ".md",
      filters: [{
        name: 'Text',
        extensions: ['txt', 'md']
      }]
    });
    if (filePath) {
      await (writeTextFile(filePath, contents));
    } else {
      console.error("Failed to get filePath")
    }
  } else {
    // TODO: have some kind of error banner at the bottom for
    // these notifications
    console.error("Export note: failed to get note contents");
  }
}

function handleOpenSettingsModal() {
  const modalBg = document.getElementById("id-modal-bg");
  const setingsModalContainer = document.getElementById("settings-modal-container");
  const settingsFontsizeInput = document.getElementById("fontsize-setting-input") as HTMLInputElement;
  if (modalBg && setingsModalContainer && settingsFontsizeInput) {
    modalBg.style.display = "block";
    setingsModalContainer.style.display = "block";
    settingsFontsizeInput.focus();
    settingsFontsizeInput.value = settings ? settings.fontSize : "16";

    modalBg.addEventListener("click", () => {
      setingsModalContainer.style.display = "none";
      modalBg.style.display = "none";
    });

    settingsFontsizeInput.addEventListener("keydown", async (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        console.log("saving settings..")
        settings = {
          fontSize: settingsFontsizeInput.value
        }
        await invoke("save_settings", {
          settings: JSON.stringify(settings)
        });
        if (createNoteContentEl) {
          createNoteContentEl.style.fontSize = settingsFontsizeInput.value + "px";
        } else {
          console.error("failed to get createNoteContentEl")
        }
        setingsModalContainer.style.display = "none";
        modalBg.style.display = "none";
      }
      if (event.key === "Escape") {
        setingsModalContainer.style.display = "none";
        modalBg.style.display = "none";
      }
    });


  } else {
    console.error("Failed to get Settings Modal elements.");
  }
}

