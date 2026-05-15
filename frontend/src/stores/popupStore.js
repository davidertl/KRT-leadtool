import { create } from 'zustand';

/**
 * UI state store for popup/window management.
 * Each popup has: id, open, position {x,y}, size {w,h}, minimized, zIndex
 */

const POPUP_DEFAULTS = {
  units:        { x: 10,  y: 60,  w: 340, h: 520, label: 'Units',         icon: '🚀' },
  persons:      { x: 10,  y: 60,  w: 340, h: 480, label: 'Persons',       icon: '🧑' },
  groups:       { x: 10,  y: 60,  w: 320, h: 420, label: 'Groups',        icon: '👥' },
  contacts:     { x: 360, y: 60,  w: 340, h: 480, label: 'SPOTREP',         icon: '📡' },
  tasks:        { x: 360, y: 60,  w: 360, h: 520, label: 'Tasks',         icon: '📋' },
  selected:     { x: 10,  y: 60,  w: 340, h: 400, label: 'Selection',     icon: '✅' },
  ops:          { x: 360, y: 60,  w: 380, h: 560, label: 'Operations',    icon: '🎯' },
  comms:        { x: 710, y: 60,  w: 340, h: 500, label: 'Comms',         icon: '📡' },
  log:          { x: 710, y: 60,  w: 380, h: 500, label: 'Event Log',     icon: '📜' },
  bookmarks:    { x: 710, y: 60,  w: 320, h: 400, label: 'POI',           icon: '📌' },
  multiplayer:  { x: 710, y: 60,  w: 360, h: 520, label: 'Multiplayer',   icon: '🌐' },
  radio:        { x: 710, y: 60,  w: 360, h: 500, label: 'Radio Net',     icon: '📻' },
  unitDetail:   { x: 200, y: 100, w: 380, h: 560, label: 'Unit Detail',   icon: '🔍' },
  personDetail: { x: 200, y: 100, w: 360, h: 480, label: 'Person Detail', icon: '🧑' },
};

let nextZ = 1000;

function getNextZ() {
  return ++nextZ;
}

const initialPopups = {};
for (const [id, def] of Object.entries(POPUP_DEFAULTS)) {
  initialPopups[id] = {
    id,
    open: false,
    minimized: false,
    position: { x: def.x, y: def.y },
    size: { w: def.w, h: def.h },
    zIndex: 1000,
    label: def.label,
    icon: def.icon,
  };
}

export const usePopupStore = create((set, get) => ({
  popups: initialPopups,

  /** Open (or focus) a popup */
  openPopup: (id) =>
    set((state) => ({
      popups: {
        ...state.popups,
        [id]: { ...state.popups[id], open: true, minimized: false, zIndex: getNextZ() },
      },
    })),

  /** Close a popup */
  closePopup: (id) =>
    set((state) => ({
      popups: {
        ...state.popups,
        [id]: { ...state.popups[id], open: false },
      },
    })),

  /** Toggle open/close */
  togglePopup: (id) => {
    const popup = get().popups[id];
    if (!popup) return;
    if (popup.open) {
      get().closePopup(id);
    } else {
      get().openPopup(id);
    }
  },

  /** Minimize / restore */
  toggleMinimize: (id) =>
    set((state) => ({
      popups: {
        ...state.popups,
        [id]: { ...state.popups[id], minimized: !state.popups[id].minimized },
      },
    })),

  /** Bring to front */
  focusPopup: (id) =>
    set((state) => ({
      popups: {
        ...state.popups,
        [id]: { ...state.popups[id], zIndex: getNextZ() },
      },
    })),

  /** Move popup */
  movePopup: (id, x, y) =>
    set((state) => ({
      popups: {
        ...state.popups,
        [id]: { ...state.popups[id], position: { x, y } },
      },
    })),

  /** Resize popup */
  resizePopup: (id, w, h) =>
    set((state) => ({
      popups: {
        ...state.popups,
        [id]: { ...state.popups[id], size: { w, h } },
      },
    })),

  /** Close all popups */
  closeAll: () =>
    set((state) => {
      const popups = { ...state.popups };
      for (const id of Object.keys(popups)) {
        popups[id] = { ...popups[id], open: false };
      }
      return { popups };
    }),

  /** Unit detail popup — special: carries a unitId */
  detailUnitId: null,
  openUnitDetail: (unitId) => {
    set({ detailUnitId: unitId });
    get().openPopup('unitDetail');
  },
  closeUnitDetail: () => {
    set({ detailUnitId: null });
    get().closePopup('unitDetail');
  },

  /** Person detail popup — special: carries a personId */
  detailPersonId: null,
  openPersonDetail: (personId) => {
    set({ detailPersonId: personId });
    get().openPopup('personDetail');
  },
  closePersonDetail: () => {
    set({ detailPersonId: null });
    get().closePopup('personDetail');
  },
}));
