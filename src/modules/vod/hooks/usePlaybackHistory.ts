import { useEffect, useState, type MutableRefObject } from 'react';
import type { MediaItem, MediaMeta } from '../types/media';

interface HistoryItem extends MediaItem { season: string; episode: string; timestamp: number }
const KEY = 'meuplayer_history';
function readHistory(): HistoryItem[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(data) ? data.filter(item => item && item.id && item.type).slice(0, 10) : [];
  } catch { return []; }
}

export function usePlaybackHistory(modal: { open: boolean; id: string; type: MediaItem['type'] }, season: string, episode: string, metadata: MutableRefObject<Record<string, MediaMeta>>) {
  const [items, setItems] = useState(readHistory);
  useEffect(() => {
    if (!modal.open || !modal.id) { setItems(readHistory()); return; }
    const meta = metadata.current[`${modal.type}-${modal.id}`] || {};
    const previous = readHistory();
    const existing = previous.find(item => item.id === modal.id && item.type === modal.type);
    const next: HistoryItem[] = [{ id: modal.id, type: modal.type, season, episode, timestamp: Date.now(), meta: { ...existing?.meta, ...meta } }, ...previous.filter(item => item.id !== modal.id || item.type !== modal.type)].slice(0, 10);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Keep history usable in memory if browser storage is unavailable. */ }
    setItems(next);
  }, [modal.open, modal.id, modal.type, season, episode]);
  return items;
}
