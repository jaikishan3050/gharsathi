let temporaryPhotoBase64 = null;

        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('editName').value = localStorage.getItem('gharsathi_username') || "Rahul Kumar";
            document.getElementById('editPhone').value = localStorage.getItem('gharsathi_phone') || "9876543210";
            document.getElementById('editEmail').value = localStorage.getItem('gharsathi_email') || "";
            
            const savedPhoto = localStorage.getItem('gharsathi_photo');
            if (savedPhoto) {
                temporaryPhotoBase64 = savedPhoto;
                document.getElementById('profilePicPreview').innerHTML = `<img src="${savedPhoto}" class="w-full h-full object-cover">`;
            }
        });

        function previewPhoto(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    temporaryPhotoBase64 = e.target.result;
                    document.getElementById('profilePicPreview').innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
                };
                reader.readAsDataURL(file);
            }
        }

        function saveProfile(event) {
            event.preventDefault();
            const name = document.getElementById('editName').value;
            const phone = document.getElementById('editPhone').value;
            const email = document.getElementById('editEmail').value;

            // Save all details to localStorage so Home.html and Settings.html can reflect them
            localStorage.setItem('gharsathi_username', name);
            localStorage.setItem('gharsathi_phone', phone);
            localStorage.setItem('gharsathi_email', email);
            
            if (temporaryPhotoBase64) {
                localStorage.setItem('gharsathi_photo', temporaryPhotoBase64);
            }

            alert("Profile updated successfully!");
            window.location.href = "settings.html";
        }

