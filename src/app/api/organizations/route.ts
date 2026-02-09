import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const [supabase, body] = await Promise.all([
      createClient(),
      request.json().catch(() => null),
    ]);

    // Verificar que el usuario esté autenticado.
    // No usamos requireAuth() aquí porque esta ruta se usa cuando
    // el usuario aún NO tiene organización (onboarding).
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Obtener el nombre de la organización del body
    const { org_name } = body ?? {};

    if (!org_name || typeof org_name !== 'string' || org_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'El nombre de la organización es requerido' },
        { status: 400 }
      );
    }

    // Llamar a la función SQL create_organization
    const { data, error } = await supabase.rpc('create_organization', {
      org_name: org_name.trim(),
    });

    if (error) {
      console.error('Error al crear organización:', error);
      return NextResponse.json(
        { error: error.message || 'Error al crear la organización' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      organization: data 
    }, { status: 201 });

  } catch (error) {
    console.error('Error inesperado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

