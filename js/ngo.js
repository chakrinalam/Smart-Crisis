document.addEventListener('DOMContentLoaded', () => {
    // 1. Guard route: redirect if not ngo or not logged in
    const user = Auth.guard('ngo');
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

    // Load Tasks
    loadNgoDashboard();
});

async function loadNgoDashboard() {
    const user = Auth.getCurrentUser();
    const db = await DataStore.load();
    const allComplaints = db.complaints || [];
    
    // Filter only those assigned to THIS NGO specifically
    const myTasks = allComplaints.filter(c => c.assignedNgo === user.username);
    
    // Split into categories
    const activeTasks = myTasks.filter(c => c.status === 'Assigned');
    const completedTasks = myTasks.filter(c => c.status === 'Resolved');
    
    // 1. Populate Active Tasks
    const activeBody = document.getElementById('activeTasksBody');
    activeBody.innerHTML = '';
    
    if (activeTasks.length === 0) {
        activeBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">No active tasks assigned to you right now.</td></tr>`;
    } else {
        activeTasks.forEach(c => {
            let sevBadge = 'badge-green';
            if (c.severity === 'Medium') sevBadge = 'badge-orange';
            if (c.severity === 'High') sevBadge = 'badge-red';
            
            const resourceTxt = c.resource || 'Standard Response';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-family: monospace; font-size: 0.85rem; color: var(--text-muted);">#${c.id.substring(1, 7).toUpperCase()}</td>
                <td style="font-weight: 600;">${c.area}</td>
                <td><span class="badge ${sevBadge}">${c.severity}</span></td>
                <td><span style="background: rgba(59, 130, 246, 0.1); padding: 0.2rem 0.6rem; border-radius: 4px; color: var(--primary-color); font-size: 0.85rem; font-weight: 500;">${resourceTxt}</span></td>
                <td style="font-size: 0.85rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${c.description}">${c.description}</td>
                <td><button class="btn btn-sm btn-success" onclick="markResolved('${c.id}')" style="box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.4);">Mark Resolved ✅</button></td>
            `;
            activeBody.appendChild(tr);
        });
    }
    
    // 2. Populate Completed Tasks
    const completedBody = document.getElementById('completedTasksBody');
    completedBody.innerHTML = '';
    
    if (completedTasks.length === 0) {
        completedBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding: 2rem;">No resolved tasks in history yet.</td></tr>`;
    } else {
        // Sort descending
        completedTasks.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        completedTasks.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-family: monospace; font-size: 0.85rem; color: var(--text-muted);">#${c.id.substring(1, 7).toUpperCase()}</td>
                <td style="font-weight: 500;">${c.area}</td>
                <td style="font-size: 0.85rem;">${AppUtils.formatDate(c.date)}</td>
                <td><span class="badge badge-green">Resolved</span></td>
            `;
            completedBody.appendChild(tr);
        });
    }
}

// Ensure the function is globally accessible so inline onclick handlers can use it
window.markResolved = async function(complaintId) {
    if(!confirm("Are you sure this issue has been completely resolved?")) return;
    
    const db = await DataStore.load();
    const complaints = db.complaints || [];
    const index = complaints.findIndex(c => c.id === complaintId);
    
    if (index > -1) {
        complaints[index].status = 'Resolved';
        db.complaints = complaints;
        await DataStore.save(db);
        
        AppUtils.showAlert('Mission Successful! Task marked as resolved.', 'success');
        
        // Re-render the tables
        loadNgoDashboard(); 
    }
};
