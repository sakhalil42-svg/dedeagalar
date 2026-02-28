"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const AUDIT_KEY = ["audit_log"];

export interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: "create" | "update" | "delete" | "restore";
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  user_email: string | null;
  created_at: string;
}

export function useAuditLog(limit = 50) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...AUDIT_KEY, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as AuditEntry[];
    },
  });
}

export async function writeAuditLog(params: {
  table_name: string;
  record_id: string;
  action: "create" | "update" | "delete" | "restore";
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
}) {
  const supabase = createClient();

  // Get current user email
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email || null;

  await supabase.from("audit_log").insert({
    table_name: params.table_name,
    record_id: params.record_id,
    action: params.action,
    old_values: params.old_values || null,
    new_values: params.new_values || null,
    user_email: email,
  });
}
