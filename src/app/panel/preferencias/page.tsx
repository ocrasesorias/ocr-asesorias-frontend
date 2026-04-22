 'use client';
 
 import { useEffect, useState } from 'react';
 import Image from 'next/image';
 import Link from 'next/link';
 import { useRouter } from 'next/navigation';
 import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/Button';
import { Switch } from '@heroui/react';
 import { useToast } from '@/contexts/ToastContext';
 import { translateError } from '@/utils/errorMessages';
 
 export default function PreferenciasPage() {
   const router = useRouter();
   const { showError, showSuccess } = useToast();
 
   const [isLoading, setIsLoading] = useState(true);
   const [isSaving, setIsSaving] = useState(false);
   const [orgId, setOrgId] = useState<string | null>(null);
   const [orgName, setOrgName] = useState<string>('');
   const [uppercaseNamesAddresses, setUppercaseNamesAddresses] = useState(true);
   const [workingQuarter, setWorkingQuarter] = useState<string>('');
   const [accountingProgram, setAccountingProgram] = useState<'monitor' | 'contasol' | 'a3'>('monitor');
   const [canEdit, setCanEdit] = useState(true);
 
   useEffect(() => {
     const run = async () => {
       setIsLoading(true);
       try {
         const supabase = createClient();

         // getUser() valida el JWT contra el servidor (más seguro que getSession())
         const { data: { user }, error: authError } = await supabase.auth.getUser();
         if (authError || !user) {
           router.push('/login?redirect=/panel/preferencias');
           return;
         }
 
         const { data: memberships, error: membershipError } = await supabase
           .from('organization_members')
           .select('org_id, role')
           .eq('user_id', user.id)
           .limit(1);
 
         if (membershipError || !memberships || memberships.length === 0) {
           router.push('/panel/bienvenida');
           return;
         }
 
         const currentOrgId = memberships[0].org_id as string;
         const role = String(memberships[0].role || '').toLowerCase();
         setCanEdit(role === 'owner');
         setOrgId(currentOrgId);
 
         const { data: organization } = await supabase
           .from('organizations')
           .select('name')
           .eq('id', currentOrgId)
           .maybeSingle();
 
         setOrgName(organization?.name || 'Preferencias');
 
         const prefResp = await fetch(`/api/organizations/${encodeURIComponent(currentOrgId)}/preferences`);
         const prefJson = await prefResp.json().catch(() => null);
         if (!prefResp.ok) {
           showError(translateError(prefJson?.error || 'Error cargando preferencias'));
         } else {
           const v = prefJson?.uppercase_names_addresses;
           setUppercaseNamesAddresses(typeof v === 'boolean' ? v : true);
           const wq = prefJson?.working_quarter;
           setWorkingQuarter(typeof wq === 'string' && /^Q[1-4]$/.test(wq) ? wq : '');
           const ap = prefJson?.accounting_program;
           setAccountingProgram(ap === 'contasol' ? 'contasol' : ap === 'a3' ? 'a3' : 'monitor');
         }
       } catch (err) {
         console.error('Error cargando preferencias:', err);
         showError('Error cargando preferencias');
       } finally {
         setIsLoading(false);
       }
     };
 
     run();
   }, [router, showError]);
 
   const handleSave = async () => {
     if (!orgId || !canEdit) return;
     setIsSaving(true);
     try {
       const resp = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/preferences`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           uppercase_names_addresses: uppercaseNamesAddresses,
           working_quarter: workingQuarter || null,
           accounting_program: accountingProgram,
         }),
       });
       const data = await resp.json().catch(() => null);
       if (!resp.ok) {
         showError(translateError(data?.error || 'Error guardando preferencias'));
         return;
       }
       showSuccess('Preferencias guardadas');
     } catch (err) {
       console.error('Error guardando preferencias:', err);
       showError('Error guardando preferencias');
     } finally {
       setIsSaving(false);
     }
   };
 
   if (isLoading) {
     return (
       <div className="min-h-screen bg-background flex items-center justify-center">
         <div className="text-center">
           <img src="/img/logo.png" alt="KontaScan" className="h-16 w-auto mx-auto mb-4 animate-pulse" />
           <p className="text-foreground-secondary">Cargando preferencias...</p>
         </div>
       </div>
     );
   }
 
   return (
     <div className="min-h-screen bg-background">
       <header className="bg-[var(--l-card,#ffffff)] border-b border-[var(--l-card-border,#e5e7eb)] text-foreground">
         <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/img/logo.png"
                alt="KontaScan"
                width={100}
                height={100}
                className="h-10 w-auto"
                priority
              />
              <span className="text-2xl font-bold text-primary">KontaScan</span>
            </Link>
          </div>
         </div>
       </header>
 
       <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
         <div className="mb-8 flex items-center gap-3">
           <Link
             href="/panel"
             className="p-2 -ml-2 rounded-none text-foreground-secondary hover:text-foreground hover:bg-primary/5 transition-colors shrink-0"
             aria-label="Volver al panel"
             title="Volver al panel"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
             </svg>
           </Link>
           <div>
             <h1 className="text-3xl font-light text-foreground mb-2">Preferencias</h1>
             <p className="text-foreground-secondary">
               Configuración para {orgName || 'tu organización'}.
             </p>
           </div>
         </div>
 
         <div className="bg-[var(--l-card,#ffffff)] rounded-none shadow-sm border border-[var(--l-card-border,#e5e7eb)] p-6">
           <div className="flex items-start justify-between gap-6">
             <div className="min-w-0">
               <h2 className="text-lg font-semibold text-foreground">
                 Mayúsculas en nombres y direcciones
               </h2>
               <p className="text-sm text-foreground-secondary mt-2">
                 Cuando está activado, los nombres y direcciones se convierten a mayúsculas al validar y exportar.
               </p>
               {!canEdit && (
                 <p className="text-sm text-amber-600 mt-2">
                   Solo el propietario puede modificar esta preferencia.
                 </p>
               )}
             </div>
            <Switch
              isSelected={uppercaseNamesAddresses}
              onValueChange={setUppercaseNamesAddresses}
              isDisabled={!canEdit}
              color="primary"
              size="md"
              aria-label="Mayúsculas en nombres y direcciones"
              classNames={{
                wrapper: uppercaseNamesAddresses ? '' : 'bg-slate-300',
              }}
            />
           </div>

           <div className="mt-8 pt-6 border-t border-[var(--l-card-border,#e5e7eb)]">
             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
               <div className="min-w-0">
                 <h2 className="text-lg font-semibold text-foreground">
                   Programa contable
                 </h2>
                 <p className="text-sm text-foreground-secondary mt-2">
                   Formato generado al exportar facturas validadas: Monitor Informática (miConversor → miConta), ContaSol (IVS.xlsx / IVR.xlsx) o a3CON / a3ECO / a3ASESOR (SUENLACE.DAT).
                 </p>
                 {!canEdit && (
                   <p className="text-sm text-amber-600 mt-2">
                     Solo el propietario puede modificar esta preferencia.
                   </p>
                 )}
               </div>
               <select
                 value={accountingProgram}
                 onChange={(e) => {
                   const v = e.target.value
                   setAccountingProgram(v === 'contasol' ? 'contasol' : v === 'a3' ? 'a3' : 'monitor')
                 }}
                 disabled={!canEdit}
                 className="px-3 py-2 border border-[var(--l-card-border,#e5e7eb)] rounded-none bg-[var(--l-card,#ffffff)] text-foreground text-sm min-w-[240px] disabled:opacity-60 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary focus:border-transparent"
                 aria-label="Programa contable"
               >
                 <option value="monitor">Monitor Informática</option>
                 <option value="contasol">ContaSol</option>
                 <option value="a3">a3CON / a3ECO / a3ASESOR (SUENLACE.DAT)</option>
               </select>
             </div>
           </div>

           <div className="mt-8 pt-6 border-t border-[var(--l-card-border,#e5e7eb)]">
             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
               <div className="min-w-0">
                 <h2 className="text-lg font-semibold text-foreground">
                   Trimestre de trabajo
                 </h2>
                 <p className="text-sm text-foreground-secondary mt-2">
                   Trimestre sobre el que se están registrando facturas. Al validar, si la fecha de la factura no corresponde a este trimestre, se mostrará un aviso (no se bloquea la validación).
                 </p>
                 {!canEdit && (
                   <p className="text-sm text-amber-600 mt-2">
                     Solo el propietario puede modificar esta preferencia.
                   </p>
                 )}
               </div>
               <select
                 value={workingQuarter}
                 onChange={(e) => setWorkingQuarter(e.target.value)}
                 disabled={!canEdit}
                 className="px-3 py-2 border border-[var(--l-card-border,#e5e7eb)] rounded-none bg-[var(--l-card,#ffffff)] text-foreground text-sm min-w-[140px] disabled:opacity-60 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary focus:border-transparent"
                 aria-label="Trimestre de trabajo"
               >
                 <option value="">No definido</option>
                 <option value="Q1">Q1 (Ene–Mar)</option>
                 <option value="Q2">Q2 (Abr–Jun)</option>
                 <option value="Q3">Q3 (Jul–Sep)</option>
                 <option value="Q4">Q4 (Oct–Dic)</option>
               </select>
             </div>
           </div>

           <div className="mt-6 flex justify-end">
             <Button
               variant="primary"
               onClick={handleSave}
               disabled={!canEdit || isSaving}
             >
               {isSaving ? 'Guardando…' : 'Guardar cambios'}
             </Button>
           </div>
         </div>

         <div className="mt-6 bg-[var(--l-card,#ffffff)] rounded-none shadow-sm border border-[var(--l-card-border,#e5e7eb)] p-6">
           <div className="mb-4">
             <h2 className="text-lg font-semibold text-foreground">Atajos de teclado</h2>
             <p className="text-sm text-foreground-secondary mt-2">
               Acciones disponibles en la pantalla de validar factura para agilizar el flujo. De momento son fijos; próximamente podrás personalizarlos.
             </p>
           </div>
           <ul className="divide-y divide-[var(--l-card-border,#e5e7eb)]">
             {[
               { keys: ['Enter'], desc: 'Mover el foco al siguiente campo' },
               { keys: ['Shift', 'Enter'], desc: 'Mover el foco al campo anterior' },
               { keys: ['Ctrl', 'Enter'], desc: 'Validar la factura' },
               { keys: ['Ctrl', '←'], desc: 'Ir a la factura anterior' },
               { keys: ['Ctrl', '→'], desc: 'Pasar esta factura para después (siguiente)' },
               { keys: ['Ctrl', 'Shift', 'Supr'], desc: 'Eliminar la factura actual' },
               { keys: ['Esc'], desc: 'Cerrar sugerencias de autocompletar' },
             ].map((row) => (
               <li key={row.desc} className="py-3 flex items-center justify-between gap-4">
                 <span className="text-sm text-foreground">{row.desc}</span>
                 <span className="flex items-center gap-1 shrink-0">
                   {row.keys.map((k, i) => (
                     <span key={i} className="flex items-center gap-1">
                       {i > 0 && <span className="text-foreground-secondary text-xs">+</span>}
                       <kbd className="px-2 py-0.5 text-xs font-mono font-semibold bg-[var(--l-bg,#f1f5f9)] border border-[var(--l-card-border,#e5e7eb)] rounded-none text-foreground">
                         {k}
                       </kbd>
                     </span>
                   ))}
                 </span>
               </li>
             ))}
           </ul>
           <p className="text-xs text-foreground-secondary mt-4">
             En macOS, usa <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-[var(--l-bg,#f1f5f9)] border border-[var(--l-card-border,#e5e7eb)] rounded-none">⌘</kbd> en lugar de <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-[var(--l-bg,#f1f5f9)] border border-[var(--l-card-border,#e5e7eb)] rounded-none">Ctrl</kbd>.
           </p>
         </div>
       </main>
     </div>
   );
 }
