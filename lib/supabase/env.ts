const requiredPublicEnv = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  publishableKey: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
} as const;

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    const missing = Object.entries(requiredPublicEnv)
      .filter(([key]) => (key === "url" ? !url : !publishableKey))
      .map(([, name]) => name)
      .join(", ");

    throw new Error(
      `Missing Supabase environment variables: ${missing}. Copy .env.example to .env.local and add the project values.`,
    );
  }

  return { url, publishableKey };
}
