import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: RequestInit,
): Promise<Response> {
  // Mesclar cabeçalhos personalizados com o padrão Content-Type
  const defaultHeaders: Record<string, string> = 
    data ? { "Content-Type": "application/json" } : {};
  
  // Combinar com cabeçalhos personalizados se fornecidos
  const headers = {
    ...defaultHeaders,
    ...(options?.headers || {})
  };
  
  // Construir opções de solicitação combinando as opções padrão com as personalizadas
  const fetchOptions: RequestInit = {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    // Outras opções padrão podem ser configuradas aqui
    cache: "no-cache", // Sempre buscar dados novos
    
    // Mesclar com opções personalizadas, se fornecidas
    ...options
  };
  
  console.time(`⚡ [API] ${method} ${url}`);
  
  try {
    const res = await fetch(url, fetchOptions);
    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`❌ [API] Erro na requisição ${method} ${url}:`, error);
    throw error;
  } finally {
    console.timeEnd(`⚡ [API] ${method} ${url}`);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
