import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import api, { unwrap } from '../api/client';
import Layout from '../components/Layout';

export default function WorkspaceDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ['workspace', id],
    queryFn: async () => unwrap(await api.get(`/workspaces/${id}`)),
  });

  const { data: projects = [], isLoading: projLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: async () => unwrap(await api.get(`/workspaces/${id}/projects`)),
  });

  const createProject = useMutation({
    mutationFn: async (name) =>
      unwrap(await api.post(`/workspaces/${id}/projects`, { name, description: '' })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', id] }),
  });

  const handleCreate = () => {
    const name = prompt('Project name');
    if (name) createProject.mutate(name);
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
        <Link to="/workspaces" className="text-sm text-slate-400 hover:text-indigo-400">
          ← Back to workspaces
        </Link>
      </div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{workspace?.name}</h1>
          <p className="text-slate-400">{workspace?.description || 'No description'}</p>
        </div>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
        >
          New project
        </button>
      </div>

      {projLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-800" />
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
              <p className="mt-1 text-sm text-slate-400">{project.description || 'Open board →'}</p>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
