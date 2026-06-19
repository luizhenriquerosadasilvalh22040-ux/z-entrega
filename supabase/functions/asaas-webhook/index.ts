import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const expectedWebhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const receivedToken = req.headers.get("asaas-access-token");
    if (!receivedToken || receivedToken !== expectedWebhookToken) {
      console.warn("⚠️ Tentativa de webhook não autorizada ou token inválido.");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { event, payment } = await req.json();
    if (!payment) {
      return new Response(JSON.stringify({ error: "Missing payment body" }), { status: 400 });
    }

    const asaasPaymentId = payment.id;
    const orderId = payment.externalReference;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.info(`💳 Evento "${event}" recebido para pagamento ${asaasPaymentId} (Pedido: ${orderId})`);

    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("status, merchant_id")
        .eq("id", orderId)
        .single();

      if (fetchError || !order) {
        console.error(`❌ Pedido ${orderId} não encontrado no banco.`);
        return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
      }

      if (order.status === "PENDING") {
        await supabase
          .from("orders")
          .update({ payment_status: "RECEIVED", status: "ACCEPTED" })
          .eq("id", orderId);

        await supabase
          .from("order_status_history")
          .insert({ order_id: orderId, status: "ACCEPTED" });

        console.info(`✅ Pedido ${orderId} atualizado com sucesso devido ao pagamento.`);
      }
    } else if (event === "PAYMENT_OVERDUE") {
      await supabase
        .from("orders")
        .update({ payment_status: "OVERDUE", status: "CANCELLED" })
        .eq("id", orderId);

      await supabase
        .from("order_status_history")
        .insert({ order_id: orderId, status: "CANCELLED" });

      console.info(`❌ Pedido ${orderId} cancelado por expiração de PIX.`);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Erro interno no processamento do webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
