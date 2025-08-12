import { fetcher } from "./fetcher";
import { TaskStatus } from "@/types/task";

export const fetchTaskStatus = async (): Promise<TaskStatus[]> => {
  const data = await fetcher<TaskStatus[]>("/api/v1/tasks/");
  return data;
};
