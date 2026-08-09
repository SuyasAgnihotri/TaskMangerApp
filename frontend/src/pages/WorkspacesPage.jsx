import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api, { unwrap } from '../api/client';
import Layout from '../components/Layout';

export default function WorkspacesPage() {
  const queryClient = useQueryClient();
  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => unwrap(await api.get('/workspaces')),
  });

  const createWorkspace = useMutation({
    mutationFn: async (name) =>
      unwrap(await api.post('/workspaces', { name, description: '' })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  });

  const handleCreate = () => {
    const name = prompt('Workspace name');
    if (name) createWorkspace.mutate(name);
  };

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workspaces</h1>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
        >
          New workspace
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-800" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
          No workspaces yet — create one to get started.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <Link
              key={ws.id}
              to={`/workspaces/${ws.id}`}
              className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-indigo-500/50 hover:bg-slate-800/50"
            >
              <h2 className="text-lg font-semibold">{ws.name}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {ws.member_count} member{ws.member_count !== 1 ? 's' : ''}
              </p>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
