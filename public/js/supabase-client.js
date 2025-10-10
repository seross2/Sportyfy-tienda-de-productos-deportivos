import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Variable para almacenar la instancia única del cliente de Supabase
let supabase = null;

/**
 * Obtiene la configuración de Supabase desde el backend.
 * @returns {Promise<{supabaseUrl: string, supabaseAnonKey: string}>}
 */
async function fetchConfig() {
    const response = await fetch('/api/config');
    if (!response.ok) {
        throw new Error('No se pudo obtener la configuración del servidor.');
    }
    return response.json();
}

/**
 * Crea y devuelve una instancia única (singleton) del cliente de Supabase.
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
export async function getSupabase() {
    if (!supabase) {
        const config = await fetchConfig();
        supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
    return supabase;
}