import { briefingTypes } from "../lib/briefings";

export function BriefingPanel({ briefingHasChanges, briefingText, briefingType, isGenerating, onBriefingTypeChange, onCopy, onGenerate, onMarkShared, user }) {
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
        <button className="secondary-button" type="button" disabled={isGenerating} onClick={onGenerate}>
          {isGenerating ? "Generating..." : "Generate"}
        </button>
        <button className="quiet-button" type="button" disabled={!briefingText} onClick={onCopy}>
          Copy
        </button>
      </div>
      {briefingType === "status_mail" && briefingText && user ? (
        <button className="quiet-button" type="button" disabled={!briefingHasChanges} onClick={onMarkShared}>
          {briefingHasChanges ? "Mark update as shared" : "No unshared changes"}
        </button>
      ) : null}
      {briefingText ? <textarea className="briefing-output" readOnly rows={11} value={briefingText} /> : null}
    </section>
  );
}
