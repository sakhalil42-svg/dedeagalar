"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useCompleteParcel() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      parcelId,
      seasonId,
    }: {
      parcelId: string;
      seasonId?: string | null;
    }) => {
      // 1. Fetch parcel details
      const { data: parcel, error: parcelError } = await supabase
        .from("parcels")
        .select("*")
        .eq("id", parcelId)
        .single();

      if (parcelError || !parcel) throw new Error("Parsel bulunamadı");

      // 2. Update status to completed
      const { error: updateError } = await supabase
        .from("parcels")
        .update({ status: "completed" })
        .eq("id", parcelId);

      if (updateError) throw updateError;

      // 3. Create account transaction for field owner (credit = we owe them)
      if (parcel.owner_total_cost > 0) {
        const { data: ownerAccount } = await supabase
          .from("accounts")
          .select("id, balance")
          .eq("contact_id", parcel.contact_id)
          .single();

        if (ownerAccount) {
          const newBalance = (ownerAccount.balance || 0) + parcel.owner_total_cost;
          await supabase.from("account_transactions").insert({
            account_id: ownerAccount.id,
            type: "credit",
            amount: parcel.owner_total_cost,
            balance_after: newBalance,
            reference_type: "other",
            reference_id: parcelId,
            description: `Parsel borcu: ${parcel.parcel_name}`,
            transaction_date: new Date().toISOString().split("T")[0],
            season_id: seasonId || parcel.season_id || null,
          });
        }
      }

      // 4. Create account transaction for contractor if applicable
      if (
        parcel.baling_provider === "contractor" &&
        parcel.contractor_id &&
        parcel.contractor_cost_per_bale
      ) {
        const contractorCost = parcel.total_bales * parcel.contractor_cost_per_bale;
        if (contractorCost > 0) {
          const { data: contractorAccount } = await supabase
            .from("accounts")
            .select("id, balance")
            .eq("contact_id", parcel.contractor_id)
            .single();

          if (contractorAccount) {
            const newBalance = (contractorAccount.balance || 0) + contractorCost;
            await supabase.from("account_transactions").insert({
              account_id: contractorAccount.id,
              type: "credit",
              amount: contractorCost,
              balance_after: newBalance,
              reference_type: "other",
              reference_id: parcelId,
              description: `Balyalama borcu: ${parcel.parcel_name} (${parcel.total_bales} balya)`,
              transaction_date: new Date().toISOString().split("T")[0],
              season_id: seasonId || parcel.season_id || null,
            });
          }
        }
      }

      return parcel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parcels"] });
      queryClient.invalidateQueries({ queryKey: ["parcel"] });
      queryClient.invalidateQueries({ queryKey: ["parcel-profitability"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
