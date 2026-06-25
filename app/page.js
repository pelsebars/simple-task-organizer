"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CreateGoalModal } from "../components/CreateGoalModal";
import { GoalSidebar } from "../components/GoalSidebar";
import { GraphCanvas } from "../components/GraphCanvas";
import { NodeDetailPanel } from "../components/NodeDetailPanel";
import {
  clamp,
  createModel,
  descendantsOf,
  ensureSelection,
  newNode,
  resequenceChildren,
  resequenceRootGoals,
  wouldCreateSuccessorCycle,
} from "../lib/model";
import { fallbackId, makeNode, sampleState, STORAGE_KEY } from "../lib/sampleData";

function loadStoredState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (saved?.nodes?.length && saved?.goals?.length) return saved;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return sampleState();
}

export default function Home() {
  const [state, setState] = useState(sampleState);
  const [isReady, setIsReady] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isCreateGoalOpen, setIsCreateGoalOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("New goal");
  const [successorLinkTargetId, setSuccessorLinkTargetId] = useState("");
  const lastPointer = useRef(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    setState(loadStoredState());
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [isReady, state]);

  const model = useMemo(() => createModel(state), [state]);
  const selectedNode = model.selectedNode();
  const successorOptions = selectedNode ? model.successorOptions(selectedNode.id) : [];
  const outgoingSuccessors = selectedNode ? model.outgoingSuccessors(selectedNode.id) : [];

  function patchState(updater) {
    setState((current) => {
      const next = structuredClone(current);
      updater(next);
      ensureSelection(next);
      return next;
    });
  }

  function updateSelectedNode(patch) {
    patchState((draft) => {
      const node = draft.nodes.find((item) => item.id === draft.selectedNodeId);
      if (!node) return;
      Object.assign(node, patch);

      if (node.kind === "goal") {
        const goal = draft.goals.find((item) => item.id === node.goalId);
        if (goal) goal.title = node.title;
      }
    });
  }

  function createGoal() {
    const title = newGoalTitle.trim();
    if (!title) return;

    patchState((draft) => {
      const id = fallbackId();
      const publicId = draft.goals.length + 1;
      draft.goals.push({ id, rootNodeId: id, title });
      draft.nodes.push(makeNode(id, publicId, null, title, "not_started", "", "", publicId, id, "goal"));
      draft.currentGoalId = id;
      draft.selectedNodeId = id;
      draft.scale = 1;
      draft.panX = 30;
      draft.panY = 30;
    });
    setNewGoalTitle("New goal");
    setIsCreateGoalOpen(false);
  }

  function deleteCurrentGoal() {
    if (state.goals.length <= 1) {
      window.alert("Keep at least one goal.");
      return;
    }

    const goal = state.goals.find((item) => item.id === state.currentGoalId);
    if (!goal || !window.confirm(`Delete goal "${goal.title}" and all its nodes?`)) return;

    patchState((draft) => {
      const nextGoal = draft.goals.find((item) => item.id !== goal.id);
      draft.goals = draft.goals.filter((item) => item.id !== goal.id);
      draft.nodes = draft.nodes.filter((node) => node.goalId !== goal.id);
      draft.successors = draft.successors.filter((edge) => edge.goalId !== goal.id);
      draft.currentGoalId = nextGoal.id;
      draft.selectedNodeId = nextGoal.rootNodeId;
      resequenceRootGoals(draft);
    });
  }

  function addChild() {
    if (!selectedNode) return;

    patchState((draft) => {
      const parent = draft.nodes.find((node) => node.id === draft.selectedNodeId);
      const node = newNode(draft, parent.id, "New task");
      draft.nodes.push(node);
      draft.selectedNodeId = node.id;
    });
  }

  function addSuccessor() {
    if (!selectedNode || selectedNode.kind === "goal") return;

    patchState((draft) => {
      const source = draft.nodes.find((node) => node.id === draft.selectedNodeId);
      const node = newNode(draft, source.parentId, "Next step");
      draft.nodes.push(node);
      draft.successors.push({ sourceId: source.id, targetId: node.id, goalId: source.goalId });
      draft.selectedNodeId = node.id;
    });
  }

  function linkExistingSuccessor() {
    if (!selectedNode || !successorLinkTargetId) return;

    patchState((draft) => {
      const source = draft.nodes.find((node) => node.id === draft.selectedNodeId);
      const target = draft.nodes.find((node) => node.id === successorLinkTargetId);
      if (!source || !target || source.kind === "goal" || source.parentId !== target.parentId) return;
      const exists = draft.successors.some((edge) => edge.sourceId === source.id && edge.targetId === target.id);
      if (wouldCreateSuccessorCycle(draft, source.id, target.id)) return;
      if (!exists) draft.successors.push({ sourceId: source.id, targetId: target.id, goalId: source.goalId });
    });
    setSuccessorLinkTargetId("");
  }

  function removeSuccessor(targetId) {
    if (!selectedNode) return;

    patchState((draft) => {
      draft.successors = draft.successors.filter((edge) => edge.sourceId !== selectedNode.id || edge.targetId !== targetId);
    });
  }

  function deleteSelectedNode() {
    if (!selectedNode || selectedNode.kind === "goal") return;
    if (!window.confirm(`Delete "${selectedNode.title}" and all children?`)) return;

    patchState((draft) => {
      const doomed = descendantsOf(draft, draft.selectedNodeId);
      doomed.add(draft.selectedNodeId);
      draft.nodes = draft.nodes.filter((node) => !doomed.has(node.id));
      draft.successors = draft.successors.filter((edge) => !doomed.has(edge.sourceId) && !doomed.has(edge.targetId));
      draft.selectedNodeId = selectedNode.parentId;
      resequenceChildren(draft, selectedNode.parentId);
    });
  }

  function resetDemo() {
    if (!window.confirm("Reset local prototype data?")) return;
    setState(sampleState());
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "simple-task-organizer-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importJson(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!imported.nodes?.length || !imported.goals?.length) throw new Error("Invalid export");
        setState(imported);
      } catch {
        window.alert("Could not import that JSON file.");
      }
    };
    reader.readAsText(file);
  }

  function zoomBy(delta) {
    patchState((draft) => {
      draft.scale = clamp(draft.scale + delta, 0.35, 2);
    });
  }

  function resetView() {
    patchState((draft) => {
      draft.scale = 1;
      draft.panX = 30;
      draft.panY = 30;
    });
  }

  function onWheel(event) {
    event.preventDefault();
    patchState((draft) => {
      draft.scale = clamp(draft.scale - event.deltaY * 0.001, 0.35, 2);
    });
  }

  function onPointerDown(event) {
    if (event.button !== 2) return;
    setIsPanning(true);
    lastPointer.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!isPanning || !lastPointer.current) return;
    const previous = lastPointer.current;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    lastPointer.current = { x: event.clientX, y: event.clientY };

    patchState((draft) => {
      draft.panX += dx;
      draft.panY += dy;
    });
  }

  function onPointerUp() {
    setIsPanning(false);
    lastPointer.current = null;
  }

  return (
    <main className="app-shell">
      <GoalSidebar
        state={state}
        importInputRef={importInputRef}
        onCreateGoal={() => setIsCreateGoalOpen(true)}
        onExportJson={exportJson}
        onImportJson={importJson}
        onResetDemo={resetDemo}
        onSelectGoal={(goal) =>
          patchState((draft) => {
            draft.currentGoalId = goal.id;
            draft.selectedNodeId = goal.rootNodeId;
          })
        }
      />

      <GraphCanvas
        model={model}
        scale={state.scale}
        panX={state.panX}
        panY={state.panY}
        selectedNodeId={state.selectedNodeId}
        onSelectNode={(nodeId) =>
          patchState((draft) => {
            draft.selectedNodeId = nodeId;
          })
        }
        onZoomBy={zoomBy}
        onResetView={resetView}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      <NodeDetailPanel
        model={model}
        selectedNode={selectedNode}
        goalCount={state.goals.length}
        successorLinkTargetId={successorLinkTargetId}
        successorOptions={successorOptions}
        outgoingSuccessors={outgoingSuccessors}
        onAddChild={addChild}
        onAddSuccessor={addSuccessor}
        onDeleteGoal={deleteCurrentGoal}
        onDeleteNode={deleteSelectedNode}
        onLinkExistingSuccessor={linkExistingSuccessor}
        onRemoveSuccessor={removeSuccessor}
        onSetSuccessorLinkTargetId={setSuccessorLinkTargetId}
        onUpdateNode={updateSelectedNode}
      />

      {isCreateGoalOpen ? (
        <CreateGoalModal title={newGoalTitle} onClose={() => setIsCreateGoalOpen(false)} onSubmit={createGoal} onTitleChange={setNewGoalTitle} />
      ) : null}
    </main>
  );
}
