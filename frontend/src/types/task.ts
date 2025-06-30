export interface TaskStatus {
  id: number;
  task_id: string;
  task_name: string;
  status: string;
  started_at: string;
  finished_at: string;
  error?: string | null;
  result?: string | null;
}
