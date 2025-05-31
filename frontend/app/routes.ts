import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("app/analysis", "routes/analysis.tsx"),
  route("app/billing", "routes/billing.tsx"),
  route("app/shared/:shareId", "routes/shared.$shareId.tsx"),
  route("404", "routes/404.tsx"),
  route("error", "routes/error.tsx"),
  // Catch-all route for unmatched paths
  route("*", "routes/404.tsx"),
] satisfies RouteConfig;
