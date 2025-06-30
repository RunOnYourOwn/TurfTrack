interface ReportsTableProps {
  filteredApps: any[];
  lawns: any[];
  productMap: Record<number, any>;
}

export function ReportsTable({
  filteredApps,
  lawns,
  productMap,
}: ReportsTableProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Application History</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 rounded-lg overflow-hidden bg-background dark:bg-gray-900 text-xs text-black dark:text-white">
          <thead>
            <tr className="bg-muted">
              <th className="px-2 py-1 text-left font-semibold">Date</th>
              <th className="px-2 py-1 text-left font-semibold">Lawn</th>
              <th className="px-2 py-1 text-left font-semibold">Product</th>
              <th className="px-2 py-1 text-left font-semibold">N</th>
              <th className="px-2 py-1 text-left font-semibold">P</th>
              <th className="px-2 py-1 text-left font-semibold">K</th>
              <th className="px-2 py-1 text-left font-semibold">Cost</th>
              <th className="px-2 py-1 text-left font-semibold">Status</th>
              <th className="px-2 py-1 text-left font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(filteredApps) &&
              filteredApps.map((app: any, idx: number) => (
                <tr
                  key={app.id}
                  className={
                    "border-b last:border-b-0 group hover:bg-muted/50 dark:hover:bg-gray-800 " +
                    (idx % 2 === 0
                      ? "bg-white dark:bg-gray-800"
                      : "bg-muted/30 dark:bg-gray-900")
                  }
                >
                  <td className="px-2 py-1 border-b whitespace-nowrap font-medium">
                    {app.application_date}
                  </td>
                  <td className="px-2 py-1 border-b whitespace-nowrap">
                    {Array.isArray(lawns)
                      ? lawns.find((l: any) => l.id === app.lawn_id)?.name ||
                        app.lawn_id
                      : app.lawn_id}
                  </td>
                  <td className="px-2 py-1 border-b whitespace-nowrap">
                    {productMap[app.product_id]?.name || app.product_id}
                  </td>
                  <td className="px-2 py-1 border-b text-right">
                    {app.n_applied?.toFixed(2)}
                  </td>
                  <td className="px-2 py-1 border-b text-right">
                    {app.p_applied?.toFixed(2)}
                  </td>
                  <td className="px-2 py-1 border-b text-right">
                    {app.k_applied?.toFixed(2)}
                  </td>
                  <td className="px-2 py-1 border-b text-right">
                    {app.cost_applied ? `$${app.cost_applied.toFixed(2)}` : ""}
                  </td>
                  <td className="px-2 py-1 border-b whitespace-nowrap capitalize">
                    {app.status}
                  </td>
                  <td className="px-2 py-1 border-b whitespace-nowrap">
                    {app.notes}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
