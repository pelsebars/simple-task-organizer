import { formatDueDate, statusLabels } from "../lib/model";

export function GraphCanvas({ model, scale, panX, panY, selectedNodeId, onCollapseAll, onExpandAll, onSelectNode, onToggleCollapse, onZoomBy, onResetView, onWheel, onPointerDown, onPointerMove, onPointerUp }) {
  return (
    <section className="canvas-wrap" aria-label="Goal graph">
      <div className="toolbar">
        <button type="button" onClick={() => onZoomBy(-0.1)}>
          -
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => onZoomBy(0.1)}>
          +
        </button>
        <button type="button" onClick={onResetView}>
          Reset
        </button>
        <button type="button" onClick={onCollapseAll}>
          Collapse all
        </button>
        <button type="button" onClick={onExpandAll}>
          Expand all
        </button>
      </div>

      <div
        className="canvas"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="graph-layer"
          style={{
            width: model.graphWidth,
            height: model.graphHeight,
            transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
          }}
        >
          <svg className="edge-layer" aria-hidden="true">
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 z" fill="#17378d" />
              </marker>
            </defs>
            {model.edges.map((edge) => (
              <path className={`edge edge-${edge.type}`} d={edge.path} key={`${edge.type}-${edge.source.id}-${edge.target.id}`} markerEnd="url(#arrow)" />
            ))}
          </svg>

          <div className="node-layer">
            {model.visibleNodes().map((node) => {
              const position = model.positionOf(node.id);
              const workStatus = model.workStatus(node.id);
              const due = model.dueState(node);
              const roleClass = model.roleClass(node);
              const warningClass = due === "soon" || due === "overdue" ? `due-${due}` : "";
              const canCollapse = model.canCollapse(node.id);
              const isCollapsed = model.isCollapsed(node.id);
              const hiddenCount = model.hiddenDescendantCount(node.id);

              return (
                <div
                  className={`node ${roleClass} ${node.id === selectedNodeId ? "selected" : ""} ${warningClass}`}
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  style={{ left: position.x, top: position.y }}
                  onClick={() => onSelectNode(node.id)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                    event.preventDefault();
                    onSelectNode(node.id);
                  }}
                >
                  <span className="node-title">
                    {model.treeNumber(node.id)}: {node.title}
                  </span>
                  <span className="status-stack">
                    <StatusLine label="Self" status={node.ownStatus} />
                    {workStatus ? <StatusLine label="Work" status={workStatus} /> : null}
                  </span>
                  {warningClass ? <span className="due-badge">{formatDueDate(node.dueDate)}</span> : null}
                  {canCollapse ? (
                    <button
                      className="collapse-toggle"
                      type="button"
                      aria-label={`${isCollapsed ? "Expand" : "Collapse"} children of ${node.title}`}
                      title={`${isCollapsed ? "Expand" : "Collapse"} children`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleCollapse(node.id);
                      }}
                    >
                      <span aria-hidden="true">{isCollapsed ? "+" : "-"}</span>
                      {hiddenCount ? <small>{hiddenCount} hidden</small> : null}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusLine({ label, status }) {
  return (
    <span className="status-line">
      {label} <span className={`dot status-${status.replace("_", "-")}`} title={statusLabels[status]} />
    </span>
  );
}
