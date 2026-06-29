import { Legend } from "./Legend";
import { goalDueState } from "../lib/model";
import { AuthPanel } from "./AuthPanel";
import { BriefingPanel } from "./BriefingPanel";

export function GoalSidebar({
  authMode,
  authError,
  briefingText,
  briefingType,
  email,
  password,
  state,
  syncStatus,
  user,
  importInputRef,
  onAuthModeChange,
  onBriefingTypeChange,
  onCopyBriefing,
  onCreateGoal,
  onEmailChange,
  onExportJson,
  onImportJson,
  onLogout,
  onPasswordChange,
  onGenerateBriefing,
  onOpenStandup,
  onResetDemo,
  onSelectGoal,
  onSubmitAuth,
  onSyncNow,
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
        syncStatus={syncStatus}
        user={user}
        onAuthModeChange={onAuthModeChange}
        onEmailChange={onEmailChange}
        onLogout={onLogout}
        onPasswordChange={onPasswordChange}
        onSubmitAuth={onSubmitAuth}
        onSyncNow={onSyncNow}
      />

      <div className="action-stack">
        <button className="standup-button" type="button" onClick={onOpenStandup}>
          Daily standup
        </button>
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

      <BriefingPanel
        briefingText={briefingText}
        briefingType={briefingType}
        onBriefingTypeChange={onBriefingTypeChange}
        onCopy={onCopyBriefing}
        onGenerate={onGenerateBriefing}
      />

      <Legend />
    </aside>
  );
}
