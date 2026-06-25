export function Legend() {
  return (
    <>
      <div className="legend">
        <h2>Status</h2>
        <p>
          <span className="dot status-not-started" /> Not started
        </p>
        <p>
          <span className="dot status-ongoing" /> Ongoing
        </p>
        <p>
          <span className="dot status-done" /> Done
        </p>
      </div>

      <div className="legend">
        <h2>Node type</h2>
        <p>
          <span className="swatch swatch-child" /> Work stream
        </p>
        <p>
          <span className="swatch swatch-successor" /> Successor
        </p>
      </div>

      <div className="legend">
        <h2>Due date</h2>
        <p>
          <span className="swatch swatch-soon" /> Due in 1-2 days
        </p>
        <p>
          <span className="swatch swatch-overdue" /> Due today or late
        </p>
      </div>
    </>
  );
}
