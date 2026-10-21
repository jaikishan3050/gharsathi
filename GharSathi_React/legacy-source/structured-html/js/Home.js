// Check if user is logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'index.html';
    }


// --- Profile Data Load, Initial & Image Logic ---
        document.addEventListener('DOMContentLoaded', () => {
            const userName = localStorage.getItem('userName') || localStorage.getItem('customerName') || localStorage.getItem('name') || 'Customer';
            const userPhone = localStorage.getItem('userPhone') || 'Not provided';
            const userEmail = localStorage.getItem('userEmail') || '';
            const savedAvatar = localStorage.getItem('gharsathi_photo') || localStorage.getItem('userAvatar') || localStorage.getItem('profilePhoto') || localStorage.getItem('profileImage');

            document.getElementById('profileName').innerText = userName;
            document.getElementById('profilePhone').innerText = userPhone;
            document.getElementById('profileEmail').innerText = userEmail;
            
            // Set Avatar image or initial letter
            const navContainer = document.getElementById('navAvatarContainer');
            const dropContainer = document.getElementById('dropAvatarContainer');

            if (savedAvatar) {
                navContainer.innerHTML = `<img src="${savedAvatar}" class="w-full h-full object-cover">`;
                dropContainer.innerHTML = `<img src="${savedAvatar}" class="w-full h-full object-cover">`;
            } else {
                const initial = userName.charAt(0).toUpperCase();
                document.getElementById('navUserInitial').innerText = initial;
                document.getElementById('dropUserInitial').innerText = initial;
            }

            const removePhotoBtn = document.getElementById('removeProfilePhotoBtn');
            if (removePhotoBtn) removePhotoBtn.classList.toggle('hidden', !savedAvatar);

            // Profile Dropdown Toggle
            const profileBtn = document.getElementById('profileBtn');
            const profileDropdown = document.getElementById('profileDropdown');

            profileBtn.addEventListener('click', function(event) {
                profileDropdown.classList.toggle('hidden');
                event.stopPropagation();
            });

            window.addEventListener('click', function(event) {
                if (!profileBtn.contains(event.target) && !profileDropdown.contains(event.target)) {
                    profileDropdown.classList.add('hidden');
                }
            });
        });

        // Update Profile Image Function
        function updateProfileImage(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const base64Image = e.target.result;
                    localStorage.setItem('gharsathi_photo', base64Image);
                    localStorage.setItem('userAvatar', base64Image);
                    localStorage.setItem('profilePhoto', base64Image);
                    localStorage.setItem('profileImage', base64Image);
                    
                    document.getElementById('navAvatarContainer').innerHTML = `<img src="${base64Image}" class="w-full h-full object-cover">`;
                    document.getElementById('dropAvatarContainer').innerHTML = `<img src="${base64Image}" class="w-full h-full object-cover">`;
                    const initial = (localStorage.getItem('userName') || localStorage.getItem('customerName') || localStorage.getItem('name') || 'Customer').trim().charAt(0).toUpperCase() || 'C';
                    document.getElementById('navUserInitial').innerText = initial;
                    document.getElementById('dropUserInitial').innerText = initial;
                    document.getElementById('removeProfilePhotoBtn').classList.remove('hidden');
                    alert("Profile photo updated successfully!");
                };
                reader.readAsDataURL(file);
            }
        }

        function removeProfilePhoto() {
            localStorage.removeItem('gharsathi_photo');
            localStorage.removeItem('userAvatar');
            localStorage.removeItem('profilePhoto');
            localStorage.removeItem('profileImage');
            const name = (localStorage.getItem('userName') || localStorage.getItem('customerName') || localStorage.getItem('name') || 'Customer').trim();
            const initial = (name.charAt(0) || 'C').toUpperCase();
            document.getElementById('navAvatarContainer').innerHTML = '<span id="navUserInitial"></span>';
            document.getElementById('dropAvatarContainer').innerHTML = '<span id="dropUserInitial"></span>';
            document.getElementById('navUserInitial').textContent = initial;
            document.getElementById('dropUserInitial').textContent = initial;
            document.getElementById('removeProfilePhotoBtn').classList.add('hidden');
            document.getElementById('profileImageInput').value = '';
        }

        // --- Logout Function ---
        function logoutUser() {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userName');
            localStorage.removeItem('userPhone');
            localStorage.removeItem('userEmail');
            window.location.href = 'index.html';
        }

        // --- Banner Scroll With Buttons ---
        function scrollBanner(direction) {
            const container = document.getElementById('banner-container');
            const scrollAmount = container.clientWidth;
            container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
        }

        // --- Banner Mouse Drag (Swipe) Logic ---
        const slider = document.getElementById('banner-container');
        let isDown = false;
        let startX;
        let scrollLeft;

        slider.addEventListener('mousedown', (e) => {
            isDown = true;
            slider.style.scrollBehavior = 'auto';
            slider.classList.add('cursor-grabbing');
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        });

        slider.addEventListener('mouseleave', () => {
            isDown = false;
            slider.classList.remove('cursor-grabbing');
            slider.style.scrollBehavior = 'smooth';
        });

        slider.addEventListener('mouseup', () => {
            isDown = false;
            slider.classList.remove('cursor-grabbing');
            slider.style.scrollBehavior = 'smooth';
        });

        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 2;
            slider.scrollLeft = scrollLeft - walk;
        });

        // --- Patna Area Automatic Fade Slider ---
        let patnaIndex = 0;
        function showPatnaSlides() {
            let slides = document.getElementsByClassName("patna-slides");
            for (let i = 0; i < slides.length; i++) {
                slides[i].style.display = "none";  
            }
            patnaIndex++;
            if (patnaIndex > slides.length) {patnaIndex = 1}    
            if(slides[patnaIndex-1]) {
                slides[patnaIndex-1].style.display = "block";  
            }
            setTimeout(showPatnaSlides, 3000); 
        }
        showPatnaSlides();


// Keep profile photos synchronized across all GharSathi pages/tabs.
window.addEventListener('storage', function(event) {
  if (event.key === 'gharsathi_photo') window.location.reload();
});

