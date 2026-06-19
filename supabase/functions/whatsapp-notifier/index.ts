import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const whatsappPhoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const whatsappAccessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const payload = await req.json();
    const { record } = payload; // Registro recebido do Supabase Database Trigger (Webhook)

    if (!record || record.type !== "WhatsApp" || record.status !== "QUEUED") {
      return new Response(JSON.stringify({ message: "No action required" }), { status: 200 });
    }

    const { id, target, content } = record;

    // Limpa caracteres especiais do telefone de destino
    let cleanedTarget = target.replace(/\D/g, "");

    // Se o número possuir 10 ou 11 dígitos, é o formato nacional brasileiro (sem DDI)
    // Adiciona o DDI '55' no início para a Meta Graph API aceitar corretamente
    if (cleanedTarget.length === 10 || cleanedTarget.length === 11) {
      cleanedTarget = `55${cleanedTarget}`;
    }

    console.info(`📱 Disparando WhatsApp oficial para ${cleanedTarget}...`);

    const metaUrl = `https://graph.facebook.com/v20.0/${whatsappPhoneNumberId}/messages`;

    // Corpo da requisição para mensagem de texto simples
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanedTarget,
      type: "text",
      text: {
        preview_url: false,
        body: content
      }
    };

    const response = await fetch(metaUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const resData = await response.json();

    if (response.ok) {
      // Atualiza status da notificação para enviado
      await supabase
        .from("notifications")
        .update({ status: "SENT", sent_at: new Date().toISOString() })
        .eq("id", id);
      
      console.info(`✅ WhatsApp oficial enviado com sucesso para ${cleanedTarget}`);
    } else {
      // Atualiza status da notificação para erro
      await supabase
        .from("notifications")
        .update({ status: "FAILED", error_message: JSON.stringify(resData.error) })
        .eq("id", id);

      console.error(`❌ Erro no disparo da Meta API:`, resData.error);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Erro interno no disparo de notificação WhatsApp:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
