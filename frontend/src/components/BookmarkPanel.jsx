import React, { useState } from 'react';
import { useMissionStore } from '../stores/missionStore';
import toast from 'react-hot-toast';

/**
 * Bookmarks panel — save and navigate to map locations
 */
export default function BookmarkPanel({ missionId }) {
  const { bookmarks, focusPosition } = useMissionStore();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [posZ, setPosZ] = useState(0);
  const [icon, setIcon] = useState('📌');
  const [isShared, setIsShared] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mission_id: missionId,
          name: name.trim(),
          pos_x: posX,
          pos_y: posY,
          pos_z: posZ,
          icon,
          is_shared: isShared,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const bm = await res.json();
      useMissionStore.getState().addBookmark(bm);
      toast.success('Bookmark saved');
      setShowCreate(false);
      setName('');
    } catch {
      toast.error('Failed to save bookmark');
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/bookmarks/${id}`, { method: 'DELETE', credentials: 'include' });
      useMissionStore.getState().removeBookmark(id);
      toast.success('Bookmark deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const ICON_OPTIONS = ['📌', '⭐', '🎯', '⚠️', '🏠', '🔴', '🔵', '🟢', '💎', '🔥'];

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('📌');
  const [editShared, setEditShared] = useState(false);

  const startEdit = (bm) => {
    setEditingId(bm.id);
    setEditName(bm.name);
    setEditIcon(bm.icon || '📌');
    setEditShared(bm.is_shared || false);
  };

  const handleEdit = async (bmId) => {
    try {
      const res = await fetch(`/api/bookmarks/${bmId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editName, icon: editIcon, is_shared: editShared }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      useMissionStore.getState().updateBookmark(updated);
      setEditingId(null);
      toast.success('Bookmark updated');
    } catch {
      toast.error('Failed to update bookmark');
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowCreate(!showCreate)}
        className="w-full text-left text-sm text-krt-accent hover:text-blue-400 py-1"
      >
        + Add Bookmark
      </button>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-krt-bg/80 rounded-lg p-3 space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bookmark name"
            className="w-full bg-krt-panel border border-krt-border rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-krt-accent"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={posX} onChange={(e) => setPosX(parseFloat(e.target.value) || 0)} placeholder="X"
              className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent" />
            <input type="number" value={posY} onChange={(e) => setPosY(parseFloat(e.target.value) || 0)} placeholder="Y"
              className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent" />
            <input type="number" value={posZ} onChange={(e) => setPosZ(parseFloat(e.target.value) || 0)} placeholder="Z"
              className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Icon</label>
            <div className="flex gap-1 flex-wrap">
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`text-lg px-1.5 py-0.5 rounded ${icon === ic ? 'bg-krt-accent/30 border border-krt-accent' : 'bg-krt-bg border border-krt-border'}`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} className="rounded" />
            Share with team
          </label>
          <div className="flex gap-2">
            <button type="submit" className="bg-krt-accent text-white text-sm px-3 py-1 rounded">Save</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-gray-400 text-sm px-3 py-1">Cancel</button>
          </div>
        </form>
      )}

      {bookmarks.length === 0 && !showCreate && (
        <p className="text-gray-500 text-sm text-center py-4">
          No bookmarks. Save map locations for quick access.
        </p>
      )}

      {bookmarks.map((bm) => (
        <div
          key={bm.id}
          className="p-2 rounded-lg bg-krt-bg/50 border border-transparent hover:border-krt-border cursor-pointer group"
          onClick={() => editingId !== bm.id && focusPosition({ x: bm.pos_x || 0, y: bm.pos_y || 0, z: bm.pos_z || 0 })}
        >
          {editingId === bm.id ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-krt-panel border border-krt-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-krt-accent" autoFocus />
              <div className="flex gap-1 flex-wrap">
                {ICON_OPTIONS.map((ic) => (
                  <button key={ic} type="button" onClick={() => setEditIcon(ic)}
                    className={`text-sm px-1 rounded ${editIcon === ic ? 'bg-krt-accent/30 border border-krt-accent' : 'bg-krt-bg border border-krt-border'}`}>
                    {ic}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input type="checkbox" checked={editShared} onChange={(e) => setEditShared(e.target.checked)} className="rounded" />
                Share with team
              </label>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(bm.id)} className="bg-krt-accent text-white text-xs px-3 py-1 rounded">Save</button>
                <button onClick={() => setEditingId(null)} className="text-gray-400 text-xs px-3 py-1">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm">{bm.icon || '📌'}</span>
                <span className="text-sm text-white flex-1 truncate">{bm.name}</span>
                {bm.is_shared && <span className="text-[10px] text-gray-600">shared</span>}
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(bm); }}
                  className="text-xs text-gray-700 hover:text-krt-accent opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(bm.id); }}
                  className="text-xs text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
              <div className="text-[10px] text-gray-600 mt-0.5">
                ({bm.pos_x?.toFixed(0)}, {bm.pos_y?.toFixed(0)}, {bm.pos_z?.toFixed(0)})
                {bm.created_by_name && <span className="ml-1">by {bm.created_by_name}</span>}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
