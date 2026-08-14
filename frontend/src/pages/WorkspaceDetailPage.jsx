import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { unwrap, unwrapError } from "../api/client";
import Layout from "../components/Layout";

export default function WorkspaceDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteError, setInviteError] = useState(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState(null);

  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ["workspace", id],
    queryFn: async () => unwrap(await api.get(`/workspaces/${id}`)),
  });

  useEffect(() => {
    if (workspace) setNameDraft(workspace.name || "");
  }, [workspace]);

  const { data: projects = [], isLoading: projLoading } = useQuery({
    queryKey: ["projects", id],
    queryFn: async () => unwrap(await api.get(`/workspaces/${id}/projects`)),
  });

  const createProject = useMutation({
    mutationFn: async (name) =>
      unwrap(
        await api.post(`/workspaces/${id}/projects`, { name, description: "" }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["projects", id] }),
  });

  const inviteMember = useMutation({
    mutationFn: async ({ email, role }) =>
      unwrap(await api.post(`/workspaces/${id}/invite`, { email, role })),
    onSuccess: () => {
      setShowInvite(false);
      setInviteEmail("");
      setInviteRole("member");
      setInviteError(null);
      queryClient.invalidateQueries({ queryKey: ["workspace", id] });
    },
    onError: (err) => {
      setInviteError(unwrapError(err).detail || "Could not invite member");
    },
  });

  const renameWorkspace = useMutation({
    mutationFn: async (name) =>
      unwrap(await api.patch(`/workspaces/${id}`, { name })),
    onSuccess: (updated) => {
      queryClient.setQueryData(["workspace", id], updated);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setEditingName(false);
      setNameError(null);
    },
    onError: (err) => {
      setNameError(unwrapError(err).detail || "Could not rename workspace");
    },
  });

  const handleCreate = () => {
    const name = prompt("Project name");
    if (name) createProject.mutate(name);
  };

  const handleInviteSubmit = (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMember.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  const handleNameSave = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setEditingName(false);
      setNameDraft(workspace?.name || "");
      return;
    }
    if (trimmed === workspace?.name) {
      setEditingName(false);
      return;
    }
    renameWorkspace.mutate(trimmed);
  };

  if (wsLoading) {
    return (
      <Layout>
        <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-2">
        <Link
          to="/workspaces"
          className="text-sm text-slate-400 hover:text-indigo-400"
        >
          ← Back to workspaces
        </Link>
      </div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          {editingName ? (
            <div>
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setNameDraft(workspace?.name || "");
                    setEditingName(false);
                  }
                }}
                className="w-full max-w-sm bg-transparent text-2xl font-bold outline-none border-b border-indigo-500"
              />
              {nameError && (
                <p className="mt-1 text-xs text-red-400">{nameError}</p>
              )}
            </div>
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              className="cursor-text text-2xl font-bold hover:text-indigo-400"
              title="Click to rename"
            >
              {workspace?.name}
            </h1>
          )}
          <p className="text-slate-400">
            {workspace?.description || "No description"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInvite(true)}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:border-indigo-500 hover:text-indigo-400"
          >
            Invite member
          </button>
          <button
            onClick={handleCreate}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
          >
            New project
          </button>
        </div>
      </div>

      {projLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-slate-800"
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
          No projects yet — create one to open a board.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}/board`}
              className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-indigo-500/50"
            >
              <h2 className="text-lg font-semibold">{project.name}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {project.description || "Open board →"}
              </p>
            </Link>
          ))}
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-4 text-lg font-semibold">Invite member</h2>
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Email
                </label>
                <input
                  type="email"
                  autoFocus
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {inviteError && (
                <p className="text-xs text-red-400">{inviteError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInvite(false);
                    setInviteError(null);
                  }}
                  className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteMember.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
                >
                  {inviteMember.isPending ? "Inviting..." : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
