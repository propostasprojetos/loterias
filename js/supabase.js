// ==========================================
// supabase.js - Supabase Client Setup
// ==========================================

const SUPABASE_URL = 'https://klrivylidketfbaakbil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtscml2eWxpZGtldGZiYWFrYmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDg3MTEsImV4cCI6MjA5NTM4NDcxMX0.hM-wBFJV8mUlUj1G0QhDtBrJ4Xcb0L4HBel0dR0bi7s';

export let supabaseClient = null;
export let sbReady = false;

export async function initSupabase() {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabaseClient = supabaseClient;
        sbReady = true;
        window.sbReady = true;
        console.log('Supabase initialized successfully');
        return true;
    } catch (e) {
        console.warn('Supabase not available:', e.message);
        sbReady = false;
        window.sbReady = false;
    }
    return false;
}
