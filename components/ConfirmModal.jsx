export function ConfirmModal({ confirmLabel = "Confirm", message, onCancel, onConfirm, title }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <h2>{title}</h2>
        <p className="modal-copy">{message}</p>
        <div className="button-row">
          <button className="quiet-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="danger-button" type="submit">
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
