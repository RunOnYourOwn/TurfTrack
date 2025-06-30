import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "../lib/fetcher";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import * as React from "react";
import { PlusIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ApplicationsTable } from "@/components/applications/ApplicationsTable";
import { ApplicationFormDialog } from "@/components/applications/ApplicationFormDialog";
import { ApplicationDeleteDialog } from "@/components/applications/ApplicationDeleteDialog";

export default function Applications() {
  const queryClient = useQueryClient();
  // Fetch all applications
  const {
    data: applications,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetcher("/api/v1/applications/"),
    staleTime: 5 * 60 * 1000,
  });
  // Fetch lawns, products, GDD models for lookup
  const { data: lawns } = useQuery({
    queryKey: ["lawns"],
    queryFn: () => fetcher("/api/v1/lawns/"),
    staleTime: 5 * 60 * 1000,
  });
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetcher("/api/v1/products/"),
    staleTime: 5 * 60 * 1000,
  });
  const { data: gddModels } = useQuery({
    queryKey: ["gddModels"],
    queryFn: () => fetcher("/api/v1/gdd_models/"),
    staleTime: 5 * 60 * 1000,
  });

  // Lookup helpers
  const lawnMap = React.useMemo(() => {
    const map: Record<number, any> = {};
    if (lawns) lawns.forEach((l: any) => (map[l.id] = l));
    return map;
  }, [lawns]);
  const productMap = React.useMemo(() => {
    const map: Record<number, any> = {};
    if (products) products.forEach((p: any) => (map[p.id] = p));
    return map;
  }, [products]);
  const gddModelMap = React.useMemo(() => {
    const map: Record<number, any> = {};
    if (gddModels) gddModels.forEach((g: any) => (map[g.id] = g));
    return map;
  }, [gddModels]);

  // Placeholder modal state for add/edit
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editApp, setEditApp] = React.useState<any | null>(null);
  const [deleteApp, setDeleteApp] = React.useState<any | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Add search and sorting state
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<string>("application_date");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  // Derived filtered and sorted applications
  const filteredApplications = React.useMemo(() => {
    if (!applications) return [];
    let filtered = applications;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter((app: any) => {
        const lawn = lawnMap[app.lawn_id]?.name || app.lawn_id;
        const location = lawnMap[app.lawn_id]?.location?.name || "";
        const product = productMap[app.product_id]?.name || app.product_id;
        const gdd = app.tied_gdd_model_id
          ? gddModelMap[app.tied_gdd_model_id]?.name || app.tied_gdd_model_id
          : "";
        return (
          String(app.application_date).toLowerCase().includes(s) ||
          String(location).toLowerCase().includes(s) ||
          String(lawn).toLowerCase().includes(s) ||
          String(product).toLowerCase().includes(s) ||
          String(app.amount_per_area).toLowerCase().includes(s) ||
          String(app.unit).toLowerCase().includes(s) ||
          String(app.area_unit).toLowerCase().includes(s) ||
          String(app.status).toLowerCase().includes(s) ||
          String(app.notes).toLowerCase().includes(s) ||
          String(gdd).toLowerCase().includes(s)
        );
      });
    }
    const compare = (a: any, b: any) => {
      let valA, valB;
      switch (sortBy) {
        case "location":
          valA = lawnMap[a.lawn_id]?.location?.name || "";
          valB = lawnMap[b.lawn_id]?.location?.name || "";
          break;
        case "lawn":
          valA = lawnMap[a.lawn_id]?.name || a.lawn_id;
          valB = lawnMap[b.lawn_id]?.name || b.lawn_id;
          break;
        case "product":
          valA = productMap[a.product_id]?.name || a.product_id;
          valB = productMap[b.product_id]?.name || b.product_id;
          break;
        case "gdd":
          valA = a.tied_gdd_model_id
            ? gddModelMap[a.tied_gdd_model_id]?.name || a.tied_gdd_model_id
            : "";
          valB = b.tied_gdd_model_id
            ? gddModelMap[b.tied_gdd_model_id]?.name || b.tied_gdd_model_id
            : "";
          break;
        default:
          valA = a[sortBy];
          valB = b[sortBy];
      }
      if (valA == null && valB == null) return 0;
      if (valA == null) return sortDir === "asc" ? -1 : 1;
      if (valB == null) return sortDir === "asc" ? 1 : -1;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === "asc" ? valA - valB : valB - valA;
      }
      return sortDir === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    };
    return [...filtered].sort(compare);
  }, [applications, search, sortBy, sortDir, lawnMap, productMap, gddModelMap]);

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  return (
    <div className="p-4 min-h-screen bg-background w-full flex flex-col overflow-y-auto">
      <Card className="min-h-[500px] w-full max-w-none shadow-lg flex flex-col bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 w-full">
          <CardTitle className="text-2xl font-bold">Applications</CardTitle>
          <CardAction>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setEditApp(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-1"
            >
              <PlusIcon className="w-4 h-4" /> Add Application
            </Button>
          </CardAction>
        </CardHeader>
        {/* Search input */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-start md:items-center px-4 pb-2">
          <Input
            placeholder="Search applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
        </div>
        <CardContent className="w-full">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading applications...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500">
              Error loading applications: {(error as Error).message}
            </div>
          ) : !applications || applications.length === 0 ? (
            <div className="flex flex-col items-center">
              <span className="text-4xl mb-2">🧪</span>
              <span className="text-muted-foreground text-lg">
                No applications found.
              </span>
            </div>
          ) : (
            <ApplicationsTable
              applications={filteredApplications}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              lawnMap={lawnMap}
              productMap={productMap}
              gddModelMap={gddModelMap}
              onEdit={(app) => {
                setEditApp(app);
                setModalOpen(true);
              }}
              onDelete={setDeleteApp}
            />
          )}
        </CardContent>
      </Card>
      {/* Add/Edit Application Modal */}
      <ApplicationFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialValues={editApp || {}}
        mode={editApp ? "edit" : "add"}
        lawns={lawns || []}
        products={products || []}
        gddModels={gddModels || []}
        submitting={false}
        error={null}
        onSubmit={async (values) => {
          try {
            // Convert empty string to null for tied_gdd_model_id
            const payload = {
              ...values,
              tied_gdd_model_id:
                values.tied_gdd_model_id === ""
                  ? null
                  : values.tied_gdd_model_id,
            };
            if (editApp) {
              await fetcher(`/api/v1/applications/${editApp.id}`, {
                method: "PUT",
                data: payload,
              });
            } else {
              await fetcher("/api/v1/applications/", {
                method: "POST",
                data: payload,
              });
            }
            setModalOpen(false);
            setEditApp(null);
            queryClient.invalidateQueries({ queryKey: ["applications"] });
          } catch (err) {
            // TODO: handle error state
            alert((err as Error).message || "Failed to save application");
          }
        }}
        onCancel={() => {
          setModalOpen(false);
          setEditApp(null);
        }}
      />
      {/* Delete Confirmation Dialog */}
      <ApplicationDeleteDialog
        open={!!deleteApp}
        error={deleteError}
        deleting={deleting}
        onCancel={() => setDeleteApp(null)}
        onDelete={async () => {
          if (!deleteApp) return;
          setDeleting(true);
          setDeleteError(null);
          try {
            await fetcher(`/api/v1/applications/${deleteApp.id}`, {
              method: "DELETE",
            });
            setDeleteApp(null);
            queryClient.invalidateQueries({ queryKey: ["applications"] });
          } catch (err) {
            setDeleteError(
              (err as Error).message || "Failed to delete application"
            );
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
