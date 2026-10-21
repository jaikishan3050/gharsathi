// Check karein ki user logged in hai ya nahi
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'login.html';
    }


document.getElementById("year").textContent =
    new Date().getFullYear();

document.getElementById("complaintForm").addEventListener(
    "submit", function(event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const bookingId = document.getElementById("bookingId").value.trim();
        const location = document.getElementById("location").value;
        const service = document.getElementById("service").value;
        const category = document.getElementById("category").value;
        const details = document.getElementById("details").value.trim();

        if (!/^[6-9][0-9]{9}$/.test(phone)) {
            alert("Please enter a valid 10-digit Indian mobile number.");
            return;
        }

        /*
          Add WhatsApp integration here if required.
          This form currently validates the fields but does not
          send or save complaints automatically.
        */

        alert(
            "Your complaint form is complete, but it has not been sent or saved yet. Please connect a submission method before publishing."
        );
    }
);


// Keep profile photos synchronized across all GharSathi pages/tabs.
window.addEventListener('storage', function(event) {
  if (event.key === 'gharsathi_photo') window.location.reload();
});

