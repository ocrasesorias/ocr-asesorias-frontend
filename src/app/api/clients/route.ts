import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verificar que el usuario esté autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Obtener la organización del usuario
    const { data: memberships, error: membershipError } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1);

    if (membershipError || !memberships || memberships.length === 0) {
      return NextResponse.json(
        { error: 'No tienes una organización' },
        { status: 403 }
      );
    }

    const orgId = memberships[0].org_id;

    // Obtener los datos del cliente del body
    const body = await request.json();
    const { name, tax_id, preferred_income_account, preferred_expense_account, activity_description } = body;

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

