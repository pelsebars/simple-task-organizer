import { Legend } from "./Legend";
import { goalDueState } from "../lib/model";
import { AuthPanel } from "./AuthPanel";

export function GoalSidebar({
  authMode,
  authError,
  email,
  password,
  state,
  user,
  importInputRef,
  onAuthModeChange,
  onCreateGoal,
  onEmailChange,
  onExportJson,
  onImportJson,
  onLoadCloud,
  onLogout,
  onPasswordChange,
  onResetDemo,
  onSaveCloud,
  onSelectGoal,
  onSubmitAuth,
}) {
  return (
    <aside className="goal-list" aria-label="Goals">
      <div className="brand">
        <span className="brand-mark" />
        <div>
          <h1>Task Organizer</h1>
          <p>Goal graphs</p>
        </div>
      </div>

      <AuthPanel
        authMode={authMode}
        authError={authError}
        email={email}
        password={password}
        user={user}
        onAuthModeChange={onAuthModeChange}
        onEmailChange={onEmailChange}
        onLoadCloud={onLoadCloud}
        onLogout={onLogout}
        onPasswordChange={onPasswordChange}
        onSaveCloud={onSaveCloud}
        onSubmitAuth={onSubmitAuth}
      />

      <div className="action-stack">
        <button className="primary-button" type="button" onClick={onCreateGoal}>
          Create new
        </button>
        <button className="quiet-button" type="button" onClick={onExportJson}>
          Export JSON
        </button>
        <button className="quiet-button" type="button" onClick={() => importInputRef.current?.click()}>
          Import JSON
        </button>
        <button className="quiet-button" type="button" onClick={onResetDemo}>
          Reset demo data
        </button>
        <input ref={importInputRef} className="hidden" type="file" accept="application/json" onChange={onImportJson} />
      </div>

      <div className="goal-section">
        <h2>Goals</h2>
        <div className="goal-list-items">
          {state.goals.map((goal) => {
            const root = state.nodes.find((node) => node.id === goal.rootNodeId);
            const due = goalDueState(state, goal.id);
            const warningClass = due === "soon" || due === "overdue" ? `goal-due-${due}` : "";

            return (
              <button
                className={`goal-item ${goal.id === state.currentGoalId ? "active" : ""} ${warningClass}`}
                key={goal.id}
                type="button"
                onClick={() => onSelectGoal(goal)}
              >
                <span>{root?.sortOrder}</span>
                <strong>{goal.title}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <Legend />
    </aside>
  );
}
