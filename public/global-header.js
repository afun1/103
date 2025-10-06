const FAVICON_PATH = '/supersparky.png';

function ensureFavicon() {
    if (typeof document === 'undefined') return;
    const { head } = document;
    if (!head) return;

    const variants = [
        { rel: 'icon', type: 'image/png' },
        { rel: 'shortcut icon', type: 'image/png' },
        { rel: 'apple-touch-icon' }
    ];

    variants.forEach(({ rel, type }) => {
        let link = head.querySelector(`link[rel="${rel}"]`);
        if (!link) {
            link = document.createElement('link');
            link.rel = rel;
            head.appendChild(link);
        }
        if (type) link.type = type;
        link.href = FAVICON_PATH;
    });
}

// Global Header Component
function loadGlobalHeader() {
    ensureFavicon();
    const headerHTML = `
        <div class="header">
            <div class="header-column">
                <img src="./Sparky-AItp.gif" alt="Screen Recorder Logo" style="height: 40px; width: auto; max-height: 40px; display: block; margin: 0 10px 0 0;">
                <div style="color: white; font-weight: bold; line-height: 1.2; display: flex; flex-direction: column; justify-content: center;">
                    <div style="font-size: 14px;">Sparky Screen Recorder</div>
                </div>
            </div>
            <div class="header-column">
                <div class="nav-buttons" id="nav-buttons">
                    <button class="nav-button" onclick="navigateTo('home')">Home</button>
                    <button class="nav-button" onclick="navigateTo('customers')">Customers</button>
                    <button class="nav-button admin-only" onclick="navigateTo('videos')">Videos</button>
                    <button class="nav-button admin-only" onclick="navigateTo('users')">Users</button>
                    <button class="nav-button admin-only" onclick="navigateTo('folders')">Folders</button>
                    <button class="nav-button admin-only" onclick="navigateTo('hierarchy')">Hierarchy</button>
                </div>
            </div>
            <div class="header-column">
                <div class="user-dropdown" id="user-dropdown">
                    <button class="dropdown-toggle" id="dropdown-toggle" onclick="toggleDropdown()">
                        <span id="user-name">Loading...</span>
                        <span class="chevron">▼</span>
                    </button>
                    <div class="dropdown-menu" id="dropdown-menu">
                        <div class="dropdown-item role" id="user-role">Loading...</div>
                        <div class="dropdown-item email" id="user-email">Loading...</div>
                        <div class="dropdown-item logout" onclick="logout()">Logout</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const headerCSS = `
        <style>
            /* Ensure body accounts for sticky header */
            body {
                padding-top: 50px;
            }
            
            body.has-sticky-header {
                padding-top: 50px;
            }
            
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: grid;
                grid-template-columns: max-content 1fr 450px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                min-height: 50px;
                height: 50px;
                margin: 0;
                padding: 0;
                overflow: visible;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                width: 100%;
                z-index: 100000;
            }

            .header-column {
                padding: 0;
                border: 3px solid white;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255, 255, 255, 0.1);
                margin: 0;
                height: 100%;
            }

            .header-column:nth-child(1) {
                background: transparent;
                border: none;
                justify-content: flex-start;
                padding: 0;
                margin: 0;
            }

            .header-column:nth-child(2) {
                background: transparent;
                border: none;
            }

            .header-column:nth-child(3) {
                background: transparent;
                border: none;
                justify-content: flex-end;
                padding: 0;
                margin: 0;
                position: relative;
                overflow: visible;
                z-index: 100001;
            }

            .user-dropdown {
                position: relative;
                display: inline-block;
                z-index: 100002;
            }

            .dropdown-toggle {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 1rem;
                background: transparent;
                color: white;
                border: none;
                cursor: pointer;
                font-weight: 500;
                font-size: 18px;
            }

            .dropdown-toggle:hover {
                background: rgba(255, 255, 255, 0.1);
            }

            .chevron {
                transition: transform 0.3s;
                color: #dc2626;
            }

            .dropdown-toggle.active .chevron {
                transform: rotate(180deg);
            }

            .dropdown-menu {
                position: absolute;
                top: calc(100% + 5px);
                right: 0;
                background: white;
                border: 1px solid #333;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                min-width: 200px;
                z-index: 999999;
                display: none;
                white-space: nowrap;
            }

            .dropdown-menu.show {
                display: block;
            }

            .dropdown-item {
                padding: 0.75rem 1rem;
                color: #333;
                border-bottom: 1px solid #eee;
                font-size: 14px;
            }

            .dropdown-item:last-child {
                border-bottom: none;
            }

            .dropdown-item.role {
                font-weight: 600;
                background: #e3f2fd;
                color: #1565c0;
                font-size: 13px;
            }

            .dropdown-item.email {
                font-weight: bold;
                background: #f8f9fa;
            }

            .dropdown-item.logout {
                cursor: pointer;
                color: #dc3545;
                font-weight: 500;
            }

            .dropdown-item.logout:hover {
                background: #f8f9fa;
            }

            .nav-buttons {
                display: flex;
                gap: 0.5rem;
                justify-content: center;
                align-items: center;
                flex-wrap: wrap;
                position: absolute;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                z-index: 10;
            }

            .nav-button {
                padding: 0;
                border: none;
                border-radius: 6px;
                font-size: 0.8rem;
                font-weight: 600;
                cursor: pointer;
                color: white;
                background: linear-gradient(180deg, #87ceeb 0%, #1e3a8a 100%);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
                transition: all 0.2s ease;
                width: 90px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                flex-shrink: 0;
                white-space: nowrap;
                overflow: hidden;
            }

            .nav-button:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.7);
                background: linear-gradient(180deg, #bfdbfe 0%, #1e40af 100%);
            }

            .nav-button:active {
                transform: translateY(1px);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
                background: linear-gradient(180deg, #93c5fd 0%, #1e3a8a 100%);
            }

            .nav-button:focus, .nav-button.focused, .nav-button.active {
                outline: none;
                width: 90px;
                height: 33px;
                color: #1e40af;
                background: linear-gradient(180deg, #86efac 0%, #15803d 100%);
                box-shadow: 
                    0 0 20px rgba(34, 197, 94, 1),
                    0 0 40px rgba(34, 197, 94, 0.8),
                    0 0 60px rgba(34, 197, 94, 0.6),
                    0 4px 8px rgba(34, 197, 94, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3);
                font-weight: 700;
                border: 2px solid rgba(34, 197, 94, 0.9);
                animation: greenGlow 2s ease-in-out infinite alternate;
            }

            @keyframes greenGlow {
                0% {
                    box-shadow: 
                        0 0 20px rgba(34, 197, 94, 1),
                        0 0 40px rgba(34, 197, 94, 0.8),
                        0 0 60px rgba(34, 197, 94, 0.6),
                        0 4px 8px rgba(34, 197, 94, 0.4),
                        inset 0 1px 0 rgba(255, 255, 255, 0.3);
                }
                100% {
                    box-shadow: 
                        0 0 30px rgba(34, 197, 94, 1),
                        0 0 50px rgba(34, 197, 94, 0.9),
                        0 0 80px rgba(34, 197, 94, 0.7),
                        0 6px 12px rgba(34, 197, 94, 0.5),
                        inset 0 1px 0 rgba(255, 255, 255, 0.4);
                }
            }

            .nav-button:focus:hover, .nav-button.focused:hover, .nav-button.active:hover {
                transform: translateY(-1px);
                box-shadow: 
                    0 0 35px rgba(34, 197, 94, 1),
                    0 0 60px rgba(34, 197, 94, 0.9),
                    0 0 90px rgba(34, 197, 94, 0.8),
                    0 8px 16px rgba(34, 197, 94, 0.6),
                    inset 0 1px 0 rgba(255, 255, 255, 0.5);
                animation: none;
            }

            /* Responsive button sizing */
            @media (max-width: 1200px) {
                .nav-button {
                    width: 80px;
                    height: 30px;
                    font-size: 0.7rem;
                }
                .nav-button:focus, .nav-button.focused, .nav-button.active {
                    width: 76px;
                    height: 28px;
                }
                .nav-buttons {
                    gap: 0.4rem;
                }
            }

            @media (max-width: 900px) {
                .nav-button {
                    width: 70px;
                    height: 28px;
                    font-size: 0.65rem;
                }
                .nav-button:focus, .nav-button.focused, .nav-button.active {
                    width: 66px;
                    height: 26px;
                }
                .nav-buttons {
                    gap: 0.3rem;
                }
            }

            @media (max-width: 768px) {
                .nav-button {
                    width: 60px;
                    height: 26px;
                    font-size: 0.6rem;
                }
                .nav-button:focus, .nav-button.focused, .nav-button.active {
                    width: 56px;
                    height: 24px;
                }
                .nav-buttons {
                    gap: 0.25rem;
                    flex-wrap: wrap;
                }
            }

            @media (max-width: 600px) {
                .nav-button {
                    width: 50px;
                    height: 24px;
                    font-size: 0.55rem;
                }
                .nav-button:focus, .nav-button.focused, .nav-button.active {
                    width: 46px;
                    height: 22px;
                }
                .nav-buttons {
                    gap: 0.2rem;
                }
            }

            .nav-button.active {
                background: linear-gradient(180deg, #34d399 0%, #059669 100%);
                box-shadow: 0 4px 8px rgba(22, 163, 74, 0.6);
                color: white;
            }

            /* Role-based navigation visibility */
            .nav-button.admin-only.hidden {
                display: none !important;
            }
        </style>
    `;

    // Inject CSS and HTML
    document.head.insertAdjacentHTML('beforeend', headerCSS);
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
    
    // Add sticky header class to body for proper layout
    document.body.classList.add('has-sticky-header');

    // Load Supabase and initialize functionality
    loadSupabaseScript();
}

function loadSupabaseScript() {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@supabase/supabase-js@2';
    script.onload = initializeHeader;
    document.head.appendChild(script);
}

function initializeHeader() {
    // Initialize Supabase
    const supabaseUrl = 'https://bwvxctexiseobyqcublc.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3dnhjdGV4aXNlb2J5cWN1YmxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNzc1NzMsImV4cCI6MjA3MDg1MzU3M30.7QGmKxE24-BfbEJpxFrxORAJuN_ZLzt9-d6904Gx0ug';
    
    // Check if Supabase library is loaded
    if (window.supabase && window.supabase.createClient) {
        window.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    } else {
        console.error('Supabase library not loaded properly');
        return;
    }

    loadUserProfile();
    setActiveNavButton();
    
    // Listen for auth state changes
    window.supabase.auth.onAuthStateChange((event, session) => {
        loadUserProfile();
    });
}

async function loadUserProfile() {
    try {
        const { data: { session }, error } = await window.supabase.auth.getSession();
        if (error || !session) {
            document.getElementById('user-name').textContent = 'Not Logged In';
            document.getElementById('user-email').textContent = 'Please log in';
            document.getElementById('user-role').textContent = 'Guest';
            updateNavigationVisibility('Guest');
            // Expose guest profile
            window.headerUserProfile = { displayName: 'Not Logged In', email: '', role: 'Guest' };
            document.body.setAttribute('data-user-name','');
            document.body.setAttribute('data-user-email','');
            document.body.setAttribute('data-user-role','Guest');
            document.dispatchEvent(new CustomEvent('profileLoaded',{detail: window.headerUserProfile}));
            return;
        }
        const { data: profile, error: profileError } = await window.supabase
            .from('profiles')
            .select('display_name, email, role')
            .eq('id', session.user.id)
            .single();
        if (profileError) {
            const displayName = session.user.user_metadata?.display_name || `${session.user.user_metadata?.first_name || ''} ${session.user.user_metadata?.last_name || ''}`.trim() || 'User';
            document.getElementById('user-name').textContent = displayName;
            document.getElementById('user-email').textContent = session.user.email;
            document.getElementById('user-role').textContent = 'User';
            updateNavigationVisibility('User');
            window.headerUserProfile = { displayName, email: session.user.email, role: 'User' };
        } else {
            const displayName = profile.display_name || 'User';
            const email = profile.email || session.user.email;
            const role = profile.role || 'User';
            document.getElementById('user-name').textContent = displayName;
            document.getElementById('user-email').textContent = email;
            document.getElementById('user-role').textContent = role;
            updateNavigationVisibility(role);
            window.headerUserProfile = { displayName, email, role };
        }
    // Persist and expose for other scripts (recording page)
        try { localStorage.setItem('currentUser', JSON.stringify(window.headerUserProfile)); } catch(e) {}
        document.body.setAttribute('data-user-name', window.headerUserProfile.displayName || '');
        document.body.setAttribute('data-user-email', window.headerUserProfile.email || '');
        document.body.setAttribute('data-user-role', window.headerUserProfile.role || '');
        // Provide a stable accessor
        window.getCurrentUser = function(){ return window.headerUserProfile; };
        document.dispatchEvent(new CustomEvent('profileLoaded',{detail: window.headerUserProfile}));
    } catch (error) {
        console.error('Error loading user profile:', error);
        document.getElementById('user-name').textContent = 'Error';
        document.getElementById('user-email').textContent = 'Could not load profile';
        document.getElementById('user-role').textContent = 'Unknown';
        updateNavigationVisibility('Unknown');
        window.headerUserProfile = { displayName: 'Error', email: '', role: 'Unknown' };
        document.body.setAttribute('data-user-name','');
        document.body.setAttribute('data-user-email','');
        document.body.setAttribute('data-user-role','Unknown');
        document.dispatchEvent(new CustomEvent('profileLoaded',{detail: window.headerUserProfile}));
    }
}

function updateNavigationVisibility(userRole) {
    const role = userRole?.toLowerCase() || 'guest';
    
    // Get all navigation buttons
    const homeButton = document.querySelector('[onclick="navigateTo(\'home\')"]');
    const customersButton = document.querySelector('[onclick="navigateTo(\'customers\')"]');
    const videosButton = document.querySelector('[onclick="navigateTo(\'videos\')"]');
    const usersButton = document.querySelector('[onclick="navigateTo(\'users\')"]');
    const foldersButton = document.querySelector('[onclick="navigateTo(\'folders\')"]');
    const hierarchyButton = document.querySelector('[onclick="navigateTo(\'hierarchy\')"]');
    
    // Role-based navigation visibility
    const showButton = (button, show) => {
        if (button) {
            button.style.display = show ? 'inline-block' : 'none';
        }
    };
    
    // Define access rules based on role
    switch (role) {
        case 'admin':
        case 'manager':
        case 'supervisor':
            // Admin, Manager, Supervisor can see everything with full editing rights
            showButton(homeButton, true);
            showButton(customersButton, true);
            showButton(videosButton, true);
            showButton(usersButton, true);
            showButton(foldersButton, true);
            showButton(hierarchyButton, true);
            break;
            
        case 'user':
            // Regular users can only see home and customers (read-only)
            showButton(homeButton, true);
            showButton(customersButton, true);
            showButton(videosButton, false);
            showButton(usersButton, false);
            showButton(foldersButton, false);
            showButton(hierarchyButton, false);
            break;
            
        default:
            // Guest or unknown role - hide everything except home
            showButton(homeButton, true);
            showButton(customersButton, false);
            showButton(videosButton, false);
            showButton(usersButton, false);
            showButton(foldersButton, false);
            showButton(hierarchyButton, false);
            break;
    }
    
    // Also handle legacy admin-only class buttons
    const adminOnlyButtons = document.querySelectorAll('.nav-button.admin-only');
    adminOnlyButtons.forEach(button => {
        if (role === 'admin' || role === 'manager' || role === 'supervisor') {
            button.classList.remove('hidden');
        } else {
            button.classList.add('hidden');
        }
    });
}

function setActiveNavButton() {
    const currentPage = window.location.pathname;
    const buttons = document.querySelectorAll('.nav-button');
    
    // Remove active class from all buttons
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Set active button based on current page
    let activeButton = null;
    if (currentPage === '/' || currentPage === '/index.html') {
        activeButton = document.querySelector('[onclick="navigateTo(\'home\')"]');
    } else if (currentPage === '/customers.html') {
        activeButton = document.querySelector('[onclick="navigateTo(\'customers\')"]');
    } else if (currentPage === '/videos.html') {
        activeButton = document.querySelector('[onclick="navigateTo(\'videos\')"]');
    } else if (currentPage === '/users.html') {
        activeButton = document.querySelector('[onclick="navigateTo(\'users\')"]');
    } else if (currentPage === '/folders.html') {
        activeButton = document.querySelector('[onclick="navigateTo(\'folders\')"]');
    } else if (currentPage === '/hierarchy.html') {
        activeButton = document.querySelector('[onclick="navigateTo(\'hierarchy\')"]');
    }
    
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

function toggleDropdown() {
    const toggle = document.getElementById('dropdown-toggle');
    const menu = document.getElementById('dropdown-menu');
    
    toggle.classList.toggle('active');
    menu.classList.toggle('show');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown && !dropdown.contains(event.target)) {
        document.getElementById('dropdown-toggle').classList.remove('active');
        document.getElementById('dropdown-menu').classList.remove('show');
    }
});

async function navigateTo(page) {
    console.log(`Navigating to: ${page}`);
    
    try {
        // Check authentication first using Supabase
        if (!window.supabase) {
            console.log('⏳ Waiting for Supabase to load...');
            setTimeout(() => navigateTo(page), 100);
            return;
        }

        const { data: { session }, error } = await window.supabase.auth.getSession();
        
        if (error || !session) {
            console.log('🔒 User not authenticated - redirecting to login');
            window.location.href = '/login.html';
            return;
        }

        // Get user profile to check role
        const { data: profile, error: profileError } = await window.supabase
            .from('profiles')
            .select('role')
            .eq('email', session.user.email)
            .single();

        if (profileError) {
            console.error('Profile fetch error:', profileError);
            console.log('🔒 Profile access denied - redirecting to login');
            window.location.href = '/login.html';
            return;
        }

        const userRole = profile?.role?.toLowerCase() || 'user';
        
        // Define role-based access rules
        const roleAccess = {
            'admin': ['home', 'customers', 'videos', 'users', 'folders', 'hierarchy'],
            'manager': ['home', 'customers', 'videos', 'users', 'folders', 'hierarchy'],
            'supervisor': ['home', 'customers', 'videos', 'users', 'folders', 'hierarchy'],
            'user': ['home', 'customers']
        };
        
        // Check if user has access to this page
        if (!roleAccess[userRole] || !roleAccess[userRole].includes(page)) {
            console.log(`🚫 Access denied - ${userRole} cannot access ${page}`);
            alert(`Access denied. You do not have permission to access the ${page} page.`);
            return;
        }
    } catch (error) {
        console.error('Navigation auth check error:', error);
        window.location.href = '/login.html';
        return;
    }
    
    // Check if we're already on the target page
    const currentPage = window.location.pathname;
    let targetPage = '';
    
    switch(page) {
        case 'home':
            targetPage = '/';
            break;
        case 'customers':
            targetPage = '/customers.html';
            break;
        case 'videos':
            targetPage = '/videos.html';
            break;
        case 'users':
            targetPage = '/users.html';
            break;
        case 'folders':
            targetPage = '/folders.html';
            break;
        case 'hierarchy':
            targetPage = '/hierarchy.html';
            break;
        default:
            console.log(`Unknown page: ${page}`);
            return;
    }
    
    // Don't navigate if we're already on the target page
    if (currentPage === targetPage || (page === 'home' && (currentPage === '/' || currentPage === '/index.html'))) {
        return;
    }
    
    // Navigate to the page
    console.log(`✅ Access granted - navigating to ${targetPage}`);
    window.location.href = targetPage;
}

async function logout() {
    try {
        await window.supabase.auth.signOut();
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Expose functions for inline event handlers
window.toggleDropdown = toggleDropdown;
window.navigateTo = navigateTo;
window.logout = logout;
// Load header when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGlobalHeader);
} else {
    loadGlobalHeader();
}