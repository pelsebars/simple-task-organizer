import { buildDailyStandup } from "../lib/standup";

export function DailyStandupPanel({ state, onClose, onSelectTask }) {
  const standup = buildDailyStandup(state);

  return (
    <div className="standup-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="standup-panel" role="dialog" aria-modal="true" aria-labelledby="standup-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="standup-header">
          <div>
            <p className="standup-date">{formatToday()}</p>
            <h2 id="standup-title">Daily standup</h2>
          </div>
          <button className="standup-close" type="button" aria-label="Close daily standup" title="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="standup-summary" aria-label="Standup totals">
          <SummaryValue value={standup.urgentCount} label="Due soon" tone="urgent" />
          <SummaryValue value={standup.ongoingCount} label="In progress" tone="ongoing" />
          <SummaryValue value={standup.notStartedCount} label="Not started" />
        </div>

        <div className="standup-content">
          {standup.goals.length ? (
            standup.goals.map((item) => (
              <article className="standup-goal" key={item.goal.id}>
                <div className="standup-goal-heading">
                  <h3>{item.goal.title}</h3>
                  <span>{item.openCount} open</span>
                </div>
                <TaskGroup title="Critical now" tasks={item.urgent} tone="urgent" onSelectTask={onSelectTask} />
                <TaskGroup title="In progress" tasks={item.ongoing} tone="ongoing" onSelectTask={onSelectTask} />
                <TaskGroup title="Not started" tasks={item.notStarted} onSelectTask={onSelectTask} />
              </article>
            ))
          ) : (
            <p className="standup-empty">Everything is done. Nothing needs attention today.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryValue({ value, label, tone = "neutral" }) {
  return (
    <div className={`standup-summary-item standup-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function TaskGroup({ title, tasks, tone = "neutral", onSelectTask }) {
  if (!tasks.length) return null;

  return (
    <section className="standup-group">
      <h4>{title}</h4>
      <div className="standup-tasks">
        {tasks.map((task) => (
          <button className={`standup-task standup-task-${tone}`} key={task.id} type="button" onClick={() => onSelectTask(task)}>
            <span className={`standup-status status-${task.ownStatus.replace("_", "-")}`} aria-hidden="true" />
            <span className="standup-task-name">
              <small>{task.number}</small>
              <strong>{task.title}</strong>
            </span>
            <span className="standup-due">{formatDueDate(task)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function formatDueDate(task) {
  if (!task.dueDate) return "No due date";
  if (task.dueState === "overdue") return `Due ${formatDate(task.dueDate)}`;
  if (task.dueState === "soon") return `Due soon · ${formatDate(task.dueDate)}`;
  return formatDate(task.dueDate);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00`));
}

function formatToday() {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}
