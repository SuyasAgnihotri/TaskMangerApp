import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import api, { unwrap } from '../api/client';

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

export default function TaskModal({ taskId, onClose }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [savedMsg, setSavedMsg] = useState(false);

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

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'medium');
      setDueDate(task.due_date || '');
    }
  }, [task]);

  const updateTask = useMutation({
    mutationFn: async (fields) => unwrap(await api.patch(`/tasks/${taskId}`, fields)),
    onSuccess: (updated) => {
      queryClient.setQueryData(['task', taskId], updated);
      queryClient.invalidateQueries({ queryKey: ['board'] });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 1200);
    },
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

  const saveField = (fields) => {
    updateTask.mutate(fields);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          {isLoading ? (
            <h2 className="text-xl font-bold">Loading...</h2>
          ) : (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title.trim() && title !== task?.title) saveField({ title: title.trim() });
              }}
              className="w-full bg-transparent text-xl font-bold outline-none focus:border-b focus:border-indigo-500"
            />
          )}
          <div className="flex items-center gap-2">
            {savedMsg && <span className="text-xs text-emerald-400">Saved</span>}
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        </div>

        {task && (
          <>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if (description !== task.description) saveField({ description });
              }}
              placeholder="Add a description..."
              rows={3}
              className="mb-4 w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-500"
            />

            <div className="mb-6 flex flex-wrap gap-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase text-slate-500">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value);
                    saveField({ priority: e.target.value });
                  }}
                  className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase text-slate-500">Due date</label>
                <input
                  type="date"
                  value={dueDate || ''}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    saveField({ due_date: e.target.value || null });
                  }}
                  className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none"
                />
              </div>
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