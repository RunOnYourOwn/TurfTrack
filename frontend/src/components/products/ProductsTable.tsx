import React from "react";
import { Button } from "@/components/ui/button";
import {
  PencilIcon,
  Trash2Icon,
  ChevronUp,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

interface ProductsTableProps {
  products: any[];
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  onEdit: (product: any) => void;
  onDelete: (product: any) => void;
}

export const ProductsTable: React.FC<ProductsTableProps> = ({
  products,
  sortBy,
  sortDir,
  onSort,
  onEdit,
  onDelete,
}) => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse rounded-lg bg-background dark:bg-gray-900 text-sm text-black dark:text-white align-middle border-b border-muted-foreground">
      <thead>
        <tr className="bg-muted">
          <th
            className="px-2 py-1 text-left font-semibold cursor-pointer select-none"
            onClick={() => onSort("name")}
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
            onClick={() => onSort("n_pct")}
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
            onClick={() => onSort("p_pct")}
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
            onClick={() => onSort("k_pct")}
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
            onClick={() => onSort("ca_pct")}
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
            onClick={() => onSort("mg_pct")}
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
            onClick={() => onSort("s_pct")}
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
            onClick={() => onSort("fe_pct")}
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
            onClick={() => onSort("cu_pct")}
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
            onClick={() => onSort("mn_pct")}
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
            onClick={() => onSort("b_pct")}
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
            onClick={() => onSort("zn_pct")}
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
            onClick={() => onSort("weight_lbs")}
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
            onClick={() => onSort("cost_per_bag")}
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
        {products.map((product: any, idx: number) => {
          const isLast = idx === products.length - 1;
          return (
            <tr
              key={product.id}
              className={
                "group hover:bg-muted/50 dark:hover:bg-gray-800 align-middle " +
                (idx % 2 === 0
                  ? "bg-white dark:bg-gray-800"
                  : "bg-muted/30 dark:bg-gray-900")
              }
            >
              <td
                className={`px-2 py-1 whitespace-nowrap align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.name}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.n_pct}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.p_pct}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.k_pct}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.ca_pct}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.mg_pct}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.s_pct}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.fe_pct}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.cu_pct}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.mn_pct}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.b_pct}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.zn_pct}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.weight_lbs}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.cost_per_bag}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                {product.product_url ? (
                  <a
                    href={product.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    <ExternalLink className="inline w-4 h-4" />
                  </a>
                ) : (
                  ""
                )}
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onEdit(product)}
                  aria-label="Edit"
                >
                  <PencilIcon className="w-4 h-4" />
                </Button>
              </td>
              <td
                className={`px-1 py-1 text-center align-middle${
                  isLast ? "" : " border-b"
                }`}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onDelete(product)}
                  aria-label="Delete"
                >
                  <Trash2Icon className="w-4 h-4 text-destructive" />
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
