import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "../lib/fetcher";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import * as React from "react";
import { ProductFormValues } from "../components/ProductForm";
import { ProductsTable } from "@/components/products/ProductsTable";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { ProductDeleteDialog } from "@/components/products/ProductDeleteDialog";

export default function Products() {
  const queryClient = useQueryClient();
  const {
    data: products,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetcher("/api/v1/products/"),
    staleTime: 5 * 60 * 1000,
  });

  // Add/Edit modal state
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editProduct, setEditProduct] = React.useState<any | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  // Delete dialog state
  const [deleteProduct, setDeleteProduct] = React.useState<any | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Sorting state
  const [sortBy, setSortBy] = React.useState<string>("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  // Search state
  const [search, setSearch] = React.useState("");

  // Derived filtered and sorted products
  const filteredProducts = React.useMemo(() => {
    if (!products) return [];
    let filtered = products;
    if (search.trim()) {
      filtered = filtered.filter((p: any) =>
        p.name.toLowerCase().includes(search.trim().toLowerCase())
      );
    }
    const compare = (a: any, b: any) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
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
  }, [products, search, sortBy, sortDir]);

  async function handleAdd(values: ProductFormValues) {
    setSubmitting(true);
    setFormError(null);
    try {
      await fetcher("/api/v1/products/", {
        method: "POST",
        data: values,
      });
      setModalOpen(false);
      setEditProduct(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      setFormError(err.message || "Failed to add product");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(values: ProductFormValues) {
    if (!editProduct) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await fetcher(`/api/v1/products/${editProduct.id}`, {
        method: "PUT",
        data: values,
      });
      setModalOpen(false);
      setEditProduct(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      setFormError(err.message || "Failed to update product");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteProduct) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await fetcher(`/api/v1/products/${deleteProduct.id}`, {
        method: "DELETE",
      });
      setDeleteProduct(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  }

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  const handleFormSubmit = editProduct ? handleEdit : handleAdd;

  return (
    <div className="p-4 min-h-screen bg-background w-full overflow-y-auto">
      <Card className="min-h-[500px] w-full shadow-lg bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 pb-2">
          <CardTitle className="text-2xl font-bold">Products</CardTitle>
          <div className="flex flex-col md:flex-row w-full md:w-auto gap-2 mt-2 md:mt-0">
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-64"
            />
            <ProductFormDialog
              open={modalOpen}
              onOpenChange={(open) => {
                setModalOpen(open);
                if (!open) setEditProduct(null);
              }}
              editProduct={editProduct}
              onSubmit={handleFormSubmit}
              submitting={submitting}
              error={formError}
            />
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading products...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500">
              Error loading products: {(error as Error).message}
            </div>
          ) : !products || products.length === 0 ? (
            <div className="flex flex-col items-center">
              <span className="text-4xl mb-2">🧪</span>
              <span className="text-muted-foreground text-lg">
                No products found.
              </span>
            </div>
          ) : (
            <ProductsTable
              products={filteredProducts}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              onEdit={(product) => {
                setEditProduct(product);
                setModalOpen(true);
              }}
              onDelete={setDeleteProduct}
            />
          )}
        </CardContent>
      </Card>
      <ProductDeleteDialog
        deleteProduct={deleteProduct}
        onDelete={handleDelete}
        onClose={() => setDeleteProduct(null)}
        deleting={deleting}
        error={deleteError}
      />
    </div>
  );
}
