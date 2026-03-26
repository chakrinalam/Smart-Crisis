document.addEventListener('DOMContentLoaded', () => {
    // 1. Guard route
    const user = Auth.guard('authority');
    if (!user) return; // Wait for redirect

    // Display Name
    document.querySelectorAll('.username-display').forEach(el => {
        el.textContent = user.username;
    });

    // Sidebar interaction
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.id !== 'logoutBtn') {
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    });

    // 2. Load Core Data
    loadDashboardData();

    // 3. Setup Allocation Form submission
    setupAllocationForm();
});

// Main Dashboard loading function
async function loadDashboardData() {
    const db = await DataStore.load();
    const complaints = db.complaints || [];
    
    // Calculate global stats
    let active = 0, assigned = 0, resolved = 0;
    complaints.forEach(c => {
        if (c.status === 'Pending') active++;
        if (c.status === 'Assigned') assigned++;
        if (c.status === 'Resolved') resolved++;
    });

    // Risk Analysis classification
    const areas = ['Downtown', 'Northridge', 'Westwood', 'Eastside', 'Southpark'];
    const riskData = {};
    
    areas.forEach(a => {
        riskData[a] = { score: 0, pendingCount: 0 };
    });

    complaints.forEach(c => {
        if (c.status !== 'Resolved' && riskData[c.area]) {
            riskData[c.area].pendingCount++;
            
            if (c.severity === 'Low') riskData[c.area].score += 1;
            else if (c.severity === 'Medium') riskData[c.area].score += 3;
            else if (c.severity === 'High') riskData[c.area].score += 5;
        }
    });

    let highRiskCount = 0;
    const zonesContainer = document.getElementById('risk-zones-container');
    zonesContainer.innerHTML = '';

    Object.keys(riskData).forEach(area => {
        const data = riskData[area];
        let riskLevel = 'Green (Safe)';
        let zoneClass = 'zone-green';
        let icon = '✅';
        
        if (data.score >= 5) {
            riskLevel = 'Red (Critical)';
            zoneClass = 'zone-red';
            icon = '🚨';
            highRiskCount++;
        } else if (data.score >= 2) {
            riskLevel = 'Orange (Warning)';
            zoneClass = 'zone-orange';
            icon = '⚠️';
        }

        zonesContainer.innerHTML += `
            <div class="zone-card ${zoneClass}">
                <div class="flex justify-between align-center mb-4">
                    <h4 style="margin-bottom: 0; font-size: 1.25rem;">${area}</h4>
                    <span style="font-size: 1.5rem;">${icon}</span>
                </div>
                <div style="background: rgba(0,0,0,0.1); border-radius: 0.5rem; padding: 0.75rem;">
                    <p style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.25rem;">Status: ${riskLevel}</p>
                    <p style="font-size: 0.85rem;">Active Issues: ${data.pendingCount}</p>
                    <p style="font-size: 0.85rem;">Calculated Index: ${data.score}</p>
                </div>
            </div>
        `;
    });

    // Inject Stats
    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-high-risk').textContent = highRiskCount;
    document.getElementById('stat-assigned').textContent = assigned;
    document.getElementById('stat-resolved').textContent = resolved;

    // Populate the All Complaints Table
    populateTable(complaints);
}

function populateTable(complaints) {
    const tbody = document.getElementById('allComplaintsBody');
    const table = document.getElementById('allComplaintsTable');
    const noData = document.getElementById('noDataMsg');
    
    tbody.innerHTML = '';
    
    if (complaints.length === 0) {
        table.style.display = 'none';
        noData.style.display = 'block';
        return;
    }
    
    table.style.display = 'table';
    noData.style.display = 'none';

    const sortedComplaints = [...complaints].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedComplaints.forEach(c => {
        const tr = document.createElement('tr');
        
        let sevBadge = 'badge-green';
        if (c.severity === 'Medium') sevBadge = 'badge-orange';
        if (c.severity === 'High') sevBadge = 'badge-red';
        
        let statBadge = 'badge-orange';
        let actionCell = '';
        
        if (c.status === 'Resolved') {
            statBadge = 'badge-green';
            actionCell = `<span class="text-muted" style="font-size: 0.8rem;">Completed</span>`;
        } else if (c.status === 'Assigned') {
            statBadge = 'badge-blue';
            actionCell = `<div style="font-size: 0.8rem; background: var(--card-bg); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid var(--border-color); display: inline-block;">
                NGO: <strong>${c.assignedNgo}</strong>
            </div>`;
        } else {
            const safeArea = c.area.replace(/'/g, "\\'");
            actionCell = `<button class="btn btn-sm btn-primary" onclick="openModal('${c.id}', '${safeArea}')">Allocate NGO</button>`;
        }

        tr.innerHTML = `
            <td style="font-family: monospace; font-size: 0.85rem; color: var(--text-muted);">#${c.id.substring(1, 7).toUpperCase()}</td>
            <td style="font-weight: 500;">${c.area}</td>
            <td><span class="badge ${sevBadge}">${c.severity}</span></td>
            <td>@${c.citizenId}</td>
            <td style="font-size: 0.85rem;">${AppUtils.formatDate(c.date)}</td>
            <td><span class="badge ${statBadge}">${c.status}</span></td>
            <td>${actionCell}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Modal Logic
async function openModal(complaintId, area) {
    document.getElementById('alloc-complaint-id').value = complaintId;
    document.getElementById('modalDesc').textContent = `Allocating resource for ticket in: ${area}`;
    
    // Fetch users async
    const db = await DataStore.load();
    const users = db.users || [];
    const ngos = users.filter(u => u.role === 'ngo');
    
    const ngoSelect = document.getElementById('ngo-select');
    ngoSelect.innerHTML = '<option value="" disabled selected>Select an NGO / Partner</option>';
    
    ngos.forEach(ngo => {
        ngoSelect.innerHTML += `<option value="${ngo.username}">${ngo.username}</option>`;
    });
    
    if(ngos.length === 0) {
        ngoSelect.innerHTML = '<option value="" disabled>ERROR: No NGOs registered in system</option>';
    }

    document.getElementById('allocationModal').style.display = 'flex';
}
window.openModal = openModal;

window.closeModal = function() {
    document.getElementById('allocationModal').style.display = 'none';
    document.getElementById('allocationForm').reset();
}

// Allocation Execution
function setupAllocationForm() {
    document.getElementById('allocationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const complaintId = document.getElementById('alloc-complaint-id').value;
        const ngoAssigned = document.getElementById('ngo-select').value;
        const resourceAssigned = document.getElementById('resource-select').value;
        
        if(!ngoAssigned) {
            AppUtils.showAlert('Please select an NGO from the list', 'error'); 
            return;
        }

        const db = await DataStore.load();
        const complaints = db.complaints || [];
        const index = complaints.findIndex(c => c.id === complaintId);
        
        if (index > -1) {
            complaints[index].status = 'Assigned';
            complaints[index].assignedNgo = ngoAssigned;
            if (resourceAssigned !== 'None') {
                complaints[index].resource = resourceAssigned;
            }
            db.complaints = complaints;
            
            // Save to file via API
            await DataStore.save(db);
            
            AppUtils.showAlert(`Task allocated to ${ngoAssigned} successfully.`, 'success');
            closeModal();
            loadDashboardData(); 
        }
    });
}
