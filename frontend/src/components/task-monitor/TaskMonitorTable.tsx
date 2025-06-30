import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskStatus } from "@/types/task";

interface TaskMonitorTableProps {
  tasks: TaskStatus[];
}

export function TaskMonitorTable({ tasks }: TaskMonitorTableProps) {
  return (
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
        {tasks?.map((task, idx) => (
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
  );
}
