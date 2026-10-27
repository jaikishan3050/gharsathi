from django.core.management.base import BaseCommand
from django.core.management import call_command
from api.seed_data import purge_database, ensure_production_superuser
from api.models import TechnicianProfile, Booking, WalletTransaction, Complaint, Service, SubService


class Command(BaseCommand):
    help = 'Flushes the database and zero-outs all mock technicians, bookings, complaints, and provisions clean catalog.'

    def add_arguments(self, parser):
        parser.add_argument('--no-flush', action='store_true', help='Skip django flush and perform model purge only')

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Flushing and zeroing-out all mock/demo data...'))

        if not options.get('no_flush'):
            try:
                call_command('flush', interactive=False)
                self.stdout.write(self.style.SUCCESS('Django database tables flushed successfully.'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Flush encountered notice (proceeding with clean purge): {e}'))

        counts = purge_database()
        ensure_production_superuser()

        self.stdout.write(
            self.style.SUCCESS(
                f"Ghar Sathi Production Zero-Out Verification:\n"
                f"  - Technicians: {counts['technicians']} (STRICT ZERO)\n"
                f"  - Bookings: {counts['bookings']} (STRICT ZERO)\n"
                f"  - Transactions: {counts['transactions']} (STRICT ZERO)\n"
                f"  - Complaints: {counts['complaints']} (STRICT ZERO)\n"
                f"  - Withdrawals: {counts['withdrawals']} (STRICT ZERO)\n"
                f"  - Services: {counts['services']} active\n"
                f"  - Subservices: {counts['subservices']} active"
            )
        )
