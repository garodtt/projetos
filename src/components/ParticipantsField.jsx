import { useState } from 'react';

export default function ParticipantsField({ participants, onChange }) {
  const [draft, setDraft] = useState('');

  function addParticipant() {
    const name = draft.trim();
    if (!name) return;
    if (participants.some(p => p.toLowerCase() === name.toLowerCase())) { setDraft(''); return; }
    onChange([...participants, name]);
    setDraft('');
  }

  function removeParticipant(name) {
    onChange(participants.filter(p => p !== name));
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); addParticipant(); }
  }

  return (
    <div className="participants-field">
      {participants.length > 0 && (
        <div className="participants-list">
          {participants.map(name => (
            <span key={name} className="participant-chip">
              {name}
              <button type="button" onClick={() => removeParticipant(name)} aria-label={'Remover ' + name}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div className="participants-input-row">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nome do participante"
        />
        <button type="button" className="secondary small" onClick={addParticipant}>+ Adicionar</button>
      </div>
    </div>
  );
}