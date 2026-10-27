from django.core.management.base import BaseCommand
from api.seed_data import purge_database


class Command(BaseCommand):
    help = 'Purges all demo/seeded bookings, mock technicians, and dummy complaints.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Purging all demo and mock data from Ghar Sathi database...'))
        counts = purge_database()
        
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully purged Ghar Sathi demo dataset:\n"
                f"  - Services: {counts['services']} active\n"
                f"  - Subservices: {counts.get('subservices', 0)} active\n"
                f"  - Technicians: {counts['technicians']} (0 dummy partners)\n"
                f"  - Bookings: {counts['bookings']} (0 mock bookings)\n"
                f"  - Complaints: {counts['complaints']} (0 mock complaints)\n"
                f"  - Transactions: {counts['transactions']} (0 mock ledger entries)\n"
                f"  - Withdrawals: {counts['withdrawals']} (0 mock withdrawals)"
            )
        )
