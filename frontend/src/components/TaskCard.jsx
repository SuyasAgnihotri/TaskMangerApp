const PRIORITY_COLORS = {
  low: 'bg-slate-600',
  medium: 'bg-blue-600',
  high: 'bg-amber-600',
  urgent: 'bg-red-600',
};

export default function TaskCard({ task, onClick }) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-3 shadow-sm transition hover:border-indigo-500/50"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-snug">{task.title}</h4>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}
        >
          {task.priority}
        </span>
      </div>
      {task.due_date && (
        <p className="mt-2 text-xs text-slate-400">Due {task.due_date}</p>
      )}
      {task.assignees?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.assignees.map((a) => (
            <span
              key={a.id}
              className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300"
            >
              {a.user.first_name || a.user.email.split('@')[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
