// Global Header Component
function loadGlobalHeader() {
    const headerHTML = `
        <div class="header">
            <div class="header-column">
                <img src="./Sparky-AItp.gif" alt="Screen Recorder Logo" style="height: 60px; width: auto; max-height: 60px; display: block; margin: 0 10px 0 0;">
                <div style="color: white; font-weight: bold; line-height: 1.1; display: flex; flex-direction: column; justify-content: center;">
                    <div style="font-size: 18px;">Sparky</div>
                    <div style="font-size: 18px;">Screen</div>
                    <div style="font-size: 18px;">Recorder</div>
                </div>
            </div>
            <div class="header-column">
                <div class="nav-buttons">
                    <button class="nav-button" onclick="navigateTo('home')">Home</button>
                    <button class="nav-button" onclick="navigateTo('customers')">Customers</button>
                    <button class="nav-button" onclick="navigateTo('videos')">Videos</button>
                    <button class="nav-button" onclick="navigateTo('users')">Users</button>
                    <button class="nav-button" onclick="navigateTo('folders')">Folders</button>
                    <button class="nav-button" onclick="navigateTo('hierarchy')">Hierarchy</button>
                </div>
            </div>
            <div class="header-column">
                <div class="user-dropdown" id="user-dropdown">
                    <button class="dropdown-toggle" id="dropdown-toggle" onclick="toggleDropdown()">
                        <span id="user-name">Loading...</span>
                        <span class="chevron">▼</span>
                    </button>
                    <div class="dropdown-menu" id="dropdown-menu">
                        <div class="dropdown-item email" id="user-email">Loading...</div>
                        <div class="dropdown-item logout" onclick="logout()">Logout</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const headerCSS = `
        <style>
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: grid;
                grid-template-columns: max-content 1fr 450px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                min-height: 80px;
                height: 80px;
                margin: 0;
                padding: 0;
                overflow: visible;
                position: sticky;
                top: 0;
                z-index: 100000;
                position: relative;
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
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.6);
                transition: all 0.2s ease;
                width: 95px;
                height: 35px;
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
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.7);
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
        </style>
    `;

    // Inject CSS and HTML
    document.head.insertAdjacentHTML('beforeend', headerCSS);
    document.body.insertAdjacentHTML('afterbegin', headerHTML);

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
    window.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

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
            return;
        }

        const { data: profile, error: profileError } = await window.supabase
            .from('profiles')
            .select('display_name, email')
            .eq('id', session.user.id)
            .single();

        if (profileError) {
            const displayName = session.user.user_metadata?.display_name || 
                              `${session.user.user_metadata?.first_name || ''} ${session.user.user_metadata?.last_name || ''}`.trim() || 
                              'User';
            document.getElementById('user-name').textContent = displayName;
            document.getElementById('user-email').textContent = session.user.email;
        } else {
            document.getElementById('user-name').textContent = profile.display_name || 'User';
            document.getElementById('user-email').textContent = profile.email || session.user.email;
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        document.getElementById('user-name').textContent = 'Error';
        document.getElementById('user-email').textContent = 'Could not load profile';
    }
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

function navigateTo(page) {
    console.log(`Navigating to: ${page}`);
    
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

// Load header when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGlobalHeader);
} else {
    loadGlobalHeader();
}