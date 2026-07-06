export function invertSvgDataUri(dataUri) {
  try {
    const commaIdx = dataUri.indexOf(',');
    const header = dataUri.slice(0, commaIdx);
    const payload = dataUri.slice(commaIdx + 1);
    let svgText;

    if (header.includes('base64')) {
      const binary = atob(payload);
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      svgText = new TextDecoder('utf-8').decode(bytes);
    } else {
      svgText = decodeURIComponent(payload);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    if (doc.getElementsByTagName('parsererror').length) return dataUri;

    const svgEl = doc.documentElement;
    const svgNS = 'http://www.w3.org/2000/svg';

    let defs = svgEl.querySelector('defs');
    if (!defs) {
      defs = doc.createElementNS(svgNS, 'defs');
      svgEl.insertBefore(defs, svgEl.firstChild);
    }

    const filterId = 'gp-invert-filter';
    if (!doc.getElementById(filterId)) {
      const filter = doc.createElementNS(svgNS, 'filter');
      filter.setAttribute('id', filterId);
      const feColorMatrix = doc.createElementNS(svgNS, 'feColorMatrix');
      feColorMatrix.setAttribute('type', 'matrix');
      feColorMatrix.setAttribute('values', '-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0');
      filter.appendChild(feColorMatrix);
      defs.appendChild(filter);
    }

    const g = doc.createElementNS(svgNS, 'g');
    g.setAttribute('filter', 'url(#' + filterId + ')');

    const toMove = [];
    svgEl.childNodes.forEach(node => {
      if (node !== defs) toMove.push(node);
    });
    toMove.forEach(node => g.appendChild(node));
    svgEl.appendChild(g);

    const serialized = new XMLSerializer().serializeToString(svgEl);
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(serialized);
  } catch (e) {
    console.error('Erro ao inverter cores do SVG', e);
    return dataUri;
  }
}