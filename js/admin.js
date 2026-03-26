document.addEventListener('DOMContentLoaded', () => {
    // 1. Guard route: redirect if not admin or not logged in
    const user = Auth.guard('admin');
    if (!user) return; // Wait for redirect

    // Display Name
    document.querySelectorAll('.username-display').forEach(el => {
        el.textContent = user.username;
    });

    // Navigation Switcher
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.id !== 'logoutBtn') {
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    });

    // Load Data
    loadAdminDashboard();
});

async function loadAdminDashboard() {
    const db = await DataStore.load();
    const users = db.users || [];
    const complaints = db.complaints || [];
    
    // 1. Compute Stats
    const totalUsers = users.length;
    const totalComplaints = complaints.length;
    
    let resolvedCount = 0;
    let ngoCount = 0;
    
    complaints.forEach(c => {
        if(c.status === 'Resolved') resolvedCount++;
    });
    
    users.forEach(u => {
        if(u.role === 'ngo') ngoCount++;
    });

    const resolutionRate = totalComplaints > 0 ? Math.round((resolvedCount / totalComplaints) * 100) : 0;

    document.getElementById('stat-users').textContent = totalUsers;
    document.getElementById('stat-complaints').textContent = totalComplaints;
    document.getElementById('stat-resolution').textContent = `${resolutionRate}%`;
    document.getElementById('stat-ngos').textContent = ngoCount;

    // 2. Chart Simulation (Complaints distribution by Area)
    const areas = ['Downtown', 'Northridge', 'Westwood', 'Eastside', 'Southpark'];
    const areaCounts = {};
    areas.forEach(a => areaCounts[a] = 0);
    
    complaints.forEach(c => {
        if(areaCounts[c.area] !== undefined) {
            areaCounts[c.area]++;
        }
    });

    // maxCount sets the 100% height limit of the chart
    const maxCount = Math.max(...Object.values(areaCounts), 1);

    const chart = document.getElementById('barChart');
    const labels = document.getElementById('chartLabels');
    chart.innerHTML = '';
    labels.innerHTML = '';

    areas.forEach(a => {
        // Initial height set to 0 to allow animation to trigger
        const finalHeightPct = (areaCounts[a] / maxCount) * 100;
        
        const barStr = `<div class="bar" style="height: 0%; position: relative;" data-height="${finalHeightPct}%">
            <span style="position: absolute; top: -25px; left: 50%; transform: translateX(-50%); color: var(--text-main); font-weight: bold;">${areaCounts[a]}</span>
        </div>`;
        chart.innerHTML += barStr;
        
        labels.innerHTML += `<div style="width: 60px; text-align: center;">${a.substring(0, 5)}...</div>`;
    });
    
    // Animating heights via setTimeout
    setTimeout(() => {
        const bars = document.querySelectorAll('.bar');
        bars.forEach(bar => {
            bar.style.height = bar.getAttribute('data-height');
        });
    }, 100);

    // 3. Populate Directory
    const tbody = document.getElementById('usersBody');
    tbody.innerHTML = '';
    
    users.forEach((u, index) => {
        const tr = document.createElement('tr');
        
        let roleBadge = 'badge-blue';
        if(u.role === 'admin') roleBadge = 'badge-red';
        if(u.role === 'authority') roleBadge = 'badge-orange';
        if(u.role === 'ngo') roleBadge = 'badge-green';

        let btn = `<button class="btn btn-sm btn-outline" onclick="deleteUser('${u.username}')" style="color: var(--danger-color); border-color: var(--danger-color);">Revoke Access</button>`;
        
        // Block removing admins 
        if(u.role === 'admin') {
            btn = `<button class="btn btn-sm btn-outline" disabled style="opacity:0.5;">Superuser</button>`;
        }

        tr.innerHTML = `
            <td style="font-weight: 500;">@${u.username}</td>
            <td><span class="badge ${roleBadge}">${u.role.toUpperCase()}</span></td>
            <td>${btn}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Global scope actions
window.deleteUser = async function(username) {
    if(!confirm(`Are you absolutely sure you want to permanently remove user @${username}?`)) return;
    
    const db = await DataStore.load();
    db.users = (db.users || []).filter(u => u.username !== username);
    await DataStore.save(db);
    
    AppUtils.showAlert(`User access for @${username} revoked.`, 'success');
    loadAdminDashboard();
};

window.resetDatabase = async function() {
    if(!confirm("DANGER: This action will permanently delete all complaints, users, and settings from data.json. A factory reset will occur. Proceed?")) return;
    
    // Nuke database file contents completely (server will throw or we can just send empty arrays)
    const freshDb = {
        users: [
            { username: 'admin', password: 'password', role: 'admin' },
            { username: 'ngo1', password: 'password', role: 'ngo' },
            { username: 'authority1', password: 'password', role: 'authority' },
            { username: 'citizen1', password: 'password', role: 'citizen' }
        ],
        complaints: [],
        resources: []
    };
    await DataStore.save(freshDb);
    
    localStorage.clear();
    
    // Logout and refresh will naturally trigger initDB to restore demo data if we needed to, but data is fresh
    window.location.href = 'index.html';
};
