import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (request) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } } },
    );
    const { orderId, code } = await request.json();
    const { data, error } = await supabase.rpc('confirm_handover', { order_id: orderId, submitted_code: code });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
});