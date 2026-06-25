import { briefingTypes } from "../lib/briefings";

export function BriefingPanel({ briefingText, briefingType, onBriefingTypeChange, onCopy, onGenerate }) {
  return (
    <section className="briefing-panel">
      <h2>Briefings</h2>
      <select value={briefingType} onChange={(event) => onBriefingTypeChange(event.target.value)}>
        {briefingTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.label}
          </option>
        ))}
      </select>
      <div className="button-row">
        <button className="secondary-button" type="button" onClick={onGenerate}>
          Generate
        </button>
        <button className="quiet-button" type="button" disabled={!briefingText} onClick={onCopy}>
          Copy
        </button>
      </div>
      {briefingText ? <textarea className="briefing-output" readOnly rows={11} value={briefingText} /> : null}
    </section>
  );
}
