// Фото дня: сжатие перед загрузкой, загрузка в приватное хранилище, показ через временные ссылки.
import { storage } from './remote.js';

const cache = new Map();   // путь → адрес картинки в памяти
const loading = new Set();
let onLoaded = () => {};
export function onPhotoLoaded(fn) { onLoaded = fn; }

const thumbPath = (p) => p.replace(/\.jpg$/, '_t.jpg');

// Возвращает адрес, если картинка уже загружена; иначе начинает загрузку и вернёт null
export function photoURL(path, thumb = false) {
  const p = thumb ? thumbPath(path) : path;
  if (cache.has(p)) return cache.get(p);
  if (!loading.has(p)) {
    loading.add(p);
    storage.download(p)
      .then((blob) => { cache.set(p, URL.createObjectURL(blob)); })
      .catch(() => { if (thumb) return storage.download(path).then((b) => cache.set(p, URL.createObjectURL(b))); return null; })
      .catch(() => {})
      .finally(() => { loading.delete(p); onLoaded(); });
  }
  return null;
}

async function toImage(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* пробуем иначе */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не получилось открыть картинку'));
    img.src = URL.createObjectURL(file);
  });
}
function shrink(img, max, quality) {
  const w = img.width, h = img.height;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', quality));
}

export async function uploadPhoto(userId, day, file) {
  const img = await toImage(file);
  const [full, thumb] = await Promise.all([shrink(img, 1600, 0.84), shrink(img, 360, 0.78)]);
  const path = `${userId}/${day}-${Date.now().toString(36)}.jpg`;
  await storage.upload(path, full);
  await storage.upload(thumbPath(path), thumb);
  cache.set(path, URL.createObjectURL(full));
  cache.set(thumbPath(path), URL.createObjectURL(thumb));
  return path;
}

export async function removePhoto(path) {
  try { await storage.remove([path, thumbPath(path)]); } catch (e) { /* файл мог уже удалиться */ }
  cache.delete(path); cache.delete(thumbPath(path));
}
