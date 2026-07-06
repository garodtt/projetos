import { useRef, useEffect } from 'react';

const FONT_OPTIONS = [
  { value: '', label: 'Padrão' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Verdana', label: 'Verdana' },
];

const CHECKLIST_HTML = '<ul class="rte-checklist"><li class="rte-checklist-item">Item</li></ul><p><br></p>';
const CHECKBOX_CLICK_ZONE = 24;

export default function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const didInit = useRef(false);

  useEffect(() => {
    if (editorRef.current && !didInit.current) {
      editorRef.current.innerHTML = value || '';
      didInit.current = true;
    }
  }, [value]);

  function focusEditor() {
    editorRef.current?.focus();
  }

  function exec(command, arg) {
    focusEditor();
    document.execCommand(command, false, arg);
  }

  function handleInsertChecklist() {
    focusEditor();
    document.execCommand('insertHTML', false, CHECKLIST_HTML);
  }

  function saveSelectionForFontPicker() {
    const sel = window.getSelection();
    savedRangeRef.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
  }

  function handleFontChange(e) {
    const font = e.target.value;
    focusEditor();
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    if (font) document.execCommand('fontName', false, font);
    handleBlurSave();
  }

  function handleEditorClick(e) {
    const item = e.target.closest('.rte-checklist-item');
    if (!item) return;
    const rect = item.getBoundingClientRect();
    if (e.clientX - rect.left > CHECKBOX_CLICK_ZONE) return;
    item.classList.toggle('is-checked');
    handleBlurSave();
  }

  function handleBlurSave() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  return (
    <div className="rte-wrapper">
      <div className="rte-toolbar">
        <button type="button" className="rte-btn" title="Negrito" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')}><strong>B</strong></button>
        <button type="button" className="rte-btn" title="Itálico" onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')}><em>I</em></button>
        <button type="button" className="rte-btn" title="Sublinhado" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')}><u>S</u></button>
        <button type="button" className="rte-btn" title="Taxado" onMouseDown={e => e.preventDefault()} onClick={() => exec('strikeThrough')}><s>T</s></button>
        <button type="button" className="rte-btn" title="Grifar" onMouseDown={e => e.preventDefault()} onClick={() => exec('backColor', '#fff3a3')}>🖍</button>
        <span className="rte-divider" />
        <select
          className="rte-font-select"
          title="Fonte"
          defaultValue=""
          onMouseDown={saveSelectionForFontPicker}
          onChange={handleFontChange}
        >
          {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <span className="rte-divider" />
        <button type="button" className="rte-btn" title="Lista com marcadores" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertUnorderedList')}>• Lista</button>
        <button type="button" className="rte-btn" title="Lista numerada" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertOrderedList')}>1. Lista</button>
        <button type="button" className="rte-btn" title="Checklist" onMouseDown={e => e.preventDefault()} onClick={handleInsertChecklist}>☑ Checklist</button>
      </div>
      <div
        ref={editorRef}
        className="rte-editor"
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlurSave}
        onClick={handleEditorClick}
        data-placeholder={placeholder || ''}
      />
    </div>
  );
}