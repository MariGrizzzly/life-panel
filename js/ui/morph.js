// Аккуратно обновляет страницу: меняет только то, что изменилось.
// Благодаря этому вода плавно поднимается, а рыбки не прыгают на старт.

function sameNode(a, b) {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) return false;
  if (a.nodeType === 1) {
    const ka = a.getAttribute('data-key'), kb = b.getAttribute('data-key');
    if (ka !== kb) return false;
  }
  return true;
}

export function morph(from, to) {
  if (!sameNode(from, to)) { from.replaceWith(to); return; }
  if (from.nodeType === 3 || from.nodeType === 8) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return;
  }
  if (from.nodeType !== 1) return;
  for (const a of Array.from(from.attributes)) if (!to.hasAttribute(a.name)) from.removeAttribute(a.name);
  for (const a of Array.from(to.attributes)) if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
  // Поля ввода: не трогаем то, что человек печатает, но синхронизируем select и checked
  if (from.tagName === 'SELECT' && to.hasAttribute('data-value') && from.value !== to.getAttribute('data-value')) from.value = to.getAttribute('data-value');
  if (from.tagName === 'TEXTAREA' || from.hasAttribute('data-skip-morph')) return;
  morphChildren(from, to);
}

export function morphChildren(from, to) {
  const fc = Array.from(from.childNodes);
  const tc = Array.from(to.childNodes);
  for (let i = 0; i < tc.length; i++) {
    if (i < fc.length) morph(fc[i], tc[i]);
    else from.appendChild(tc[i]);
  }
  for (let i = fc.length - 1; i >= tc.length; i--) from.removeChild(fc[i]);
}

export function patch(container, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  morphChildren(container, tpl.content);
}
