import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from "lucide-react";
import { TaskStatus } from "@/types/task";

interface TaskMonitorTableProps {
  tasks: TaskStatus[];
}

type SortColumn =
  | "id"
  | "task_id"
  | "task_name"
  | "status"
  | "started_at"
  | "finished_at"
  | "error"
  | "result";
type SortDirection = "asc" | "desc";

export function TaskMonitorTable({ tasks }: TaskMonitorTableProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>("started_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Search state
  const [search, setSearch] = useState("");

  // Sorting function
  const sortTasks = (
    tasks: TaskStatus[],
    column: SortColumn,
    direction: SortDirection
  ) => {
    return [...tasks].sort((a, b) => {
      let aValue: any = a[column];
      let bValue: any = b[column];

      // Handle date columns
      if (column === "started_at" || column === "finished_at") {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = "";
      if (bValue === null || bValue === undefined) bValue = "";

      // Convert to strings for comparison
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();

      if (direction === "asc") {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
  };

  // Handle sort column click
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Get sort icon
  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ChevronsUpDown className="w-4 h-4" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  // Filter, sort and paginate tasks
  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;

    const searchTerm = search.trim().toLowerCase();
    return tasks.filter((task) => {
      return (
        task.task_name.toLowerCase().includes(searchTerm) ||
        task.task_id.toLowerCase().includes(searchTerm) ||
        task.status.toLowerCase().includes(searchTerm) ||
        (task.error && task.error.toLowerCase().includes(searchTerm)) ||
        (task.result && task.result.toLowerCase().includes(searchTerm)) ||
        task.id.toString().includes(searchTerm)
      );
    });
  }, [tasks, search]);

  const sortedTasks = useMemo(
    () => sortTasks(filteredTasks, sortColumn, sortDirection),
    [filteredTasks, sortColumn, sortDirection]
  );

  const totalPages = Math.ceil(sortedTasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTasks = sortedTasks.slice(startIndex, endIndex);

  // Pagination controls
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToPreviousPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  return (
    <div className="space-y-4">
      {/* Search and Pagination Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1); // Reset to first page when searching
              }}
              className="pl-8 w-full md:w-64"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Items per page:
            </span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1); // Reset to first page when changing items per page
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              {startIndex + 1}-{Math.min(endIndex, sortedTasks.length)} of{" "}
              {sortedTasks.length} tasks
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-md">
        <Table className="bg-background dark:bg-gray-900 text-black dark:text-white">
          <TableHeader>
            <TableRow className="bg-muted dark:bg-gray-800">
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("id")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  ID {getSortIcon("id")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("task_id")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Task ID {getSortIcon("task_id")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("task_name")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Task Name {getSortIcon("task_name")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("status")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Status {getSortIcon("status")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("started_at")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Started At {getSortIcon("started_at")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("finished_at")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Finished At {getSortIcon("finished_at")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("error")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Error {getSortIcon("error")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("result")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Result {getSortIcon("result")}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTasks?.map((task, idx) => (
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
                <TableCell className="font-mono text-xs">
                  {task.task_id}
                </TableCell>
                <TableCell>{task.task_name}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      task.status === "success"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : task.status === "failure"
                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                    }`}
                  >
                    {task.status}
                  </span>
                </TableCell>
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
                <TableCell
                  className="max-w-xs truncate"
                  title={task.error || undefined}
                >
                  {task.error || "-"}
                </TableCell>
                <TableCell
                  className="max-w-xs truncate"
                  title={task.result || undefined}
                >
                  {task.result || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Navigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>

          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(pageNum)}
                  className="w-8 h-8 p-0"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
