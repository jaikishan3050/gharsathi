from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0011_customerprofile_email_otpverification_email_and_more')]
    operations = [migrations.AlterField(
        model_name='technicianprofile', name='password',
        field=models.CharField(default='', max_length=128),
    )]
