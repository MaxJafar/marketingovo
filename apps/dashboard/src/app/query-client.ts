import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status =
          typeof error === "object" && error && "status" in error
            ? Number(error.status)
            : 0;
        return status >= 400 && status < 500 ? false : failureCount < 2;
      },
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: { retry: false },
  },
});
