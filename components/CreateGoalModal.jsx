export function CreateGoalModal({ title, onClose, onSubmit, onTitleChange }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <h2>Create Goal</h2>
        <label htmlFor="newGoalTitle">Name</label>
        <input id="newGoalTitle" autoFocus type="text" value={title} onChange={(event) => onTitleChange(event.target.value)} />
        <div className="button-row">
          <button className="quiet-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={!title.trim()}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
