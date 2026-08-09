import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
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

function BoardColumn({ column, onTaskClick }) {
  const taskIds = column.tasks.map((t) => `task-${t.id}`);

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-800 bg-slate-900/50">
      <div className="border-b border-slate-800 px-4 py-3">
        <h3 className="font-semibold">{column.name}</h3>
        <span className="text-xs text-slate-500">{column.tasks.length} tasks</span>
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[200px] flex-1 flex-col gap-2 p-3">
          {column.tasks.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-600">No tasks yet</p>
          ) : (
            column.tasks.map((task) => (
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

  const columnsById = useMemo(() => {
    if (!localBoard) return {};
    return Object.fromEntries(localBoard.columns.map((c) => [c.id, c]));
  }, [localBoard]);

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

  return (
    <Layout>
      <div className="mb-4">
        <Link to="/workspaces" className="text-sm text-slate-400 hover:text-indigo-400">
          ← Back
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{localBoard?.name || 'Board'}</h1>
      </div>

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
            {localBoard.columns.map((column) => (
              <div key={column.id} id={`column-${column.id}`}>
                <BoardColumn column={column} onTaskClick={setSelectedTaskId} />
                <button
                  onClick={() => handleAddTask(column.id)}
                  className="mt-2 w-full rounded-lg border border-dashed border-slate-700 py-2 text-xs text-slate-400 hover:border-indigo-500 hover:text-indigo-400"
                >
                  + Add task
                </button>
              </div>
            ))}
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
