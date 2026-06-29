"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmModal } from "../components/ConfirmModal";
import { CreateGoalModal } from "../components/CreateGoalModal";
import { DailyStandupPanel } from "../components/DailyStandupPanel";
import { GoalSidebar } from "../components/GoalSidebar";
import { GraphCanvas } from "../components/GraphCanvas";
import { NodeDetailPanel } from "../components/NodeDetailPanel";
import { buildGoalContext, generateBriefing } from "../lib/briefings";
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
  const [isStandupOpen, setIsStandupOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("New goal");
  const [successorLinkTargetId, setSuccessorLinkTargetId] = useState("");
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [notice, setNotice] = useState("");
  const [syncStatus, setSyncStatus] = useState("idle");
  const [briefingType, setBriefingType] = useState("status_mail");
  const [briefingText, setBriefingText] = useState("");
  const [briefingHasChanges, setBriefingHasChanges] = useState(false);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [briefingGoalId, setBriefingGoalId] = useState(null);
  const lastPointer = useRef(null);
  const importInputRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const hasLoadedCloudRef = useRef(false);
  const lastSavedJsonRef = useRef("");
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef(null);
  const savePromiseRef = useRef(null);

  useEffect(() => {
    setState(loadStoredState());
    setIsReady(true);
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!isReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [isReady, state]);

  useEffect(() => {
    if (!user) {
      hasLoadedCloudRef.current = false;
      lastSavedJsonRef.current = "";
      setSyncStatus("idle");
      return;
    }

    loadCloudState({ seedIfEmpty: true, silent: true });
  }, [user]);

  useEffect(() => {
    if (!isReady || !user || !hasLoadedCloudRef.current) return;

    const serialized = JSON.stringify(state);
    if (serialized === lastSavedJsonRef.current) return;

    window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      saveCloudState({ silent: true, stateToSave: state });
    }, 900);

    return () => window.clearTimeout(autosaveTimerRef.current);
  }, [isReady, state, user]);

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
      draft.goals.push({ id, rootNodeId: id, title, context: "", stakeholders: "" });
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

  async function submitAuth(event) {
    event.preventDefault();
    setAuthError("");

    const response = await fetch(`/api/auth/${authMode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: authEmail, password: authPassword }),
    });
    const data = await response.json();

    if (!response.ok) {
      setAuthError(data.error ?? "Authentication failed.");
      return;
    }

    setUser(data.user);
    setAuthPassword("");
  }

  async function logout() {
    window.clearTimeout(autosaveTimerRef.current);
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  async function loadCloudState({ seedIfEmpty = false, silent = false } = {}) {
    setSyncStatus("loading");
    let response;
    let data;

    try {
      response = await fetchWithTimeout("/api/state", {}, 20000);
      data = await readJsonResponse(response);
    } catch {
      setSyncStatus("error");
      if (!silent) showNotice("Could not reach cloud storage.");
      return;
    }

    if (!response.ok) {
      setSyncStatus("error");
      if (!silent) showNotice(data.error ?? "Could not load cloud data.");
      return;
    }

    if (!data.state?.goals?.length) {
      hasLoadedCloudRef.current = true;
      if (seedIfEmpty) {
        await saveCloudState({ silent: true, stateToSave: state });
        return;
      }
      setSyncStatus("idle");
      if (!silent) showNotice("No cloud data saved yet.");
      return;
    }

    const serialized = JSON.stringify(data.state);
    lastSavedJsonRef.current = serialized;
    hasLoadedCloudRef.current = true;
    setState(data.state);
    setSyncStatus("saved");
    if (!silent) showNotice("Loaded cloud data.");
  }

  async function saveCloudState({ silent = false, stateToSave = state } = {}) {
    pendingSaveRef.current = { silent, state: structuredClone(stateToSave) };
    if (saveInFlightRef.current) return savePromiseRef.current;

    saveInFlightRef.current = true;
    savePromiseRef.current = (async () => {
      try {
        while (pendingSaveRef.current) {
          const pending = pendingSaveRef.current;
          pendingSaveRef.current = null;
          setSyncStatus("saving");

          try {
            const response = await fetchWithTimeout(
              "/api/state",
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: pending.state }),
              },
              25000,
            );
            const data = await readJsonResponse(response);

            if (!response.ok) throw new Error(data.error ?? "Could not save cloud data.");

            lastSavedJsonRef.current = JSON.stringify(pending.state);
            hasLoadedCloudRef.current = true;
            if (!pending.silent) showNotice("Saved to cloud.");
          } catch (error) {
            setSyncStatus("error");
            if (!pending.silent) showNotice(error.message ?? "Could not save cloud data.");
            return;
          }
        }

        setSyncStatus("saved");
      } finally {
        saveInFlightRef.current = false;
        savePromiseRef.current = null;
      }
    })();

    return savePromiseRef.current;
  }

  function deleteCurrentGoal() {
    if (state.goals.length <= 1) {
      showNotice("Keep at least one goal.");
      return;
    }

    const goal = state.goals.find((item) => item.id === state.currentGoalId);
    if (!goal) return;
    setConfirmRequest({
      kind: "delete-goal",
      id: goal.id,
      title: "Delete Goal",
      message: `Delete "${goal.title}" and all its nodes?`,
      confirmLabel: "Delete",
    });
  }

  function confirmDeleteCurrentGoal(goalId) {
    const goal = state.goals.find((item) => item.id === goalId);
    if (!goal) return;

    patchState((draft) => {
      const nextGoal = draft.goals.find((item) => item.id !== goal.id);
      draft.goals = draft.goals.filter((item) => item.id !== goal.id);
      draft.nodes = draft.nodes.filter((node) => node.goalId !== goal.id);
      draft.successors = draft.successors.filter((edge) => edge.goalId !== goal.id);
      draft.currentGoalId = nextGoal.id;
      draft.selectedNodeId = nextGoal.rootNodeId;
      resequenceRootGoals(draft);
    });
    showNotice("Goal deleted.");
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
    setConfirmRequest({
      kind: "delete-node",
      id: selectedNode.id,
      title: "Delete Node",
      message: `Delete "${selectedNode.title}" and all children?`,
      confirmLabel: "Delete",
    });
  }

  function confirmDeleteSelectedNode(nodeId) {
    const node = state.nodes.find((item) => item.id === nodeId);
    if (!node || node.kind === "goal") return;

    patchState((draft) => {
      const doomed = descendantsOf(draft, nodeId);
      doomed.add(nodeId);
      draft.nodes = draft.nodes.filter((node) => !doomed.has(node.id));
      draft.successors = draft.successors.filter((edge) => !doomed.has(edge.sourceId) && !doomed.has(edge.targetId));
      draft.selectedNodeId = node.parentId;
      resequenceChildren(draft, node.parentId);
    });
    showNotice("Node deleted.");
  }

  function resetDemo() {
    setConfirmRequest({
      kind: "reset-demo",
      title: "Reset Demo Data",
      message: "Reset local prototype data?",
      confirmLabel: "Reset",
    });
  }

  function confirmAction() {
    if (!confirmRequest) return;

    if (confirmRequest.kind === "delete-goal") confirmDeleteCurrentGoal(confirmRequest.id);
    if (confirmRequest.kind === "delete-node") confirmDeleteSelectedNode(confirmRequest.id);
    if (confirmRequest.kind === "reset-demo") {
      setState(sampleState());
      showNotice("Demo data reset.");
    }

    setConfirmRequest(null);
  }

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => {
      setNotice((current) => (current === message ? "" : current));
    }, 3200);
  }

  async function generateCurrentBriefing() {
    setIsGeneratingBriefing(true);
    const context = buildGoalContext(state, state.currentGoalId);

    try {
      if (briefingType === "status_mail" && user) {
        await saveCloudState({ silent: true, stateToSave: state });
        const response = await fetch(`/api/updates?goalId=${encodeURIComponent(state.currentGoalId)}`);
        const data = await readJsonResponse(response);
        if (!response.ok) throw new Error(data.error ?? "Could not load update history.");
        context.changes = data.changes;
        context.changesSince = data.since;
        setBriefingHasChanges(data.changes.length > 0);
      } else {
        setBriefingHasChanges(false);
      }

      setBriefingText(generateBriefing(context, briefingType));
      setBriefingGoalId(state.currentGoalId);
    } catch (error) {
      showNotice(error.message ?? "Could not generate briefing.");
    } finally {
      setIsGeneratingBriefing(false);
    }
  }

  async function markBriefingShared() {
    if (!briefingGoalId) return;
    const response = await fetch("/api/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId: briefingGoalId }),
    });
    const data = await readJsonResponse(response);

    if (!response.ok) {
      showNotice(data.error ?? "Could not mark update as shared.");
      return;
    }

    setBriefingHasChanges(false);
    showNotice("Stakeholder update marked as shared.");
  }

  async function copyBriefing() {
    if (!briefingText) return;
    await navigator.clipboard.writeText(briefingText);
    showNotice("Briefing copied.");
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
        showNotice("Could not import that JSON file.");
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
        authMode={authMode}
        authError={authError}
        briefingHasChanges={briefingHasChanges}
        briefingText={briefingText}
        briefingType={briefingType}
        isGeneratingBriefing={isGeneratingBriefing}
        email={authEmail}
        password={authPassword}
        state={state}
        syncStatus={syncStatus}
        user={user}
        importInputRef={importInputRef}
        onAuthModeChange={setAuthMode}
        onBriefingTypeChange={(type) => {
          setBriefingType(type);
          setBriefingText("");
          setBriefingHasChanges(false);
          setBriefingGoalId(null);
        }}
        onCopyBriefing={copyBriefing}
        onCreateGoal={() => setIsCreateGoalOpen(true)}
        onEmailChange={setAuthEmail}
        onExportJson={exportJson}
        onImportJson={importJson}
        onLogout={logout}
        onPasswordChange={setAuthPassword}
        onGenerateBriefing={generateCurrentBriefing}
        onMarkBriefingShared={markBriefingShared}
        onOpenStandup={() => setIsStandupOpen(true)}
        onResetDemo={resetDemo}
        onSelectGoal={(goal) => {
          patchState((draft) => {
            draft.currentGoalId = goal.id;
            draft.selectedNodeId = goal.rootNodeId;
          });
          setBriefingText("");
          setBriefingHasChanges(false);
          setBriefingGoalId(null);
        }}
        onSubmitAuth={submitAuth}
        onSyncNow={() => saveCloudState({ silent: false })}
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

      {isStandupOpen ? (
        <DailyStandupPanel
          state={state}
          onClose={() => setIsStandupOpen(false)}
          onSelectTask={(task) => {
            patchState((draft) => {
              draft.currentGoalId = task.goalId;
              draft.selectedNodeId = task.id;
            });
            setIsStandupOpen(false);
          }}
        />
      ) : null}

      <NodeDetailPanel
        model={model}
        selectedNode={selectedNode}
        selectedGoal={state.goals.find((goal) => goal.id === selectedNode?.goalId)}
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
        onUpdateGoal={(patch) =>
          patchState((draft) => {
            const goal = draft.goals.find((item) => item.id === selectedNode?.goalId);
            if (goal) Object.assign(goal, patch);
          })
        }
      />

      {isCreateGoalOpen ? (
        <CreateGoalModal title={newGoalTitle} onClose={() => setIsCreateGoalOpen(false)} onSubmit={createGoal} onTitleChange={setNewGoalTitle} />
      ) : null}

      {confirmRequest ? (
        <ConfirmModal
          confirmLabel={confirmRequest.confirmLabel}
          message={confirmRequest.message}
          onCancel={() => setConfirmRequest(null)}
          onConfirm={confirmAction}
          title={confirmRequest.title}
        />
      ) : null}

      {notice ? <div className="notice">{notice}</div> : null}
    </main>
  );
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: `Cloud storage returned an invalid response (${response.status}).` };
  }
}
