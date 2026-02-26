"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "delivery-photos";
const PHOTOS_KEY = ["delivery-photos"];

export interface DeliveryPhoto {
  name: string;
  url: string;
}

export function useDeliveryPhotos(deliveryId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...PHOTOS_KEY, deliveryId],
    queryFn: async () => {
      const folder = `deliveries/${deliveryId}`;
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(folder, { sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      if (!data || data.length === 0) return [] as DeliveryPhoto[];

      return data
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((f) => ({
          name: f.name,
          url: supabase.storage
            .from(BUCKET)
            .getPublicUrl(`${folder}/${f.name}`).data.publicUrl,
        }));
    },
    enabled: !!deliveryId,
  });
}

export function useUploadDeliveryPhoto() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deliveryId,
      file,
    }: {
      deliveryId: string;
      file: File;
    }) => {
      const ext = file.name.split(".").pop() || "jpg";
      const timestamp = Date.now();
      const path = `deliveries/${deliveryId}/${timestamp}.${ext}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false });
      if (error) throw error;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return { name: `${timestamp}.${ext}`, url: data.publicUrl };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...PHOTOS_KEY, variables.deliveryId],
      });
    },
  });
}

export function useDeleteDeliveryPhoto() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deliveryId,
      fileName,
    }: {
      deliveryId: string;
      fileName: string;
    }) => {
      const path = `deliveries/${deliveryId}/${fileName}`;
      const { error } = await supabase.storage.from(BUCKET).remove([path]);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...PHOTOS_KEY, variables.deliveryId],
      });
    },
  });
}
