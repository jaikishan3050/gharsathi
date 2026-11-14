from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0012_booking_happy_code_attempts'),
    ]

    operations = [
        migrations.AlterField(
            model_name='otpverification',
            name='otp_code',
            field=models.CharField(max_length=64),
        ),
    ]
