import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 500,
      retry: (failureCount, error) =>
        !String(error).includes("401") && failureCount < 2,
    },
  },
});
