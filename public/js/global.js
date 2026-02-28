import { getSupabaseClient } from '/js/supabaseClient.js';
import { showToast } from '/js/utils.js';

// Clase para manejar la lógica global (Navegación, Autenticación, Menú Móvil)
export class GlobalApp {
    constructor() {
        this.init();
    }

    async init() {
        this.renderNavigation();
        this.selectElements();
        this.setupMobileMenu();
        await this.checkAuth();
        this.setupLogout();
        this.listenForAuthChanges();
    }

    renderNavigation() {
        const nav = document.querySelector('nav');
        if (!nav) return;

        nav.innerHTML = `
            <button class="nav-toggle" aria-label="Abrir menú">
                <span class="hamburger"></span>
            </button>
            <ul class="nav-links">
                <li class="store-link"><a href="/">Productos</a></li>
                <li class="store-link"><a href="/cart.html"><img src="/icons/icono carrito.png" alt="Carrito" class="nav-icon"></a></li>
                <li class="store-link"><a href="/contact.html">Contacto</a></li>
                <li id="nav-login" class="hidden"><a href="/login.html">Login</a></li>
                <li id="nav-register" class="hidden"><a href="/register.html">Registro</a></li>
                <li id="nav-user" class="hidden"><a href="/profile.html" id="nav-user-link">Usuario</a></li>
                <li id="nav-admin" class="hidden"><a href="/admin.html">Panel Admin</a></li>
                <li id="nav-logout" class="hidden"><a href="#" id="logout-button">Cerrar Sesión</a></li>
            </ul>
        `;
    }

    selectElements() {
        this.navLogin = document.getElementById('nav-login');
        this.navRegister = document.getElementById('nav-register');
        this.navUser = document.getElementById('nav-user');
        this.navAdmin = document.getElementById('nav-admin');
        this.navLogout = document.getElementById('nav-logout');
        this.navToggle = document.querySelector('.nav-toggle');
        this.navLinks = document.querySelector('.nav-links');
    }

    setupMobileMenu() {
        if (this.navToggle && this.navLinks) {
            this.navToggle.addEventListener('click', () => {
                this.navLinks.classList.toggle('active');
                this.navToggle.classList.toggle('active');
            });
        }
    }

    async checkAuth() {
        const supabase = await getSupabaseClient();
        if (!supabase) {
            this.updateNavigation(null); // Mostrar menú por defecto si falla la conexión
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        this.updateNavigation(session);
    }

    async updateNavigation(session) {
        // Ocultar todo primero
        const navItems = [this.navLogin, this.navRegister, this.navUser, this.navAdmin, this.navLogout];
        navItems.forEach(item => { if(item) item.classList.add('hidden'); });

        if (session) {
            if(this.navUser) this.navUser.classList.remove('hidden');
            if(this.navLogout) this.navLogout.classList.remove('hidden');
            
            // Verificar rol de admin
            const supabase = await getSupabaseClient();
            const { data: profile } = await supabase
                .from('profiles')
                .select('rol')
                .eq('id', session.user.id)
                .single();
            
            if (profile && profile.rol === 'admin') {
                if(this.navAdmin) this.navAdmin.classList.remove('hidden');
            }
        } else {
            if(this.navLogin) this.navLogin.classList.remove('hidden');
            if(this.navRegister) this.navRegister.classList.remove('hidden');
        }
    }

    setupLogout() {
        if (this.navLogout) {
            this.navLogout.addEventListener('click', async (e) => {
                e.preventDefault();
                const supabase = await getSupabaseClient();
                await supabase.auth.signOut();
                showToast('Sesión cerrada correctamente.');
                setTimeout(() => window.location.href = '/', 1000);
            });
        }
    }

    async listenForAuthChanges() {
        const supabase = await getSupabaseClient();
        if (!supabase) return;

        supabase.auth.onAuthStateChange((_event, session) => {
            this.updateNavigation(session);
        });
    }
}

// Inicializar automáticamente al cargar
document.addEventListener('DOMContentLoaded', () => {
    new GlobalApp();
});