from django.db import migrations, models
from django.db.models.functions import Lower


class Migration(migrations.Migration):
    dependencies = [('api', '0015_booking_customer_identity')]

    operations = [
        migrations.AddConstraint(
            model_name='customerprofile',
            constraint=models.UniqueConstraint(
                Lower('email'),
                condition=~models.Q(email=''),
                name='unique_customer_email_ci_when_present',
            ),
        ),
    ]
