import { useQuery } from "@tanstack/react-query";
import { fetcher } from "../lib/fetcher";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

interface TaskStatus {
  id: number;
  task_id: string;
  task_name: string;
  status: string;
  started_at: string;
  finished_at: string;
  error?: string | null;
  result?: string | null;
}

const fetchTaskStatus = async (): Promise<TaskStatus[]> => {
  const data = await fetcher<TaskStatus[]>("/api/v1/tasks/");
  // console.log("Task status API response:", data);
  return data;
};

export default function TaskMonitor() {
  const { data, isLoading, error } = useQuery<TaskStatus[]>({
    queryKey: ["taskStatus"],
    queryFn: fetchTaskStatus,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading task status</div>;

  return (
    <div className="p-4 min-h-screen bg-background w-full flex flex-col overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4">Task Monitor</h1>
      <Card className="bg-white dark:bg-gray-900 text-black dark:text-white w-full max-w-none shadow-lg flex flex-col">
        <CardHeader>
          <CardTitle>Task Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="bg-background dark:bg-gray-900 text-black dark:text-white">
            <TableHeader>
              <TableRow className="bg-muted dark:bg-gray-800">
                <TableHead>ID</TableHead>
                <TableHead>Task ID</TableHead>
                <TableHead>Task Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started At</TableHead>
                <TableHead>Finished At</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((task, idx) => (
                <TableRow
                  key={task.id}
                  className={
                    (idx % 2 === 0
                      ? "bg-white dark:bg-gray-800"
                      : "bg-muted/30 dark:bg-gray-900") +
                    " border-b last:border-b-0 group hover:bg-muted/50 dark:hover:bg-gray-800"
                  }
                >
                  <TableCell>{task.id}</TableCell>
                  <TableCell>{task.task_id}</TableCell>
                  <TableCell>{task.task_name}</TableCell>
                  <TableCell>{task.status}</TableCell>
                  <TableCell>
                    {task.started_at
                      ? new Date(task.started_at).toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {task.finished_at
                      ? new Date(task.finished_at).toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell>{task.error || "-"}</TableCell>
                  <TableCell>{task.result || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
