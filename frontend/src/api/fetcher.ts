export async function fetcher<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  // Prepend VITE_API_URL if url is relative
  const baseUrl = import.meta.env.VITE_API_URL;
  const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
  const res = await fetch(fullUrl, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
