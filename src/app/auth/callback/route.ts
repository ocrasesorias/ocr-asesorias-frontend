import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const mode = requestUrl.searchParams.get('mode'); // 'login' o 'signup'
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = await createClient();
    
    // Intercambiar el código por la sesión
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      );
    }

    // Si el modo es 'signup', guardar metadata de términos aceptados
    if (mode === 'signup') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.auth.updateUser({
          data: {
            accepted_terms: true,
            accepted_terms_at: new Date().toISOString(),
          },
        });
      }
    }

    // Redirigir al dashboard
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  // Si no hay código, redirigir a login
  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}

