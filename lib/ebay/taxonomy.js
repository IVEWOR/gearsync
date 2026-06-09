import { ebayClient } from "./client.js";

// eBay Motors category tree ID (sandbox and production both use 100 for EBAY_MOTORS_US)
const MOTORS_TREE_ID = "100";

// Recursively collects leaf categories, building a breadcrumb path as we descend.
function collectLeaves(node, ancestors = []) {
  if (!node) return [];

  const name = node.category?.categoryName ?? "";
  const id   = node.category?.categoryId;
  const path = ancestors.length ? `${ancestors.join(" > ")} > ${name}` : name;

  if (node.leafCategoryTreeNode) {
    return [{ id, name, fullPath: path }];
  }

  const leaves = [];
  for (const child of node.childCategoryTreeNodes ?? []) {
    leaves.push(...collectLeaves(child, [...ancestors, name]));
  }
  return leaves;
}

// Returns an array of leaf categories:  { id, name, fullPath }
// fullPath example: "Parts & Accessories > Car & Truck Parts > Fuel System > Carburetors"
export async function getEbayCategories(shopId) {
  const client = await ebayClient(shopId);
  const res = await client.request(
    `/commerce/taxonomy/v1/category_tree/${MOTORS_TREE_ID}`,
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`eBay taxonomy fetch failed ${res.status}: ${body}`);
  }

  const data = await res.json();
  return collectLeaves(data.rootCategoryNode);
}

// Returns required/recommended item aspects (attributes) for a leaf category.
// Used when building listing forms so merchants know what fields are mandatory.
export async function getCategoryAspects(shopId, categoryId) {
  const client = await ebayClient(shopId);
  const res = await client.request(
    `/commerce/taxonomy/v1/category_tree/${MOTORS_TREE_ID}/fetch_item_aspects_for_category?category_id=${categoryId}`,
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`eBay aspects fetch failed ${res.status}: ${body}`);
  }

  return res.json();
}
