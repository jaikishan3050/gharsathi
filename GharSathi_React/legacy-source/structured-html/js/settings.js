document.addEventListener('DOMContentLoaded', () => {
            const name = localStorage.getItem('userName') || localStorage.getItem('customerName') || localStorage.getItem('name') || localStorage.getItem('gharsathi_username') || 'Customer';
            const phone = localStorage.getItem('userPhone') || localStorage.getItem('phone') || localStorage.getItem('gharsathi_phone') || '';
            const photo = localStorage.getItem('gharsathi_photo') || localStorage.getItem('userAvatar') || localStorage.getItem('profilePhoto') || localStorage.getItem('profileImage') || '';
            document.getElementById('profileName').textContent = name;
            document.getElementById('profilePhone').textContent = phone ? (phone.startsWith('+91') ? phone : '+91 ' + phone) : 'Phone number not provided';
            function renderPhoto(value) {
                const boxes = [document.getElementById('settingsProfilePic'), document.getElementById('settingsPhotoPreview')].filter(Boolean);
                boxes.forEach(box => {
                    box.innerHTML = '';
                    if (value) {
                        const img = document.createElement('img'); img.src = value; img.alt = 'Customer profile photo'; img.className = 'w-full h-full object-cover'; box.appendChild(img);
                    } else { box.textContent = (name.trim().charAt(0) || 'C').toUpperCase(); }
                });
                document.getElementById('settingsRemovePhoto').classList.toggle('hidden', !value);
            }
            renderPhoto(photo);
            document.getElementById('settingsPhotoInput').addEventListener('change', event => {
                const file = event.target.files && event.target.files[0]; if (!file) return;
                if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
                const reader = new FileReader();
                reader.onload = e => { ['gharsathi_photo','userAvatar','profilePhoto','profileImage'].forEach(k => localStorage.setItem(k, e.target.result)); renderPhoto(e.target.result); };
                reader.readAsDataURL(file);
            });
            document.getElementById('settingsRemovePhoto').addEventListener('click', () => {
                ['gharsathi_photo','userAvatar','profilePhoto','profileImage'].forEach(k => localStorage.removeItem(k));
                document.getElementById('settingsPhotoInput').value = ''; renderPhoto('');
            });
        });

        let currentLang = "English";
        function toggleLanguage() {
            currentLang = currentLang === "English" ? "English" : "English";
            const el = document.getElementById('langSubText'); if (el) el.innerText = currentLang;
            alert("Language preference set to English.");
        }

        function confirmLogout() {
            if (confirm("Are you sure you want to log out?")) {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('user');
                window.location.href = "index.html";
            }
        }


// Keep profile photos synchronized across all GharSathi pages/tabs.
window.addEventListener('storage', function(event) {
  if (event.key === 'gharsathi_photo') window.location.reload();
});

