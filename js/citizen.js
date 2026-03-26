document.addEventListener('DOMContentLoaded', () => {
    // 1. Guard route: redirect if not citizen or not logged in
    const user = Auth.guard('citizen');
    if (!user) return; // Wait for redirect

    // Update UI username
    document.querySelectorAll('.username-display').forEach(el => {
        el.textContent = user.username;
    });

    // 2. Initial Data Load
    renderComplaints(user.username);

    // Navigation Switcher (simple hash based or class based)
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.id !== 'logoutBtn') {
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    });

    // 3. Handle Form Submission
    const complaintForm = document.getElementById('complaintForm');
    if (complaintForm) {
        complaintForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const area = document.getElementById('area-select').value;
            const severity = document.getElementById('severity-select').value;
            const description = document.getElementById('desc-textarea').value.trim();

            if (!area || !severity || !description) {
                AppUtils.showAlert('Please fill out all required fields.', 'error');
                return;
            }

            // Create Complaint Object
            const newComplaint = {
                id: AppUtils.generateId(),
                citizenId: user.username,
                area: area,
                severity: severity,
                description: description,
                status: 'Pending', // Pending, Assigned, Resolved
                date: new Date().toISOString(),
                assignedNgo: null
            };

            // Save via asynchronous DataStore integration
            const db = await DataStore.load();
            if (!db.complaints) db.complaints = [];
            db.complaints.push(newComplaint);
            await DataStore.save(db);

            // Notify User & Reset Form
            AppUtils.showAlert('Complaint submitted successfully.', 'success');
            complaintForm.reset();
            
            // Re-render table
            await renderComplaints(user.username);
            
            // Highlight History tab
            document.querySelector("a[href='#history']").click();
            document.getElementById('history').scrollIntoView({ behavior: 'smooth' });
        });
    }
});

// 4. Render Complaints Table
async function renderComplaints(username) {
    const db = await DataStore.load();
    const allComplaints = db.complaints || [];
    
    // Filter out only this user's complaints
    const userComplaints = allComplaints.filter(c => c.citizenId === username);
    
    // Sort Date DESC
    userComplaints.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById('complaintsTableBody');
    const table = document.getElementById('complaintsTable');
    const noDataMsg = document.getElementById('noDataMsg');
    
    tbody.innerHTML = ''; // Clear existing
    
    if (userComplaints.length === 0) {
        table.style.display = 'none';
        noDataMsg.style.display = 'block';
    } else {
        table.style.display = 'table';
        noDataMsg.style.display = 'none';
        
        userComplaints.forEach(c => {
            const tr = document.createElement('tr');
            
            // Badges
            let sevBadge = 'badge-green';
            if (c.severity === 'Medium') sevBadge = 'badge-orange';
            if (c.severity === 'High') sevBadge = 'badge-red';
            
            let statBadge = 'badge-orange'; // Pending
            if (c.status === 'Resolved') statBadge = 'badge-green';
            if (c.status === 'Assigned') statBadge = 'badge-blue';

            // Data rows
            tr.innerHTML = `
                <td style="font-family: monospace; font-size: 0.85rem; color: var(--text-muted);">#${c.id.substring(1, 7).toUpperCase()}</td>
                <td>${AppUtils.formatDate(c.date)}</td>
                <td style="font-weight: 500;">${c.area}</td>
                <td><span class="badge ${sevBadge}">${c.severity}</span></td>
                <td><span class="badge ${statBadge}">${c.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
}
