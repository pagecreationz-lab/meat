export function prepareOrderSubmission({ mode, value, items, data }) {
  const requireRecord = (kind, id, label) => {
    if (!id) throw new Error(`Select ${label} before saving.`);
    if (!(data[kind] || []).some((r) => r.id === id && r.status !== "Inactive"))
      throw new Error(
        `The selected ${label.replace(/^(a|an) /, '')} is unavailable. Refresh the page and select it again.`,
      );
  };
  requireRecord("shops", value.shopId, "a shop");
  if (mode === "order")
    requireRecord("customers", value.customerId, "a customer");
  else requireRecord("suppliers", value.supplierId, "a supplier");
  if (!items.length) throw new Error("Add at least one item before saving.");
  for (const line of items) requireRecord("items", line.itemId, "an item");
  return { ...value, items };
}
