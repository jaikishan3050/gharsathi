from django.db import migrations


class Migration(migrations.Migration):
    """Join the independent technician-password and email-signup migration lines."""
    dependencies = [
        ('api', '0012_remove_default_technician_password'),
        ('api', '0016_unique_customer_email_ci'),
    ]

    operations = []
