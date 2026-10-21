// Check karein ki user logged in hai ya nahi
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'login.html';
    }


// Automatically update the copyright year
        document.getElementById("currentYear").textContent =
            new Date().getFullYear();

        // Demo form validation
        document.getElementById("feedbackForm").addEventListener(
            "submit",
            function (event) {
                event.preventDefault();

                const form = this;
                const message = document.getElementById("form-message");
                const mobile = document.getElementById("mobile").value.trim();

                if (!/^[6-9][0-9]{9}$/.test(mobile)) {
                    message.style.display = "block";
                    message.textContent =
                        "Please enter a valid 10-digit Indian mobile number.";
                    return;
                }

                message.style.display = "block";
                message.textContent =
                    "Form design sahi hai, lekin feedback abhi save nahi hua hai. " +
                    "Feedback ko actually save karne ke liye backend ya Google Forms integration chahiye.";

                // This demo does not send or store customer data.
            }
        );


// Keep profile photos synchronized across all GharSathi pages/tabs.
window.addEventListener('storage', function(event) {
  if (event.key === 'gharsathi_photo') window.location.reload();
});

