from django.core.management.base import BaseCommand, CommandError

from api.seed_data import ensure_production_superuser


class Command(BaseCommand):
    help = 'Create or rotate the administrator using ADMIN_BOOTSTRAP_* environment variables.'

    def handle(self, *args, **options):
        admin_user = ensure_production_superuser()
        if not admin_user:
            raise CommandError('Configure ADMIN_BOOTSTRAP_USERNAME, ADMIN_BOOTSTRAP_EMAIL, and ADMIN_BOOTSTRAP_PASSWORD before bootstrapping the admin.')
        self.stdout.write(self.style.SUCCESS('Administrator account configured from server environment.'))
