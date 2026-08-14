import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { unwrap } from '../api/client';
import Layout from '../components/Layout';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

function SortableTask({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `task-${task.id}`, data: { task, type: 'task' } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onClick={onClick} />
    </div>
  );
}

function BoardColumn({ column, visibleTasks, hiddenCount, onTaskClick }) {
  const taskIds = visibleTasks.map((t) => `task-${t.id}`);

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: 'column', columnId: column.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-slate-900/50 transition-colors ${
        isOver ? 'border-indigo-500' : 'border-slate-800'
      }`}
    >
      <div className="border-b border-slate-800 px-4 py-3">
        <h3 className="font-semibold">{column.name}</h3>
        <span className="text-xs text-slate-500">
          {visibleTasks.length} tasks
          {hiddenCount > 0 && <span className="text-slate-600"> · {hiddenCount} hidden</span>}
        </span>
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[200px] flex-1 flex-col gap-2 p-3">
          {visibleTasks.length === 0 ? (
            <p className="pointer-events-none py-8 text-center text-xs text-slate-600">
              {hiddenCount > 0 ? 'No tasks match the filter' : 'No tasks yet'}
            </p>
          ) : (
            visibleTasks.map((task) => (
              <SortableTask
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function BoardPage() {
  const { id: projectId } = useParams();
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [localBoard, setLocalBoard] = useState(null);

  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterLabel, setFilterLabel] = useState('');

  const { data: board, isLoading } = useQuery({
    queryKey: ['board', projectId],
    queryFn: async () => unwrap(await api.get(`/projects/${projectId}/board`)),
  });

  useEffect(() => {
    if (board) {
      setLocalBoard({
        ...board,
        columns: board.columns.map((col) => ({
          ...col,
          tasks: col.tasks.map((t) => ({ ...t, column_id: col.id })),
        })),
      });
    }
  }, [board]);

  const updateTask = useMutation({
    mutationFn: async ({ taskId, column_id, position }) =>
      unwrap(await api.patch(`/tasks/${taskId}`, { column_id, position })),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] });
    },
  });

  const createTask = useMutation({
    mutationFn: async ({ column_id, title }) =>
      unwrap(await api.post('/tasks', { column_id, title, description: '', priority: 'medium' })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board', projectId] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { assigneeOptions, labelOptions } = useMemo(() => {
    if (!localBoard) return { assigneeOptions: [], labelOptions: [] };
    const assigneesMap = new Map();
    const labelsSet = new Set();

    localBoard.columns.forEach((col) => {
      col.tasks.forEach((task) => {
        (task.assignees || []).forEach((a) => {
          assigneesMap.set(a.user.id, a.user.first_name || a.user.email.split('@')[0]);
        });
        (task.labels || []).forEach((l) => labelsSet.add(l));
      });
    });

    return {
      assigneeOptions: Array.from(assigneesMap, ([id, name]) => ({ id, name })),
      labelOptions: Array.from(labelsSet),
    };
  }, [localBoard]);

  const hasActiveFilters = filterPriority || filterAssignee || filterLabel;

  const matchesFilter = useCallback(
    (task) => {
      if (filterPriority && task.priority !== filterPriority) return false;
      if (filterAssignee && !(task.assignees || []).some((a) => String(a.user.id) === filterAssignee))
        return false;
      if (filterLabel && !(task.labels || []).includes(filterLabel)) return false;
      return true;
    },
    [filterPriority, filterAssignee, filterLabel]
  );

  const handleDragStart = (event) => {
    const task = event.active.data.current?.task;
    if (task) setActiveTask(task);
  };

  const handleDragEnd = useCallback(
    (event) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over || !localBoard) return;

      const taskId = parseInt(active.id.toString().replace('task-', ''), 10);
      let targetColumnId = null;

      if (over.data.current?.type === 'task') {
        targetColumnId = over.data.current.task.column_id;
      } else if (over.data.current?.type === 'column') {
        targetColumnId = over.data.current.columnId;
      } else if (String(over.id).startsWith('column-')) {
        targetColumnId = parseInt(String(over.id).replace('column-', ''), 10);
      }

      const sourceTask = localBoard.columns
        .flatMap((c) => c.tasks)
        .find((t) => t.id === taskId);

      if (!sourceTask || !targetColumnId) return;
      if (sourceTask.column_id === targetColumnId && over.data.current?.type === 'task') return;

      const previousBoard = structuredClone(localBoard);
      const nextBoard = structuredClone(localBoard);

      nextBoard.columns.forEach((col) => {
        col.tasks = col.tasks.filter((t) => t.id !== taskId);
      });

      const targetCol = nextBoard.columns.find((c) => c.id === targetColumnId);
      if (targetCol) {
        const movedTask = { ...sourceTask, column_id: targetColumnId };
        targetCol.tasks.push(movedTask);
      }

      setLocalBoard(nextBoard);

      updateTask.mutate(
        { taskId, column_id: targetColumnId, position: targetCol?.tasks.length || 0 },
        {
          onError: () => setLocalBoard(previousBoard),
        }
      );
    },
    [localBoard, updateTask]
  );

  useEffect(() => {
    if (!localBoard?.id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/board/${localBoard.id}`);

    ws.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] });
    };

    return () => ws.close();
  }, [localBoard?.id, projectId, queryClient]);

  const handleAddTask = (columnId) => {
    const title = prompt('Task title');
    if (title) createTask.mutate({ column_id: columnId, title });
  };

  const clearFilters = () => {
    setFilterPriority('');
    setFilterAssignee('');
    setFilterLabel('');
  };

  return (
    <Layout>
      <div className="mb-4">
        <Link to="/workspaces" className="text-sm text-slate-400 hover:text-indigo-400">
          ← Back
        </Link>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{localBoard?.name || 'Board'}</h1>
      </div>

      {localBoard && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
          >
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
          >
            <option value="">All assignees</option>
            {assigneeOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {labelOptions.length > 0 && (
            <select
              value={filterLabel}
              onChange={(e) => setFilterLabel(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
            >
              <option value="">All labels</option>
              {labelOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-indigo-400"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {isLoading || !localBoard ? (
        <div className="flex gap-4 overflow-x-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 w-72 animate-pulse rounded-xl bg-slate-800" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {localBoard.columns.map((column) => {
              const visibleTasks = column.tasks.filter(matchesFilter);
              const hiddenCount = column.tasks.length - visibleTasks.length;
              return (
                <div key={column.id}>
                  <BoardColumn
                    column={column}
                    visibleTasks={visibleTasks}
                    hiddenCount={hiddenCount}
                    onTaskClick={setSelectedTaskId}
                  />
                  <button
                    onClick={() => handleAddTask(column.id)}
                    className="mt-2 w-full rounded-lg border border-dashed border-slate-700 py-2 text-xs text-slate-400 hover:border-indigo-500 hover:text-indigo-400"
                  >
                    + Add task
                  </button>
                </div>
              );
            })}
          </div>
          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <TaskModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </Layout>
  );
}