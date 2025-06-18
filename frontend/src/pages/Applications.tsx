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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import * as React from "react";
import { PencilIcon, Trash2Icon, PlusIcon } from "lucide-react";
import {
  ApplicationForm,
  ApplicationFormValues,
} from "@/components/ApplicationForm";
import { toast } from "sonner";

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

  return (
    <div className="p-4 min-h-screen bg-muted/50 w-full flex flex-col">
      <Card className="min-h-[500px] w-full max-w-none shadow-lg flex flex-col">
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
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 rounded-lg overflow-hidden bg-background text-xs">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-2 py-1 text-left font-semibold">Date</th>
                    <th className="px-2 py-1 text-left font-semibold">Lawn</th>
                    <th className="px-2 py-1 text-left font-semibold">
                      Product
                    </th>
                    <th className="px-2 py-1 text-left font-semibold">
                      Amount
                    </th>
                    <th className="px-2 py-1 text-left font-semibold">
                      Status
                    </th>
                    <th className="px-2 py-1 text-left font-semibold">Notes</th>
                    <th className="px-2 py-1 text-left font-semibold">
                      GDD Model
                    </th>
                    <th className="px-2 py-1 text-left font-semibold">Edit</th>
                    <th className="px-2 py-1 text-left font-semibold">
                      Delete
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app: any) => (
                    <tr
                      key={app.id}
                      className="border-b last:border-b-0 group hover:bg-muted/50"
                    >
                      <td className="px-2 py-1 border-b whitespace-nowrap font-medium">
                        {app.application_date}
                      </td>
                      <td className="px-2 py-1 border-b whitespace-nowrap">
                        {lawnMap[app.lawn_id]?.name || app.lawn_id}
                      </td>
                      <td className="px-2 py-1 border-b whitespace-nowrap">
                        {productMap[app.product_id]?.name || app.product_id}
                      </td>
                      <td className="px-2 py-1 border-b whitespace-nowrap">
                        {app.amount_per_area} {app.unit} / {app.area_unit} sq ft
                      </td>
                      <td className="px-2 py-1 border-b whitespace-nowrap capitalize">
                        {app.status}
                      </td>
                      <td className="px-2 py-1 border-b whitespace-nowrap">
                        {app.notes}
                      </td>
                      <td className="px-2 py-1 border-b whitespace-nowrap">
                        {app.tied_gdd_model_id
                          ? gddModelMap[app.tied_gdd_model_id]?.name ||
                            app.tied_gdd_model_id
                          : ""}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditApp(app);
                            setModalOpen(true);
                          }}
                          aria-label="Edit"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-2 py-1 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setDeleteApp(app)}
                          aria-label="Delete"
                        >
                          <Trash2Icon className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Add/Edit Application Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editApp ? "Edit Application" : "Add Application"}
            </DialogTitle>
            <DialogDescription>
              Fill out the form to add or edit an application.
            </DialogDescription>
          </DialogHeader>
          <ApplicationForm
            initialValues={editApp || {}}
            mode={editApp ? "edit" : "add"}
            submitting={false}
            error={null}
            lawns={lawns || []}
            products={products || []}
            gddModels={gddModels || []}
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
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteApp}
        onOpenChange={(open) => {
          if (!open) setDeleteApp(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this application? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="text-red-500 text-sm mb-2">{deleteError}</div>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="ghost"
              onClick={() => setDeleteApp(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteApp) return;
                setDeleting(true);
                setDeleteError(null);
                try {
                  await fetcher(`/api/v1/applications/${deleteApp.id}`, {
                    method: "DELETE",
                  });
                  setDeleteApp(null);
                  queryClient.invalidateQueries({ queryKey: ["applications"] });
                  toast.success("Application deleted.");
                } catch (err) {
                  setDeleteError(
                    (err as Error).message || "Failed to delete application"
                  );
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
