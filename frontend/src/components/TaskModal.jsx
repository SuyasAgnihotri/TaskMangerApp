import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api, { unwrap } from '../api/client';

export default function TaskModal({ taskId, onClose }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => unwrap(await api.get(`/tasks/${taskId}`)),
    enabled: !!taskId,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', taskId],
    queryFn: async () => unwrap(await api.get(`/tasks/${taskId}/comments`)),
    enabled: !!taskId,
  });

  const addComment = useMutation({
    mutationFn: async (content) =>
      unwrap(await api.post(`/tasks/${taskId}/comments`, { content })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      setComment('');
    },
  });

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-xl font-bold">{isLoading ? 'Loading...' : task?.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {task && (
          <>
            <p className="mb-4 text-sm text-slate-300">{task.description || 'No description'}</p>
            <div className="mb-6 flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="rounded bg-slate-800 px-2 py-1">Priority: {task.priority}</span>
              {task.due_date && (
                <span className="rounded bg-slate-800 px-2 py-1">Due: {task.due_date}</span>
              )}
            </div>

            <h3 className="mb-3 font-semibold">Comments</h3>
            <div className="mb-4 space-y-3">
              {comments.length === 0 ? (
                <p className="text-sm text-slate-500">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-slate-800 p-3">
                    <p className="text-xs text-indigo-400">{c.author.email}</p>
                    <p className="mt-1 text-sm">{c.content}</p>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (comment.trim()) addComment.mutate(comment.trim());
              }}
              className="flex gap-2"
            >
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500"
              >
                Post
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
