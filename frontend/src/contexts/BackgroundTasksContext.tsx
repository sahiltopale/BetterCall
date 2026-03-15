import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface DraftTask {
  id: string;
  type: 'draft';
  status: 'pending' | 'processing' | 'completed' | 'error';
  prompt: string;
  draftType?: string;
  startedAt: string;
  completedAt?: string;
  notifiedAt?: string;
  result?: any;
  error?: string;
}

export interface AnalysisTask {
  id: string;
  type: 'analysis';
  status: 'pending' | 'processing' | 'completed' | 'error';
  documentName: string;
  startedAt: string;
  completedAt?: string;
  notifiedAt?: string;
  result?: any;
  error?: string;
}

export type BackgroundTask = DraftTask | AnalysisTask;

type NewDraftTask = Omit<DraftTask, 'id' | 'startedAt' | 'status'>;
type NewAnalysisTask = Omit<AnalysisTask, 'id' | 'startedAt' | 'status'>;

interface BackgroundTasksContextType {
  tasks: BackgroundTask[];
  addTask: (task: NewDraftTask | NewAnalysisTask) => string;
  updateTask: (id: string, updates: Partial<BackgroundTask>) => void;
  removeTask: (id: string) => void;
  getTask: (id: string) => BackgroundTask | undefined;
  clearCompletedTasks: () => void;
}

const BackgroundTasksContext = createContext<BackgroundTasksContextType | undefined>(undefined);

const STORAGE_KEY = 'background_tasks';

export function BackgroundTasksProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<BackgroundTask[]>(() => {
    // Load tasks from localStorage on initialization
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? (JSON.parse(stored) as BackgroundTask[]) : [];
      // Prevent old tasks from re-triggering notifications after reload
      return parsed.map((task) => {
        if (task.status === 'completed' || task.status === 'error') {
          return {
            ...task,
            notifiedAt: task.notifiedAt || task.completedAt || new Date().toISOString(),
          } as BackgroundTask;
        }
        return task;
      });
    } catch {
      return [];
    }
  });

  // Persist tasks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // Show notification when task completes (only once per task)
  useEffect(() => {
    const tasksToNotify = tasks.filter(
      (task) => (task.status === 'completed' || task.status === 'error') && !task.notifiedAt
    );

    if (tasksToNotify.length === 0) {
      return;
    }

    tasksToNotify.forEach((task) => {
      const taskName = task.type === 'draft' ? 'Draft Generation' : 'Judgment Analysis';
      if (task.status === 'completed') {
        toast({
          title: `${taskName} Completed`,
          description:
            task.type === 'draft'
              ? `Draft "${(task as DraftTask).prompt.substring(0, 50)}..." is ready`
              : `Analysis for "${(task as AnalysisTask).documentName}" is complete`,
        });
      } else if (task.status === 'error' && task.error) {
        toast({
          title: `${taskName} Failed`,
          description: task.error,
          variant: 'destructive',
        });
      }
    });

    setTasks((prev) =>
      prev.map((task) => {
        if ((task.status === 'completed' || task.status === 'error') && !task.notifiedAt) {
          return { ...task, notifiedAt: new Date().toISOString() } as BackgroundTask;
        }
        return task;
      })
    );
  }, [tasks, toast]);

  const addTask = (task: NewDraftTask | NewAnalysisTask) => {
    const id = `${task.type}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const newTask: BackgroundTask = {
      ...task,
      id,
      status: 'pending',
      startedAt: new Date().toISOString(),
    } as BackgroundTask;
    
    setTasks(prev => [...prev, newTask]);
    return id;
  };

  const updateTask = (id: string, updates: Partial<BackgroundTask>) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id
          ? { ...task, ...updates, completedAt: updates.status === 'completed' ? new Date().toISOString() : task.completedAt } as BackgroundTask
          : task
      )
    );
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  };

  const getTask = (id: string) => {
    return tasks.find(task => task.id === id);
  };

  const clearCompletedTasks = () => {
    setTasks(prev => prev.filter(task => task.status !== 'completed' && task.status !== 'error'));
  };

  return (
    <BackgroundTasksContext.Provider
      value={{ tasks, addTask, updateTask, removeTask, getTask, clearCompletedTasks }}
    >
      {children}
    </BackgroundTasksContext.Provider>
  );
}

export function useBackgroundTasks() {
  const context = useContext(BackgroundTasksContext);
  if (!context) {
    throw new Error('useBackgroundTasks must be used within BackgroundTasksProvider');
  }
  return context;
}
