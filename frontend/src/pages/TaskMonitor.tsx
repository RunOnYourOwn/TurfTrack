import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskStatus } from "@/types/task";
import { fetchTaskStatus } from "@/lib/taskApi";
import { TaskMonitorTable } from "@/components/task-monitor/TaskMonitorTable";

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
          <TaskMonitorTable tasks={data || []} />
        </CardContent>
      </Card>
    </div>
  );
}
