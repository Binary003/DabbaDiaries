import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (request) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } } },
    );
    const payload = await request.json();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    const { data, error } = await supabase.rpc('create_subscription_with_capacity', { customer: user.user.id, payload });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
});