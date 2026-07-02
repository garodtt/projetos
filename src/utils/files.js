const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];

function extensionOf(value) {
  if (!value) return '';
  const clean = value.split('?')[0].split('#')[0];
  return clean.split('.').pop().toLowerCase();
}

export function isImageFile(value) {
  return IMAGE_EXTENSIONS.includes(extensionOf(value));
}

export function fileIcon(value) {
  const ext = extensionOf(value);
  if (!ext) return '📎';
  if (IMAGE_EXTENSIONS.includes(ext)) return '🖼️';
  if (ext === 'pdf') return '📕';
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return '📊';
  if (['ppt', 'pptx', 'odp'].includes(ext)) return '📽️';
  return '📎';
}

export const ATTACHMENT_ACCEPT = 'image/*,.pdf,.doc,.docx,.odt,.rtf,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp,.txt';