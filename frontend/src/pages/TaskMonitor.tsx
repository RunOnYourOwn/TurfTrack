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
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Task Monitor</h1>
      <Card>
        <CardHeader>
          <CardTitle>Task Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
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
              {data?.map((task) => (
                <TableRow key={task.id}>
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
