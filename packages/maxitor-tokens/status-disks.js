// The graph viewer's production disks. Applications and standalone mockups use this same drawing.

/** @param {string} value */
function diskText(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** @param {string} fill @param {string} sign @param {number} size */
export function statusDiskSvg(fill, sign, size = 14) {
  const paths = {
    "+": "M8 12h8M12 8v8",
    "−": "M8 12h8",
    "=": "M8 10h8M8 14h8",
    "~": "M7.5 13.5C9 8.5 15 15.5 16.5 10.5",
  };
  const path = paths[sign];
  const mark = path
    ? `<path d="${path}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="butt"/>`
    : sign ? `<text x="12" y="${size > 12 ? 16.5 : 15.5}" text-anchor="middle" font-family="sans-serif" font-size="${size}" font-weight="700" fill="#fff">${diskText(sign)}</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" data-sign="${diskText(sign)}"><circle cx="12" cy="12" r="11" fill="${diskText(fill)}"/>${mark}</svg>`;
}

/** @param {string} fill @param {string} sign @param {number} size */
export function statusDiskUri(fill, sign, size = 14) {
  return `data:image/svg+xml,${encodeURIComponent(statusDiskSvg(fill, sign, size))}`;
}
