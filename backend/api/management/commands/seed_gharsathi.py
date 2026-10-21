from django.core.management.base import BaseCommand
from api.seed_data import seed_database


class Command(BaseCommand):
    help = 'Seeds the Ghar Sathi database with official services, technicians, bookings, and complaints'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Seeding Ghar Sathi database...'))
        counts = seed_database()
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded Ghar Sathi database:\n"
                f"  - {counts['services']} Services\n"
                f"  - {counts['technicians']} Technicians\n"
                f"  - {counts['bookings']} Bookings\n"
                f"  - {counts['transactions']} Wallet Transactions\n"
                f"  - {counts['complaints']} Complaints\n"
                f"  - {counts.get('withdrawals', 0)} Admin Withdrawals"
            )
        )
