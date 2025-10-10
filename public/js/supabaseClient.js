import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase = null;

async function getSupabaseClient() {
    if (supabase) {
        return supabase;
    }

    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('No se pudo obtener la configuración del servidor.');
        const config = await response.json();
        if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Configuración de Supabase incompleta.');
        
        supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
        return supabase;
    } catch (error) {
        console.error("Error fatal inicializando Supabase:", error);
        return null;
    }
}

export { getSupabaseClient };