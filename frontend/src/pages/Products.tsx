import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "../lib/fetcher";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import * as React from "react";
import {
  PencilIcon,
  Trash2Icon,
  ChevronUp,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { ProductForm, ProductFormValues } from "../components/ProductForm";

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

  return (
    <div className="p-4 min-h-screen bg-background w-full">
      <Card className="min-h-[500px] w-full shadow-lg bg-white dark:bg-gray-900 text-black dark:text-white">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-2xl font-bold">Products</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Dialog
              open={modalOpen}
              onOpenChange={(open) => {
                setModalOpen(open);
                if (!open) setEditProduct(null);
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setEditProduct(null);
                    setModalOpen(true);
                  }}
                >
                  + Add Product
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editProduct ? "Edit Product" : "Add Product"}
                  </DialogTitle>
                  <DialogDescription>
                    {editProduct
                      ? "Update the product details."
                      : "Fill out the form to add a new product."}
                  </DialogDescription>
                </DialogHeader>
                <ProductForm
                  initialValues={editProduct || {}}
                  mode={editProduct ? "edit" : "add"}
                  submitting={submitting}
                  error={formError}
                  onSubmit={editProduct ? handleEdit : handleAdd}
                  onCancel={() => {
                    setModalOpen(false);
                    setEditProduct(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
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
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 rounded-lg overflow-hidden bg-background dark:bg-gray-900 text-xs text-black dark:text-white">
                <thead>
                  <tr className="bg-muted">
                    <th
                      className="px-2 py-1 text-left font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("name")}
                    >
                      Name{" "}
                      {sortBy === "name" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-1 py-1 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("n_pct")}
                    >
                      N{" "}
                      {sortBy === "n_pct" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-1 py-1 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("p_pct")}
                    >
                      P{" "}
                      {sortBy === "p_pct" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-1 py-1 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("k_pct")}
                    >
                      K{" "}
                      {sortBy === "k_pct" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-1 py-1 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("ca_pct")}
                    >
                      Ca{" "}
                      {sortBy === "ca_pct" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-1 py-1 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("mg_pct")}
                    >
                      Mg{" "}
                      {sortBy === "mg_pct" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-1 py-1 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("s_pct")}
                    >
                      S{" "}
                      {sortBy === "s_pct" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-1 py-1 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("fe_pct")}
                    >
                      Fe{" "}
                      {sortBy === "fe_pct" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-1 py-1 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("cu_pct")}
                    >
                      Cu{" "}
                      {sortBy === "cu_pct" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-1 py-1 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("mn_pct")}
                    >
                      Mn{" "}
                      {sortBy === "mn_pct" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-1 py-1 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("b_pct")}
                    >
                      B{" "}
                      {sortBy === "b_pct" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-1 py-1 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("zn_pct")}
                    >
                      Zn{" "}
                      {sortBy === "zn_pct" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-1 py-1 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("weight_lbs")}
                    >
                      Weight (lbs){" "}
                      {sortBy === "weight_lbs" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th
                      className="px-1 py-1 font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("cost_per_bag")}
                    >
                      Cost/Bag{" "}
                      {sortBy === "cost_per_bag" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="inline w-3 h-3" />
                        ) : (
                          <ChevronDown className="inline w-3 h-3" />
                        ))}
                    </th>
                    <th className="px-1 py-1 font-semibold">Product Link</th>
                    <th className="px-1 py-1 font-semibold">Edit</th>
                    <th className="px-1 py-1 font-semibold">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product: any, idx: number) => (
                    <tr
                      key={product.id}
                      className={
                        "border-b last:border-b-0 group hover:bg-muted/50 dark:hover:bg-gray-800 " +
                        (idx % 2 === 0
                          ? "bg-white dark:bg-gray-800"
                          : "bg-muted/30 dark:bg-gray-900")
                      }
                    >
                      <td className="px-2 py-1 border-b whitespace-nowrap font-medium">
                        {product.name}
                      </td>
                      <td className="px-1 py-1 border-b text-right">
                        {product.n_pct}
                      </td>
                      <td className="px-1 py-1 border-b text-right">
                        {product.p_pct}
                      </td>
                      <td className="px-1 py-1 border-b text-right">
                        {product.k_pct}
                      </td>
                      <td className="px-1 py-1 border-b text-right">
                        {product.ca_pct}
                      </td>
                      <td className="px-1 py-1 border-b text-right">
                        {product.mg_pct}
                      </td>
                      <td className="px-1 py-1 border-b text-right">
                        {product.s_pct}
                      </td>
                      <td className="px-1 py-1 border-b text-right">
                        {product.fe_pct}
                      </td>
                      <td className="px-1 py-1 border-b text-right">
                        {product.cu_pct}
                      </td>
                      <td className="px-1 py-1 border-b text-right">
                        {product.mn_pct}
                      </td>
                      <td className="px-1 py-1 border-b text-right">
                        {product.b_pct}
                      </td>
                      <td className="px-1 py-1 border-b text-right">
                        {product.zn_pct}
                      </td>
                      <td className="px-1 py-1 border-b text-right">
                        {product.weight_lbs}
                      </td>
                      <td className="px-1 py-1 border-b text-right">
                        {product.cost_per_bag !== null &&
                        product.cost_per_bag !== undefined
                          ? Number(product.cost_per_bag).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )
                          : ""}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {product.product_link && (
                          <a
                            href={product.product_link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-4 h-4 inline" />
                          </a>
                        )}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditProduct(product);
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
                          onClick={() => setDeleteProduct(product)}
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
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteProduct}
        onOpenChange={(open) => {
          if (!open) setDeleteProduct(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteProduct?.name}</span>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="text-red-500 text-sm mb-2">{deleteError}</div>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" disabled={deleting}>
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
