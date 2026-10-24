from django.core.management.base import BaseCommand
from django.contrib.auth import authenticate
from api.seed_data import purge_database


class Command(BaseCommand):
    help = 'Purges all demo/seeded bookings, mock technicians, dummy complaints, and provisions production superuser.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Purging all demo and mock data from Ghar Sathi database...'))
        counts = purge_database()
        
        # Verify production credentials
        auth_prabhat = authenticate(username='prabhat', password='Gharsathi@2026')
        auth_email = authenticate(username='prabhat@gharsathi.in', password='Gharsathi@2026')

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully purged Ghar Sathi demo dataset:\n"
                f"  - Services: {counts['services']} active\n"
                f"  - Subservices: {counts.get('subservices', 0)} active\n"
                f"  - Technicians: {counts['technicians']} (0 dummy partners)\n"
                f"  - Bookings: {counts['bookings']} (0 mock bookings)\n"
                f"  - Complaints: {counts['complaints']} (0 mock complaints)\n"
                f"  - Transactions: {counts['transactions']} (0 mock ledger entries)\n"
                f"  - Withdrawals: {counts['withdrawals']} (0 mock withdrawals)\n"
                f"  - Superuser 'prabhat': {'Verified OK' if auth_prabhat else 'Failed'}\n"
                f"  - Superuser 'prabhat@gharsathi.in': {'Verified OK' if auth_email else 'Failed'}"
            )
        )
