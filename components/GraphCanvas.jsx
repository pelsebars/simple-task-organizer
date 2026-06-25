import { formatDueDate, statusLabels } from "../lib/model";

export function GraphCanvas({ model, scale, panX, panY, selectedNodeId, onSelectNode, onZoomBy, onResetView, onWheel, onPointerDown, onPointerMove, onPointerUp }) {
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
            {model.currentNodes().map((node) => {
              const position = model.positionOf(node.id);
              const workStatus = model.workStatus(node.id);
              const due = model.dueState(node);
              const roleClass = model.roleClass(node);
              const warningClass = due === "soon" || due === "overdue" ? `due-${due}` : "";

              return (
                <button
                  className={`node ${roleClass} ${node.id === selectedNodeId ? "selected" : ""} ${warningClass}`}
                  key={node.id}
                  style={{ left: position.x, top: position.y }}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                >
                  <span className="node-title">
                    {model.treeNumber(node.id)}: {node.title}
                  </span>
                    <span className="status-stack">
                      <StatusLine label="Self" status={node.ownStatus} />
                    {workStatus ? <StatusLine label="Work" status={workStatus} /> : null}
                    </span>
                  {warningClass ? <span className="due-badge">{formatDueDate(node.dueDate)}</span> : null}
                </button>
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
