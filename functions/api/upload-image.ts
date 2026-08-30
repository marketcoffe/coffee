// Cloudflare Pages Function - Upload Image (bypass RLS with service_role)
// Location: /functions/api/upload-image.ts

declare const PagesFunction: any;

function getAllowedOrigin(request: Request, env: any): string {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s: string) => s.trim());
  if (allowed.includes(origin)) return origin;
  return allowed[0] || '';
}

function getCORSHeaders(request: Request, env: any): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(request, env),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export const onRequestOptions: any = async (context: any) => {
  const { request, env } = context;
  return new Response(null, { status: 204, headers: getCORSHeaders(request, env) });
};

export const onRequestPost: any = async (context: any) => {
  const { request, env } = context;
  const corsHeaders = getCORSHeaders(request, env);

  try {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bucket = formData.get('bucket') as string || 'productos';
    const folder = formData.get('folder') as string || 'products';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Invalid file type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large (max 5MB)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const fileExt = file.name.split('.').pop() || 'webp';
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Upload via Supabase Storage REST API with service_role
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;
    const arrayBuffer = await file.arrayBuffer();

    const uploadResp = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': file.type || 'image/webp',
        'x-upsert': 'true',
      },
      body: arrayBuffer,
    });

    if (!uploadResp.ok) {
      const errBody = await uploadResp.text();
      console.error('[upload-image] Storage error:', uploadResp.status, errBody);
      return new Response(JSON.stringify({
        error: 'Upload failed',
        details: errBody,
        status: uploadResp.status
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Build public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`;

    return new Response(JSON.stringify({ success: true, url: publicUrl, path: filePath }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('[upload-image] Exception:', error.message);
    return new Response(JSON.stringify({ error: 'Upload failed', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};
