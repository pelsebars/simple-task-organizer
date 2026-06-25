export function AuthPanel({ authMode, authError, email, password, user, onAuthModeChange, onEmailChange, onLoadCloud, onLogout, onPasswordChange, onSaveCloud, onSubmitAuth }) {
  if (user) {
    return (
      <div className="auth-panel">
        <p className="auth-user">{user.email}</p>
        <div className="auth-actions">
          <button className="quiet-button" type="button" onClick={onLoadCloud}>
            Load cloud
          </button>
          <button className="quiet-button" type="button" onClick={onSaveCloud}>
            Save cloud
          </button>
          <button className="quiet-button" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="auth-panel" onSubmit={onSubmitAuth}>
      <div className="auth-mode">
        <button className={authMode === "login" ? "active" : ""} type="button" onClick={() => onAuthModeChange("login")}>
          Login
        </button>
        <button className={authMode === "signup" ? "active" : ""} type="button" onClick={() => onAuthModeChange("signup")}>
          Create
        </button>
      </div>
      <input aria-label="Email" placeholder="Email" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} />
      <input aria-label="Password" placeholder="Password" type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} />
      {authError ? <p className="auth-error">{authError}</p> : null}
      <button className="primary-button" type="submit">
        {authMode === "login" ? "Login" : "Create account"}
      </button>
    </form>
  );
}
