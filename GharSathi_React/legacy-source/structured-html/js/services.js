// Show customer's first initial until a profile photo is saved.
    (function initServicesProfile(){
      const name = localStorage.getItem('userName') || localStorage.getItem('customerName') || localStorage.getItem('name') || 'Customer';
      const phone = localStorage.getItem('userPhone') || localStorage.getItem('phone') || '';
      const photo = localStorage.getItem('gharsathi_photo') || localStorage.getItem('userAvatar') || localStorage.getItem('profilePhoto') || localStorage.getItem('profileImage') || '';
      const initial = (name.trim().charAt(0) || 'G').toUpperCase();
      const small = document.getElementById('servicesProfileAvatar');
      const large = document.getElementById('servicesProfileLargeAvatar');
      if (small) small.innerHTML = photo ? '<img alt="Customer profile photo" src="' + photo.replace(/"/g, '&quot;') + '">' : initial;
      if (large) large.innerHTML = photo ? '<img alt="Customer profile photo" src="' + photo.replace(/"/g, '&quot;') + '">' : initial;
      const nameEl = document.getElementById('profileName');
      const phoneEl = document.getElementById('profilePhone');
      if (nameEl) nameEl.textContent = name;
      if (phoneEl) phoneEl.textContent = phone || 'Manage your Ghar Sathi account';
      const removeBtn = document.getElementById('servicesRemovePhoto');
      if (removeBtn) removeBtn.classList.toggle('hidden', !photo);
    })();

    function renderServicesAvatar(photo) {
      const name = localStorage.getItem('userName') || localStorage.getItem('customerName') || localStorage.getItem('name') || 'Customer';
      const initial = (name.trim().charAt(0) || 'C').toUpperCase();
      ['servicesProfileAvatar','servicesProfileLargeAvatar'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        if (photo) {
          const img = document.createElement('img'); img.alt = 'Customer profile photo'; img.src = photo;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover'; el.appendChild(img);
        } else { el.textContent = initial; }
      });
      const removeBtn = document.getElementById('servicesRemovePhoto');
      if (removeBtn) removeBtn.classList.toggle('hidden', !photo);
    }
    function updateServicesProfileImage(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
      const reader = new FileReader();
      reader.onload = function(e) {
        ['gharsathi_photo','userAvatar','profilePhoto','profileImage'].forEach(k => localStorage.setItem(k, e.target.result));
        renderServicesAvatar(e.target.result);
      };
      reader.readAsDataURL(file);
    }
    function removeServicesProfileImage() {
      ['gharsathi_photo','userAvatar','profilePhoto','profileImage'].forEach(k => localStorage.removeItem(k));
      const input = document.getElementById('servicesProfileImageInput');
      if (input) input.value = '';
      renderServicesAvatar('');
    }

    function toggleProfileMenu() {
      const menu = document.getElementById('profileDropdown');
      const button = document.getElementById('profileMenuButton');
      const opening = menu.classList.contains('hidden');
      menu.classList.toggle('hidden');
      button.setAttribute('aria-expanded', String(opening));
    }

    document.addEventListener('click', function(event) {
      const menu = document.getElementById('profileDropdown');
      const button = document.getElementById('profileMenuButton');
      if (menu && button && !menu.contains(event.target) && !button.contains(event.target)) {
        menu.classList.add('hidden');
        button.setAttribute('aria-expanded', 'false');
      }
    });

    function logoutProfile() {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('user');
      window.location.href = 'index.html';
    }

    function openServiceDetail(serviceName) {
      window.location.href = 'services-detail.html?service=' + encodeURIComponent(serviceName);
    }

    // Banner Touch & Mouse Swipe Scroll Logic
    const slider = document.getElementById('bannerScroll');
    let isDown = false;
    let startX;
    let scrollLeft;

    if (slider) {
      slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.classList.add('cursor-grabbing');
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
      });

      slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.classList.remove('cursor-grabbing');
      });

      slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.classList.remove('cursor-grabbing');
      });

      slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2;
        slider.scrollLeft = scrollLeft - walk;
      });
    }


// Keep profile photos synchronized across all GharSathi pages/tabs.
window.addEventListener('storage', function(event) {
  if (event.key === 'gharsathi_photo') window.location.reload();
});

