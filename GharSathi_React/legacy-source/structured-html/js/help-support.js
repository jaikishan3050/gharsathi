function submitComplaint(event) {
            event.preventDefault();
            alert("Your complaint has been successfully registered. Our support team will contact you soon.");
            document.getElementById('complaintContact').value = "";
            document.getElementById('complaintDesc').value = "";
        }


// Keep profile photos synchronized across all GharSathi pages/tabs.
window.addEventListener('storage', function(event) {
  if (event.key === 'gharsathi_photo') window.location.reload();
});

