let allBookings = [];

        document.addEventListener('DOMContentLoaded', () => {
            allBookings = JSON.parse(localStorage.getItem('gharsathi_bookings_db')) || [];
            renderBookings(allBookings);
        });

        function renderBookings(bookingsToDisplay) {
            const container = document.getElementById('bookingsListContainer');
            container.innerHTML = "";

            if (!bookingsToDisplay || bookingsToDisplay.length === 0) {
                container.innerHTML = `
                    <div class="bg-white rounded-2xl p-8 text-center shadow-sm border mt-10">
                        <div class="text-4xl mb-3">📭</div>
                        <h3 class="font-bold text-lg text-gray-800">No Bookings Found</h3>
                        <p class="text-xs text-gray-500 mt-1">You haven't made any service bookings yet.</p>
                        <a href="services.html" class="inline-block mt-4 bg-[#0B3D2E] text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow hover:bg-green-800 transition">Book a Service Now</a>
                    </div>
                `;
                return;
            }

            bookingsToDisplay.forEach(b => {
                let badgeColor = "bg-green-100 text-[#0f5132]";
                if (b.status === "In Progress") badgeColor = "bg-blue-100 text-blue-700";
                if (b.status === "Upcoming") badgeColor = "bg-yellow-100 text-yellow-800";
                if (b.status === "Cancelled") badgeColor = "bg-red-100 text-red-700";

                let actionButtons = '';
                if (b.status === "Completed") {
                    actionButtons = `
                        <button class="bg-[#0f5132] text-white py-2 rounded-xl text-xs font-bold hover:bg-green-800 transition">👁️ View Details</button>
                        <button class="bg-[#D4AF37] text-white py-2 rounded-xl text-xs font-bold hover:bg-yellow-600 transition">📅 Book Again</button>
                        <button class="bg-white border border-gray-300 text-gray-700 py-2 rounded-xl text-xs font-bold hover:bg-gray-50 transition">⭐ Give Review</button>
                    `;
                } else if (b.status === "In Progress" || b.status === "Upcoming") {
                    actionButtons = `
                        <button class="bg-[#0f5132] text-white py-2.5 rounded-xl text-xs font-bold hover:bg-green-800 transition">👁️ View Details</button>
                        <button onclick="cancelBooking('${b.id}')" class="bg-white border border-red-500 text-red-600 py-2.5 rounded-xl text-xs font-bold hover:bg-red-50 transition">✕ Cancel Booking</button>
                    `;
                } else {
                    actionButtons = `
                        <button class="col-span-2 bg-gray-200 text-gray-600 py-2.5 rounded-xl text-xs font-bold">Booking Cancelled</button>
                    `;
                }

                let card = document.createElement('div');
                card.className = "bg-white rounded-2xl p-4 shadow-sm border border-gray-200";
                card.innerHTML = `
                    <div class="flex justify-between items-center mb-3 border-b pb-2">
                        <div>
                            <span class="text-xs font-bold text-gray-500">Booking ID:</span>
                            <span class="text-xs font-bold text-gray-900">${b.id}</span>
                        </div>
                        <span class="px-3 py-1 ${badgeColor} text-xs font-bold rounded-full">${b.status}</span>
                    </div>

                    <div class="flex items-center gap-3 text-xs text-gray-500 mb-3">
                        <span>📅 ${b.date}</span>
                        <span>📍 ${b.location}</span>
                    </div>

                    <div class="flex gap-4 items-center mb-4">
                        <img src="${b.image}" alt="Service" class="w-24 h-24 rounded-xl object-cover border">
                        <div>
                            <h3 class="font-bold text-gray-900 text-base">${b.service}</h3>
                            <p class="text-lg font-extrabold text-gray-900 mt-1">₹${b.price}</p>
                            <p class="text-xs text-gray-600 mt-1">👤 Technician: ${b.technician}</p>
                            <p class="text-xs text-gray-600">📞 Contact: ${b.contact}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-${b.status === "Completed" ? '3' : '2'} gap-2 pt-2 border-t">
                        ${actionButtons}
                    </div>
                `;
                container.appendChild(card);
            });
        }

        function filterBookings(status, btnElement) {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.className = "tab-btn px-5 py-2 rounded-full bg-white text-gray-700 font-semibold text-sm shadow-sm border whitespace-nowrap hover:bg-gray-50";
            });
            btnElement.className = "tab-btn px-5 py-2 rounded-full bg-[#D4AF37] text-white font-bold text-sm shadow whitespace-nowrap";

            if (status === 'All') {
                renderBookings(allBookings);
            } else {
                let filtered = allBookings.filter(b => b.status === status);
                renderBookings(filtered);
            }
        }

        function cancelBooking(bookingId) {
            if (confirm("Are you sure you want to cancel this booking?")) {
                allBookings = allBookings.map(b => {
                    if (b.id === bookingId) { b.status = "Cancelled"; }
                    return b;
                });
                localStorage.setItem('gharsathi_bookings_db', JSON.stringify(allBookings));
                renderBookings(allBookings);
                alert("Booking cancelled successfully.");
            }
        }


// Keep profile photos synchronized across all GharSathi pages/tabs.
window.addEventListener('storage', function(event) {
  if (event.key === 'gharsathi_photo') window.location.reload();
});

