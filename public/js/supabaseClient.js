import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Variable para almacenar la instancia única del cliente de Supabase (patrón Singleton)
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
    const config = await response.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
        throw new Error('Configuración de Supabase incompleta recibida del servidor.');
    }
    return config;
}

/**
 * Crea y/o devuelve una instancia única (singleton) del cliente de Supabase.
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient|null>}
 */
export async function getSupabaseClient() {
    if (supabase) return supabase;
    
    try {
        const config = await fetchConfig();
        supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
        return supabase;
    } catch (error) {
        console.error("Error fatal inicializando Supabase:", error);
        return null;
    }
}