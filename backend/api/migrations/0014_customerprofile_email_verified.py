from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0013_otpverification_code_length'),
    ]

    operations = [
        migrations.AddField(
            model_name='customerprofile',
            name='email_verified',
            field=models.BooleanField(default=False, editable=False),
        ),
    ]
