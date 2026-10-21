// Check karein ki user logged in hai ya nahi
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'login.html';
    }


document.getElementById("currentYear").textContent =
            new Date().getFullYear();

        document.getElementById("contactForm").addEventListener(
            "submit",
            function(event) {
                event.preventDefault();

                const phone = document.getElementById("phone").value.trim();
                const messageBox = document.getElementById("formMessage");

                if (!/^[6-9][0-9]{9}$/.test(phone)) {
                    messageBox.style.display = "block";
                    messageBox.textContent =
                        "Please enter a valid 10-digit Indian mobile number.";
                    return;
                }

                const name = document.getElementById("name").value.trim();
                const email = document.getElementById("email").value.trim();
                const subject = document.getElementById("subject").value;
                const city = document.getElementById("city").value;
                const message = document.getElementById("message").value.trim();

                const whatsappNumber = "919251115827"; // Replace with your actual WhatsApp number

                if (whatsappNumber.includes("X")) {
                    messageBox.style.display = "block";
                    messageBox.textContent =
                        "Form check ho gaya hai, lekin message send nahi hua. " +
                        "WhatsApp number set karein ya form ko backend se connect karein.";
                    return;
                }

                const whatsappMessage =
                    "Ghar Sathi Contact Enquiry\n\n" +
                    "Name: " + name + "\n" +
                    "Mobile: " + phone + "\n" +
                    "Email: " + (email || "Not provided") + "\n" +
                    "Reason: " + subject + "\n" +
                    "Location: " + city + "\n" +
                    "Message: " + message;

                const whatsappURL =
                    "https://wa.me/919251115827" + whatsappNumber +
                    "?text=" + encodeURIComponent(whatsappMessage);

                window.open(whatsappURL, "https://wa.me/919251115827");
            }
        );


// Keep profile photos synchronized across all GharSathi pages/tabs.
window.addEventListener('storage', function(event) {
  if (event.key === 'gharsathi_photo') window.location.reload();
});

