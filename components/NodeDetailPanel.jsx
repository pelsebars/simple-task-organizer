export function NodeDetailPanel({
  model,
  selectedNode,
  selectedGoal,
  goalCount,
  moveMode,
  moveOptions,
  movePreview,
  moveTargetId,
  successorLinkTargetId,
  successorOptions,
  outgoingSuccessors,
  onAddChild,
  onAddSuccessor,
  onDeleteGoal,
  onDeleteNode,
  onLinkExistingSuccessor,
  onMoveModeChange,
  onMoveNode,
  onMoveTargetChange,
  onRemoveSuccessor,
  onSetSuccessorLinkTargetId,
  onUpdateGoal,
  onUpdateNode,
}) {
  const workRollupNodes = selectedNode ? model.workItemsOf(selectedNode.id) : [];
  const workRollupStatus = selectedNode ? model.workStatus(selectedNode.id) : null;

  return (
    <aside className="detail-panel" aria-label="Node details">
      {!selectedNode ? (
        <div className="empty-state">
          <h2>Select a node</h2>
          <p>Click a node to edit status, due date, and conclusion.</p>
        </div>
      ) : (
        <form className="node-form">
          <div>
            <p className="overline">Node {model.treeNumber(selectedNode.id)}</p>
            <label htmlFor="nodeTitle">Name</label>
            <input id="nodeTitle" type="text" value={selectedNode.title} onChange={(event) => onUpdateNode({ title: event.target.value })} />
          </div>

          <div className="meta-grid">
            <div>
              <span>Unique ID</span>
              <strong>{selectedNode.publicId}</strong>
            </div>
            <div>
              <span>Work items</span>
              <strong>{workRollupNodes.length}</strong>
            </div>
          </div>

          {workRollupNodes.length > 0 ? (
            <section className="relation-section">
              <h2>Work Rollup</h2>
              <p className="muted-copy">Status: {workRollupStatus}</p>
              {workRollupNodes.map((node) => (
                <div className="relation-row" key={node.id}>
                  <span>
                    {model.treeNumber(node.id)}: {node.title}
                  </span>
                  <strong>{model.displayStatus(node.id)}</strong>
                </div>
              ))}
            </section>
          ) : null}

          <div>
            <label htmlFor="ownStatus">Self status</label>
            <select id="ownStatus" value={selectedNode.ownStatus} onChange={(event) => onUpdateNode({ ownStatus: event.target.value })}>
              <option value="not_started">Not started</option>
              <option value="ongoing">Ongoing</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div>
            <label htmlFor="dueDate">Due date</label>
            <input id="dueDate" type="date" value={selectedNode.dueDate} onChange={(event) => onUpdateNode({ dueDate: event.target.value })} />
          </div>

          <div>
            <label htmlFor="conclusion">Conclusion</label>
            <textarea id="conclusion" rows={7} value={selectedNode.conclusion} onChange={(event) => onUpdateNode({ conclusion: event.target.value })} />
          </div>

          {selectedNode.kind === "goal" ? (
            <>
              <div>
                <label htmlFor="goalContext">Project context</label>
                <textarea
                  id="goalContext"
                  rows={7}
                  value={selectedGoal?.context ?? ""}
                  onChange={(event) => onUpdateGoal({ context: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor="stakeholders">Stakeholders</label>
                <textarea
                  id="stakeholders"
                  rows={7}
                  value={selectedGoal?.stakeholders ?? ""}
                  onChange={(event) => onUpdateGoal({ stakeholders: event.target.value })}
                />
              </div>
            </>
          ) : null}

          <div className="button-row">
            <button className="secondary-button" type="button" onClick={onAddChild}>
              Add child
            </button>
            <button className="secondary-button" type="button" disabled={selectedNode.kind === "goal"} onClick={onAddSuccessor}>
              Add successor
            </button>
          </div>

          {selectedNode.kind !== "goal" ? (
            <section className="relation-section move-section">
              <h2>Move node</h2>
              <div className="move-controls">
                <label htmlFor="moveMode">Move</label>
                <select id="moveMode" value={moveMode} onChange={(event) => onMoveModeChange(event.target.value)}>
                  <option value="into">Into</option>
                  <option value="after">After</option>
                </select>
                <label htmlFor="moveTarget">Destination</label>
                <select id="moveTarget" value={moveTargetId} onChange={(event) => onMoveTargetChange(event.target.value)}>
                  <option value="">Select node...</option>
                  {moveOptions.map((node) => (
                    <option key={node.id} value={node.id}>
                      {model.treeNumber(node.id)}: {node.title}
                    </option>
                  ))}
                </select>
              </div>
              {movePreview ? <p className="move-preview">{movePreview}</p> : null}
              <button className="secondary-button" type="button" disabled={!moveTargetId} onClick={onMoveNode}>
                Move node
              </button>
            </section>
          ) : null}

          <button className="danger-button" type="button" disabled={selectedNode.kind === "goal"} onClick={onDeleteNode}>
            Delete node
          </button>

          {selectedNode.kind === "goal" ? (
            <button className="danger-button" type="button" disabled={goalCount <= 1} onClick={onDeleteGoal}>
              Delete goal
            </button>
          ) : (
            <section className="relation-section">
              <h2>Successors</h2>
              {outgoingSuccessors.length === 0 ? <p className="muted-copy">No outgoing successors.</p> : null}
              {outgoingSuccessors.map((node) => (
                <div className="relation-row" key={node.id}>
                  <span>
                    {model.treeNumber(node.id)}: {node.title}
                  </span>
                  <button type="button" onClick={() => onRemoveSuccessor(node.id)}>
                    Remove
                  </button>
                </div>
              ))}

              <div className="inline-control">
                <select value={successorLinkTargetId} onChange={(event) => onSetSuccessorLinkTargetId(event.target.value)}>
                  <option value="">Link existing sibling...</option>
                  {successorOptions.map((node) => (
                    <option key={node.id} value={node.id}>
                      {model.treeNumber(node.id)}: {node.title}
                    </option>
                  ))}
                </select>
                <button className="secondary-button" type="button" disabled={!successorLinkTargetId} onClick={onLinkExistingSuccessor}>
                  Link
                </button>
              </div>
            </section>
          )}
        </form>
      )}
    </aside>
  );
}
