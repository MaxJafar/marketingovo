import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./app/router";
import { queryClient } from "./app/query-client";
import { SiteProvider } from "./context/site-context";
import "./styles.css";
// Loaded after the base sheet so the console frame can override the shared
// component styles the older pages still rely on.
import "./pixel.css";

const container = document.getElementById("root");
if (!container) throw new Error("Dashboard root element was not found");

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SiteProvider>
        <RouterProvider router={router} />
      </SiteProvider>
    </QueryClientProvider>
  </StrictMode>,
);
