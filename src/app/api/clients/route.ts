import { requireAuth } from '@/lib/supabase/auth-guard';
import { NextResponse } from 'next/server';

/**
 * GET: lista de clientes de la organización actual (orgId del servidor).
 * Usa requireAuth() para que la org sea siempre la del backend y no se mezclen datos entre gestorías.
 */
export async function GET() {
  try {
    const { data: auth, response: authError } = await requireAuth();
    if (authError) return authError;

    const { supabase, orgId } = auth;

    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al listar clientes:', error);
      return NextResponse.json(
        { error: error.message || 'Error al cargar los clientes' },
        { status: 500 }
      );
    }

    return NextResponse.json({ clients: clients ?? [] });
  } catch (error) {
    console.error('Error inesperado en GET /api/clients:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const [authResult, body] = await Promise.all([
      requireAuth(),
      request.json().catch(() => null),
    ]);

    const { data: auth, response: authError } = authResult;
    if (authError) return authError;

    const { supabase, orgId } = auth;

    // Obtener los datos del cliente del body
    const { name, tax_id, preferred_income_account, preferred_expense_account, activity_description } = body ?? {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'El nombre del cliente es requerido' },
        { status: 400 }
      );
    }

    // Crear el cliente
    const { data, error } = await supabase
      .from('clients')
      .insert({
        org_id: orgId,
        name: name.trim(),
        tax_id: tax_id?.trim() || null,
        preferred_income_account:
          typeof preferred_income_account === 'string' && preferred_income_account.trim()
            ? preferred_income_account.trim()
            : null,
        preferred_expense_account:
          typeof preferred_expense_account === 'string' && preferred_expense_account.trim()
            ? preferred_expense_account.trim()
            : null,
        activity_description:
          typeof activity_description === 'string' && activity_description.trim()
            ? activity_description.trim()
            : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error al crear cliente:', error);
      return NextResponse.json(
        {
          error:
            error.message ||
            'Error al crear el cliente',
          details:
            process.env.NODE_ENV !== 'production'
              ? {
                  hint:
                    String(error.message || '').includes('preferred_income_account') ||
                    String(error.message || '').includes('preferred_expense_account')
                      ? 'Faltan columnas en la tabla clients. Añade preferred_income_account y preferred_expense_account (tipo text) en Supabase.'
                      : undefined,
                }
              : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      client: data 
    }, { status: 201 });

  } catch (error) {
    console.error('Error inesperado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

