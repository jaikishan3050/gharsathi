from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0011_customerprofile_email_otpverification_email_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='happy_code_attempts',
            field=models.PositiveSmallIntegerField(default=0, editable=False),
        ),
    ]
